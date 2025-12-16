#!/usr/bin/env bun
import path from "path";
import { slugFromUrl, extractMediaUrls, computeSha256 } from "./utils";

const args = process.argv.slice(2);
function getArg(name: string) {
    const idx = args.indexOf(name);
    if (idx >= 0 && args[idx + 1]) return args[idx + 1];
    return undefined;
}

function showHelp() {
    console.log(`Usage: bun ./scraper/index.ts --url <URL> [options]

Options:
    --url, -u <URL>              The URL to scrape (required unless using other modes)
    --name, -n <name>            Output folder base name (default: scrape-<ts> or slug-timestamp when configured)
    --download-media <csv|none>  Override config ` + "downloadMedia" + ` (comma-separated list or 'none')
    --max-download-bytes <num>   Override config ` + "maxDownloadBytes" + ` (per-file limit in bytes)
    --help, -h                   Show this help message

Config: the scraper loads ` + "scraper/config.json" + ` (fallback to config.example.json). See README for details.

Behavior: by default media are cataloged in the manifest without downloading. Use ` + "--download-media" + ` to enable downloads for specific media classes.
`);
}

const url = getArg("--url") || getArg("-u");
const name = getArg("--name") || getArg("-n") || `scrape-${Date.now()}`;

if (args.includes("--help") || args.includes("-h")) {
    showHelp();
    process.exit(0);
}

if (!url) {
    console.log("Missing required --url. Run --help for usage.");
    process.exit(1);
}

// output root can be overridden with --output or -o (defaults to ./output)
const outputFlag = getArg("--output") || getArg("-o");
const outputRoot = outputFlag ? path.resolve(outputFlag) : path.join(process.cwd(), "output");
const outDir = path.join(outputRoot, name);
const start = Date.now();

async function ensureDir(dir: string) {
    if (typeof (globalThis as any).Bun !== "undefined") {
        try {
            const Bun = (globalThis as any).Bun;
            if (typeof Bun.mkdir === "function") {
                await Bun.mkdir(dir, { recursive: true });
                return;
            }
        } catch { }
    }

    if (typeof (globalThis as any).Deno !== "undefined") {
        await (globalThis as any).Deno.mkdir(dir, { recursive: true });
        return;
    }

    const { mkdir } = await import("node:fs/promises");
    await mkdir(dir, { recursive: true });
}

async function writeText(filePath: string, text: string) {
    if (typeof (globalThis as any).Bun !== "undefined") {
        try {
            const Bun = (globalThis as any).Bun;
            if (typeof Bun.write === "function") {
                await Bun.write(filePath, text);
                return;
            }
        } catch { }
    }

    if (typeof (globalThis as any).Deno !== "undefined") {
        await (globalThis as any).Deno.writeTextFile(filePath, text);
        return;
    }

    const { writeFile } = await import("node:fs/promises");
    await writeFile(filePath, text, "utf8");
}

await ensureDir(outDir);

async function readText(filePath: string) {
    if (typeof (globalThis as any).Bun !== "undefined") {
        try {
            const Bun = (globalThis as any).Bun;
            if (typeof Bun.file === "function") {
                const f = Bun.file(filePath);
                return await f.text();
            }
        } catch { }
    }

    if (typeof (globalThis as any).Deno !== "undefined") {
        return await (globalThis as any).Deno.readTextFile(filePath);
    }

    const { readFile } = await import("node:fs/promises");
    return (await readFile(filePath, "utf8")).toString();
}

async function writeBinary(filePath: string, data: Uint8Array) {
    if (typeof (globalThis as any).Bun !== "undefined") {
        try {
            const Bun = (globalThis as any).Bun;
            if (typeof Bun.write === "function") {
                await Bun.write(filePath, data);
                return;
            }
        } catch { }
    }

    if (typeof (globalThis as any).Deno !== "undefined") {
        await (globalThis as any).Deno.writeFile(filePath, data);
        return;
    }

    const { writeFile } = await import("node:fs/promises");
    await writeFile(filePath, Buffer.from(data));
}



function resolveUrl(base: string, relative: string) {
    try {
        return new URL(relative, base).toString();
    } catch {
        return relative;
    }
}

// media extraction moved to `scraper/utils.ts` and imported at top

async function fetchBinary(urlStr: string) {
    const res = await fetch(urlStr);
    const contentType = res.headers.get('content-type') || '';
    const arr = new Uint8Array(await res.arrayBuffer());
    return { data: arr, contentType, size: arr.byteLength };
}


