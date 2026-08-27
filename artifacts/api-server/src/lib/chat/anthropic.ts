/**
 * Compatibility surface for the chat feature.
 *
 * Provider selection, model resolution and metering now live in `lib/ai/`, which
 * every AI call site goes through. This file survives because the chat route and
 * agent are written against its two names, and because `ChatConfigError` is what
 * `routes/chat.ts` catches to return a 503.
 *
 * `ChatConfigError` is an ALIAS of `AiConfigError`, not a separate class — the
 * chat route's `instanceof` check must still match the error the client factory
 * throws, whichever vendor the chat task is pointed at.
 */

export { AiConfigError as ChatConfigError } from "../ai/client.js";

import { isTaskConfigured } from "../ai/client.js";

/** True when the public chat assistant can run as currently configured. */
export function isChatConfigured(): boolean {
  return isTaskConfigured("chat");
}
