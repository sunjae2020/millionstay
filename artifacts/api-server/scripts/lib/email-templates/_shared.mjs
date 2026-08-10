// 이메일 템플릿 공용 변수 세트. 정본 = docs/EMAIL_TEMPLATE_SPEC.md
const V = {
  recipient: { type: "string", required: true },   // 수신자 이름
  brand:     { type: "string" },                   // 테넌트 상호 (셸이 채움)
  url:       { type: "url" },
  ref:       { type: "string" },
  date:      { type: "date" },
  amount:    { type: "string" },
};

const vars = (...names) => Object.fromEntries(names.map((n) => [n, V[n] ?? { type: "string" }]));

// ─────────────────────────────────────────────────────────────────────────────
// common — 공통 (전 수신자 공용)
// ─────────────────────────────────────────────────────────────────────────────

export { V, vars };
