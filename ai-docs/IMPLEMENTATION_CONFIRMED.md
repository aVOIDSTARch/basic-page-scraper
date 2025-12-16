# Confirmed Implementation — Page Scraper

This document records the confirmed decisions and the concrete defaults used by the implementation.

## Confirmed Defaults

- Folder naming: `slug-timestamp` (derived from URL hostname+path + timestamp).
- Media types: `images, video, audio, fonts, documents, other` (config-controlled).
- Robots & rate limits: obey `robots.txt` by default; default rate limit 0.5 RPS.
- Authentication: none by default; plan for future auth support.
- Crawl depth: configurable; default `0` (single page).
- Metadata schema: `manifest` containing `source`, `fetchedAt`, `files: [{ path, mime, sha256, size, meta }]`.
- Hash algorithm: `sha256`; dedupe across scrapes enabled.
- Oversized files: threshold 25MB; default behavior is `skip` and record to `oversized_content.json`.
- Summary format: `markdown`.
- Local viewer: `Bun.serve()` demo enabled as an optional feature.

## Files Added/Updated

- `scraper/config.example.json` — example configuration with the confirmed defaults.
- `scraper/cli.ts` — runtime-adaptive CLI updated to load `scraper/config.json` or fall back to the example.
- `ai-docs/IMPLEMENTATION.md` — updated to include a Decisions Pending section earlier.

## Next Steps

- If you confirm these defaults, I will:
  - Add `scraper/config.json` (non-example) with these values (committed or left for you to edit).
  - Implement media extraction, hashing, manifest writing, and oversized file handling.
  - Add a `Bun.serve()` viewer under `scraper/viewer/` to preview scrapes.

---

Confirm or edit any defaults and I'll apply the changes to `scraper/config.json` and proceed with implementation tasks.
