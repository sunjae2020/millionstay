/**
 * The registry of every AI task the platform runs — the SSOT behind the admin's
 * "AI 작업" table and behind every model-resolution decision on the server.
 *
 * Adding a new AI call site means adding a row here first. That is deliberate:
 * the registry is what makes "which model does this job, and may it be moved to
 * a cheaper vendor?" answerable without grepping the codebase, and what stops a
 * PDF-reading task from being pointed at a text-only model.
 *
 * `needs` drives the capability gate in `client.ts`; `movable` is the
 * human-judgement column shown in the admin. They are related but distinct: a
 * task can be technically runnable on a cheap model (`needs` satisfied) and
 * still be a bad idea to move (`movable: "no"`), which is exactly the case for
 * document intake — see the note on that row.
 */

import type { AiCapabilities, AiProviderId } from "./providers.js";

export type AiTaskId =
  | "chat"
  | "cs_translate"
  | "i18n_translate"
  | "cms_translate"
  | "content_translate"
  | "business_card_ocr"
  | "id_document_ocr"
  | "document_intake"
  | "website_enrich"
  | "match_rationale";

/** How safe it is to move this task off the strongest model. */
export type Movability = "yes" | "verify" | "no";

/** Rough call volume, used to rank optimisation candidates in the admin. */
export type Volume = "high" | "medium" | "low";

export interface AiTask {
  id: AiTaskId;
  /** i18n key suffix under `ai_ops.task.*` in the admin locales. */
  label: string;
  /** Product area, for grouping the admin table. */
  area: "chat" | "translation" | "documents" | "data";
  /** Env var that overrides this task's model. Runtime-settable by an admin. */
  envKey: string;
  /** Model used when `envKey` (and its fallback) are unset. */
  defaultModel: string;
  /**
   * Env var consulted before `defaultModel` when `envKey` is unset. Preserves
   * the pre-registry behaviour where several tasks all followed CHAT_MODEL.
   */
  fallbackEnvKey?: string;
  /** Capabilities the call site actually uses. Enforced by the client factory. */
  needs: Partial<AiCapabilities>;
  volume: Volume;
  movable: Movability;
  /** Where the call lives, so the admin table links to something real. */
  source: string;
  /** Why the movability verdict is what it is. Shown as the admin row hint. */
  rationale: string;
}

