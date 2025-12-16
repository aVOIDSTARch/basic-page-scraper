import path from "path";
import { slugFromUrl, extractMediaUrls, computeSha256 } from "./utils";
import { ensureDir, writeText, writeBinary, readText } from "./fs-helpers";
import { fetchBinary, extFromUrl, mediaTypeFromExt } from "./media-utils";
import { buildGlobalIndex } from "./dedupe";


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
    // Build a global index of existing sha256 -> absolute path to allow dedupe across scrapes
    const globalIndex = await buildGlobalIndex();


    // config-based download controls
    const downloadMediaCfg: string[] = Array.isArray(config.downloadMedia) ? config.downloadMedia : (config.downloadMedia ? [config.downloadMedia] : []);
    const maxDownloadBytesCfg: number = Number(config.maxDownloadBytes ?? 5242880);


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
                const existingAbs = globalIndex.get(sha)!;
                const existingRel = path.relative(finalOutDir, existingAbs);
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
