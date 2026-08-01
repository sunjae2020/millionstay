// ---------------------------------------------------------------------------
// HTML sanitiser for the `custom-html` and `richtext` block fields.
//
// Decision (2026-08-01): scripts are FORBIDDEN and tags are allow-listed. Staff
// can format copy and embed links/images, but cannot inject executable content
// into a public site. This runs on the server at save time AND again in the
// renderer, so a stored value from before this rule cannot execute either.
// ---------------------------------------------------------------------------

const ALLOWED_TAGS = new Set([
  "p", "br", "hr", "div", "span", "section", "article",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "strong", "b", "em", "i", "u", "s", "mark", "small", "sub", "sup",
  "ul", "ol", "li", "dl", "dt", "dd",
  "blockquote", "pre", "code",
  "a", "img", "figure", "figcaption",
  "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption", "colgroup", "col",
]);

/** Attributes allowed on any tag, plus per-tag extras. */
const GLOBAL_ATTRS = new Set(["class", "id", "title", "dir", "lang"]);
const TAG_ATTRS: Record<string, Set<string>> = {
  a: new Set(["href", "target", "rel"]),
  img: new Set(["src", "alt", "width", "height", "loading"]),
  td: new Set(["colspan", "rowspan"]),
  th: new Set(["colspan", "rowspan", "scope"]),
  col: new Set(["span"]),
  colgroup: new Set(["span"]),
};

/** Tags whose entire contents are removed, not just the tag itself. */
const DROP_WITH_CONTENT = ["script", "style", "iframe", "object", "embed", "noscript", "template", "svg", "math"];

function stripDangerousBlocks(html: string): string {
  let out = html;
  for (const tag of DROP_WITH_CONTENT) {
    out = out.replace(new RegExp(`<${tag}\\b[\\s\\S]*?<\\/${tag}\\s*>`, "gi"), "");
    // Unclosed / self-closing variants.
    out = out.replace(new RegExp(`<${tag}\\b[^>]*\\/?>`, "gi"), "");
  }
  // HTML comments (can hide conditional-comment payloads).
  out = out.replace(/<!--[\s\S]*?-->/g, "");
  return out;
}

function safeUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  // Block javascript:, vbscript:, data: (except inline images), file:, etc.
  if (/^\s*(javascript|vbscript|file|about|blob)\s*:/i.test(trimmed)) return null;
  if (/^\s*data\s*:/i.test(trimmed) && !/^\s*data:image\/(png|jpe?g|gif|webp|svg\+xml);/i.test(trimmed)) {
    return null;
  }
  return trimmed;
}

function sanitiseAttributes(tag: string, attrString: string): string {
  const allowed = TAG_ATTRS[tag];
  const out: string[] = [];
  const attrRe = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
  let match: RegExpExecArray | null;
  while ((match = attrRe.exec(attrString)) !== null) {
    const name = (match[1] ?? "").toLowerCase();
    const value = match[3] ?? match[4] ?? match[5] ?? "";
    // Never allow event handlers or style (style can carry url()/expression()).
    if (name.startsWith("on") || name === "style" || name === "srcdoc" || name === "formaction") continue;
    if (!GLOBAL_ATTRS.has(name) && !allowed?.has(name)) continue;
    if (name === "href" || name === "src") {
      const url = safeUrl(value);
      if (!url) continue;
      out.push(`${name}="${escapeAttr(url)}"`);
      continue;
    }
    out.push(`${name}="${escapeAttr(value)}"`);
  }
  // External links open safely.
  if (tag === "a" && out.some((a) => a.startsWith('target="_blank"'))) {
    if (!out.some((a) => a.startsWith("rel="))) out.push('rel="noopener noreferrer"');
  }
  return out.length ? ` ${out.join(" ")}` : "";
}

function escapeAttr(value: string): string {
  return value.replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Returns HTML containing only allow-listed tags and attributes, with all
 * scripting removed. Disallowed tags are unwrapped (their text survives), which
 * keeps copy intact when an editor pastes from an external source.
 */
export function sanitiseHtml(input: string): string {
  if (!input) return "";
  let html = stripDangerousBlocks(input);

  html = html.replace(/<\/?([a-zA-Z][a-zA-Z0-9-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g, (full, rawTag: string, attrs: string) => {
    const tag = rawTag.toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) return ""; // unwrap: drop the tag, keep the text
    if (full.startsWith("</")) return `</${tag}>`;
    const selfClosing = /\/\s*$/.test(attrs) || tag === "br" || tag === "hr" || tag === "img" || tag === "col";
    const cleanAttrs = sanitiseAttributes(tag, attrs);
    return selfClosing ? `<${tag}${cleanAttrs} />` : `<${tag}${cleanAttrs}>`;
  });

  // Any stray angle-bracket constructs that survived are not markup.
  return html;
}
