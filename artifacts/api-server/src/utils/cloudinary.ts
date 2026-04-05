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

export async function deleteFromCloudinary(publicId: string): Promise<void> {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.error("Cloudinary delete error:", err);
  }
}

export default cloudinary;
