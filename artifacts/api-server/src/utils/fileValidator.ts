/**
 * File MIME validation by magic bytes — Sprint B-6
 *
 * Defends against malicious uploads with spoofed MIME headers (e.g. .exe with
 * Content-Type: image/jpeg). Reads the leading bytes and matches them to
 * known file-type signatures.
 *
 * Usage:
 *   const ok = validateMimeBySignature(buffer, declaredMime);
 *   if (!ok) throw new Error("File contents do not match declared type");
 */
const ALLOWED_SIGNATURES: Record<string, number[][]> = {
  "application/pdf": [[0x25, 0x50, 0x44, 0x46]], // %PDF
  "image/jpeg": [[0xff, 0xd8, 0xff]],
  "image/png": [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  "image/webp": [[0x52, 0x49, 0x46, 0x46]], // RIFF (followed by ...WEBP at offset 8)
  "image/gif": [
    [0x47, 0x49, 0x46, 0x38, 0x37, 0x61], // GIF87a
    [0x47, 0x49, 0x46, 0x38, 0x39, 0x61], // GIF89a
  ],
};

export function validateMimeBySignature(buffer: Buffer, declaredMime: string): boolean {
  const sigs = ALLOWED_SIGNATURES[declaredMime];
  if (!sigs || !buffer || buffer.length < 4) return false;

  const matches = sigs.some((sig) => sig.every((byte, i) => buffer[i] === byte));
  if (!matches) return false;

  // Extra check for WebP — the next 4 bytes after RIFF size must be "WEBP"
  if (declaredMime === "image/webp") {
    if (buffer.length < 12) return false;
    const tag = buffer.slice(8, 12).toString("ascii");
    return tag === "WEBP";
  }

  return true;
}

export function isMimeAllowed(declaredMime: string): boolean {
  return Object.prototype.hasOwnProperty.call(ALLOWED_SIGNATURES, declaredMime);
}

export function listAllowedMimes(): string[] {
  return Object.keys(ALLOWED_SIGNATURES);
}