export const AI_TASKS: Record<AiTaskId, AiTask> = {
  chat: {
    id: "chat",
    label: "chat",
    area: "chat",
    envKey: "CHAT_MODEL",
    defaultModel: "claude-sonnet-4-6",
    needs: { tools: true, streaming: true },
    volume: "medium",
    movable: "verify",
    source: "lib/chat/agent.ts",
    rationale:
      "Public-facing, streams, and calls four tools. Needs a live round-trip against the " +
      "target vendor's tool-use support before it can move.",
  },
  cs_translate: {
    id: "cs_translate",
    label: "cs_translate",
    area: "translation",
    envKey: "CS_TRANSLATE_MODEL",
    defaultModel: "claude-haiku-4-5-20251001",
    needs: {},
    volume: "high",
    movable: "yes",
    source: "lib/chat/translateMessage.ts",
    rationale:
      "Highest-volume task and plain text in / JSON out. Already isolated on its own model " +
      "lever, so it is the natural first A/B candidate.",
  },
  i18n_translate: {
    id: "i18n_translate",
    label: "i18n_translate",
    area: "translation",
    envKey: "I18N_TRANSLATE_MODEL",
    fallbackEnvKey: "CHAT_MODEL",
    defaultModel: "claude-sonnet-4-6",
    needs: {},
    volume: "medium",
    movable: "yes",
    source: "routes/translations.ts",
    rationale: "Batch UI-string translation and review. Output is edited by a human before shipping.",
  },
  cms_translate: {
    id: "cms_translate",
    label: "cms_translate",
    area: "translation",
    envKey: "CMS_TRANSLATE_MODEL",
    fallbackEnvKey: "CHAT_MODEL",
    defaultModel: "claude-sonnet-4-6",
    needs: {},
    volume: "low",
    movable: "yes",
    source: "routes/cms.ts",
    rationale:
      "Translates the text props of a page's block tree. Structure, ids and styling never reach " +
      "the model, so a weaker one cannot break a layout.",
  },
  content_translate: {
    id: "content_translate",
    label: "content_translate",
    area: "translation",
    envKey: "CONTENT_TRANSLATE_MODEL",
    fallbackEnvKey: "CHAT_MODEL",
    defaultModel: "claude-sonnet-4-6",
    needs: {},
    volume: "medium",
    movable: "yes",
    source: "routes/content-translations.ts",
    rationale: "Space / listing / amenity copy. Drafts are reviewed in the admin before publishing.",
  },
  business_card_ocr: {
    id: "business_card_ocr",
    label: "business_card_ocr",
    area: "documents",
    envKey: "BUSINESS_CARD_OCR_MODEL",
    fallbackEnvKey: "CHAT_MODEL",
    defaultModel: "claude-sonnet-4-6",
    needs: { vision: true },
    volume: "low",
    movable: "verify",
    source: "lib/contacts/businessCardOcr.ts",
    rationale:
      "Vision task, but every field is confirmed by an admin in the approval dialog, so a " +
      "misread costs a correction rather than bad data.",
  },
  id_document_ocr: {
    id: "id_document_ocr",
    label: "id_document_ocr",
    area: "documents",
    envKey: "ID_DOC_OCR_MODEL",
    fallbackEnvKey: "CHAT_MODEL",
    defaultModel: "claude-sonnet-4-6",
    needs: { vision: true },
    volume: "low",
    movable: "no",
    source: "lib/contacts/idDocumentOcr.ts",
    rationale:
      "Reads passports and 주민등록증 to crop a portrait and transcribe GENERAL fields only — " +
      "document numbers are refused by prompt and scrubbed from the output. Sending an identity " +
      "document to a vendor is a privacy decision, not a cost one, so the engine stays where the " +
      "data-handling terms are known.",
  },
  document_intake: {
    id: "document_intake",
    label: "document_intake",
    area: "documents",
    envKey: "DOCUMENT_INTAKE_MODEL",
    defaultModel: "claude-opus-5",
    needs: { vision: true, pdf: true },
    volume: "medium",
    movable: "no",
    source: "lib/documents/intakeScan.ts",
    rationale:
      "Reads base64 PDFs and classifies them, and the chosen type sets the file's RETENTION " +
      "PERIOD. A misclassification puts a 30-day identity-scan clock on a 7-year contract, so " +
      "this task stays on the strongest model regardless of price.",
  },
  website_enrich: {
    id: "website_enrich",
    label: "website_enrich",
    area: "data",
    envKey: "WEBSITE_ENRICH_MODEL",
    fallbackEnvKey: "CHAT_MODEL",
    defaultModel: "claude-sonnet-4-6",
    needs: {},
    volume: "low",
    movable: "yes",
    source: "lib/accounts/websiteEnrich.ts",
    rationale: "Reads scraped page text and proposes account fields. Nothing is written without approval.",
  },
  match_rationale: {
    id: "match_rationale",
    label: "match_rationale",
    area: "data",
    envKey: "MATCH_RATIONALE_MODEL",
    fallbackEnvKey: "CHAT_MODEL",
    defaultModel: "claude-sonnet-4-6",
    needs: {},
    volume: "low",
    movable: "yes",
    source: "lib/homestay/matchRationale.ts",
    rationale:
      "Writes a one-line reason next to an already-computed match score. Fails soft — the " +
      "suggestions still render without it.",
  },
};

export const AI_TASK_IDS: AiTaskId[] = Object.keys(AI_TASKS) as AiTaskId[];

/** Every env var an admin may set to steer a task's model. */
export function taskModelEnvKeys(): string[] {
  return AI_TASK_IDS.map((id) => AI_TASKS[id].envKey);
}

/**
 * The model string configured for a task, before provider parsing.
 * Order: the task's own env key → its historical fallback key → the default.
 */
export function configuredModelRef(id: AiTaskId): string {
  const task = AI_TASKS[id];
  const own = process.env[task.envKey];
  if (own && own.trim()) return own.trim();
  if (task.fallbackEnvKey) {
    const fb = process.env[task.fallbackEnvKey];
    if (fb && fb.trim()) return fb.trim();
  }
  return task.defaultModel;
}

/** Capabilities a provider must have to run this task. */
export function requiredCapabilities(id: AiTaskId): Array<keyof AiCapabilities> {
  const needs = AI_TASKS[id].needs;
  return (Object.keys(needs) as Array<keyof AiCapabilities>).filter((k) => needs[k] === true);
}

/** Capabilities `provider` is missing for `task`. Empty = the assignment is legal. */
export function missingCapabilities(
  id: AiTaskId,
  caps: AiCapabilities,
): Array<keyof AiCapabilities> {
  return requiredCapabilities(id).filter((k) => !caps[k]);
}

/** Providers that could legally run this task, given each one's capabilities. */
export function eligibleProviders(
  id: AiTaskId,
  capsOf: (p: AiProviderId) => AiCapabilities,
  providers: AiProviderId[],
): AiProviderId[] {
  return providers.filter((p) => missingCapabilities(id, capsOf(p)).length === 0);
}
