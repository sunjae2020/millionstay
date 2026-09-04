// Photo capture helpers for the mobile web app.
//
// A modern phone camera produces 4–12 MB per shot; a work order carries a
// dozen. Downscaling in the browser before upload turns a stalled 4G upload
// into a couple of seconds, and 1600px on the long edge is still far more
// detail than any of these photos is ever printed at.

const MAX_EDGE = 1600;
const QUALITY = 0.82;

export async function downscaleImage(file: File, maxEdge = MAX_EDGE, quality = QUALITY): Promise<File> {
  // HEIC and friends can't be decoded by every browser; if anything below
  // fails we simply upload the original rather than losing the photo.
  try {
    if (!file.type.startsWith("image/")) return file;
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    if (scale >= 1 && file.size < 1_500_000) { bitmap.close?.(); return file; }

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) { bitmap.close?.(); return file; }
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    if (!blob || blob.size >= file.size) return file;
    const name = file.name.replace(/\.[^.]+$/, "") || "photo";
    return new File([blob], `${name}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
  } catch {
    return file;
  }
}

export async function downscaleAll(files: File[]): Promise<File[]> {
  return Promise.all(files.map((f) => downscaleImage(f)));
}
