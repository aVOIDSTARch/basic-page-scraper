export function slugFromUrl(u: string) {
    try {
        const parsed = new URL(u);
        const parts = [parsed.hostname, parsed.pathname.replace(/\/+$/, "")]
            .filter(Boolean)
            .join("-")
            .replace(/[^a-zA-Z0-9-_\.]/g, "-")
            .replace(/-+/g, "-")
            .replace(/(^-|-$)/g, "");
        return parts || parsed.hostname;
    } catch {
        return u.replace(/[^a-zA-Z0-9-_\.]/g, "-");
    }
}

export function extractMediaUrls(html: string) {
    const urls: string[] = [];
    const reSrc = /<(img|audio|video|source)[^>]+src=["']?([^"' >]+)/gi;
    let m: RegExpExecArray | null;
    while ((m = reSrc.exec(html)) !== null) {
        if (m[2]) urls.push(m[2]);
    }

    const reLink = /<link[^>]+href=["']?([^"' >]+)[^>]*>/gi;
    while ((m = reLink.exec(html)) !== null) {
        if (m[1]) urls.push(m[1]);
    }

    const reA = /<a[^>]+href=["']?([^"' >]+)[^>]*>/gi;
    while ((m = reA.exec(html)) !== null) {
        const href = m[1] || "";
        if (href && /\.(pdf|docx?|xlsx?|zip|tar|gz)$/i.test(href)) urls.push(href);
    }

    return Array.from(new Set(urls));
}

export async function computeSha256(bytes: Uint8Array) {
    const subtle = (globalThis as any).crypto?.subtle || (globalThis as any).cryptoSubtle;
    if (subtle && typeof subtle.digest === "function") {
        const hash = await subtle.digest("SHA-256", bytes);
        return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
    }

    try {
        const crypto = await import('crypto');
        const h = crypto.createHash('sha256');
        h.update(Buffer.from(bytes));
        return h.digest('hex');
    } catch {
        return "";
    }
}
