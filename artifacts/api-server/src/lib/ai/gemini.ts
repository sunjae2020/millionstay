/**
 * Gemini adapter — presents Google's OpenAI-compatible endpoint through the
 * same `messages.create()` surface the rest of the codebase already calls.
 *
 * Every AI call site in this repo was written against the Anthropic SDK. Rather
 * than rewrite fifteen call sites into a lowest-common-denominator interface,
 * the adapter translates at the boundary: Anthropic-shaped request in,
 * Anthropic-shaped response out, OpenAI wire format in between.
 *
 * What does NOT translate is refused loudly rather than silently dropped:
 *
 *   - `document` (PDF) blocks — no equivalent on this endpoint. Silently
 *     dropping one would hand the model a classification prompt with no
 *     document attached, and it would still answer.
 *   - `tools` / `tool_use` — expressible, but the multi-turn tool loop in
 *     agent.ts depends on Anthropic block semantics; a half-working
 *     translation is worse than a clear refusal.
 *   - streaming — not implemented; `client.ts` gates streaming tasks off this
 *     provider before a call is ever made.
 *
 * `cache_control` is accepted and ignored, matching the endpoint's behaviour.
 */

const REQUEST_TIMEOUT_MS = 120_000;

export class GeminiAdapterError extends Error {
  /**
   * HTTP status when the vendor answered, undefined for a local translation
   * failure or a timeout. The fallback logic in `client.ts` reads this to tell a
   * retryable outage (429 / 5xx) from a request this adapter can never satisfy
   * (a PDF block), which must fail loudly rather than be retried elsewhere.
   */
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "GeminiAdapterError";
    this.status = status;
  }
}

type AnthropicBlock = Record<string, any>;

interface CreateParams {
  model: string;
  max_tokens?: number;
  temperature?: number;
  system?: string | AnthropicBlock[];
  messages: Array<{ role: string; content: string | AnthropicBlock[] }>;
  tools?: unknown;
  [k: string]: unknown;
}

/** Flatten Anthropic's `system` (string or cache-controlled blocks) to text. */
function systemText(system: CreateParams["system"]): string | null {
  if (!system) return null;
  if (typeof system === "string") return system;
  const text = system
    .map((b) => (b?.type === "text" && typeof b.text === "string" ? b.text : ""))
    .join("\n\n")
    .trim();
  return text || null;
}

/** Anthropic content blocks → OpenAI `content` parts. */
function toOpenAiContent(content: string | AnthropicBlock[]): unknown {
  if (typeof content === "string") return content;

  const parts: unknown[] = [];
  for (const block of content) {
    switch (block?.type) {
      case "text":
        parts.push({ type: "text", text: String(block.text ?? "") });
        break;
      case "image": {
        const src = block.source ?? {};
        if (src.type === "base64") {
          parts.push({
            type: "image_url",
            image_url: { url: `data:${src.media_type};base64,${src.data}` },
          });
        } else if (src.type === "url" && typeof src.url === "string") {
          parts.push({ type: "image_url", image_url: { url: src.url } });
        } else {
          throw new GeminiAdapterError("Unsupported image source for the Gemini adapter.");
        }
        break;
      }
      case "document":
        throw new GeminiAdapterError(
          "PDF document blocks cannot be sent to Gemini through the OpenAI-compatible endpoint. " +
            "Point this task at Anthropic.",
        );
      case "tool_use":
      case "tool_result":
        throw new GeminiAdapterError(
          "Tool-use conversations are not translated by the Gemini adapter. Point this task at Anthropic.",
        );
      default:
        throw new GeminiAdapterError(`Unsupported content block "${block?.type}" for the Gemini adapter.`);
    }
  }
  return parts;
}

/** OpenAI `finish_reason` → the Anthropic `stop_reason` callers branch on. */
function toStopReason(finish: string | null | undefined): string {
  switch (finish) {
    case "length":
      return "max_tokens";
    case "content_filter":
      return "refusal";
    case "tool_calls":
      return "tool_use";
    default:
      return "end_turn";
  }
}

export interface GeminiClientOptions {
  apiKey: string;
  baseUrl: string;
}

/**
 * A minimal stand-in for the Anthropic SDK client, exposing only what the call
 * sites use. Structurally compatible on purpose — `client.ts` hands this back
 * where an `Anthropic` instance would otherwise go.
 */
export function createGeminiClient(opts: GeminiClientOptions) {
  async function create(params: CreateParams): Promise<any> {
    if (params.tools) {
      throw new GeminiAdapterError(
        "Tool use is not supported by the Gemini adapter. Point this task at Anthropic.",
      );
    }

    const messages: unknown[] = [];
    const sys = systemText(params.system);
    if (sys) messages.push({ role: "system", content: sys });
    for (const m of params.messages) {
      messages.push({ role: m.role, content: toOpenAiContent(m.content) });
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(`${opts.baseUrl}/chat/completions`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${opts.apiKey}`,
        },
        body: JSON.stringify({
          model: params.model,
          messages,
          max_tokens: params.max_tokens,
          ...(params.temperature !== undefined ? { temperature: params.temperature } : {}),
        }),
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        // No status: a timeout is retryable, and `isRetryable` treats a missing
        // status on a transport failure as such.
        throw new GeminiAdapterError("The Gemini request timed out.");
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      // Surface the vendor's own message — it is what tells an admin whether the
      // key is wrong, the model name is wrong, or the quota is exhausted.
      throw new GeminiAdapterError(`Gemini API error ${res.status}: ${body.slice(0, 500)}`, res.status);
    }

    const json = (await res.json()) as any;
    const choice = json?.choices?.[0];
    const text = typeof choice?.message?.content === "string" ? choice.message.content : "";

    return {
      id: json?.id ?? "gemini",
      model: json?.model ?? params.model,
      role: "assistant",
      type: "message",
      content: [{ type: "text", text }],
      stop_reason: toStopReason(choice?.finish_reason),
      usage: {
        input_tokens: json?.usage?.prompt_tokens ?? 0,
        output_tokens: json?.usage?.completion_tokens ?? 0,
      },
    };
  }

  function stream(): never {
    throw new GeminiAdapterError(
      "Streaming is not implemented for the Gemini adapter. Point streaming tasks at Anthropic.",
    );
  }

  return { messages: { create, stream } };
}
