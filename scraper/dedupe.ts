import path from "path";

// Build a global index of existing sha256 -> relative path to allow dedupe across scrapes
export async function buildGlobalIndex() {
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
                            map.set(f.sha256, path.relative(process.cwd(), abs)); // Storing relative to cwd temporarily or we need finalOutDir passed in?
                            // Wait, the original logic stored path relative to finalOutDir?
                            // No, `map.set(f.sha256, path.relative(finalOutDir, abs));` in original code.
                            // But `finalOutDir` changes per scrape.
                            // If we want to reuse files from OTHER scrapes, we need a stable reference.
                            // The original code calculated relative path from THE CURRENT scrape's directory to the EXISTING file.
                            // So we need to pass `finalOutDir` to this function if we want to mimic exact behavior, 
                            // OR we return absolute paths and let the caller calc relative paths.
                            // Returning absolute paths is safer/cleaner.
                            map.set(f.sha256, abs);
                        }
                    }
                }
            } catch { }
        }
    } catch { }
    return map;
}
