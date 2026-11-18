// Title + body in the single `alert.message` column (no schema change): "title\nbody".
const SEP = "\n";

export function joinMessage(title: string, body: string): string {
    return `${title.trim()}${SEP}${body.trim()}`; // always add SEP, so a title-only alert still splits back correctly
}

// Legacy one-line rows (e.g. the old STALE_DATA message) → the type label as title, the whole text as body
export function splitMessage(message: string, fallbackTitle: string): { title: string; body: string } {
    const i = message.indexOf(SEP);
    if (i === -1) return { title: fallbackTitle, body: message };
    return { title: message.slice(0, i), body: message.slice(i + 1) };
}