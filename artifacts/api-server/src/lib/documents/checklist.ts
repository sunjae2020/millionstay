/**
 * What paperwork a tenancy is supposed to have on file.
 *
 * This is the definition the 서류 점검 screen measures against. It lives on its
 * own because it is the one thing here a person will actually want to change:
 * every office keeps a slightly different set, and the list is a policy
 * decision, not a technical one.
 *
 * Deliberately kept in code rather than made configurable in Settings. A
 * configurable checklist needs its own admin screen, per-tenant storage and a
 * migration, and none of that is worth building before anyone has said the
 * default is wrong. Editing this array is a one-line change.
 *
 * Only types filed against the *contract* belong here. A tenant's ID scan lives
 * on the person (30-day retention, see routes/documents.ts) and would report as
 * permanently missing if it were listed — a checklist that is always red
 * teaches people to ignore it.
 */

export interface RequiredDoc {
  doc_type: string;
  /**
   * `required` — the tenancy is incomplete without it.
   * `recommended` — worth having, but its absence is not a defect.
   */
  level: "required" | "recommended";
}

export const CONTRACT_CHECKLIST: RequiredDoc[] = [
  // The agreement itself. Either the working copy or the scanned signed
  // original satisfies this — see SATISFIED_BY below.
  { doc_type: "contract", level: "required" },
  // 중개대상물 확인·설명서 — issued with the lease whenever an agent was involved.
  { doc_type: "brokerage_disclosure", level: "required" },
  // 임대차 신고필증 — proof the tenancy was reported.
  { doc_type: "lease_report", level: "required" },
  // 계좌·통장 사본 — needed at the end, to return the deposit.
  { doc_type: "bank_account_copy", level: "recommended" },
  // 입·퇴실 확인서 — the evidence a deposit dispute turns on.
  { doc_type: "move_in_out_report", level: "recommended" },
];

/**
 * Types that stand in for another. A scanned signed original is a contract for
 * checklist purposes — insisting on both would flag every properly-executed
 * tenancy as incomplete.
 */
const SATISFIED_BY: Record<string, string[]> = {
  contract: ["contract", "signed_contract"],
};

export interface ChecklistLine {
  doc_type: string;
  level: RequiredDoc["level"];
  present: boolean;
}

/** Measure one contract's filed types against the checklist. */
export function evaluateChecklist(presentTypes: Iterable<string>): {
  lines: ChecklistLine[];
  missingRequired: string[];
  complete: boolean;
} {
  const present = new Set(presentTypes);
  const lines = CONTRACT_CHECKLIST.map((item) => ({
    doc_type: item.doc_type,
    level: item.level,
    present: (SATISFIED_BY[item.doc_type] ?? [item.doc_type]).some((t) => present.has(t)),
  }));
  const missingRequired = lines.filter((l) => l.level === "required" && !l.present).map((l) => l.doc_type);
  return { lines, missingRequired, complete: missingRequired.length === 0 };
}
