# Implementation Notes — Page Scraper (Bun-first)

## Goal

Provide a minimal, Bun-friendly CLI to fetch a URL and save a basic scrape output under `./output/<name>`.

## Decisions

- Short-term: use Node-compatible `node:fs/promises` APIs for reliable file operations in both Bun and Node. This keeps the runtime simple and portable.
- Long-term: replace `node:fs` calls with `Bun.file` / Bun-specific APIs for idiomatic Bun behavior (streaming, performance) per project guidelines.
- The CLI will be runnable with `bun ./scraper/index.ts` and accept `--url` and optional `--name` arguments.

## Files created/modified

- `scraper/index.ts` — CLI entrypoint that:
  - creates `./output/<name>`
  - fetches the URL
  - saves `index.html`, `metadata.json`, and `summary.scrape`
- `scraper/package.json` — add a `start` script for convenience.

## Usage

Run from the `scraper` directory (or `bun` will work from workspace root if path is adjusted):

```bash
bun ./scraper/index.ts --url https://example.com --name example-scrape
```

## Next steps

- Replace `node:fs` usage with `Bun.file` and `Bun.write` for full Bun idiomatic implementation.
- Implement media extraction, metadata schema, and summary formatting per `plan.flick`.
- Add `bun test` tests for file creation and metadata validation.


## Decisions Pending (fill via `ai-docs/DECISIONS.md`)

- **Folder naming:** slug with URL+timestamp (user confirmed in `PROPOSAL.md`).
- **Media types:** capability to handle images/video/audio/other; exact selection controlled by config file.
- **Robots & rate limits:** obey `robots.txt` by default; allow disable via config flag.
- **Authentication:** public pages only for now (no auth).
- **Crawl depth:** default 0 (single page), configurable later.
- **Metadata schema:** pending user's preferred schema — recommend a simple manifest with `files[]` and per-file metadata.
- **Hashes & manifest:** store SHA-256 per binary and a `manifest.json` for dedupe.
- **Oversized files:** files >25MB recorded in `oversized_content.json`.
- **Summary format:** Markdown by default to enable a preview webpage.
- **Local viewer:** optionally provide an HTML+`Bun.serve()` demo to browse outputs.
