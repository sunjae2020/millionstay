// Generates a comprehensive .dark override layer that prevents hardcoded
// light utility colors (bg-white, bg-*-50/100/200, text-*-600..900, border-*)
// from rendering as bright/white surfaces in dark mode.

const HUES = [
  "blue", "green", "yellow", "red", "amber", "orange", "indigo", "purple",
  "pink", "emerald", "teal", "sky", "cyan", "lime", "violet", "rose", "fuchsia",
];
const NEUTRALS = ["gray", "slate", "zinc", "neutral", "stone"];

// Variant prefixes seen in the codebase that must keep working in dark mode.
const STATES = [
  { prefix: "", suffix: "" },
  { prefix: "hover\\:", suffix: ":hover" },
  { prefix: "group-hover\\:", suffix: "" }, // handled via .group:hover below
];

const out = [];
out.push("/* ------------------------------------------------------------------ */");
out.push("/* Dark-mode safety net: remap hardcoded light utility colors so that  */");
out.push("/* boxes, buttons and panels never render with white / near-white     */");
out.push("/* backgrounds in dark mode. Generated — see scripts note in index.css */");
out.push("/* ------------------------------------------------------------------ */");

function sel(prefix, core, suffix) {
  // group-hover needs the ancestor .group:hover form
  if (prefix === "group-hover\\:") {
    return `.dark .group:hover .group-hover\\:${core}`;
  }
  return `.dark .${prefix}${core}${suffix}`;
}

function emit(coreClass, decls) {
  for (const s of STATES) {
    out.push(`${sel(s.prefix, coreClass, s.suffix)} { ${decls} }`);
  }
}

// --- bg-white ---
emit("bg-white", "background-color: hsl(var(--card)) !important;");
// translucent whites used as overlays
out.push(`.dark .bg-white\\/50 { background-color: hsl(var(--card) / 0.5) !important; }`);
out.push(`.dark .bg-white\\/60 { background-color: hsl(var(--card) / 0.6) !important; }`);

// --- neutral backgrounds -> muted surface ---
for (const n of NEUTRALS) {
  for (const shade of ["50", "100"]) {
    emit(`bg-${n}-${shade}`, "background-color: hsl(var(--muted)) !important;");
  }
  emit(`bg-${n}-200`, "background-color: hsl(var(--accent)) !important;");
}

// --- colored tint backgrounds -> dark translucent tint over the card ---
const BG_MIX = { "50": 8, "100": 14, "200": 22 };
for (const c of HUES) {
  for (const shade of ["50", "100", "200"]) {
    const pct = BG_MIX[shade];
    emit(
      `bg-${c}-${shade}`,
      `background-color: color-mix(in oklab, var(--color-${c}-500) ${pct}%, hsl(var(--card))) !important;`,
    );
  }
}

// --- colored text -> lighter, readable on dark ---
for (const c of HUES) {
  emit(`text-${c}-600`, `color: var(--color-${c}-400) !important;`);
  for (const shade of ["700", "800", "900"]) {
    emit(`text-${c}-${shade}`, `color: var(--color-${c}-300) !important;`);
  }
}
// neutral text -> theme foreground tokens
for (const n of NEUTRALS) {
  emit(`text-${n}-600`, "color: hsl(var(--muted-foreground)) !important;");
  for (const shade of ["700", "800", "900"]) {
    emit(`text-${n}-${shade}`, "color: hsl(var(--foreground)) !important;");
  }
}

// --- colored borders -> dimmer ---
const BORDER_MIX = { "200": 30, "300": 38 };
for (const c of HUES) {
  for (const shade of ["200", "300"]) {
    emit(
      `border-${c}-${shade}`,
      `border-color: color-mix(in oklab, var(--color-${c}-500) ${BORDER_MIX[shade]}%, transparent) !important;`,
    );
  }
}
for (const n of NEUTRALS) {
  for (const shade of ["200", "300"]) {
    emit(`border-${n}-${shade}`, "border-color: hsl(var(--border)) !important;");
  }
}

// --- divide colors ---
out.push(`.dark .divide-amber-100 > :not([hidden]) ~ :not([hidden]) { border-color: color-mix(in oklab, var(--color-amber-500) 22%, transparent) !important; }`);

console.log(out.join("\n"));
