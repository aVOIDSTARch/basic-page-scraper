# Proposal: Page Scraper

## Summary

I will implement a Bun-first command-line scraper that accepts a URL, scrapes specified content, and saves a complete, structured output under `./output/<name>` including media, metadata (JSON), and a `summary.scrape` report.

## Proposed Implementation

- CLI entry `scraper/index.ts` runnable with `bun ./scraper/index.ts`.
- Create `./output/<folder_name>` per scrape and ensure folder exists.
- Save HTML/text content, media files (images, video, audio) in per-media subfolders with associated metadata JSON (alt text, source, mime, original URL).
- Produce `summary.scrape` (plain-text or markdown) containing: source URL, runtime, errors, file inventory, and optional folder-structure diagram.
- Provide an option to export standardized JSON metadata for imports by other apps.
- Minimal tests using `bun test` to validate save routines and metadata format.

## Milestones

1. Audit repo for Bun compatibility and scripts.
2. Implement core scraper CLI and output layout.
3. Implement media extraction + metadata and `summary.scrape` generation.
4. Add tests and README instructions for Bun usage.

## Questions / Clarifications

1. Preferred folder naming convention for `./output/<name>`? (timestamp, slug, provided name) slug that has url and timestamp included
2. Which media types must be saved? (images only, or include video/audio/other blobs) that should be determined by the config file that is provided but capability to digest all content should be included with a standard for handling each type
3. Should we obey `robots.txt` and rate-limit scraping? If so, preferred defaults? default yes but disable by flag in config file
4. Authentication requirements? (cookies, headers, OAuth) nothing for now we will only going to public pages
5. Max crawl depth / follow-links policy for a given URL? depth of zero (only the page provided) for now but add a config file value for later
6. Preferred metadata schema for JSON (any existing schema to match)? recommend
7. Should we store binary files with hashes (sha256) and a manifest for dedupe? yes
8. Any file-size limits or media quality constraints? if file is over 25Mb add to out file named oversized_content.json in that has url for item and met a data
9. Output `summary.scrape` format preference: plain text, Markdown, or JSON? eventually we will use this file to create a webpage so markdown probably
10. Do you want an HTML import + `Bun.serve()` demo for viewing outputs locally? explain

---

If this looks good I will proceed to audit the repo for Bun compatibility and update the todo list accordingly.
