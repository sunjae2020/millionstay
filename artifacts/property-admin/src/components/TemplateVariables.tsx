/**
 * 템플릿 변수 삽입 — `{{` 자동완성 + 목록 팝오버.
 *
 * 문안을 쓰는 사람이 알고 싶은 것은 "무엇을 넣을 수 있나" 와 "지금 이 자리에
 * 넣기" 두 가지다. 종전에는 오른쪽 목록을 누르면 본문 **맨 끝**에 붙어서, 문장
 * 중간에 변수를 넣으려면 붙은 것을 잘라 옮겨야 했다.
 *
 * 그래서 템플릿 편집기의 표준 방식을 그대로 쓴다 —
 *
 *   ① 본문에 `{{` 를 치면 그 자리에서 목록이 열리고, 이어 치는 글자로 좁혀진다.
 *      ↑↓ 로 고르고 Enter·Tab 으로 **커서 자리에** 넣는다. Esc 로 닫는다.
 *   ② 처음 쓰는 사람은 `{{` 를 쳐야 하는 줄 모르므로, 같은 목록을 여는 버튼을
 *      본문 위에 둔다. 버튼으로 넣어도 삽입 위치는 마지막 커서 자리다.
 *
 * 목록에는 **표본값**을 함께 보인다. 변수 이름만으로는 `{{ref}}` 가 계약번호인지
 * 청구번호인지 알 수 없고, 문자 문안에서는 그 값의 길이가 곧 요금이라 특히 중요하다.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Braces, TriangleAlert } from "lucide-react";

export interface VariableDef {
  name: string;
  type?: string;
  /** 미리보기에 쓰이는 표본값. */
  sample?: string;
  /**
   * 호출부가 넘기지 않아도 서버가 채우는 변수(상호·문의번호 등). 목록에서
   * 따로 표시한다 — 안 넣으면 빈칸이 나가는 변수와 구분되어야 한다.
   */
  auto?: boolean;
  description?: string;
  /**
   * 이 문안이 **선언하지 않은** 변수. 같은 종류의 다른 문안에서 가져온 것이라
   * 넣으려면 발송 코드도 함께 고쳐야 한다 — 안 그러면 빈칸으로 나간다.
   */
  related?: boolean;
  /** 어느 문안이 쓰는지(related 에만). */
  usedBy?: string[];
  usedCount?: number;
  /** 분류 키(link·money·date·person·place·contact·doc·other). */
  group?: string;
}

/** 팝오버 안의 묶음 순서. 서버 groupOf() 와 같은 키를 쓴다. */
const GROUP_ORDER = ["link", "money", "date", "person", "place", "contact", "doc", "other"];

/* ── `{{` 자동완성 ────────────────────────────────────────────────────────
   textarea 전용이다. 커서 앞을 거꾸로 훑어 여는 `{{` 를 찾고, 그 뒤에 닫는
   괄호나 공백·줄바꿈이 없을 때만 "지금 변수를 치는 중" 으로 본다. */

interface Trigger { start: number; query: string }

function findTrigger(value: string, caret: number): Trigger | null {
  const open = value.lastIndexOf("{{", caret);
  if (open < 0) return null;
  const between = value.slice(open + 2, caret);
  // 공백·줄바꿈·닫는 괄호가 끼면 변수를 치는 중이 아니다.
  if (/[\s}]/.test(between)) return null;
  return { start: open, query: between };
}

export interface VariableAutocomplete {
  /** textarea 에 그대로 펼친다. */
  inputProps: {
    onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
    onSelect: () => void;
    onBlur: () => void;
  };
  /** 열려 있으면 목록을 그린다. */
  open: boolean;
  items: VariableDef[];
  activeIndex: number;
  setActiveIndex: (i: number) => void;
  /** 목록 항목을 눌렀을 때. */
  choose: (v: VariableDef) => void;
  /** 버튼으로 넣을 때 — 마지막 커서 자리에 삽입한다. */
  insertAtCaret: (name: string) => void;
  close: () => void;
}

/**
 * @param ref     대상 textarea
 * @param value   현재 본문(제어 컴포넌트)
 * @param onChange 본문 갱신
 */
