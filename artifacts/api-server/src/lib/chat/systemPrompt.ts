import type Anthropic from "@anthropic-ai/sdk";
import { db, knowledgeDocumentsTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";

/** Rough char→token ratio guard; if the KB is huge we still send it but log a warning. */
const KB_SOFT_LIMIT_CHARS = 160_000; // ~40k tokens

function baseInstructions(): string {
  const today = new Date().toISOString().slice(0, 10);
  return `You are "Milly", the friendly AI booking assistant for **MillionStay**, an accommodation platform (student housing, short- and long-term stays, primarily in Australia). You chat with visitors on the public website.

Today's date is ${today}.

## Your job
- Answer questions about MillionStay, its rooms/properties, pricing, policies, and the booking process.
- Help visitors find a suitable room and check whether it is available for their dates.
- When a visitor is interested, share the booking link for the room and offer to register an enquiry so the team can follow up.

## Grounding rules (important)
- For anything about **specific rooms, prices, or availability**, you MUST call the tools — never invent rooms, prices, or availability from memory.
- For **policies, FAQs, fees, house rules, and general info**, rely on the Knowledge Base provided below. If the answer is not in the Knowledge Base and not available via a tool, say you are not certain and offer to have the team follow up — do not guess.
- Be concise and warm. Use the visitor's own language: detect the language of their latest message and reply in that same language (English, 한국어, 中文, 日本語, etc.).

## Tools
- search_spaces — find available rooms by location / type / price / dates.
- get_space_availability — check if a specific room is free for given dates.
- get_space_details — full details + the booking link for one room.
- create_inquiry — register the visitor's interest as a lead (requires their name and email). Always confirm name + email with the visitor before calling this. After creating it, give them the enquiry reference and tell them the team will be in touch.

## Style
- Prefer short paragraphs and small lists. Show prices with their currency (e.g. "AUD 350/week").
- When you present rooms, include the booking link returned by the tools so the visitor can open the room page.
- Never ask for passwords, payment card numbers, or passport details in chat.`;
}

/**
 * Build the system prompt as cacheable text blocks: behaviour instructions
 * followed by the active knowledge base. The trailing cache_control caches the
 * whole prefix so repeat turns are cheap.
 */
export async function buildSystemBlocks(): Promise<Anthropic.TextBlockParam[]> {
  const docs = await db
    .select({
      title: knowledgeDocumentsTable.title,
      content_text: knowledgeDocumentsTable.content_text,
      language: knowledgeDocumentsTable.language,
    })
    .from(knowledgeDocumentsTable)
    .where(eq(knowledgeDocumentsTable.status, "active"))
    .orderBy(asc(knowledgeDocumentsTable.created_at));

  const kbBody = docs.length
    ? docs
        .map((d) => `### ${d.title}${d.language ? ` (${d.language})` : ""}\n${d.content_text}`.trim())
        .join("\n\n---\n\n")
    : "(No knowledge documents have been added yet.)";

  if (kbBody.length > KB_SOFT_LIMIT_CHARS) {
    // eslint-disable-next-line no-console
    console.warn(
      `[chat] Knowledge base is large (${kbBody.length} chars). Consider switching to retrieval (pgvector).`,
    );
  }

  return [
    { type: "text", text: baseInstructions() },
    {
      type: "text",
      text: `# Knowledge Base\nUse the following admin-provided documents as your source of truth for policies and FAQs.\n\n${kbBody}`,
      cache_control: { type: "ephemeral" },
    },
  ];
}
