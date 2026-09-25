// Tiny CSS-subset selector for the frozen /status.html contract (shared/status-page.ts).
// Supports exactly the selectors NIMBLE_STATUS_PARSER uses: "#id" and "#id .class".
// Used only when Nimble's server-side parser returns an empty `data.parsing` for HTML that
// Nimble itself retrieved (labelled parse_mode:"local-css"), and for the labelled `direct` fallback.

const decode = (s: string) =>
  s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
const textOf = (inner: string) => decode(inner.replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim();

/** Returns the inner HTML of the first element whose opening tag matches `attrRe`. */
function innerOf(html: string, attrRe: RegExp): string | null {
  const open = new RegExp(`<([a-zA-Z][a-zA-Z0-9]*)\\b[^>]*${attrRe.source}[^>]*>`, "i");
  const m = open.exec(html);
  if (!m) return null;
  const tag = m[1]!.toLowerCase();
  const start = m.index + m[0].length;
  // Walk forward balancing same-name tags.
  const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, "gi");
  re.lastIndex = start;
  let depth = 1;
  let mm: RegExpExecArray | null;
  while ((mm = re.exec(html))) {
    depth += mm[1] ? -1 : 1;
    if (depth === 0) return html.slice(start, mm.index);
  }
  return html.slice(start);
}

const idRe = (id: string) => new RegExp(`\\bid\\s*=\\s*["']${id.replace(/[-]/g, "\\-")}["']`);
const classRe = (c: string) => new RegExp(`\\bclass\\s*=\\s*["'](?:[^"']*\\s)?${c.replace(/[-]/g, "\\-")}(?:\\s[^"']*)?["']`);

export function selectText(html: string, css: string): string | null {
  const parts = css.trim().split(/\s+/);
  let scope: string | null = html;
  for (const p of parts) {
    if (scope === null) return null;
    if (p.startsWith("#")) scope = innerOf(scope, idRe(p.slice(1)));
    else if (p.startsWith(".")) scope = innerOf(scope, classRe(p.slice(1)));
    else throw new Error(`html-select: unsupported selector part ${p}`);
  }
  return scope === null ? null : textOf(scope);
}

/** Apply a Nimble-style terminal parser map ({field:{selector:{css_selector}}}) locally. */
export function applyParserLocally(html: string, parser: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [field, spec] of Object.entries(parser)) {
    const css = (spec as { selector?: { css_selector?: string } })?.selector?.css_selector;
    if (!css) continue;
    const v = selectText(html, css);
    if (v !== null) out[field] = v;
  }
  return out;
}