export function useVariableAutocomplete(
  ref: React.RefObject<HTMLTextAreaElement | null>,
  value: string,
  onChange: (next: string) => void,
  variables: VariableDef[],
): VariableAutocomplete {
  const [trigger, setTrigger] = useState<Trigger | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  // 버튼 삽입은 포커스를 잃은 뒤에 일어나므로 마지막 커서 자리를 기억해 둔다.
  const lastCaret = useRef<number>(value.length);

  const items = useMemo(() => {
    const q = (trigger?.query ?? "").toLowerCase();
    if (!q) return variables;
    return variables.filter((v) => v.name.toLowerCase().includes(q));
  }, [trigger, variables]);

  useEffect(() => { setActiveIndex(0); }, [trigger?.query]);

  const close = useCallback(() => setTrigger(null), []);

  /** 커서 자리(또는 `{{` 자동완성 구간)를 `{{name}}` 으로 바꾸고 그 뒤에 커서를 둔다. */
  const replaceRange = useCallback((from: number, to: number, name: string) => {
    const token = `{{${name}}}`;
    const next = value.slice(0, from) + token + value.slice(to);
    onChange(next);
    setTrigger(null);
    const caret = from + token.length;
    lastCaret.current = caret;
    // 값 갱신이 DOM 에 반영된 뒤라야 커서를 옮길 수 있다.
    requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(caret, caret);
    });
  }, [value, onChange, ref]);

  const choose = useCallback((v: VariableDef) => {
    const el = ref.current;
    const caret = el?.selectionStart ?? lastCaret.current;
    if (trigger) replaceRange(trigger.start, caret, v.name);
    else replaceRange(caret, caret, v.name);
  }, [trigger, replaceRange, ref]);

  const insertAtCaret = useCallback((name: string) => {
    const el = ref.current;
    const from = el && document.activeElement === el ? el.selectionStart : lastCaret.current;
    const to = el && document.activeElement === el ? el.selectionEnd : lastCaret.current;
    replaceRange(Math.min(from, to), Math.max(from, to), name);
  }, [replaceRange, ref]);

  /** 커서가 움직일 때마다 `{{` 안에 있는지 다시 본다. */
  const sync = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    lastCaret.current = el.selectionStart;
    setTrigger(findTrigger(value, el.selectionStart));
  }, [value, ref]);

  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!trigger || items.length === 0) {
      // 방금 두 번째 `{` 를 쳤다면 다음 프레임에 열린다.
      if (e.key === "{") requestAnimationFrame(sync);
      return;
    }
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIndex((i) => (i + 1) % items.length); return; }
    if (e.key === "ArrowUp") { e.preventDefault(); setActiveIndex((i) => (i - 1 + items.length) % items.length); return; }
    if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      const pick = items[Math.min(activeIndex, items.length - 1)];
      if (pick) choose(pick);
      return;
    }
    if (e.key === "Escape") { e.preventDefault(); close(); return; }
    // 그 밖의 입력은 값이 바뀐 뒤 다시 판정한다.
    requestAnimationFrame(sync);
  }, [trigger, items, activeIndex, choose, close, sync]);

  return {
    inputProps: {
      onKeyDown,
      onSelect: sync,
      // 목록 클릭이 먼저 처리되도록 닫기를 한 박자 늦춘다.
      onBlur: () => setTimeout(() => setTrigger(null), 150),
    },
    open: !!trigger && items.length > 0,
    items,
    activeIndex: Math.min(activeIndex, Math.max(items.length - 1, 0)),
    setActiveIndex,
    choose,
    insertAtCaret,
    close,
  };
}

/* ── 목록 UI ───────────────────────────────────────────────────────────── */

