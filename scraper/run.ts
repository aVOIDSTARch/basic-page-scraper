import path from "path";
import { slugFromUrl, extractMediaUrls, computeSha256 } from "./utils";

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

async function fetchBinary(urlStr: string) {
    const res = await fetch(urlStr);
    const contentType = res.headers.get('content-type') || '';
    const arr = new Uint8Array(await res.arrayBuffer());
    return { data: arr, contentType, size: arr.byteLength };
}

export async function runScrape(opts: { url: string; name?: string; config?: any; outputRoot?: string }) {
    const url = opts.url;
    const name = opts.name || `scrape-${Date.now()}`;
    const config = opts.config || {};
    const outputRoot = opts.outputRoot ? path.resolve(opts.outputRoot) : path.join(process.cwd(), "output");

    const outDir = path.join(outputRoot, name);
    await ensureDir(outDir);

    const folderNaming = config.folderNaming || "slug-timestamp";
    const oversizeThreshold = Number(config.oversizedThresholdBytes ?? 26214400);

    const filesCreated: string[] = [];
    const res = await fetch(url);
    const contentType = res.headers.get("content-type") || "text/html";
    const text = await res.text();

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
    const mediaUrls = extractMediaUrls(text).map(u => (new URL(u, url).toString()));
    const mediaDir = path.join(finalOutDir, "media");
    await ensureDir(mediaDir);
    const manifest: any = { source: url, fetchedAt: new Date().toISOString(), files: [] };
    const oversized: any[] = [];

    // Build a global index of existing sha256 -> relative path to allow dedupe across scrapes
    async function buildGlobalIndex() {
        const map = new Map<string, string>();
        try {
            const outRoot = path.join(process.cwd(), "output");
            const { readdir, readFile } = await import("node:fs/promises");
            // readdir may return string[] or Dirent[] depending on runtime/options; treat as any[]
            const items: any[] = await readdir(outRoot, { withFileTypes: true } as any);
            for (const it of items) {
                // determine the directory name regardless of returned shape
                const name = typeof it === "string" ? it : it.name;
                if (!name) continue;
                // if the item is a Dirent-like object, skip non-directories
                if (typeof it !== "string" && typeof it.isDirectory === "function" && !it.isDirectory()) continue;
                const manifestPath = path.join(outRoot, name, "manifest.json");
                try {
                    const raw = await readFile(manifestPath, "utf8");
                    const m = JSON.parse(raw);
                    if (Array.isArray(m.files)) {
                        for (const f of m.files) {
                            if (f.sha256 && f.path) {
                                const abs = path.join(outRoot, name, f.path);
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

    // config-based download controls
    const downloadMediaCfg: string[] = Array.isArray(config.downloadMedia) ? config.downloadMedia : (config.downloadMedia ? [config.downloadMedia] : []);
    const maxDownloadBytesCfg: number = Number(config.maxDownloadBytes ?? 5242880);

    function extFromUrl(u: string) { try { return (new URL(u)).pathname.split('.').pop()?.toLowerCase() || ''; } catch { return '' } }
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

    let idx = 0;
    for (const murl of mediaUrls) {
        idx++;
        try {
            const ext = extFromUrl(murl);
            const mtype = mediaTypeFromExt(ext);
            const shouldDownloadMedia = mtype === 'text' || (mtype === 'other' && ext === '') || downloadMediaCfg.includes(mtype);

            if (Array.isArray(config.ignoreFileExtensions) && config.ignoreFileExtensions.map((s: any) => String(s).toLowerCase()).includes(ext)) {
                manifest.files.push({ path: null, url: murl, mime: null, sha256: null, size: null, downloaded: false });
                continue;
            }

            let headSize: number | null = null;
            try {
                const h = await fetch(murl, { method: 'HEAD' });
                const cl = h.headers.get('content-length');
                if (cl) headSize = Number(cl);
            } catch { }

            const limit = (maxDownloadBytesCfg > 0 ? maxDownloadBytesCfg : oversizeThreshold);
            if (headSize !== null && headSize > limit) {
                oversized.push({ url: murl, size: headSize });
                manifest.files.push({ path: null, url: murl, mime: null, sha256: null, size: headSize, downloaded: false });
                continue;
            }

            if (!shouldDownloadMedia) {
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

            if (globalIndex.has(sha)) {
                const existingRel = globalIndex.get(sha)!;
                try {
                    const { unlink } = await import("node:fs/promises");
                    await unlink(mediaPath).catch(() => { });
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
        `Runtime: ${(Date.now() - Date.now()) / 1000}s`,
        `Files:`,
        ...filesCreated.map((f) => ` - ${f}`),
    ].join("\n");

    await writeText(path.join(finalOutDir, "summary.scrape"), summary);
    return { out: finalOutDir, files: filesCreated, manifest };
}
