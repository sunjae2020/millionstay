// 은행별 명세서 포맷.
//
// 은행마다 컬럼 이름도 순서도 다르다. "거래일자/출금금액/입금금액"이 있는가 하면
// "거래일시/맡기신금액/찾으신금액"인 곳도 있다. 헤더 텍스트로 컬럼을 찾되, 못 찾으면
// 위치로 떨어지지 않고 **실패시킨다** — 잘못 짚은 열로 금액을 읽으면 그 오류가
// 장부까지 그대로 간다.
//
// 새 은행은 여기에 프로필 한 줄만 추가하면 된다.

export interface BankProfile {
  id: string;
  label: string;
  /** 각 논리 컬럼에 해당하는 헤더 후보(부분 일치, 공백 무시). */
  headers: {
    date: string[];
    withdrawal: string[];
    deposit: string[];
    balance: string[];
    memo: string[];
    /** 있으면 적요를 보강한다(거래점·비고 등). */
    extra?: string[];
  };
  notes?: string;
}

const COMMON_DATE = ["거래일자", "거래일시", "거래일", "일자", "날짜", "date"];
const COMMON_BAL = ["거래후잔액", "잔액", "거래후 잔액", "balance"];

export const BANK_PROFILES: BankProfile[] = [
  {
    id: "nh",
    label: "농협",
    headers: {
      date: COMMON_DATE,
      withdrawal: ["출금금액", "출금", "지급금액"],
      deposit: ["입금금액", "입금", "입금액"],
      balance: COMMON_BAL,
      memo: ["거래기록사항", "내용", "적요", "거래내용"],
      extra: ["거래점", "비고"],
    },
    notes: "조회전용서비스 입출금거래내역 형식",
  },
  {
    id: "kb",
    label: "국민은행",
    headers: {
      date: COMMON_DATE,
      withdrawal: ["출금액", "찾으신금액", "출금"],
      deposit: ["입금액", "맡기신금액", "입금"],
      balance: COMMON_BAL,
      memo: ["내용", "적요", "거래내용", "보낸분/받는분"],
      extra: ["거래점", "메모"],
    },
  },
  {
    id: "shinhan",
    label: "신한은행",
    headers: {
      date: COMMON_DATE,
      withdrawal: ["출금(원)", "출금", "찾으신금액"],
      deposit: ["입금(원)", "입금", "맡기신금액"],
      balance: COMMON_BAL,
      memo: ["내용", "적요", "거래내용"],
      extra: ["거래점", "메모"],
    },
  },
  {
    id: "woori",
    label: "우리은행",
    headers: {
      date: COMMON_DATE,
      withdrawal: ["출금", "찾으신금액"],
      deposit: ["입금", "맡기신금액"],
      balance: COMMON_BAL,
      memo: ["기재내용", "내용", "적요"],
      extra: ["거래점", "메모"],
    },
  },
  {
    id: "hana",
    label: "하나은행",
    headers: {
      date: COMMON_DATE,
      withdrawal: ["출금액", "출금"],
      deposit: ["입금액", "입금"],
      balance: COMMON_BAL,
      memo: ["적요", "내용", "거래구분"],
      extra: ["거래점", "메모"],
    },
  },
  {
    id: "ibk",
    label: "기업은행",
    headers: {
      date: COMMON_DATE,
      withdrawal: ["출금액", "출금"],
      deposit: ["입금액", "입금"],
      balance: COMMON_BAL,
      memo: ["거래내용", "적요", "내용"],
      extra: ["거래점", "비고"],
    },
  },
  {
    id: "auto",
    label: "자동 인식 (기타 은행)",
    headers: {
      date: COMMON_DATE,
      withdrawal: ["출금금액", "출금액", "출금", "찾으신금액", "지급금액"],
      deposit: ["입금금액", "입금액", "입금", "맡기신금액"],
      balance: COMMON_BAL,
      memo: ["거래기록사항", "기재내용", "거래내용", "내용", "적요"],
      extra: ["거래점", "비고", "메모"],
    },
    notes: "흔한 한국 은행 헤더를 모두 시도한다. 실패하면 은행을 직접 고를 것.",
  },
];

export function findProfile(id: string): BankProfile {
  return BANK_PROFILES.find((p) => p.id === id) ?? BANK_PROFILES[BANK_PROFILES.length - 1]!;
}
