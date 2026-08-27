import { Router, type IRouter } from "express";
import multer from "multer";
import {
  isCloudinaryConfigured,
  uploadToCloudinary,
  deleteFromCloudinary,
  listCloudinaryResources,
  moveCloudinaryAsset,
  cldFolder,
  CLOUDINARY_ROOT_FOLDER,
} from "../utils/cloudinary";

// Admin Media Library. Mounted under /api after the global /api/v1 requireAuth
// guard, so every route here is admin-authenticated.
const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

// Folders surfaced in the library. Deliberately EXCLUDES sensitive folders
// (private, condition, cs, jobs, avatars) that may hold personal / identifying
// images — the library is for marketing & CMS assets only. Keep this list in
// sync with the folders used by uploadToCloudinary callers.
//
// `content` (the website bucket) is further split into sub-folders so marketing
// assets don't pile into one flat list. Sub-folders are plain Cloudinary path
// segments — `content/hero` lives at `<root>/content/hero`.
export const CONTENT_SUBFOLDERS = [
  "brand", // 로고, 파비콘, OG 이미지 — 거의 안 바뀜
  "hero", // 페이지별 상단 배너
  "programs", // 프로그램·상품 이미지
  "team", // 직원·강사 프로필
  "gallery", // 캠프·활동 사진
  "blog", // 포스트 본문 이미지
  "icons", // 아이콘·일러스트
] as const;

const ALLOWED_FOLDERS = [
  "content",
  ...CONTENT_SUBFOLDERS.map((s) => `content/${s}`),
  "spaces",
  "listings",
  "branding",
] as const satisfies readonly string[];
function isAllowedFolder(f: string): boolean {
  return (ALLOWED_FOLDERS as readonly string[]).includes(f);
}

// GET /api/v1/media/folders — the folders the UI may browse.
router.get("/v1/media/folders", (_req, res): void => {
  res.json({ folders: ALLOWED_FOLDERS, content_subfolders: CONTENT_SUBFOLDERS });
});

// GET /api/v1/media?folder=content&cursor=... — list images in a folder.
router.get("/v1/media", async (req, res): Promise<void> => {
  const folder = String(req.query["folder"] ?? "content");
  if (!isAllowedFolder(folder)) {
    res.status(400).json({ error: "Invalid folder" });
    return;
  }
  if (!isCloudinaryConfigured()) {
    res.json({ resources: [], next_cursor: null });
    return;
  }
  try {
    const cursor = req.query["cursor"] ? String(req.query["cursor"]) : undefined;
    const out = await listCloudinaryResources(folder, {
      max: 60,
      nextCursor: cursor,
      // The website bucket lists only its own loose assets — the sub-folders
      // have their own tabs.
      ...(folder === "content"
        ? { excludePrefixes: CONTENT_SUBFOLDERS.map((s) => `content/${s}`) }
        : {}),
    });
    res.json(out);
  } catch (err) {
    const message = err instanceof Error ? err.message : "List failed";
    console.error("[media] list failed:", message);
    res.status(500).json({ error: "Failed to list media" });
  }
});

// POST /api/v1/media/upload (multipart: image, folder) — upload to a folder.
router.post("/v1/media/upload", upload.single("image"), async (req, res): Promise<void> => {
  const folder = String((req.body as { folder?: string })?.folder ?? "content");
  if (!isAllowedFolder(folder)) {
    res.status(400).json({ error: "Invalid folder" });
    return;
  }
  if (!req.file) {
    res.status(400).json({ error: "No file provided" });
    return;
  }
  try {
    if (isCloudinaryConfigured()) {
      const result = await uploadToCloudinary(req.file.buffer, { folder: cldFolder(folder) });
      res.json({ success: true, url: result.secure_url, public_id: result.public_id });
      return;
    }
    const dataUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
    res.json({ success: true, url: dataUrl, public_id: null });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    console.error("[media] upload failed:", message);
    res.status(500).json({ error: "Image upload failed" });
  }
});

// DELETE /api/v1/media  { public_id } — delete an asset. Guarded so only assets
// under an allowed folder within this instance's root can be removed.
router.delete("/v1/media", async (req, res): Promise<void> => {
  const publicId = String((req.body as { public_id?: string })?.public_id ?? "");
  if (!publicId) {
    res.status(400).json({ error: "public_id is required" });
    return;
  }
  const allowedPrefixes = ALLOWED_FOLDERS.map((f) => `${CLOUDINARY_ROOT_FOLDER}/${f}/`);
  if (!allowedPrefixes.some((p) => publicId.startsWith(p))) {
    res.status(400).json({ error: "Refusing to delete asset outside allowed media folders" });
    return;
  }
  try {
    await deleteFromCloudinary(publicId);
    res.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Delete failed";
    console.error("[media] delete failed:", message);
    res.status(500).json({ error: "Failed to delete media" });
  }
});

// Shared guard for the bulk endpoints: every id must live under an allowed
// folder inside this instance's root, so a crafted public_id can't reach
// private/CS/ID assets.
function assertOwnedIds(publicIds: string[]): string | null {
  const allowedPrefixes = ALLOWED_FOLDERS.map((f) => `${CLOUDINARY_ROOT_FOLDER}/${f}/`);
  for (const id of publicIds) {
    if (!allowedPrefixes.some((p) => id.startsWith(p))) {
      return `Refusing to touch asset outside allowed media folders: ${id}`;
    }
  }
  return null;
}

function parseIds(body: unknown): string[] {
  const raw = (body as { public_ids?: unknown })?.public_ids;
  if (!Array.isArray(raw)) return [];
  return raw.map((v) => String(v)).filter(Boolean).slice(0, 100);
}

// POST /api/v1/media/bulk-delete  { public_ids: [] } — delete many at once.
router.post("/v1/media/bulk-delete", async (req, res): Promise<void> => {
  const publicIds = parseIds(req.body);
  if (publicIds.length === 0) {
    res.status(400).json({ error: "public_ids is required" });
    return;
  }
  const bad = assertOwnedIds(publicIds);
  if (bad) {
    res.status(400).json({ error: bad });
    return;
  }
  const failed: string[] = [];
  for (const id of publicIds) {
    try {
      await deleteFromCloudinary(id);
    } catch {
      failed.push(id);
    }
  }
  res.json({ success: failed.length === 0, deleted: publicIds.length - failed.length, failed });
});

// POST /api/v1/media/move  { public_ids: [], folder } — move assets to another
// library folder. The public_id (and therefore the URL) changes.
router.post("/v1/media/move", async (req, res): Promise<void> => {
  const publicIds = parseIds(req.body);
  const folder = String((req.body as { folder?: string })?.folder ?? "");
  if (publicIds.length === 0) {
    res.status(400).json({ error: "public_ids is required" });
    return;
  }
  if (!isAllowedFolder(folder)) {
    res.status(400).json({ error: "Invalid folder" });
    return;
  }
  const bad = assertOwnedIds(publicIds);
  if (bad) {
    res.status(400).json({ error: bad });
    return;
  }
  if (!isCloudinaryConfigured()) {
    res.status(503).json({ error: "Media storage is not configured" });
    return;
  }
  const moved: { from: string; to: string; url: string }[] = [];
  const failed: string[] = [];
  for (const id of publicIds) {
    try {
      const out = await moveCloudinaryAsset(id, folder);
      moved.push({ from: id, to: out.public_id, url: out.secure_url });
    } catch (err) {
      console.error("[media] move failed:", id, err instanceof Error ? err.message : err);
      failed.push(id);
    }
  }
  res.json({ success: failed.length === 0, moved, failed });
});

export default router;
