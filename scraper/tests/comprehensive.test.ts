import { describe, test, expect, beforeAll, afterAll, spyOn, mock } from "bun:test";
import path from "path";
import fs from "fs";
import { runScrape } from "../run";
import { extFromUrl, mediaTypeFromExt, fetchBinary } from "../media-utils";
import { ensureDir, writeText, readText, writeBinary } from "../fs-helpers";
import { buildGlobalIndex } from "../dedupe";

describe("Media Utils", () => {
    test("extFromUrl correctly extracts extensions", () => {
        expect(extFromUrl("https://example.com/image.png")).toBe("png");
        expect(extFromUrl("https://example.com/file.JSON")).toBe("json");
        expect(extFromUrl("https://example.com/no-ext")).toBe("");
        expect(extFromUrl("https://example.com/path/to.file.tar.gz")).toBe("gz");
        expect(extFromUrl("invalid-url")).toBe("");
    });

    test("mediaTypeFromExt classifies correctly", () => {
        expect(mediaTypeFromExt("png")).toBe("images");
        expect(mediaTypeFromExt("mp4")).toBe("video");
        expect(mediaTypeFromExt("mp3")).toBe("audio");
        expect(mediaTypeFromExt("ttf")).toBe("fonts");
        expect(mediaTypeFromExt("pdf")).toBe("documents");
        expect(mediaTypeFromExt("css")).toBe("text");
        expect(mediaTypeFromExt("unknown")).toBe("other");
        expect(mediaTypeFromExt("")).toBe("other");
    });
});

describe("FS Helpers", () => {
    const testDir = path.join(process.cwd(), "fs-test-temp");

    afterAll(() => {
        try { fs.rmSync(testDir, { recursive: true, force: true }); } catch { }
    });

    test("ensureDir creates directory", async () => {
        await ensureDir(testDir);
        expect(fs.existsSync(testDir)).toBe(true);
    });

    test("writeText and readText work", async () => {
        const file = path.join(testDir, "test.txt");
        await writeText(file, "hello world");
        expect(fs.existsSync(file)).toBe(true);
        const content = await readText(file);
        expect(content).toBe("hello world");
    });

    test("writeBinary works", async () => {
        const file = path.join(testDir, "test.bin");
        const data = new Uint8Array([1, 2, 3]);
        await writeBinary(file, data);
        expect(fs.existsSync(file)).toBe(true);
        const readData = fs.readFileSync(file);
        expect(new Uint8Array(readData)).toEqual(data);
    });
});

