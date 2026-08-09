import { useEffect, useState } from "react";
import { sanitiseHtml } from "./sanitise";
import { styleToCss, tokensToCssVars, type DesignTokens } from "./tokens";
import type { Block, BlockImage } from "./types";

// ---------------------------------------------------------------------------
// The public renderer for CMS block pages. One component per block type, driven
// entirely by the shared registry — the admin builder and this file agree
// because they read the same `Block` shape from @workspace/cms-blocks.
//
// Styling comes ONLY from design tokens (roles + scale steps). No block carries
// a raw colour or pixel value, which is what keeps pages visually consistent.
// ---------------------------------------------------------------------------

/**
 * Rows the data-backed blocks render. The host app fetches them (it owns the API
 * base and auth) and hands them in, which keeps this package free of any
 * network or routing dependency.
 */
export interface BlockDataItem {
  id: string | number;
  title: string;
  subtitle?: string;
  description?: string;
  imageUrl?: string;
  href?: string;
  meta?: string;
}

export interface BlockData {
  "space-listings"?: BlockDataItem[];
  "sale-listings"?: BlockDataItem[];
  "blog-posts"?: BlockDataItem[];
}

export function BlockRenderer({
  blocks,
  tokens,
  data,
}: {
  blocks: Block[];
  tokens: DesignTokens;
  data?: BlockData;
}) {
  return (
    <div style={tokensToCssVars(tokens) as React.CSSProperties} className="cms-page">
      {blocks.filter((b) => !b.hidden).map((block) => (
        <BlockView key={block.id} block={block} tokens={tokens} data={data} />
      ))}
    </div>
  );
}

function BlockView({
  block,
  tokens,
  data,
}: {
  block: Block;
  tokens: DesignTokens;
  data?: BlockData;
}) {
  const style = styleToCss(block.style, tokens) as React.CSSProperties;
  const contained = (block.style?.width ?? "contained") === "contained";

  return (
    <section style={style} className="w-full">
      <div className={contained ? "mx-auto max-w-6xl px-4 sm:px-6" : "w-full"}>
        <BlockBody block={block} tokens={tokens} data={data} />
      </div>
    </section>
  );
}

// ── helpers ────────────────────────────────────────────────────────────────

const str = (value: unknown): string => (typeof value === "string" ? value : "");
const img = (value: unknown): BlockImage | null => {
  if (!value || typeof value !== "object") return null;
  const image = value as BlockImage;
  return image.url ? image : null;
};
const rows = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value) ? (value as Record<string, unknown>[]) : [];

