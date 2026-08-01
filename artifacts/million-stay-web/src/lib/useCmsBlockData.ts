import { useQueries } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { getApiBase } from "./api-base";
import type { Block } from "@workspace/cms-blocks";
import type { BlockData, BlockDataItem } from "@workspace/cms-blocks/react";

const BASE = getApiBase();

// Data-backed blocks (space/sale listings, blog posts) render live rows rather
// than authored copy. The renderer stays network-free — this hook does the
// fetching and hands it the rows, and it only fires for block types the page
// actually uses.

function usedTypes(blocks: Block[]): Set<string> {
  const types = new Set<string>();
  const walk = (list: Block[]) => {
    for (const block of list) {
      types.add(block.type);
      if (block.children?.length) walk(block.children);
    }
  };
  walk(blocks);
  return types;
}

/** Largest `limit` any block of this type asked for — one fetch covers them all. */
function maxLimit(blocks: Block[], type: string, fallback: number): number {
  let max = 0;
  const walk = (list: Block[]) => {
    for (const block of list) {
      if (block.type === type) max = Math.max(max, Number(block.props["limit"]) || 0);
      if (block.children?.length) walk(block.children);
    }
  };
  walk(blocks);
  return max || fallback;
}

async function getJson(url: string): Promise<any> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export function useCmsBlockData(blocks: Block[], siteKey: string): BlockData {
  const { i18n } = useTranslation();
  const lang = (i18n.language || "en").split("-")[0];
  const types = usedTypes(blocks);

  const results = useQueries({
    queries: [
      {
        queryKey: ["cms-block-spaces", lang, maxLimit(blocks, "space-listings", 6)],
        enabled: types.has("space-listings"),
        staleTime: 5 * 60 * 1000,
        retry: false,
        queryFn: async (): Promise<BlockDataItem[]> => {
          const json = await getJson(
            `${BASE}/api/v1/public/spaces?limit=${maxLimit(blocks, "space-listings", 6)}&lang=${lang}`,
          );
          const rows = json?.data ?? json ?? [];
          return (Array.isArray(rows) ? rows : []).map((row: any) => ({
            id: row.id,
            title: row.name ?? row.title ?? "",
            subtitle: row.property_name ?? row.suburb ?? "",
            description: row.description ?? "",
            imageUrl: row.image_url ?? row.cover_image_url ?? row.images?.[0]?.url ?? "",
            href: `/space/${row.id}`,
            meta: row.price_label ?? "",
          }));
        },
      },
      {
        queryKey: ["cms-block-sale", lang, maxLimit(blocks, "sale-listings", 6)],
        enabled: types.has("sale-listings"),
        staleTime: 5 * 60 * 1000,
        retry: false,
        queryFn: async (): Promise<BlockDataItem[]> => {
          const json = await getJson(
            `${BASE}/api/v1/public/sale-listings?limit=${maxLimit(blocks, "sale-listings", 6)}&lang=${lang}`,
          );
          const rows = json?.data ?? json ?? [];
          return (Array.isArray(rows) ? rows : []).map((row: any) => ({
            id: row.id,
            title: row.title ?? "",
            subtitle: row.subtitle ?? row.location ?? "",
            description: row.description ?? "",
            imageUrl: row.cover_image_url ?? row.images?.[0] ?? "",
            href: `/buy/${row.id}`,
            meta: row.price_label ?? "",
          }));
        },
      },
      {
        queryKey: ["cms-block-posts", siteKey, maxLimit(blocks, "blog-posts", 3)],
        enabled: types.has("blog-posts"),
        staleTime: 5 * 60 * 1000,
        retry: false,
        queryFn: async (): Promise<BlockDataItem[]> => {
          const json = await getJson(
            `${BASE}/api/v1/public/blog?site=${encodeURIComponent(siteKey)}&limit=${maxLimit(blocks, "blog-posts", 3)}`,
          );
          const rows = json?.data ?? [];
          return (Array.isArray(rows) ? rows : []).map((row: any) => ({
            id: row.id,
            title: row.title ?? "",
            subtitle: row.category ?? "",
            description: row.excerpt ?? "",
            imageUrl: row.cover_image_url ?? "",
            href: `/blog/${row.slug}`,
            meta: row.published_at ? String(row.published_at).slice(0, 10) : "",
          }));
        },
      },
    ],
  });

  return {
    "space-listings": results[0]?.data ?? [],
    "sale-listings": results[1]?.data ?? [],
    "blog-posts": results[2]?.data ?? [],
  };
}