describe("Scraper Logic (runScrape)", () => {
    // Mock fetch globally
    const originalFetch = globalThis.fetch;
    const testOutRoot = path.join(process.cwd(), "test-output-comprehensive");

    beforeAll(() => {
        globalThis.fetch = mock(async (url: string | Request | URL) => {
            const u = url.toString();
            if (u.includes("example.com")) {
                return new Response(`
                    <html>
                        <body>
                            <img src="img.png" />
                            <a href="doc.pdf">Doc</a>
                            <video src="video.mp4" />
                            <img src="huge.jpg" />
                        </body>
                    </html>
                `, { headers: { "content-type": "text/html" } });
            }
            if (u.endsWith("img.png")) {
                return new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "image/png" } });
            }
            if (u.endsWith("doc.pdf")) {
                return new Response(new Uint8Array([4, 5, 6]), { headers: { "content-type": "application/pdf" } });
            }
            if (u.endsWith("video.mp4")) {
                return new Response(new Uint8Array([7, 8, 9]), { headers: { "content-type": "video/mp4" } });
            }
            if (u.endsWith("huge.jpg")) {
                // Mock a huge file via HEAD and GET
                const hugeSize = 10 * 1024 * 1024; // 10MB
                return new Response(new Uint8Array(10), {
                    headers: { "content-type": "image/jpeg", "content-length": hugeSize.toString() }
                });
            }
            return new Response("404", { status: 404 });
        }) as any;
    });

    afterAll(() => {
        globalThis.fetch = originalFetch;
        try { fs.rmSync(testOutRoot, { recursive: true, force: true }); } catch { }
    });

    test("scrapes page and identifies media", async () => {
        const result = await runScrape({
            url: "https://example.com/index.html",
            name: "basic-scrape",
            outputRoot: testOutRoot,
            config: {
                downloadMedia: ["images"],
                maxDownloadBytes: 1000 // Small limit to test oversize logic
            }
        });

        expect(result.files).toContain("index.html");
        expect(result.files).toContain("manifest.json");
        expect(result.files).toContain("metadata.json");

        const manifest = result.manifest;
        expect(manifest.files.length).toBeGreaterThan(0);

        // Check if img.png was downloaded (it is small and 'images' is allowed)
        const imgEntry = manifest.files.find((f: any) => f.url.includes("img.png"));
        expect(imgEntry).toBeDefined();
        // Since we mocked fetch to return dummy bytes, we expect it to try downloading.
        // runScrape logic uses `downloadMediaCfg.includes(mtype)`
        // img.png -> 'images'. config has 'images'. Should download.
        // It's small (3 bytes) < 1000 limit.
        expect(imgEntry.downloaded).not.toBe(false); // In current logic, success entry doesn't strictly have `downloaded: true`, but has `path`.
        expect(imgEntry.path).toBeTruthy();

        // Check video.mp4 (type 'video' not in downloadMedia) -> should not download
        const vidEntry = manifest.files.find((f: any) => f.url.includes("video.mp4"));
        expect(vidEntry).toBeDefined();
        expect(vidEntry.path).toBeNull();
        expect(vidEntry.downloaded).toBe(false);

        // Check huge.jpg -> size 10MB > 1000 bytes limit -> should be oversized
        const hugeEntry = manifest.files.find((f: any) => f.url.includes("huge.jpg"));
        expect(hugeEntry).toBeDefined();
        expect(hugeEntry.size).toBeGreaterThan(1000);
        expect(hugeEntry.path).toBeNull(); // Oversized files are skipped

        // Verify output structure on disk
        const outDir = result.out;
        expect(fs.existsSync(path.join(outDir, "index.html"))).toBe(true);
        expect(fs.existsSync(path.join(outDir, "media"))).toBe(true);
    });

    test("ignoreFileExtensions config works", async () => {
        const result = await runScrape({
            url: "https://example.com/index.html",
            name: "ignore-scrape",
            outputRoot: testOutRoot,
            config: {
                downloadMedia: ["images", "documents"],
                ignoreFileExtensions: ["pdf"]
            }
        });

        const manifest = result.manifest;
        // doc.pdf -> type 'documents' (allowed) BUT ext 'pdf' (ignored) -> should skip
        const docEntry = manifest.files.find((f: any) => f.url.includes("doc.pdf"));
        expect(docEntry).toBeDefined();
        expect(docEntry.path).toBeNull();
    });
});

describe("Deduplication Logic", () => {
    // This is harder to test fully without creating a complex file structure, 
    // but we can test the `buildGlobalIndex` function by mocking fs.readdir/readFile.
    // For now, we will assume fs integration tests above cover basic fs ops.
    // We can try to run two identical scrapes and see if the second one references the first.

    const testOutRoot = path.join(process.cwd(), "test-output-dedupe");

    afterAll(() => {
        try { fs.rmSync(testOutRoot, { recursive: true, force: true }); } catch { }
    });

    test("deduplicates identical files across scrapes", async () => {
        // First scrape
        const res1 = await runScrape({
            url: "https://example.com/index.html",
            name: "scrape-1",
            outputRoot: testOutRoot,
            config: { downloadMedia: ["images"] }
        });

        // Find the hash of img.png
        const imgEntry1 = res1.manifest.files.find((f: any) => f.url.includes("img.png"));
        expect(imgEntry1).toBeDefined();
        const sha1 = imgEntry1.sha256;
        expect(sha1).toBeTruthy();

        // Second scrape (same content)
        const res2 = await runScrape({
            url: "https://example.com/index.html",
            name: "scrape-2",
            outputRoot: testOutRoot,
            config: { downloadMedia: ["images"] }
        });

        const imgEntry2 = res2.manifest.files.find((f: any) => f.url.includes("img.png"));
        expect(imgEntry2).toBeDefined();
        expect(imgEntry2.sha256).toBe(sha1);

        // The second entry should point to the first file's location (relative path)
        // or at least be a valid path.
        // run.ts logic: if (globalIndex.has(sha)) -> use existing.
        // path.relative(finalOutDir, existingAbs)

        // We expect the file NOT to exist as a duplicate in scrape-2 folder?
        // Actually run.ts writes it then deletes it if duplicate found.

        // Let's check manifest paths.
        // path 1: "media/1-img.png" (relative to scrape-1)
        // path 2: "../scrape-1/media/1-img.png" (relative to scrape-2, pointing to scrape-1)

        expect(imgEntry1.path).not.toEqual(imgEntry2.path);
        expect(imgEntry2.path).toContain("scrape-1");
    });
});