function Heading({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  if (!children) return null;
  return (
    <h2
      className={`text-2xl sm:text-3xl font-bold ${className}`}
      style={{ fontFamily: "var(--cms-font-heading)", fontSize: "calc(1.875rem * var(--cms-heading-scale))" }}
    >
      {children}
    </h2>
  );
}

/** Small label above a heading — the "eyebrow" every marketing section uses. */
function Eyebrow({ children, className = "" }: { children: string; className?: string }) {
  if (!children) return null;
  return (
    <p
      className={`text-sm font-semibold tracking-widest uppercase ${className}`}
      style={{ color: "var(--cms-primary)" }}
    >
      {children}
    </p>
  );
}

/** Sanitised on save AND here — stored values from before the rule can't execute. */
function Html({ html, className = "" }: { html: string; className?: string }) {
  if (!html) return null;
  return (
    <div
      className={`prose prose-sm max-w-none ${className}`}
      style={{ fontFamily: "var(--cms-font-body)" }}
      dangerouslySetInnerHTML={{ __html: sanitiseHtml(html) }}
    />
  );
}

function CtaButton({ label, href }: { label: string; href: string }) {
  if (!label) return null;
  const className = "inline-block px-5 py-2.5 text-sm font-medium transition-opacity hover:opacity-90";
  const style = {
    background: "var(--cms-primary)",
    color: "var(--cms-on-primary)",
    borderRadius: "var(--cms-radius)",
  } as React.CSSProperties;
  if (!href) return <span className={className} style={style}>{label}</span>;
  const external = /^https?:/i.test(href);
  return (
    <a
      className={className}
      style={style}
      href={href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {label}
    </a>
  );
}

function Picture({ image, className = "" }: { image: BlockImage | null; className?: string }) {
  if (!image) return null;
  return (
    <img
      src={image.url}
      alt={image.alt ?? ""}
      loading="lazy"
      className={`max-w-full ${className}`}
      style={{ borderRadius: "var(--cms-radius)" }}
    />
  );
}

function usePrefersReducedMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduce(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduce;
}

/**
 * Full-bleed autoplaying hero. Slides crossfade behind a dark overlay so the
 * copy stays legible over any photo, and indicators let a reader step through
 * them. Motion is dropped entirely when the OS asks for reduced motion.
 */
function HeroSlider({
  slides,
  eyebrow,
  autoplaySeconds,
}: {
  slides: Record<string, unknown>[];
  eyebrow: string;
  autoplaySeconds: number;
}) {
  const [index, setIndex] = useState(0);
  const reduce = usePrefersReducedMotion();
  const interval = Math.max(2, autoplaySeconds || 6) * 1000;

  useEffect(() => {
    if (reduce || slides.length <= 1) return;
    const id = setInterval(() => setIndex((prev) => (prev + 1) % slides.length), interval);
    return () => clearInterval(id);
  }, [reduce, slides.length, interval]);

  const active = slides[index] ?? slides[0];
  if (!active) return null;

  return (
    <div className="relative flex items-center min-h-[70vh] overflow-hidden" style={{ background: "var(--cms-ink)" }}>
      {slides.map((slide, idx) => {
        const image = img(slide["image"]);
        return image ? (
          <img
            key={idx}
            src={image.url}
            alt=""
            aria-hidden
            className="absolute inset-0 h-full w-full object-cover transition-opacity duration-700"
            style={{ opacity: idx === index ? 1 : 0 }}
          />
        ) : null;
      })}
      <div className="absolute inset-0 bg-black/50" />

      <div className="relative mx-auto w-full max-w-6xl px-4 sm:px-6 py-20 sm:py-28 text-white">
        <div className="max-w-2xl">
          {eyebrow && <p className="text-sm font-semibold tracking-widest uppercase text-white/80">{eyebrow}</p>}
          <h1
            className="mt-4 text-3xl sm:text-5xl font-bold leading-tight"
            style={{ fontFamily: "var(--cms-font-heading)" }}
          >
            {str(active["title"])}
          </h1>
          {str(active["description"]) && <p className="mt-5 text-lg opacity-90">{str(active["description"])}</p>}
          {str(active["buttonLabel"]) && (
            <div className="mt-8">
              <CtaButton label={str(active["buttonLabel"])} href={str(active["buttonUrl"])} />
            </div>
          )}
        </div>
      </div>

      {slides.length > 1 && (
        <div className="absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 gap-2">
          {slides.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setIndex(idx)}
              aria-label={`Slide ${idx + 1}`}
              aria-current={idx === index}
              className="h-2 rounded-full transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
              style={{
                width: idx === index ? "24px" : "8px",
                backgroundColor: idx === index ? "#fff" : "rgba(255,255,255,0.5)",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

const GRID_COLS: Record<string, string> = {
  "2": "sm:grid-cols-2",
  "3": "sm:grid-cols-2 lg:grid-cols-3",
  "4": "sm:grid-cols-2 lg:grid-cols-4",
};

// ── per-type rendering ─────────────────────────────────────────────────────

function BlockBody({
  block,
  tokens,
  data,
}: {
  block: Block;
  tokens: DesignTokens;
  data?: BlockData;
}) {
  const p = block.props;

  switch (block.type) {
    case "section":
      return (
        <div>
          <Heading>{str(p["title"])}</Heading>
          {str(p["subtitle"]) && <p className="mt-2 opacity-80">{str(p["subtitle"])}</p>}
          <div className="mt-4">
            {(block.children ?? [])
              .filter((c) => !c.hidden)
              .map((child) => (
                <BlockView key={child.id} block={child} tokens={tokens} data={data} />
              ))}
          </div>
        </div>
      );

    case "hero-banner": {
      const background = img(p["backgroundImage"]);
      return (
        <div className="relative">
          {background && (
            <div className="absolute inset-0 -z-10">
              <img src={background.url} alt={background.alt ?? ""} className="h-full w-full object-cover" />
              {p["overlay"] !== false && <div className="absolute inset-0 bg-black/45" />}
            </div>
          )}
          <div className="mx-auto max-w-4xl px-4 py-20 sm:py-28 text-center">
            <h1
              className="text-3xl sm:text-5xl font-bold"
              style={{ fontFamily: "var(--cms-font-heading)" }}
            >
              {str(p["title"])}
            </h1>
            {str(p["subtitle"]) && <p className="mt-3 text-lg opacity-90">{str(p["subtitle"])}</p>}
            {str(p["description"]) && <p className="mt-4 opacity-80">{str(p["description"])}</p>}
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <CtaButton label={str(p["buttonLabel"])} href={str(p["buttonUrl"])} />
              {str(p["secondaryLabel"]) && (
                <a
                  href={str(p["secondaryUrl"]) || "#"}
                  className="inline-block px-5 py-2.5 text-sm font-medium border"
                  style={{ borderRadius: "var(--cms-radius)", borderColor: "currentColor" }}
                >
                  {str(p["secondaryLabel"])}
                </a>
              )}
            </div>
          </div>
        </div>
      );
    }

    case "hero-slider":
      return (
        <HeroSlider
          slides={rows(p["slides"])}
          eyebrow={str(p["eyebrow"])}
          autoplaySeconds={typeof p["autoplaySeconds"] === "number" ? p["autoplaySeconds"] : 6}
        />
      );

    case "rich-text":
      return (
        <div>
          <Heading>{str(p["title"])}</Heading>
          <Html html={str(p["body"])} className="mt-3" />
        </div>
      );

    case "about-us":
      return (
        <div className="grid gap-8 lg:grid-cols-2 items-center">
          <div>
            <Eyebrow className="mb-2">{str(p["eyebrow"])}</Eyebrow>
            <Heading>{str(p["title"])}</Heading>
            {str(p["subtitle"]) && <p className="mt-2 opacity-70">{str(p["subtitle"])}</p>}
            <Html html={str(p["description"])} className="mt-4" />
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {rows(p["highlights"]).map((item, index) => (
                <div key={index}>
                  <p className="font-semibold">{str(item["title"])}</p>
                  <p className="text-sm opacity-75 mt-1">{str(item["description"])}</p>
                </div>
              ))}
            </div>
          </div>
          <Picture image={img(p["image"])} className="w-full object-cover" />
        </div>
      );

    case "content-featured": {
      const imageLeft = str(p["imagePosition"]) === "left";
      return (
        <div className={`grid gap-8 lg:grid-cols-2 items-center ${imageLeft ? "" : "lg:[direction:rtl]"}`}>
          <div className="lg:[direction:ltr]">
            <Picture image={img(p["image"])} className="w-full object-cover" />
          </div>
          <div className="lg:[direction:ltr]">
            <Heading>{str(p["title"])}</Heading>
            <Html html={str(p["body"])} className="mt-3" />
            <div className="mt-5">
              <CtaButton label={str(p["buttonLabel"])} href={str(p["buttonUrl"])} />
            </div>
          </div>
        </div>
      );
    }

    case "feature-list":
      return (
        <div>
          <Eyebrow className="text-center mb-2">{str(p["eyebrow"])}</Eyebrow>
          <Heading className="text-center">{str(p["title"])}</Heading>
          {str(p["subtitle"]) && <p className="mt-2 text-center opacity-75">{str(p["subtitle"])}</p>}
          <div className={`mt-8 grid gap-6 ${GRID_COLS[str(p["columns"])] ?? GRID_COLS["3"]}`}>
            {rows(p["items"]).map((item, index) => (
              <div key={index} className="p-5 border" style={{ borderRadius: "var(--cms-radius)" }}>
                <Picture image={img(item["icon"])} className="h-10 w-10 object-contain mb-3" />
                <p className="font-semibold">{str(item["title"])}</p>
                <p className="text-sm opacity-75 mt-1">{str(item["description"])}</p>
              </div>
            ))}
          </div>
        </div>
      );

    case "quote":
      return (
        <figure className="mx-auto max-w-3xl text-center">
          <blockquote className="text-lg sm:text-xl italic">{str(p["quote"])}</blockquote>
          {(str(p["author"]) || str(p["role"])) && (
            <figcaption className="mt-3 text-sm opacity-70">
              {str(p["author"])}
              {str(p["role"]) && ` · ${str(p["role"])}`}
            </figcaption>
          )}
        </figure>
      );

    case "steps":
      return (
        <div>
          <Heading className="text-center">{str(p["title"])}</Heading>
          {str(p["subtitle"]) && <p className="mt-2 text-center opacity-75">{str(p["subtitle"])}</p>}
          <ol className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {rows(p["items"]).map((item, index) => (
              <li key={index} className="flex gap-3">
                <span
                  className="h-8 w-8 shrink-0 flex items-center justify-center text-sm font-bold"
                  style={{ background: "var(--cms-primary)", color: "var(--cms-on-primary)", borderRadius: "999px" }}
                >
                  {index + 1}
                </span>
                <div>
                  <p className="font-semibold">{str(item["title"])}</p>
                  <p className="text-sm opacity-75 mt-1">{str(item["description"])}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      );

    case "statistics":
      return (
        <div>
          <Heading className="text-center">{str(p["title"])}</Heading>
          <div className="mt-6 grid gap-6 grid-cols-2 lg:grid-cols-4 text-center">
            {rows(p["items"]).map((item, index) => (
              <div key={index}>
                <p className="text-3xl font-bold" style={{ color: "var(--cms-primary)" }}>
                  {str(item["value"])}
                </p>
                <p className="text-sm opacity-75 mt-1">{str(item["label"])}</p>
              </div>
            ))}
          </div>
        </div>
      );

    case "custom-html":
      return <Html html={str(p["html"])} />;

    case "services":
      return (
        <div>
          <Eyebrow className="text-center mb-2">{str(p["eyebrow"])}</Eyebrow>
          <Heading className="text-center">{str(p["title"])}</Heading>
          {str(p["subtitle"]) && <p className="mt-2 text-center opacity-75">{str(p["subtitle"])}</p>}
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {rows(p["items"]).map((item, index) => (
              <div key={index} className="border overflow-hidden" style={{ borderRadius: "var(--cms-radius)" }}>
                <Picture image={img(item["image"])} className="w-full h-40 object-cover" />
                <div className="p-4">
                  <p className="font-semibold">{str(item["title"])}</p>
                  <p className="text-sm opacity-75 mt-1">{str(item["description"])}</p>
                  {str(item["href"]) && (
                    <a href={str(item["href"])} className="text-sm mt-3 inline-block underline">
                      →
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      );

    case "pricing":
      return (
        <div>
          <Heading className="text-center">{str(p["title"])}</Heading>
          {str(p["subtitle"]) && <p className="mt-2 text-center opacity-75">{str(p["subtitle"])}</p>}
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {rows(p["plans"]).map((plan, index) => (
              <div
                key={index}
                className={`border p-6 ${plan["featured"] ? "ring-2" : ""}`}
                style={{ borderRadius: "var(--cms-radius)", ...(plan["featured"] ? { boxShadow: "0 0 0 2px var(--cms-primary)" } : {}) }}
              >
                <p className="font-semibold">{str(plan["name"])}</p>
                <p className="text-3xl font-bold mt-2">
                  {str(plan["price"])}
                  <span className="text-sm font-normal opacity-70"> {str(plan["period"])}</span>
                </p>
                <p className="text-sm opacity-75 mt-2">{str(plan["description"])}</p>
                <ul className="mt-4 space-y-1 text-sm">
                  {str(plan["features"])
                    .split("\n")
                    .filter(Boolean)
                    .map((feature, i) => (
                      <li key={i}>· {feature}</li>
                    ))}
                </ul>
                <div className="mt-5">
                  <CtaButton label={str(plan["buttonLabel"])} href={str(plan["buttonUrl"])} />
                </div>
              </div>
            ))}
          </div>
        </div>
      );

    case "faqs":
      return (
        <div className="mx-auto max-w-3xl">
          <Heading className="text-center">{str(p["title"])}</Heading>
          <div className="mt-6 divide-y">
            {rows(p["items"]).map((item, index) => (
              <details key={index} className="py-4">
                <summary className="font-medium cursor-pointer">{str(item["question"])}</summary>
                <Html html={str(item["answer"])} className="mt-2" />
              </details>
            ))}
          </div>
        </div>
      );

    case "brands":
      return (
        <div>
          <Heading className="text-center">{str(p["title"])}</Heading>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-8">
            {rows(p["items"]).map((item, index) => (
              <Picture key={index} image={img(item["image"])} className="h-10 object-contain opacity-70" />
            ))}
          </div>
        </div>
      );

    case "testimonials":
      return (
        <div>
          <Eyebrow className="text-center mb-2">{str(p["eyebrow"])}</Eyebrow>
          <Heading className="text-center">{str(p["title"])}</Heading>
          {str(p["subtitle"]) && <p className="mt-2 text-center opacity-75">{str(p["subtitle"])}</p>}
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {rows(p["items"]).map((item, index) => (
              <figure key={index} className="border p-5" style={{ borderRadius: "var(--cms-radius)" }}>
                <blockquote className="text-sm">{str(item["quote"])}</blockquote>
                <figcaption className="mt-4 flex items-center gap-3">
                  <Picture image={img(item["avatar"])} className="h-9 w-9 rounded-full object-cover" />
                  <div>
                    <p className="text-sm font-medium">{str(item["author"])}</p>
                    <p className="text-xs opacity-70">{str(item["role"])}</p>
                  </div>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      );

    case "team":
      return (
        <div>
          <Heading className="text-center">{str(p["title"])}</Heading>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {rows(p["items"]).map((item, index) => (
              <div key={index} className="text-center">
                <Picture image={img(item["photo"])} className="mx-auto h-28 w-28 rounded-full object-cover" />
                <p className="mt-3 font-semibold">{str(item["name"])}</p>
                <p className="text-sm opacity-70">{str(item["role"])}</p>
                <p className="text-xs opacity-60 mt-1">{str(item["bio"])}</p>
              </div>
            ))}
          </div>
        </div>
      );

    case "gallery":
      return (
        <div>
          <Heading className="text-center">{str(p["title"])}</Heading>
          <div className={`mt-6 grid gap-3 grid-cols-2 ${GRID_COLS[str(p["columns"])] ?? GRID_COLS["3"]}`}>
            {rows(p["items"]).map((item, index) => (
              <figure key={index}>
                <Picture image={img(item["image"])} className="w-full h-48 object-cover" />
                {str(item["caption"]) && <figcaption className="text-xs opacity-70 mt-1">{str(item["caption"])}</figcaption>}
              </figure>
            ))}
          </div>
        </div>
      );

    case "video": {
      const url = str(p["url"]);
      const youtube = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([\w-]{6,})/);
      return (
        <div className="mx-auto max-w-3xl">
          <Heading className="text-center">{str(p["title"])}</Heading>
          <div className="mt-4 aspect-video overflow-hidden" style={{ borderRadius: "var(--cms-radius)" }}>
            {youtube ? (
              <iframe
                className="h-full w-full"
                src={`https://www.youtube.com/embed/${youtube[1]}`}
                title={str(p["title"]) || "video"}
                allowFullScreen
              />
            ) : url ? (
              <video className="h-full w-full" src={url} controls poster={img(p["poster"])?.url} />
            ) : null}
          </div>
        </div>
      );
    }

    case "cta-banner":
      return (
        <div className="mx-auto max-w-3xl text-center">
          <Heading>{str(p["title"])}</Heading>
          {str(p["subtitle"]) && <p className="mt-2 opacity-90">{str(p["subtitle"])}</p>}
          <div className="mt-6">
            <CtaButton label={str(p["buttonLabel"])} href={str(p["buttonUrl"])} />
          </div>
        </div>
      );

    case "contact-block":
      return (
        <div>
          <Heading>{str(p["title"])}</Heading>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2 text-sm">
            {str(p["address"]) && <div><dt className="opacity-60">Address</dt><dd>{str(p["address"])}</dd></div>}
            {str(p["phone"]) && <div><dt className="opacity-60">Phone</dt><dd>{str(p["phone"])}</dd></div>}
            {str(p["email"]) && <div><dt className="opacity-60">Email</dt><dd>{str(p["email"])}</dd></div>}
            {str(p["hours"]) && <div><dt className="opacity-60">Hours</dt><dd>{str(p["hours"])}</dd></div>}
          </dl>
        </div>
      );

    case "contact-form":
      return (
        <div className="mx-auto max-w-xl">
          <Heading className="text-center">{str(p["title"])}</Heading>
          {str(p["description"]) && <p className="mt-2 text-center opacity-75">{str(p["description"])}</p>}
          {/* Submissions go through the existing public enquiry endpoint. */}
          <form
            className="mt-6 space-y-3"
            action="/api/v1/public/leads"
            method="post"
          >
            <input name="name" required placeholder="Name" className="w-full border px-3 py-2 text-sm" style={{ borderRadius: "var(--cms-radius)" }} />
            <input name="email" type="email" required placeholder="Email" className="w-full border px-3 py-2 text-sm" style={{ borderRadius: "var(--cms-radius)" }} />
            <textarea name="message" rows={4} placeholder="Message" className="w-full border px-3 py-2 text-sm" style={{ borderRadius: "var(--cms-radius)" }} />
            <button
              type="submit"
              className="w-full px-4 py-2.5 text-sm font-medium"
              style={{ background: "var(--cms-primary)", color: "var(--cms-on-primary)", borderRadius: "var(--cms-radius)" }}
            >
              {str(p["submitLabel"]) || "Send"}
            </button>
          </form>
        </div>
      );

    case "google-maps": {
      const address = str(p["address"]);
      if (!address) return null;
      return (
        <div>
          <Heading className="text-center">{str(p["title"])}</Heading>
          <div className="mt-4 aspect-video overflow-hidden" style={{ borderRadius: "var(--cms-radius)" }}>
            <iframe
              className="h-full w-full"
              title={address}
              src={`https://maps.google.com/maps?q=${encodeURIComponent(address)}&z=${Number(p["zoom"]) || 15}&output=embed`}
            />
          </div>
        </div>
      );
    }

    // Data-backed blocks: the host app supplies the rows, this renders them.
    case "space-listings":
    case "sale-listings":
    case "blog-posts": {
      const items = (data?.[block.type] ?? []).slice(0, Number(p["limit"]) || 6);
      return (
        <div>
          <Heading className="text-center">{str(p["title"])}</Heading>
          {items.length === 0 ? (
            <p className="mt-4 text-center text-sm opacity-60">{str(p["emptyText"]) || "—"}</p>
          ) : (
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((item) => (
                <a
                  key={item.id}
                  href={item.href ?? "#"}
                  className="block border overflow-hidden hover:opacity-90 transition-opacity"
                  style={{ borderRadius: "var(--cms-radius)" }}
                >
                  {item.imageUrl && (
                    <img src={item.imageUrl} alt="" loading="lazy" className="w-full h-40 object-cover" />
                  )}
                  <div className="p-4">
                    {item.meta && <p className="text-xs opacity-60">{item.meta}</p>}
                    <p className="font-semibold mt-0.5">{item.title}</p>
                    {item.subtitle && <p className="text-sm opacity-75 mt-0.5">{item.subtitle}</p>}
                    {item.description && (
                      <p className="text-sm opacity-70 mt-2 line-clamp-2">{item.description}</p>
                    )}
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      );
    }

    default:
      return null;
  }
}
