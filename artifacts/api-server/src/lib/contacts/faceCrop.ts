/**
 * Profile-photo face normalisation.
 *
 * An uploaded portrait is whatever the admin happened to have: a full-body shot,
 * a group photo, a tight selfie. The contact list and every avatar slot render a
 * small circle, so the useful part is always the same — the face, centred, at a
 * predictable size. This module turns Cloudinary's face-detection output
 * (`faces: true` on upload → `[[x, y, w, h], …]`) into a crop transformation that
 * puts the subject's face in the same place, at the same scale, on every photo.
 *
 * Geometry (all relative to the detected face box):
 *   • The output is a square. Its side is the face height divided by
 *     FACE_HEIGHT_RATIO, so a face always occupies the same share of the frame
 *     regardless of how far away the camera was.
 *   • The face centre sits at FACE_CENTER_Y of the frame height — slightly above
 *     the middle, which leaves room for hair above and shoulders below (the
 *     standard ID-photo composition).
 *   • The square is clamped inside the image, so a face near an edge shifts the
 *     frame rather than producing letterboxed padding.
 *
 * When no face is found we fall back to Cloudinary's content-aware square thumb,
 * which is what the avatar used to be — never worse than before.
 */

/** Detected face box, in pixels: [x, y, width, height]. */
export type FaceBox = [number, number, number, number];

/** Share of the output frame height taken by the detected face box. */
const FACE_HEIGHT_RATIO = 0.52;
/** Where the face centre lands vertically inside the frame (0 = top, 1 = bottom). */
const FACE_CENTER_Y = 0.44;
/** Rendered avatar size (square, px). */
const AVATAR_SIZE = 512;

export interface FaceCropResult {
  /** Cloudinary transformation array for the normalised avatar. */
  transformation: Array<Record<string, unknown>>;
  /** False when no face was detected and the centre-weighted fallback was used. */
  faceDetected: boolean;
  /** How many faces the detector found (0 when none). */
  faceCount: number;
}

/** Cloudinary's `faces` response is loosely typed — keep only well-formed boxes. */
export function parseFaces(raw: unknown): FaceBox[] {
  if (!Array.isArray(raw)) return [];
  const boxes: FaceBox[] = [];
  for (const entry of raw) {
    if (!Array.isArray(entry) || entry.length < 4) continue;
    const [x, y, w, h] = entry.map(Number);
    if ([x, y, w, h].some((n) => !Number.isFinite(n)) || w! <= 0 || h! <= 0) continue;
    boxes.push([x!, y!, w!, h!]);
  }
  return boxes;
}

/** The subject of a group photo is the largest face — pick it. */
function largestFace(faces: FaceBox[]): FaceBox | null {
  let best: FaceBox | null = null;
  for (const face of faces) {
    if (!best || face[2] * face[3] > best[2] * best[3]) best = face;
  }
  return best;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

/** Square, content-aware crop — used when there is no face to centre on. */
function fallbackTransformation(): Array<Record<string, unknown>> {
  return [
    { width: AVATAR_SIZE, height: AVATAR_SIZE, crop: "thumb", gravity: "auto" },
    { quality: "auto:good", fetch_format: "auto" },
  ];
}

/**
 * Build the avatar transformation for an uploaded image.
 *
 * `imageWidth`/`imageHeight` are the dimensions of the *stored* asset, which is
 * also the basis Cloudinary reports face coordinates in. A face box that spills
 * outside those bounds means the two came from different bases (an incoming
 * transformation resized the asset after detection), so the boxes are rescaled
 * uniformly back into range instead of producing a crop outside the image.
 */
export function buildFaceCrop(
  faces: FaceBox[],
  imageWidth: number,
  imageHeight: number,
): FaceCropResult {
  if (!faces.length || imageWidth <= 0 || imageHeight <= 0) {
    return { transformation: fallbackTransformation(), faceDetected: false, faceCount: faces.length };
  }

  let scale = 1;
  for (const [x, y, w, h] of faces) {
    if (x + w > imageWidth) scale = Math.min(scale, imageWidth / (x + w));
    if (y + h > imageHeight) scale = Math.min(scale, imageHeight / (y + h));
  }
  const face = largestFace(faces.map(([x, y, w, h]) => [x * scale, y * scale, w * scale, h * scale] as FaceBox));
  if (!face) {
    return { transformation: fallbackTransformation(), faceDetected: false, faceCount: 0 };
  }

  const [fx, fy, fw, fh] = face;
  // Square side that gives the face its standard share of the frame; never
  // larger than the image itself (a close-up head shot cannot be zoomed out).
  const side = Math.round(clamp(fh / FACE_HEIGHT_RATIO, 1, Math.min(imageWidth, imageHeight)));
  const faceCenterX = fx + fw / 2;
  const faceCenterY = fy + fh / 2;
  const x = Math.round(clamp(faceCenterX - side / 2, 0, imageWidth - side));
  const y = Math.round(clamp(faceCenterY - side * FACE_CENTER_Y, 0, imageHeight - side));

  return {
    transformation: [
      { crop: "crop", x, y, width: side, height: side },
      { width: AVATAR_SIZE, height: AVATAR_SIZE, crop: "fill" },
      { quality: "auto:good", fetch_format: "auto" },
    ],
    faceDetected: true,
    faceCount: faces.length,
  };
}
