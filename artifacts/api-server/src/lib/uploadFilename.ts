/**
 * Multipart filename decoding.
 *
 * Busboy (under multer) hands `file.originalname` back as latin1, so any
 * non-ASCII filename arrives as mojibake — a Korean name lands as
 * "á á ¦á …" and is stored that way. macOS compounds it by submitting
 * decomposed Hangul (NFD), which renders as separate jamo everywhere else.
 *
 * Re-read the bytes as UTF-8 and normalise to NFC. ASCII names round-trip
 * unchanged, and anything that does not decode cleanly is returned as-is
 * rather than replaced with U+FFFD.
 */
export function decodeUploadFilename(name: string): string {
  if (!name) return name;
  try {
    const decoded = Buffer.from(name, "latin1").toString("utf8").normalize("NFC");
    return decoded.includes("�") ? name : decoded;
  } catch {
    return name;
  }
}
