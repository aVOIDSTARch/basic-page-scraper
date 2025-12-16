
export async function ensureDir(dir: string) {
    if (typeof (globalThis as any).Bun !== "undefined") {
        try {
            const Bun = (globalThis as any).Bun;
            if (typeof Bun.mkdir === "function") {
                await Bun.mkdir(dir, { recursive: true });
                return;
            }
        } catch { }
    }

    if (typeof (globalThis as any).Deno !== "undefined") {
        await (globalThis as any).Deno.mkdir(dir, { recursive: true });
        return;
    }

    const { mkdir } = await import("node:fs/promises");
    await mkdir(dir, { recursive: true });
}

export async function writeText(filePath: string, text: string) {
    if (typeof (globalThis as any).Bun !== "undefined") {
        try {
            const Bun = (globalThis as any).Bun;
            if (typeof Bun.write === "function") {
                await Bun.write(filePath, text);
                return;
            }
        } catch { }
    }

    if (typeof (globalThis as any).Deno !== "undefined") {
        await (globalThis as any).Deno.writeTextFile(filePath, text);
        return;
    }

    const { writeFile } = await import("node:fs/promises");
    await writeFile(filePath, text, "utf8");
}

export async function readText(filePath: string) {
    if (typeof (globalThis as any).Bun !== "undefined") {
        try {
            const Bun = (globalThis as any).Bun;
            if (typeof Bun.file === "function") {
                const f = Bun.file(filePath);
                return await f.text();
            }
        } catch { }
    }

    if (typeof (globalThis as any).Deno !== "undefined") {
        return await (globalThis as any).Deno.readTextFile(filePath);
    }

    const { readFile } = await import("node:fs/promises");
    return (await readFile(filePath, "utf8")).toString();
}

export async function writeBinary(filePath: string, data: Uint8Array) {
    if (typeof (globalThis as any).Bun !== "undefined") {
        try {
            const Bun = (globalThis as any).Bun;
            if (typeof Bun.write === "function") {
                await Bun.write(filePath, data);
                return;
            }
        } catch { }
    }

    if (typeof (globalThis as any).Deno !== "undefined") {
        await (globalThis as any).Deno.writeFile(filePath, data);
        return;
    }

    const { writeFile } = await import("node:fs/promises");
    await writeFile(filePath, Buffer.from(data));
}
