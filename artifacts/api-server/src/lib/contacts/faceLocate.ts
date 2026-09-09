import { getAiClient, isTaskConfigured } from "../ai/client.js";

/**
 * Second-chance face finder for profile photos.
 *
 * Cloudinary's detector is fast and free but it only recognises reasonably sharp,
 * frontal faces. Real contact photos are often none of those: a phone snapshot of
 * a printed portrait, a scan whose subject is cut off by the frame, a face at an
 * angle. Those come back with zero faces, the avatar falls back to a centre crop,
 * and nothing about the photo improves.
 *
 * So when the detector finds nothing, the image goes to the vision model with one
 * question — where is the face? — and the answer is fed into the same crop
 * geometry as a native detection (see faceCrop.ts). Nothing else is asked for and
 * nothing is read out of the picture: this call returns a rectangle, never text.
 *
 * The task is registered as `face_locate` (lib/ai/tasks.ts), so it resolves its
 * model from the admin's settings and is metered like every other AI call. If no
 * provider is configured the function returns null and the caller keeps its
 * previous fallback — a missing AI key must never fail a photo upload.
 */

/** Face box as fractions (0–1) of the image width/height. */
export interface RelativeBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

const SYSTEM_PROMPT =
  `You locate a human face in a photograph and answer with coordinates only.\n\n` +
  `Return the bounding box of the FACE of the main subject: from the top of the ` +
  `forehead (hairline) to the bottom of the chin, and from ear to ear. Exclude hair ` +
  `above the hairline, the neck and the shoulders.\n\n` +
  `Rules:\n` +
  `• Coordinates are fractions of the image size: x and y are the left/top corner, ` +
  `w and h the width/height, each between 0 and 1.\n` +
  `• If several people are visible, box the largest, most prominent face.\n` +
  `• If the face is partly outside the frame, box the visible part only, and keep ` +
  `the box inside the image.\n` +
  `• The image may be blurry, low contrast, or a photograph of a printed photo — ` +
  `answer anyway if a face is discernible.\n` +
  `• If no human face is discernible at all, answer with null.\n\n` +
  `Respond with ONLY this JSON: {"face":{"x":<num>,"y":<num>,"w":<num>,"h":<num>}|null,` +
  `"confidence":<0-1>}. No prose, no code fences.`;

/**
 * Ask the model where the face is. Returns null when the task is unconfigured,
 * when the model finds no face, or when its answer is unusable — every one of
 * those means "carry on without a face box", never an error.
 */
export async function locateFace(image: { buffer: Buffer; mimetype: string }): Promise<RelativeBox | null> {
  if (!isTaskConfigured("face_locate")) return null;

  try {
    const ai = getAiClient("face_locate");
    const msg = await ai.messages.create({
      max_tokens: 200,
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [{
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: image.mimetype.toLowerCase(), data: image.buffer.toString("base64") },
          },
          { type: "text", text: "Where is the face?" },
        ] as never,
      }],
    });

    const raw = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    const parsed = JSON.parse(raw.slice(start, end + 1)) as { face?: unknown };
    return normaliseBox(parsed.face);
  } catch (err) {
    // A face box is a nicety; losing it must not cost the upload.
    console.error("[contacts] AI face locate failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

/** Keep only a box that is inside the image and big enough to be a face. */
function normaliseBox(raw: unknown): RelativeBox | null {
  if (!raw || typeof raw !== "object") return null;
  const box = raw as Record<string, unknown>;
  if (!["x", "y", "w", "h"].every((k) => typeof box[k] === "number" && Number.isFinite(box[k]))) return null;
  const x = Math.min(1, Math.max(0, box["x"] as number));
  const y = Math.min(1, Math.max(0, box["y"] as number));
  const w = Math.min(1 - x, Math.max(0, box["w"] as number));
  const h = Math.min(1 - y, Math.max(0, box["h"] as number));
  // Below ~2% of the frame it is noise, not a face the avatar should centre on.
  if (w < 0.02 || h < 0.02) return null;
  return { x, y, w, h };
}
