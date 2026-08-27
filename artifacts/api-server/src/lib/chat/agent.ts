import type Anthropic from "@anthropic-ai/sdk";
import { db, chatMessagesTable, chatConversationsTable } from "@workspace/db";
import { eq, asc, and, ne } from "drizzle-orm";
import { getAiClient } from "../ai/client.js";
import { buildSystemBlocks } from "./systemPrompt";
import { TOOLS, executeTool, type ToolContext } from "./tools";

const MAX_ITERATIONS = 6;
const MAX_TOKENS = 1500;

/** Events streamed back to the caller during a turn. */
export type ChatEvent =
  | { type: "delta"; text: string }
  | { type: "tool"; name: string }
  | { type: "ui"; kind: string; data: unknown }
  | { type: "done"; text: string }
  | { type: "error"; message: string };

export interface RunTurnParams {
  conversationId: string;
  sessionId: string;
  userMessage: string;
  emit: (event: ChatEvent) => void;
}

/** Reconstruct prior cross-turn history as plain user/assistant text messages. */
async function loadHistory(conversationId: string): Promise<Anthropic.MessageParam[]> {
  const rows = await db
    .select({ role: chatMessagesTable.role, content: chatMessagesTable.content })
    .from(chatMessagesTable)
    .where(and(eq(chatMessagesTable.conversation_id, conversationId), ne(chatMessagesTable.content, "")))
    .orderBy(asc(chatMessagesTable.created_at));

  return rows
    .filter((r) => (r.role === "user" || r.role === "assistant") && r.content.trim().length > 0)
    .map((r) => ({ role: r.role as "user" | "assistant", content: r.content }));
}

function textFromBlocks(blocks: Anthropic.ContentBlock[]): string {
  return blocks
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

/**
 * Run one assistant turn: stream text, execute any tool calls, persist every
 * message, and emit events. Returns the final assistant text.
 */
export async function runChatTurn(params: RunTurnParams): Promise<string> {
  const { conversationId, sessionId, userMessage, emit } = params;
  const ai = getAiClient("chat");
  const ctx: ToolContext = { conversationId, sessionId };

  const messages = await loadHistory(conversationId);
  messages.push({ role: "user", content: userMessage });

  // Persist the visitor's message.
  await db.insert(chatMessagesTable).values({ conversation_id: conversationId, role: "user", content: userMessage });

  const system = await buildSystemBlocks();
  let finalText = "";

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    // The model comes from the "chat" task registry entry, so re-pointing the
    // assistant at another vendor is an env change, not an edit here.
    const stream = ai.messages.stream({
      max_tokens: MAX_TOKENS,
      system,
      tools: TOOLS,
      messages,
    });
    stream.on("text", (delta) => emit({ type: "delta", text: delta }));

    const final = await stream.finalMessage();
    const text = textFromBlocks(final.content);
    if (text) finalText = text;

    const toolUses = final.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");

    // Persist the assistant turn (text + any tool calls + token usage).
    await db.insert(chatMessagesTable).values({
      conversation_id: conversationId,
      role: "assistant",
      content: text,
      tool_calls: toolUses.length ? toolUses : null,
      input_tokens: final.usage?.input_tokens ?? null,
      output_tokens: final.usage?.output_tokens ?? null,
    });

    messages.push({ role: "assistant", content: final.content });

    if (final.stop_reason !== "tool_use" || toolUses.length === 0) break;

    // Execute each requested tool and feed results back.
    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const tu of toolUses) {
      emit({ type: "tool", name: tu.name });
      let resultPayload: unknown;
      try {
        const out = await executeTool(tu.name, (tu.input ?? {}) as Record<string, any>, ctx);
        resultPayload = out.result;
        if (out.ui) emit({ type: "ui", kind: out.ui.kind, data: out.ui.data });
      } catch (err) {
        resultPayload = { error: err instanceof Error ? err.message : "tool failed" };
      }
      const contentStr = JSON.stringify(resultPayload);
      await db.insert(chatMessagesTable).values({
        conversation_id: conversationId,
        role: "tool",
        content: contentStr,
        tool_name: tu.name,
      });
      toolResults.push({ type: "tool_result", tool_use_id: tu.id, content: contentStr });
    }
    messages.push({ role: "user", content: toolResults });
  }

  await db
    .update(chatConversationsTable)
    .set({ last_message_at: new Date() })
    .where(eq(chatConversationsTable.id, conversationId));

  emit({ type: "done", text: finalText });
  return finalText;
}