function Row({ v, active, onPick, onHover }: { v: VariableDef; active?: boolean; onPick: () => void; onHover?: () => void }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      // onMouseDown: textarea 의 blur 보다 먼저 잡아야 선택이 사라지지 않는다.
      onMouseDown={(e) => { e.preventDefault(); onPick(); }}
      onMouseEnter={onHover}
      className={`w-full text-left rounded px-2 py-1.5 transition-colors ${active ? "bg-muted" : "hover:bg-muted/60"}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1 font-mono text-xs">
          {v.related && <TriangleAlert className="h-3 w-3 shrink-0 text-amber-600" />}
          <span className="truncate">{`{{${v.name}}}`}</span>
        </span>
        <span className="shrink-0 text-[10px] text-muted-foreground">
          {v.auto ? t("templateVars.auto", "auto") : (v.type ?? "string")}
        </span>
      </div>
      {(v.sample || v.description) && (
        <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
          {v.description ? v.description : `→ ${v.sample}`}
        </div>
      )}
      {v.related && (
        <div className="mt-0.5 truncate text-[11px] text-amber-700 dark:text-amber-500">
          {t("templateVars.related_note", "Not sent for this template — the sending code must supply it, or it goes out blank.")}
          {v.usedBy?.length ? ` · ${v.usedBy.join(", ")}${(v.usedCount ?? 0) > v.usedBy.length ? " …" : ""}` : ""}
        </div>
      )}
    </button>
  );
}

/** 묶음 제목 한 줄. */
function GroupLabel({ children }: { children: React.ReactNode }) {
  return <p className="px-2 pb-0.5 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{children}</p>;
}

/** `{{` 자동완성이 열렸을 때 본문 아래에 붙는 목록. */
export function VariableSuggestions({ ac }: { ac: VariableAutocomplete }) {
  const { t } = useTranslation();
  if (!ac.open) return null;
  return (
    <div className="relative">
      <div className="absolute z-30 mt-1 w-full max-w-md rounded-md border bg-popover p-1 shadow-md">
        <p className="px-2 pb-1 pt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
          {t("templateVars.pick_hint", "↑↓ to choose · Enter to insert · Esc to close")}
        </p>
        <div className="max-h-56 overflow-y-auto">
          {ac.items.map((v, i) => (
            <Row key={v.name} v={v} active={i === ac.activeIndex} onPick={() => ac.choose(v)} onHover={() => ac.setActiveIndex(i)} />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * 본문 위의 "변수" 버튼 — 같은 목록을 팝오버로 연다. `{{` 를 쳐야 하는 줄
 * 모르는 사람을 위한 입구이고, 검색으로 긴 목록을 좁힐 수 있다.
 */
export function VariablePickerButton({
  variables,
  onInsert,
  disabled,
}: {
  variables: VariableDef[];
  onInsert: (name: string) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const items = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return variables;
    return variables.filter((v) => v.name.toLowerCase().includes(s) || (v.description ?? "").toLowerCase().includes(s));
  }, [q, variables]);

  /* 변수가 스무 개를 넘으면 한 덩어리 목록은 훑어지지 않는다. 먼저 "이 문안이
     받는 값"과 "자동" 을 위로 올리고, 나머지 관련 변수만 분류로 나눈다 —
     분류가 필요한 것은 관련 변수 쪽이지 선언된 변수가 아니다. */
  const sections = useMemo(() => {
    const out: Array<{ title: string; items: VariableDef[] }> = [];
    const own = items.filter((v) => !v.related && !v.auto);
    const auto = items.filter((v) => v.auto);
    const rel = items.filter((v) => v.related);
    if (own.length) out.push({ title: t("templateVars.sec_declared", "This template"), items: own });
    if (auto.length) out.push({ title: t("templateVars.sec_auto", "Filled in automatically"), items: auto });
    if (rel.length) {
      const byGroup = new Map<string, VariableDef[]>();
      for (const v of rel) {
        const g = v.group ?? "other";
        byGroup.set(g, [...(byGroup.get(g) ?? []), v]);
      }
      const ordered = [...byGroup.entries()].sort(
        (a, b) => GROUP_ORDER.indexOf(a[0]) - GROUP_ORDER.indexOf(b[0]),
      );
      for (const [g, list] of ordered) {
        out.push({ title: `${t("templateVars.sec_related", "Used by other templates")} · ${t(`templateVars.group_${g}`, g)}`, items: list });
      }
    }
    return out;
  }, [items, t]);

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) setQ(""); }}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="h-7 gap-1 px-2 text-xs" disabled={disabled}>
          <Braces className="h-3 w-3" /> {t("templateVars.button", "Variables")}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-96 p-2">
        {variables.length === 0 ? (
          <p className="px-1 py-2 text-xs text-muted-foreground">{t("templateVars.none", "This template has no variables.")}</p>
        ) : (
          <>
            <Input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("templateVars.search", "Search variables…")}
              className="h-8 text-xs"
            />
            <p className="px-1 pt-2 text-[10px] uppercase tracking-wider text-muted-foreground">
              {t("templateVars.insert_hint", "Inserts at the cursor. Typing {{ in the body opens this too.")}
            </p>
            <div className="mt-1 max-h-80 overflow-y-auto">
              {items.length === 0 ? (
                <p className="px-1 py-2 text-xs text-muted-foreground">{t("templateVars.no_match", "No match.")}</p>
              ) : sections.map((sec) => (
                <div key={sec.title}>
                  <GroupLabel>{sec.title}</GroupLabel>
                  {sec.items.map((v) => (
                    <Row key={v.name} v={v} onPick={() => { onInsert(v.name); setOpen(false); setQ(""); }} />
                  ))}
                </div>
              ))}
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
