/**
 * On-screen debug banner. The EVEN Hub WebView gives no easy access
 * to the JS console, so log lines are also drawn into a fixed div.
 */
let banner: HTMLDivElement | null = null;
const lines: string[] = [];
const MAX_LINES = 12;

function ensureBanner(): HTMLDivElement {
    if (banner) return banner;
    const el = document.createElement("div");
    el.id = "debug-banner";
    el.style.cssText = [
        "position:fixed",
        "top:0",
        "left:0",
        "right:0",
        "z-index:99999",
        "background:rgba(0,0,0,0.85)",
        "color:#0f0",
        "font:14px/1.3 monospace",
        "padding:6px 8px",
        "white-space:pre-wrap",
        "max-height:30vh",
        "overflow-y:auto",
        "pointer-events:auto",
    ].join(";");
    el.addEventListener("dblclick", () => {
        if (banner) banner.style.display = "none";
    });
    document.body.appendChild(el);
    banner = el;
    return el;
}

export function dbg(msg: string): void {
    const ts = new Date().toISOString().substring(11, 19);
    const line = `[${ts}] ${msg}`;
    console.log(line);
    lines.push(line);
    if (lines.length > MAX_LINES) lines.shift();
    try {
        const el = ensureBanner();
        el.textContent = lines.join("\n");
    } catch {
        // body may not exist yet — ignore
    }
}