async function loadConfig() {
    const cfgPath = path.join(process.cwd(), "scraper", "config.json");
    const example = path.join(process.cwd(), "scraper", "config.example.json");
    try {
        const raw = await readText(cfgPath);
        return JSON.parse(raw);
    } catch {
        try {
            const raw = await readText(example);
            return JSON.parse(raw);
        } catch {
            return {};
        }
    }
}

const config = await loadConfig();
const folderNaming = config.folderNaming || "slug-timestamp";
const oversizeThreshold = Number(config.oversizedThresholdBytes ?? 26214400);
const downloadMediaCfg: string[] = Array.isArray(config.downloadMedia) ? config.downloadMedia : (config.downloadMedia ? [config.downloadMedia] : []);
const maxDownloadBytesCfg: number = Number(config.maxDownloadBytes ?? 5242880);

// CLI overrides
const downloadMediaFlag = getArg("--download-media"); // comma-separated or 'none'
const maxDownloadFlag = getArg("--max-download-bytes");
const downloadMedia: string[] = downloadMediaFlag ? (downloadMediaFlag === 'none' ? [] : downloadMediaFlag.split(',').map(s => s.trim())) : downloadMediaCfg;
const maxDownloadBytes = maxDownloadFlag ? Number(maxDownloadFlag) : maxDownloadBytesCfg;

