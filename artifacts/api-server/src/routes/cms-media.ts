import { Router, type IRouter } from "express";
import { and, asc, desc, eq, ilike, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import { db, cmsMediaAssetsTable } from "@workspace/db";
import * as z from "zod/v4";
import { listCloudinaryResources, isCloudinaryConfigured } from "../utils/cloudinary.js";

// ---------------------------------------------------------------------------
// Media index.
//
// Cloudinary still owns the bytes and remains the source of truth for what
// exists; this index exists so an image can be FOUND — by caption, by tag, by
// folder — which listing a remote folder cannot do. Rows are created lazily by
// the sync endpoint below and by uploads, and an asset missing from the index
// still shows in the grid (the grid reads Cloudinary, then joins these rows).
//
// Mounted behind the global /api/v1 requireAuth guard.
// ---------------------------------------------------------------------------

const router: IRouter = Router();

// Same allow-list as routes/media.ts — folders holding personal or identifying
// images are deliberately absent and must stay that way.
const ALLOWED_FOLDERS = ["content", "spaces", "listings", "branding"] as const;
function isAllowedFolder(folder: string): boolean {
  return (ALLOWED_FOLDERS as readonly string[]).includes(folder);
}

/** GET /v1/cms/media/assets?folder=&q=&tag= — the searchable index. */
router.get("/v1/cms/media/assets", async (req, res): Promise<void> => {
  const conditions: SQL[] = [isNull(cmsMediaAssetsTable.deleted_at)];

  const folder = String(req.query["folder"] ?? "");
  if (folder) {
    if (!isAllowedFolder(folder)) {
      res.status(400).json({ error: "Invalid folder" });
      return;
    }
    conditions.push(eq(cmsMediaAssetsTable.folder, folder));
  }

  const q = String(req.query["q"] ?? "").trim();
  if (q) {
    conditions.push(
      or(
        ilike(cmsMediaAssetsTable.alt_text, `%${q}%`),
        ilike(cmsMediaAssetsTable.public_id, `%${q}%`),
      )!,
    );
  }

  const tag = String(req.query["tag"] ?? "").trim();
  // jsonb array containment — matches an exact tag, not a substring of one.
  if (tag) conditions.push(sql`${cmsMediaAssetsTable.tags} @> ${JSON.stringify([tag])}::jsonb`);

  const rows = await db
    .select()
    .from(cmsMediaAssetsTable)
    .where(and(...conditions))
    .orderBy(desc(cmsMediaAssetsTable.created_at))
    .limit(500);
  res.json(rows);
});

/** GET /v1/cms/media/tags — every tag in use, for the filter chips. */
router.get("/v1/cms/media/tags", async (_req, res): Promise<void> => {
  const rows = await db
    .select({ tag: sql<string>`jsonb_array_elements_text(${cmsMediaAssetsTable.tags})`, count: sql<number>`count(*)::int` })
    .from(cmsMediaAssetsTable)
    .where(isNull(cmsMediaAssetsTable.deleted_at))
    .groupBy(sql`1`)
    .orderBy(sql`2 DESC`)
    .limit(60);
  res.json(rows);
});

const AssetBody = z.object({
  alt_text: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
});

/**
 * PUT /v1/cms/media/assets/:publicId — caption and tag one asset.
 * Upserts, so an image Cloudinary has but the index has not yet seen can be
 * described without a sync first. The public id may contain slashes, hence the
 * wildcard route.
 */
router.put(/^\/v1\/cms\/media\/assets\/(.+)$/, async (req, res): Promise<void> => {
  const publicId = decodeURIComponent(String((req.params as unknown as string[])[0] ?? ""));
  if (!publicId) {
    res.status(400).json({ error: "public_id is required" });
    return;
  }
  const parsed = AssetBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body", details: parsed.error.issues });
    return;
  }
  const url = String(req.body?.url ?? "");
  const folder = publicId.split("/")[0] ?? "content";

  const [row] = await db
    .insert(cmsMediaAssetsTable)
    .values({
      public_id: publicId,
      url,
      folder: isAllowedFolder(folder) ? folder : "content",
      alt_text: parsed.data.alt_text ?? null,
      tags: parsed.data.tags ?? [],
    })
    .onConflictDoUpdate({
      target: cmsMediaAssetsTable.public_id,
      set: {
        ...(parsed.data.alt_text !== undefined ? { alt_text: parsed.data.alt_text } : {}),
        ...(parsed.data.tags !== undefined ? { tags: parsed.data.tags } : {}),
        updated_at: new Date(),
      },
    })
    .returning();
  res.json(row);
});

/**
 * POST /v1/cms/media/sync — index what Cloudinary holds.
 * Adds rows for assets the index has not seen and refreshes their dimensions;
 * an existing row's caption and tags are never overwritten, because those are
 * the parts a human wrote.
 */
router.post("/v1/cms/media/sync", async (_req, res): Promise<void> => {
  if (!isCloudinaryConfigured()) {
    res.status(503).json({ error: "Cloudinary is not configured" });
    return;
  }

  let indexed = 0;
  let added = 0;
  try {
    for (const folder of ALLOWED_FOLDERS) {
      let cursor: string | undefined;
      do {
        const page = await listCloudinaryResources(folder, { max: 100, nextCursor: cursor });
        const resources = (page?.resources ?? []) as {
          public_id: string;
          secure_url: string;
          format?: string;
          width?: number;
          height?: number;
          bytes?: number;
        }[];
        if (resources.length > 0) {
          const existing = await db
            .select({ public_id: cmsMediaAssetsTable.public_id })
            .from(cmsMediaAssetsTable)
            .where(inArray(cmsMediaAssetsTable.public_id, resources.map((r) => r.public_id)));
          const known = new Set(existing.map((e) => e.public_id));

          for (const resource of resources) {
            indexed += 1;
            if (!known.has(resource.public_id)) added += 1;
            await db
              .insert(cmsMediaAssetsTable)
              .values({
                public_id: resource.public_id,
                url: resource.secure_url,
                folder,
                format: resource.format ?? null,
                width: resource.width ?? null,
                height: resource.height ?? null,
                bytes: resource.bytes ?? null,
              })
              .onConflictDoUpdate({
                target: cmsMediaAssetsTable.public_id,
                set: {
                  url: resource.secure_url,
                  format: resource.format ?? null,
                  width: resource.width ?? null,
                  height: resource.height ?? null,
                  bytes: resource.bytes ?? null,
                  updated_at: new Date(),
                },
              });
          }
        }
        cursor = page?.next_cursor ?? undefined;
      } while (cursor);
    }
    res.json({ indexed, added });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed";
    console.error("[cms/media/sync] failed:", message);
    res.status(500).json({ error: message, indexed, added });
  }
});

export default router;
