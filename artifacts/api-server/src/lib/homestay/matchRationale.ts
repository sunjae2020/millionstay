// AI rationale layer for host suggestions (Phase 5b).
//
// The deterministic engine (matching.ts) decides the ranking; this adds a short
// human-readable "why this host" line per candidate using Claude. It is strictly
// best-effort: if the key is missing or the call fails, suggestions are returned
// unchanged (no rationale). It never throws to the caller.
import { getAiClient, isTaskConfigured } from "../ai/client.js";
import type { HomestayStudentRequest } from "@workspace/db";
import type { HostSuggestion } from "./matching.js";

const SYSTEM = `You are an operations assistant for a homestay placement agency. Given a student's homestay conditions and a shortlist of candidate host families (each already scored and filtered for hard requirements), write a concise 1–2 sentence rationale for EACH host explaining why they suit (or where to be cautious for) this student. Be specific and reference the actual matched points and concerns. Do not invent facts beyond what is provided. Never recommend a host that violates a safety or allergy concern. Respond ONLY with a JSON object mapping each host_application_id (as a string) to its rationale string.`;

function studentSummary(student: HomestayStudentRequest): Record<string, unknown> {
  const p = (student.preferences && typeof student.preferences === "object" ? student.preferences : {}) as Record<string, any>;
  return {
    gender: student.gender,
    is_minor: student.is_minor,
    nationality: student.nationality,
    allergic_to_pets: p.allergic_to_pets,
    can_live_with_pets: p.can_live_with_pets,
    smoker: p.smoker,
    can_live_with_smokers: p.can_live_with_smokers,
    can_live_with_children: p.can_live_with_children,
    can_live_with_students: p.can_live_with_students,
    dietary: p.dietary,
    meals: p.meals,
    beliefs: p.beliefs,
    campus_location: p.campus_location,
    school: p.school,
  };
}

/**
 * Attach `rationale` to each suggestion. Returns a new array; on any failure or
 * when AI is unconfigured, returns the input untouched. `ai_used` tells the
 * caller whether the LLM actually ran.
 */
export async function attachRationales(
  student: HomestayStudentRequest,
  suggestions: HostSuggestion[],
): Promise<{ suggestions: HostSuggestion[]; ai_used: boolean }> {
  if (!isTaskConfigured("match_rationale") || suggestions.length === 0) {
    return { suggestions, ai_used: false };
  }
  try {
    const ai = getAiClient("match_rationale");
    const payload = {
      student: studentSummary(student),
      hosts: suggestions.map((s) => ({
        host_application_id: s.host_application_id,
        host_name: s.host_name,
        suburb: s.suburb,
        score: s.score,
        matched: s.matched,
        concerns: s.concerns,
      })),
    };
    const msg = await ai.messages.create({
      max_tokens: 1024,
      // Static instructions are cache-friendly; the per-request data goes in the user turn.
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: JSON.stringify(payload) }],
    });
    const text = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
    const map = JSON.parse(json) as Record<string, string>;
    const withRationale = suggestions.map((s) => {
      const r = map[String(s.host_application_id)];
      return r ? { ...s, rationale: r } : s;
    });
    return { suggestions: withRationale, ai_used: true };
  } catch (e) {
    console.error("[homestay-match] rationale generation failed:", e);
    return { suggestions, ai_used: false };
  }
}
