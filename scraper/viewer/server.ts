#!/usr/bin/env bun
import { readdir } from "node:fs/promises";
import path from "path";

const OUTPUT_DIR = path.join(process.cwd(), "output");

function renderIndex(dirs: string[]) {
    return `<!doctype html>
<html>
<head><meta charset="utf-8"><title>Scrape outputs</title></head>
<body>
<h1>Scrape outputs</h1>
<ul>
${dirs.map(d => `<li><a href="/view/${encodeURIComponent(d)}/">${d}</a></li>`).join('\n')}
</ul>
</body></html>`;
}

async function listOutputs() {
    try {
        const items = await readdir(OUTPUT_DIR, { withFileTypes: true } as any);
        return items.filter((it: any) => it.isDirectory()).map((d: any) => d.name);
    } catch (e) {
        return [];
    }
}

const server = Bun.serve({
    port: 3000,
    fetch: async (req: Request) => {
        const url = new URL(req.url);
        if (url.pathname === "/") {
            const dirs = await listOutputs();
            return new Response(renderIndex(dirs), { headers: { "content-type": "text/html; charset=utf-8" } });
        }

        const viewMatch = url.pathname.match(/^\/view\/(.+?)\/(.*)$/);
        if (viewMatch && viewMatch[1]) {
            const folder = decodeURIComponent(viewMatch[1]);
            const rest = viewMatch[2] || "index.html";
            const filePath = path.join(OUTPUT_DIR, folder, rest);
            try {
                // Read file as arrayBuffer and return as Response to satisfy types
                const buf = await Bun.file(filePath).arrayBuffer();
                return new Response(new Uint8Array(buf), { status: 200 });
            } catch (e) {
                return new Response("Not found", { status: 404 });
            }
        }

        return new Response("Not found", { status: 404 });
    }
});

console.log(`Viewer running at http://localhost:${(server as any).port}/`);
