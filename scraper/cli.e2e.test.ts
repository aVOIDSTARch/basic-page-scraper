import { test, expect } from "bun:test";
import fs from "fs";
import path from "path";
import { runScrape } from "./run";

test("e2e: CLI scrapes a page and writes manifest", async () => {
    // start a small Node http server to serve a page and an image
    const http = await import("node:http");
    const port = await new Promise((resolve, reject) => {
        const srv = http.createServer((req, res) => {
            if (req.url === "/") {
                res.writeHead(200, { "content-type": "text/html" });
                res.end(`<html><body><img src=\"/img.png\"></body></html>`);
                return;
            }
            if (req.url === "/img.png") {
                res.writeHead(200, { "content-type": "image/png", "content-length": 5 });
                res.end(Buffer.from([1, 2, 3, 4, 5]));
                return;
            }
            res.writeHead(404);
            res.end("Not found");
        });
        srv.listen(0, () => {
            // @ts-ignore
            const p = (srv.address() as any).port;
            (srv as any)._listener = srv;
            (globalThis as any).__testServer = srv; // store so we can close later
            resolve(p);
        });
    });

    const url = `http://localhost:${port}/`;
    const scrapeName = `test-e2e-${Date.now()}`;

    // ensure output dir doesn't exist before
    const outRoot = path.join(process.cwd(), "output", scrapeName);
    try { fs.rmSync(outRoot, { recursive: true, force: true }); } catch { }

    // run the scraper in-process to avoid spawning a new Bun process during tests
    const out = await runScrape({ url, name: scrapeName });
    expect(out).toBeTruthy();

    // verify manifest exists
    // `runScrape` returns the final output directory and manifest; prefer that
    const finalOut = out.out || fs.readdirSync(path.join(process.cwd(), "output")).find(d => d.includes("test-e2e-"));
    const outDir = typeof finalOut === "string" && finalOut.includes(path.join(process.cwd(), "output")) ? finalOut : path.join(process.cwd(), "output", finalOut as string);
    const manifest = out.manifest || JSON.parse(fs.readFileSync(path.join(outDir, "manifest.json"), "utf8"));
    expect(manifest).toHaveProperty("files");
    expect(Array.isArray(manifest.files)).toBe(true);

    try {
        const srv: any = (globalThis as any).__testServer;
        if (srv && typeof srv.close === "function") srv.close();
    } catch { }
});
