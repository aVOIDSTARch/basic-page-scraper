# scraper

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.ts
```

This project was created using `bun init` in bun v1.3.4. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.

## Configuration

The scraper reads `scraper/config.json` (falling back to `scraper/config.example.json`). Relevant options added:

- `ignoreFileExtensions`: array of lowercase extensions (without dot) to skip downloading; entries are cataloged in the manifest but not downloaded.
- `downloadMedia`: array of media classes to download. Valid values: `images`, `video`, `audio`, `fonts`, `documents`, `other`. Default: `[]` (do not download media by default).
- `maxDownloadBytes`: per-file download limit in bytes. If > 0, files larger than this will not be downloaded and will be recorded in the manifest with `downloaded: false`.

## CLI flags

- `--download-media <csv|none>` — override `downloadMedia` for this run. Use `none` to disable downloads, or a comma-separated list (e.g. `images,video`).
- `--max-download-bytes <bytes>` — override `maxDownloadBytes` for this run.

## Behavior notes

- By default the scraper will save the fetched HTML to `index.html` in the output folder and catalog discovered resources in `manifest.json` without downloading them.
- When downloads are enabled via config or `--download-media`, the scraper will attempt to fetch each resource but will skip downloads larger than `maxDownloadBytes` (or the configured oversized threshold if `maxDownloadBytes` is 0).
- Manifest entries for non-downloaded resources include `downloaded: false` and may include `inferredType` and `size` when available.

## Examples

Run with default (no media downloaded):

```bash
bun ./scraper/index.ts --url https://example.com --name sample-manual
```

Run and allow images and audio to download up to 10MB per file:

```bash
bun ./scraper/index.ts --url https://example.com --name sample-manual --download-media images,audio --max-download-bytes 10485760
```

## CLI help

You can view full CLI options with:

```bash
bun ./scraper/index.ts --help
```

The help output shows the flags: `--url`, `--name`, `--download-media`, `--max-download-bytes`, and `--help`.

## Additional flags

- `--output <path>` or `-o <path>` — change the base output directory used for scrapes. By default the scraper writes into `./output` under the repo; pass an absolute or relative path to change that base.

Example writing into a custom folder:

```bash
bun ./scraper/index.ts --url https://example.com --name my-scrape --output /tmp/scrapes
```
