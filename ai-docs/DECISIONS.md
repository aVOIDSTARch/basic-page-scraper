# Decisions / Clarifications — Page Scraper

Below are the questions pulled from `ai-docs/PROPOSAL.md` with the current user-entered answers (if present). Please confirm or modify each.

1. Folder naming for `./output/<name>`
   - Current: "slug that has url and timestamp included"
   - Confirm or change: confirm

2. Which media types must be saved?
   - Current: "determined by the config file; capability to digest all content"
   - Confirm media types to include by default (e.g., `images, video, audio, fonts, documents`): confirm

3. Should we obey `robots.txt` and rate-limit scraping?
   - Current: "default yes but disable by flag in config file"
   - Confirm default behavior and preferred rate limits (requests per second): whatever you recommend that won't piss everyone off

4. Authentication requirements
   - Current: "nothing for now; only public pages"
   - Confirm whether any auth/cookies/headers will be needed later: yes later

5. Max crawl depth / follow-links policy
   - Current: "depth of zero (only the page provided) for now"
   - Confirm whether to implement link-following now or later and any limits: implement link following to depth in config file but make it 0 for only this page as default

6. Preferred metadata schema for JSON
   - Current: (no concrete schema provided)
   - Do you have an existing schema to match? If not, I recommend a manifest containing: `source`, `fetchedAt`, `files: [{ path, mime, sha256, size, meta }]`.
    Yours works
7. Binary file hashes & manifest for dedupe
   - Current: "yes"
   - Confirm hashing algorithm (default: `sha256`) and whether to dedupe across scrapes: sha256 and yes dedupe

8. File-size limits / oversized behavior
   - Current: "if file is over 25Mb add to out file named oversized_content.json with url and metadata"
   - Confirm size threshold (25MB ok?) and whether to still download or skip large files: skip and write to file > 25MB this file can be used to download separate to scrape

9. Output `summary.scrape` format preference
   - Current: "markdown probably"
   - Confirm final format (Markdown by default) or prefer JSON/HTML: markdown

10. Local viewer / `Bun.serve()` demo
    - Current: (user asked to explain)
    - Do you want a simple `Bun.serve()` demo that serves a browsable HTML index of the `./output` folder? (yes/no) yes

---

Reply with short answers (e.g., accept defaults, change X to Y, or list specific values). Once you confirm, I will update the implementation files (`ai-docs/IMPLEMENTATION.md` and `scraper/cli.ts`) to embed the chosen defaults and add a `scraper/config.example.json` with your confirmed settings so we can track changes.
