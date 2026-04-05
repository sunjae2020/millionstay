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

export async function uploadToCloudinary(
  buffer: Buffer,
  options: Record<string, unknown> = {}
): Promise<{ secure_url: string; thumbnail_url: string; public_id: string; bytes: number; format: string }> {
  const uploadResult = await new Promise<{ secure_url: string; public_id: string; bytes: number; format: string }>(
    (resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: "millionstay/spaces",
          transformation: [
            { quality: "auto", fetch_format: "auto" },
            { width: 1200, height: 900, crop: "limit" },
          ],
          ...options,
        },
        (error, result) => {
          if (error || !result) reject(error ?? new Error("Upload failed"));
          else resolve(result as { secure_url: string; public_id: string; bytes: number; format: string });
        }
      );
      stream.end(buffer);
    }
  );

  const thumbResult = await new Promise<{ secure_url: string }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "millionstay/thumbnails",
        transformation: [
          { width: 400, height: 300, crop: "fill", gravity: "auto" },
          { quality: "auto", fetch_format: "auto" },
        ],
      },
      (error, result) => {
        if (error || !result) reject(error ?? new Error("Thumbnail upload failed"));
        else resolve(result as { secure_url: string });
      }
    );
    stream.end(buffer);
  });

  return {
    secure_url: uploadResult.secure_url,
    thumbnail_url: thumbResult.secure_url,
    public_id: uploadResult.public_id,
    bytes: uploadResult.bytes,
    format: uploadResult.format,
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
