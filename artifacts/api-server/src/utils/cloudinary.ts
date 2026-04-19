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
        folder: "millionstay/spaces",
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
        folder: "millionstay/private",
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

export async function deleteFromCloudinary(publicId: string): Promise<void> {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.error("Cloudinary delete error:", err);
  }
}

export default cloudinary;
