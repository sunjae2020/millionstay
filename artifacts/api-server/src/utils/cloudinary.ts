import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env["CLOUDINARY_CLOUD_NAME"],
  api_key: process.env["CLOUDINARY_API_KEY"],
  api_secret: process.env["CLOUDINARY_API_SECRET"],
});

export function isCloudinaryConfigured(): boolean {
  return !!(
    process.env["CLOUDINARY_CLOUD_NAME"] &&
    process.env["CLOUDINARY_API_KEY"] &&
    process.env["CLOUDINARY_API_SECRET"]
  );
}

/** Per-instance Cloudinary root folder (white-label). Defaults to "millionstay". */
export const CLOUDINARY_ROOT_FOLDER = process.env["CLOUDINARY_ROOT_FOLDER"]?.trim() || "millionstay";
/** Build a Cloudinary folder path under the instance root, e.g. cldFolder("spaces") -> "millionstay/spaces". */
export function cldFolder(sub: string): string {
  return `${CLOUDINARY_ROOT_FOLDER}/${sub}`;
}

/**
 * Upload an image to Cloudinary with automatic optimisation:
 *   - quality: auto   → Cloudinary picks the best quality (typically ~75-85 for web)
 *   - fetch_format: auto → serves WebP / AVIF to browsers that support it, JPEG otherwise
 *   - width: 1920, height: 1440, crop: limit → never upscales; caps at 1920×1440 px (≈ 2 MP)
 *   - strip_profile / exif removal is handled by Cloudinary automatically on upload
 *
 * Thumbnail URL is derived from the uploaded public_id via URL transformation
 * (no second upload needed — Cloudinary generates the variant on first request and caches it).
 */
export async function uploadToCloudinary(
  buffer: Buffer,
  options: Record<string, unknown> = {}
): Promise<{ secure_url: string; thumbnail_url: string; public_id: string; bytes: number; format: string }> {
  const result = await new Promise<{
    secure_url: string;
    public_id: string;
    bytes: number;
    format: string;
    version: number;
  }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: cldFolder("spaces"),
        transformation: [
          { quality: "auto:good", fetch_format: "auto" },
          { width: 1920, height: 1440, crop: "limit" },
          { dpr: "auto" },
        ],
        ...options,
      },
      (error, res) => {
        if (error || !res) reject(error ?? new Error("Cloudinary upload failed"));
        else resolve(res as { secure_url: string; public_id: string; bytes: number; format: string; version: number });
      }
    );
    stream.end(buffer);
  });

  const thumbnailUrl = cloudinary.url(result.public_id, {
    secure: true,
    transformation: [
      { width: 480, height: 360, crop: "fill", gravity: "auto" },
      { quality: "auto:eco", fetch_format: "auto" },
    ],
    version: result.version,
  });

  return {
    secure_url: result.secure_url,
    thumbnail_url: thumbnailUrl,
    public_id: result.public_id,
    bytes: result.bytes,
    format: result.format,
  };
}

/**
 * Sprint A-6 — Generate a time-limited Signed URL for a Cloudinary asset.
 *
 * Use this for sensitive documents (passport scans, signed contracts, invoices)
 * uploaded with `type: "authenticated"`. The returned URL contains a
 * `?__cld_token__=` query parameter that expires after `expiresInSeconds`.
 *
 * NOTE: Public marketing assets (e.g. space images) are stored as `type: "upload"`
 * and remain on permanent CDN URLs — switching them to signed URLs would break
 * SEO and browser caching. Only use this helper for assets uploaded as
 * `authenticated`.
 */
export function generateSignedUrl(publicId: string, expiresInSeconds = 900): string {
  if (!publicId) throw new Error("generateSignedUrl: publicId is required");
  return cloudinary.url(publicId, {
    sign_url: true,
    type: "authenticated",
    secure: true,
    expires_at: Math.floor(Date.now() / 1000) + expiresInSeconds,
  });
}

/**
 * Sprint A-6 — Upload a sensitive file (e.g. passport, contract PDF) using
 * Cloudinary `authenticated` mode so it can ONLY be served via signed URLs.
 *
 * Pair with `generateSignedUrl(publicId)` when serving the file to clients.
 */
export async function uploadPrivateToCloudinary(
  buffer: Buffer,
  options: Record<string, unknown> = {},
): Promise<{ public_id: string; bytes: number; format: string }> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: cldFolder("private"),
        type: "authenticated",
        access_mode: "authenticated",
        ...options,
      },
      (error, res) => {
        if (error || !res) reject(error ?? new Error("Cloudinary private upload failed"));
        else
          resolve({
            public_id: (res as any).public_id,
            bytes: (res as any).bytes,
            format: (res as any).format,
          });
      },
    );
    stream.end(buffer);
  });
}

export interface MediaResource {
  public_id: string;
  secure_url: string;
  thumbnail_url: string;
  format: string;
  bytes: number;
  width: number;
  height: number;
  created_at: string;
}

/**
 * List public ("upload"-type) images in a sub-folder under the instance root,
 * newest first. Used by the admin Media Library. Authenticated/private assets
 * (type: "authenticated") are never returned because we query type: "upload".
 */
export async function listCloudinaryResources(
  subFolder: string,
  opts: { max?: number; nextCursor?: string } = {},
): Promise<{ resources: MediaResource[]; next_cursor: string | null }> {
  const res = await cloudinary.api.resources({
    type: "upload",
    prefix: cldFolder(subFolder),
    max_results: opts.max ?? 60,
    direction: "desc",
    ...(opts.nextCursor ? { next_cursor: opts.nextCursor } : {}),
  });
  const resources: MediaResource[] = ((res.resources as unknown[]) ?? []).map((raw) => {
    const r = raw as { public_id: string; secure_url: string; version: number; format: string; bytes: number; width: number; height: number; created_at: string };
    return {
      public_id: r.public_id,
      secure_url: r.secure_url,
      thumbnail_url: cloudinary.url(r.public_id, {
        secure: true,
        version: r.version,
        transformation: [
          { width: 400, height: 300, crop: "fill", gravity: "auto" },
          { quality: "auto:eco", fetch_format: "auto" },
        ],
      }),
      format: r.format,
      bytes: r.bytes,
      width: r.width,
      height: r.height,
      created_at: r.created_at,
    };
  });
  return { resources, next_cursor: (res.next_cursor as string | undefined) ?? null };
}

export async function deleteFromCloudinary(publicId: string): Promise<void> {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.error("Cloudinary delete error:", err);
  }
}

export default cloudinary;
