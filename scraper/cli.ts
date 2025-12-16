#!/usr/bin/env bun
import path from "path";
import { readText } from "./fs-helpers";
import { runScrape } from "./run";

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
    --download-media <csv|none>  Override config "downloadMedia" (comma-separated list or 'none')
    --max-download-bytes <num>   Override config "maxDownloadBytes" (per-file limit in bytes)
    --help, -h                   Show this help message

Config: the scraper loads "scraper/config.json" (fallback to config.example.json). See README for details.

Behavior: by default media are cataloged in the manifest without downloading. Use "--download-media" to enable downloads for specific media classes.
`);
}

const url = getArg("--url") || getArg("-u");
const name = getArg("--name") || getArg("-n");

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

try {
    const config = await loadConfig();

    // CLI overrides for config
    const downloadMediaFlag = getArg("--download-media");
    if (downloadMediaFlag) {
        config.downloadMedia = downloadMediaFlag === 'none' ? [] : downloadMediaFlag.split(',').map(s => s.trim());
    }

    const maxDownloadFlag = getArg("--max-download-bytes");
    if (maxDownloadFlag) {
        config.maxDownloadBytes = Number(maxDownloadFlag);
    }

    console.log(`[cli] starting scrape for ${url}`);
    const result = await runScrape({
        url,
        name,
        config,
        outputRoot
    });

    console.log("Scrape complete. Output:", result.out);
} catch (e) {
    console.error("Scrape failed:", e);
    process.exit(2);
}
