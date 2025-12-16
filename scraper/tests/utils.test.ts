import { test, expect } from "bun:test";
import { slugFromUrl, extractMediaUrls, computeSha256 } from "./utils";

test("slugFromUrl produces safe slug", () => {
    const s = slugFromUrl("https://example.com/path/to/page");
    expect(s).toBe("example.com-path-to-page");
});

test("extractMediaUrls finds image and links", () => {
    const html = `<html><body><img src="/img.png"><link href="/style.css"><a href="/file.pdf">`;
    const urls = extractMediaUrls(html);
    expect(urls).toEqual(expect.arrayContaining(["/img.png", "/style.css", "/file.pdf"]));
});

test("computeSha256 returns 64-char hex string", async () => {
    const data = new TextEncoder().encode("hello world");
    const sha = await computeSha256(data);
    expect(sha).toMatch(/^[0-9a-f]{64}$/);
});
