// 영수증·매입 청구서 판독 → 거래 초안.
//
// 종이 영수증을 손으로 옮겨 적는 일이 거래 입력의 대부분이고, 그 과정에서 날짜와
// 금액이 가장 자주 틀린다. 읽어서 **폼을 채워 주기만** 한다 — 저장은 사람이 확인한
// 뒤에 한다. 그래서 확신이 없는 칸은 지어내지 말고 비워 두는 것이 옳다.
//
// AI 호출은 작업 레지스트리 경유(lib/ai/tasks.ts 의 transaction_receipt_ocr).
import { getAiClient } from "../ai/client.js";

export interface ReceiptDraft {
  /** YYYY-MM-DD. 읽지 못했으면 null — 오늘 날짜로 채우면 틀린 날짜가 확정된다. */
  txn_date: string | null;
  /** 공급가액(세액 별도). 총액만 보이면 total 에 넣고 여기는 비운다. */
  amount: number | null;
  tax_amount: number | null;
  total_amount: number | null;
  currency: string | null;
  counterparty_name: string | null;
  /** 사업자등록번호 등 — 거래처를 특정하는 데 쓴다. */
  counterparty_registration_no: string | null;
  description: string | null;
  /** 'income' | 'expense' — 우리가 낸 돈이면 expense. */
  txn_type: "income" | "expense" | null;
  payment_method: string | null;
  /** 모델이 읽은 그대로의 항목들(사람이 검토할 때 근거가 된다). */
  line_items: Array<{ label: string; amount: number | null }>;
  confidence: number | null;
  /** 읽지 못했거나 애매한 칸에 대한 한 줄 설명. */
  notes: string | null;
}

const EMPTY: ReceiptDraft = {
  txn_date: null, amount: null, tax_amount: null, total_amount: null, currency: null,
  counterparty_name: null, counterparty_registration_no: null, description: null,
  txn_type: null, payment_method: null, line_items: [], confidence: null, notes: null,
};

const PROMPT = `You are reading ONE receipt, tax invoice (세금계산서) or supplier invoice for a Korean property-management company, to pre-fill a bookkeeping form.

Return JSON only, with exactly these keys:
{
  "txn_date": "YYYY-MM-DD or null",
  "amount": <supply value / 공급가액, tax EXCLUDED, number or null>,
  "tax_amount": <VAT / 부가세, number or null>,
  "total_amount": <grand total actually paid, number or null>,
  "currency": "KRW" | "AUD" | ... | null,
  "counterparty_name": "<merchant / supplier name>" or null,
  "counterparty_registration_no": "<사업자등록번호 if printed>" or null,
  "description": "<one short line: what was bought>" or null,
  "txn_type": "expense" | "income" | null,
  "payment_method": "card" | "cash" | "bank_transfer" | null,
  "line_items": [{ "label": "...", "amount": <number or null> }],
  "confidence": <0.0-1.0>,
  "notes": "<one sentence about anything unreadable>" or null
}

Rules that matter:
- LEAVE A FIELD null RATHER THAN GUESSING. A wrong date or amount that looks confident is worse
  than a blank the operator fills in. Never invent a date because one is expected.
- Korean receipts usually print 공급가액 / 부가세 / 합계 separately. Map them to amount /
  tax_amount / total_amount respectively. If only one total is printed, put it in total_amount
  and leave amount and tax_amount null.
- A receipt WE paid is "expense". Only mark "income" if this is proof of money received by us.
- Amounts: digits only, no thousands separators, no currency symbol.`;

/** 판독. 실패하면 빈 초안을 돌려준다 — 화면은 빈 폼으로 계속 쓸 수 있어야 한다. */
export async function extractReceipt(
  file: { buffer: Buffer; mimetype: string },
): Promise<ReceiptDraft> {
  const ai = getAiClient("transaction_receipt_ocr");
  const mime = file.mimetype.toLowerCase();
  const isPdf = mime === "application/pdf";

  const block = isPdf
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: file.buffer.toString("base64") } }
    : { type: "image", source: { type: "base64", media_type: mime, data: file.buffer.toString("base64") } };

  const msg = await ai.messages.create({
    max_tokens: 1500,
    messages: [{ role: "user", content: [block, { type: "text", text: PROMPT }] as never }],
  });

  const text = msg.content.map((c) => (c.type === "text" ? c.text : "")).join("").trim();
  const json = /\{[\s\S]*\}/.exec(text)?.[0];
  if (!json) return EMPTY;

  try {
    const raw = JSON.parse(json) as Record<string, unknown>;
    const num = (v: unknown): number | null => {
      if (v == null || v === "") return null;
      const n = Number(String(v).replace(/[^0-9.-]/g, ""));
      return Number.isFinite(n) ? n : null;
    };
    const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
    const date = str(raw.txn_date);
    return {
      // 형식이 어긋나면 버린다 — "2026년 3월" 같은 문자열이 날짜 칸에 들어가면
      // 저장 시점에야 터진다.
      txn_date: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null,
      amount: num(raw.amount),
      tax_amount: num(raw.tax_amount),
      total_amount: num(raw.total_amount),
      currency: str(raw.currency)?.toUpperCase() ?? null,
      counterparty_name: str(raw.counterparty_name),
      counterparty_registration_no: str(raw.counterparty_registration_no),
      description: str(raw.description),
      txn_type: raw.txn_type === "income" || raw.txn_type === "expense" ? raw.txn_type : null,
      payment_method: str(raw.payment_method),
      line_items: Array.isArray(raw.line_items)
        ? (raw.line_items as Array<Record<string, unknown>>)
            .map((l) => ({ label: str(l.label) ?? "", amount: num(l.amount) }))
            .filter((l) => l.label)
        : [],
      confidence: num(raw.confidence),
      notes: str(raw.notes),
    };
  } catch {
    return EMPTY;
  }
}
