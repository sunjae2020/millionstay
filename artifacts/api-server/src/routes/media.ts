import { Router, type IRouter } from "express";
import multer from "multer";
import {
  isCloudinaryConfigured,
  uploadToCloudinary,
  deleteFromCloudinary,
  listCloudinaryResources,
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
const ALLOWED_FOLDERS = ["content", "spaces", "listings", "branding"] as const;
type AllowedFolder = (typeof ALLOWED_FOLDERS)[number];
function isAllowedFolder(f: string): f is AllowedFolder {
  return (ALLOWED_FOLDERS as readonly string[]).includes(f);
}

// GET /api/v1/media/folders — the folders the UI may browse.
router.get("/v1/media/folders", (_req, res): void => {
  res.json({ folders: ALLOWED_FOLDERS });
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
    const out = await listCloudinaryResources(folder, { max: 60, nextCursor: cursor });
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

export default router;