const filesCreated: string[] = [];
try {
    const res = await fetch(url);
    const contentType = res.headers.get("content-type") || "text/html";
    const text = await res.text();
    console.log("[cli] fetched main url", url, "content-type", contentType);

    // name / outDir resolution according to config

    let finalOutDir = outDir;
    if (folderNaming === "slug-timestamp") {
        const slug = slugFromUrl(url);
        finalOutDir = path.join(process.cwd(), "output", `${slug}-${Date.now()}`);
        await ensureDir(finalOutDir);
    }

    const indexPath = path.join(finalOutDir, "index.html");
    await writeText(indexPath, text);
    filesCreated.push("index.html");

    // Find media URLs and download them according to config
    const mediaUrls = extractMediaUrls(text).map(u => resolveUrl(url, u));
    const mediaDir = path.join(finalOutDir, "media");
    await ensureDir(mediaDir);
    const manifest: any = { source: url, fetchedAt: new Date().toISOString(), files: [] };
    const oversized: any[] = [];
    function extFromUrl(u: string) {
        try { return (new URL(u)).pathname.split('.').pop()?.toLowerCase() || ''; } catch { return '' }
    }
    function mediaTypeFromExt(ext: string) {
        if (!ext) return 'other';
        if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'tiff', 'ico'].includes(ext)) return 'images';
        if (['mp4', 'webm', 'mov', 'mkv', 'ogg', 'ogv'].includes(ext)) return 'video';
        if (['mp3', 'wav', 'm4a', 'aac', 'flac'].includes(ext)) return 'audio';
        if (['woff', 'woff2', 'ttf', 'otf', 'eot'].includes(ext)) return 'fonts';
        if (['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext)) return 'documents';
        if (['css', 'js', 'map', 'json', 'xml', 'txt', 'html', 'htm'].includes(ext)) return 'text';
        return 'other';
    }
    // Build a global index of existing sha256 -> relative path to allow dedupe across scrapes
    async function buildGlobalIndex() {
        const map = new Map<string, string>();
        try {
            const outRoot = path.join(process.cwd(), "output");
            const { readdir, readFile } = await import("node:fs/promises");
            const items: any[] = await readdir(outRoot, { withFileTypes: true } as any);
            for (const it of items) {
                try {
                    if (!it || !it.name) continue;
                    const manifestPath = path.join(outRoot, it.name, "manifest.json");
                    const raw = await readFile(manifestPath, "utf8");
                    const m = JSON.parse(raw);
                    if (Array.isArray(m.files)) {
                        for (const f of m.files) {
                            if (f.sha256 && f.path) {
                                const abs = path.join(outRoot, it.name, f.path);
                                map.set(f.sha256, path.relative(finalOutDir, abs));
                            }
                        }
                    }
                } catch { }
            }
        } catch { }
        return map;
    }

    const globalIndex = await buildGlobalIndex();
    let idx = 0;
    for (const murl of mediaUrls) {
        console.log('[cli] media candidate', murl);
        idx++;
        try {
            // classify by extension/type and decide whether to download
            const ext = extFromUrl(murl);
            const mtype = mediaTypeFromExt(ext);
            const shouldDownloadMedia = mtype === 'text' || (mtype === 'other' && ext === '') || downloadMedia.includes(mtype);
            // If extension explicitly ignored in config, don't download
            if (Array.isArray(config.ignoreFileExtensions) && config.ignoreFileExtensions.map((s: any) => String(s).toLowerCase()).includes(ext)) {
                // record as not-downloaded
                manifest.files.push({ path: null, url: murl, mime: null, sha256: null, size: null, downloaded: false });
                continue;
            }

            // Attempt HEAD to check size
            let headSize: number | null = null;
            try {
                const h = await fetch(murl, { method: 'HEAD' });
                const cl = h.headers.get('content-length');
                if (cl) headSize = Number(cl);
            } catch { }
            // Per-file limit: use `maxDownloadBytes` if set (>0), otherwise fall back to `oversizeThreshold`
            const limit = (maxDownloadBytes > 0 ? maxDownloadBytes : oversizeThreshold);
            if (headSize !== null && headSize > limit) {
                oversized.push({ url: murl, size: headSize });
                manifest.files.push({ path: null, url: murl, mime: null, sha256: null, size: headSize, downloaded: false });
                continue;
            }

            if (!shouldDownloadMedia) {
                // Do not download; include manifest entry derived from data
                manifest.files.push({ path: null, url: murl, mime: null, sha256: null, size: headSize, downloaded: false, inferredType: mtype });
                continue;
            }

            const { data, contentType, size } = await fetchBinary(murl);
            if (size > limit) {
                oversized.push({ url: murl, size });
                manifest.files.push({ path: null, url: murl, mime: contentType, sha256: null, size, downloaded: false });
                continue;
            }

            const filename = (new URL(murl)).pathname.split('/').pop() || `file-${idx}`;
            const safeName = `${idx}-${filename.replace(/[\\/:*?"<>|]/g, '-')}`;
            const mediaPath = path.join(mediaDir, safeName);
            await writeBinary(mediaPath, data);

            const sha = await computeSha256(data);

            // Deduplicate: if sha exists in other scrapes, reference existing file instead of keeping duplicate
            if (globalIndex.has(sha)) {
                const existingRel = globalIndex.get(sha)!;
                try {
                    if (typeof (globalThis as any).Bun !== "undefined") {
                        try { (globalThis as any).Bun.rm(mediaPath); } catch { }
                    } else if (typeof (globalThis as any).Deno !== "undefined") {
                        try { await (globalThis as any).Deno.remove(mediaPath); } catch { }
                    } else {
                        const { unlink } = await import("node:fs/promises");
                        try { await unlink(mediaPath); } catch { }
                    }
                } catch { }

                const entry = { path: existingRel, url: murl, mime: contentType, sha256: sha, size };
                manifest.files.push(entry);
                filesCreated.push(existingRel);
            } else {
                const entry = { path: path.relative(finalOutDir, mediaPath), url: murl, mime: contentType, sha256: sha, size };
                manifest.files.push(entry);
                filesCreated.push(path.join('media', safeName));
                globalIndex.set(sha, path.relative(finalOutDir, mediaPath));
            }
        } catch (err) {
            // skip individual media errors
            console.error('media fetch error', murl, err);
        }
    }

    // write metadata / manifest / oversized
    await writeText(path.join(finalOutDir, "metadata.json"), JSON.stringify({ source: url, fetchedAt: new Date().toISOString(), contentType }, null, 2));
    filesCreated.push("metadata.json");

    await writeText(path.join(finalOutDir, "manifest.json"), JSON.stringify(manifest, null, 2));
    filesCreated.push("manifest.json");

    if (oversized.length) {
        await writeText(path.join(finalOutDir, "oversized_content.json"), JSON.stringify(oversized, null, 2));
        filesCreated.push("oversized_content.json");
    }

    const summary = [
        `Source: ${url}`,
        `Runtime: ${(Date.now() - start) / 1000}s`,
        `Files:`,
        ...filesCreated.map((f) => ` - ${f}`),
    ].join("\n");

    await writeText(path.join(finalOutDir, "summary.scrape"), summary);
    console.log("Scrape complete. Output:", finalOutDir);
} catch (e) {
    const summary = `Source: ${url}\nError: ${String(e)}\nRuntime: ${(Date.now() - start) / 1000}s\n`;
    try {
        await writeText(path.join(outDir, "summary.scrape"), summary);
    } catch { }
    console.error("Scrape failed:", e);
    process.exit(2);
}
