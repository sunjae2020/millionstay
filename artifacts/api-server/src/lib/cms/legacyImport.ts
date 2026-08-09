import type { Block } from "@workspace/cms-blocks";

// ---------------------------------------------------------------------------
// Folding a legacy `page_contents` row into a block tree. The old fixed-field
// editor used a handful of key conventions — `hero_*` / `hero_slide_N_*`,
// `intro_*`, `pillar_*`, `feature_N_*` / `why_N_*`, `stat_*`, `review_N_*`,
// `news_N_*`, `cta_*` — and each group maps onto the block that renders it the
// same way the hand-built page did. Anything unmatched survives in a rich-text
// block so no copy is ever lost in the conversion.
//
// Kept as a pure function (no db, no request) so the mapping can be exercised
// against a page's real content without going through the HTTP route.
// ---------------------------------------------------------------------------

export interface LegacyImportResult {
  blocks: Block[];
  unmatchedKeys: string[];
}

export function legacyContentToBlocks(input: Record<string, unknown>): LegacyImportResult {
  const content = input as Record<string, string>;
  const used = new Set<string>();
  const take = (key: string): string => {
    const value = content[key];
    if (typeof value === "string" && value.trim()) {
      used.add(key);
      return value;
    }
    if (value !== undefined) used.add(key);
    return "";
  };
  const blocks: Block[] = [];
  const id = (n: number) => `legacy_${n}`;
  let seq = 0;

  // Hero — a slide set (`hero_slide_N_*`, the marketing pages) wins over the
  // single-banner fields when both are present.
  const slides: Record<string, unknown>[] = [];
  for (let i = 1; i <= 8; i += 1) {
    const title = take(`hero_slide_${i}_title`);
    const description = take(`hero_slide_${i}_subtitle`);
    const image = take(`hero_slide_${i}_image`);
    if (title || description || image) slides.push({ title, description, image: { url: image } });
  }
  if (slides.length > 0) {
    blocks.push({
      id: id(seq++),
      type: "hero-slider",
      props: { eyebrow: take("hero_eyebrow"), autoplaySeconds: 6, slides },
      style: { width: "full", spacingTop: 0, spacingBottom: 0 },
    });
  }

  const heroTitle = slides.length === 0 ? take("hero_title") : "";
  if (slides.length === 0 && (heroTitle || content["hero_subtitle"])) {
    blocks.push({
      id: id(seq++),
      type: "hero-banner",
      props: {
        title: heroTitle,
        subtitle: take("hero_subtitle"),
        description: take("hero_description"),
        buttonLabel: take("hero_cta_primary") || take("cta_primary"),
        secondaryLabel: take("hero_cta_secondary") || take("cta_secondary"),
        backgroundImage: { url: take("hero_image_url") },
        overlay: true,
      },
      style: { bg: "ink", width: "full", spacingTop: 0, spacingBottom: 0, align: "center" },
    });
  }

  // Intro — copy + image, with any `intro_stat_N_*` pairs kept alongside it the
  // way the hand-built pages show them.
  const introTitle = take("intro_title");
  const introBody = take("intro_body");
  if (introTitle || introBody) {
    const highlights: Record<string, unknown>[] = [];
    for (let i = 1; i <= 6; i += 1) {
      const value = take(`intro_stat_${i}_value`);
      const label = take(`intro_stat_${i}_label`);
      if (value || label) highlights.push({ title: value, description: label });
    }
    blocks.push({
      id: id(seq++),
      type: "about-us",
      props: {
        eyebrow: take("intro_eyebrow"),
        title: introTitle,
        subtitle: "",
        description: introBody ? `<p>${introBody}</p>` : "",
        image: { url: take("intro_image") },
        highlights,
      },
      style: { spacingTop: 3, spacingBottom: 3, width: "contained" },
    });
  }

  // Pillars — the "what we do" cards (`pillar_<key>_title|body`), each linking
  // to its own section of the site.
  const PILLAR_LINKS: Record<string, string> = { buy: "/buy", rent: "/rent", mgmt: "/management" };
  const pillars: Record<string, unknown>[] = [];
  for (const key of Object.keys(PILLAR_LINKS)) {
    const title = take(`pillar_${key}_title`);
    const description = take(`pillar_${key}_body`);
    if (title || description) {
      pillars.push({ title, description, href: PILLAR_LINKS[key] ?? "" });
    }
  }
  if (pillars.length > 0) {
    blocks.push({
      id: id(seq++),
      type: "services",
      props: { eyebrow: "", title: take("pillars_heading"), subtitle: "", items: pillars },
      style: { spacingTop: 3, spacingBottom: 3, width: "contained" },
    });
  }

  // "Why us" cards — written as `feature_N_*` on some pages and `why_N_*` on
  // others; both land in one feature list.
  const features: Record<string, unknown>[] = [];
  for (let i = 1; i <= 8; i += 1) {
    const title = take(`feature_${i}_title`);
    const description = take(`feature_${i}_body`);
    if (title || description) features.push({ title, description });
  }
  for (let i = 1; i <= 8; i += 1) {
    const title = take(`why_${i}_title`);
    const description = take(`why_${i}_body`);
    if (title || description) features.push({ title, description });
  }
  if (features.length > 0) {
    blocks.push({
      id: id(seq++),
      type: "feature-list",
      props: {
        eyebrow: "",
        title: take("why_title") || take("why_heading"),
        subtitle: take("why_body") || take("why_subtitle"),
        columns: "3",
        items: features,
      },
      style: { bg: "surface", spacingTop: 3, spacingBottom: 3, width: "contained" },
    });
  }

  const stats = Object.keys(content)
    .filter((k) => k.startsWith("stat_"))
    .map((k) => {
      used.add(k);
      return { value: String(content[k] ?? ""), label: k.replace("stat_", "").replace(/_/g, " ") };
    });
  if (stats.length > 0) {
    blocks.push({
      id: id(seq++),
      type: "statistics",
      props: { title: "", items: stats },
      style: { bg: "surface", spacingTop: 3, spacingBottom: 3 },
    });
  }

  // Reviews (`review_N_*`) → testimonials.
  const reviews: Record<string, unknown>[] = [];
  for (let i = 1; i <= 12; i += 1) {
    const quote = take(`review_${i}_quote`);
    const author = take(`review_${i}_name`);
    const role = take(`review_${i}_role`);
    const avatar = take(`review_${i}_avatar`);
    if (quote || author) reviews.push({ quote, author, role, avatar: { url: avatar } });
  }
  if (reviews.length > 0) {
    blocks.push({
      id: id(seq++),
      type: "testimonials",
      props: {
        eyebrow: take("reviews_eyebrow"),
        title: take("reviews_heading"),
        subtitle: take("reviews_subtitle"),
        items: reviews,
      },
      style: { spacingTop: 3, spacingBottom: 3, width: "contained" },
    });
  }

  // News (`news_N_*`) → service cards; the date is folded into the summary line
  // because the card has no separate date slot.
  const news: Record<string, unknown>[] = [];
  for (let i = 1; i <= 12; i += 1) {
    const title = take(`news_${i}_title`);
    const date = take(`news_${i}_date`);
    const summary = take(`news_${i}_summary`);
    const image = take(`news_${i}_image`);
    const link = take(`news_${i}_link`);
    if (title || summary) {
      news.push({
        title,
        description: [date, summary].filter(Boolean).join(" · "),
        image: { url: image },
        href: link,
      });
    }
  }
  if (news.length > 0) {
    blocks.push({
      id: id(seq++),
      type: "services",
      props: {
        eyebrow: take("news_eyebrow"),
        title: take("news_heading"),
        subtitle: take("news_subtitle"),
        items: news,
      },
      style: { bg: "surface", spacingTop: 3, spacingBottom: 3, width: "contained" },
    });
  }

  const ctaTitle = take("cta_title");
  if (ctaTitle) {
    blocks.push({
      id: id(seq++),
      type: "cta-banner",
      props: { title: ctaTitle, subtitle: take("cta_subtitle"), buttonLabel: take("cta_button"), buttonUrl: "" },
      style: { bg: "primary", spacingTop: 3, spacingBottom: 3, align: "center", width: "full" },
    });
  }

  // Nothing is discarded — leftovers become a rich-text block for the editor.
  const leftovers = Object.entries(content).filter(
    ([k, v]) => !used.has(k) && typeof v === "string" && v.trim(),
  );
  if (leftovers.length > 0) {
    blocks.push({
      id: id(seq++),
      type: "rich-text",
      props: {
        title: "",
        body: leftovers.map(([k, v]) => `<p><strong>${k}</strong><br>${v}</p>`).join("\n"),
      },
      style: { spacingTop: 2, spacingBottom: 2, width: "contained" },
    });
  }


  return { blocks, unmatchedKeys: leftovers.map(([k]) => k) };
}
