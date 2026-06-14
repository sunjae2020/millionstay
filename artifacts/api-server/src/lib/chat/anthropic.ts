import Anthropic from "@anthropic-ai/sdk";

/** Thrown when the chat feature is not configured (no API key). Mapped to 503. */
export class ChatConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChatConfigError";
  }
}

let client: Anthropic | null = null;
let clientKey: string | null = null;

/**
 * Lazily create the Anthropic client. The key can be set/changed at runtime via
 * the admin Integrations page (it updates process.env), so rebuild the client
 * whenever the key differs from the one it was created with.
 */
export function getAnthropic(): Anthropic {
  const apiKey = process.env["ANTHROPIC_API_KEY"];
  if (!apiKey) {
    throw new ChatConfigError(
      "AI chat is not configured: set the Anthropic API key in Admin → Settings → Integrations.",
    );
  }
  if (!client || clientKey !== apiKey) {
    client = new Anthropic({ apiKey });
    clientKey = apiKey;
  }
  return client;
}

export function isChatConfigured(): boolean {
  return Boolean(process.env["ANTHROPIC_API_KEY"]);
}

/** Model used for the customer chat assistant. Overridable via CHAT_MODEL. */
export const CHAT_MODEL = process.env["CHAT_MODEL"] || "claude-sonnet-4-6";

/**
 * Model used for CS message auto-translation. Kept separate from CHAT_MODEL so
 * the high-volume, simple translation workload can run on a cheaper model
 * (Haiku) than the conversational assistant. Read as a function (not a const)
 * because admins change it at runtime via Admin → Settings → Integrations, which
 * updates process.env — see CS_TRANSLATE_MODEL in the integrations ALLOWED_KEYS.
 */
export function getCsTranslateModel(): string {
  return process.env["CS_TRANSLATE_MODEL"] || "claude-haiku-4-5-20251001";
}
