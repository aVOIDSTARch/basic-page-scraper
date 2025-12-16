export async function fetchBinary(urlStr: string) {
    const res = await fetch(urlStr);
    const contentType = res.headers.get('content-type') || '';
    const arr = new Uint8Array(await res.arrayBuffer());
    return { data: arr, contentType, size: arr.byteLength };
}

export function extFromUrl(u: string) { try { return (new URL(u)).pathname.split('.').pop()?.toLowerCase() || ''; } catch { return '' } }

export function mediaTypeFromExt(ext: string) {
    if (!ext) return 'other';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'tiff', 'ico'].includes(ext)) return 'images';
    if (['mp4', 'webm', 'mov', 'mkv', 'ogg', 'ogv'].includes(ext)) return 'video';
    if (['mp3', 'wav', 'm4a', 'aac', 'flac'].includes(ext)) return 'audio';
    if (['woff', 'woff2', 'ttf', 'otf', 'eot'].includes(ext)) return 'fonts';
    if (['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext)) return 'documents';
    if (['css', 'js', 'map', 'json', 'xml', 'txt', 'html', 'htm'].includes(ext)) return 'text';
    return 'other';
}
