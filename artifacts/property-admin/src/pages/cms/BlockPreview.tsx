import { createBlock, type Block, type DesignTokens } from "@workspace/cms-blocks";
import { BlockRenderer, type BlockData } from "@workspace/cms-blocks/react";

// A real, scaled-down render of a block using its starting content — produced by
// the SAME renderer the public site uses, so a thumbnail can never drift from
// what actually ships. Data-backed blocks get sample rows: a preview must not
// depend on (or wait for) live records.

const SAMPLE_ROWS: BlockData = {
  "space-listings": [
    { id: 1, title: "101호 · A타입", subtitle: "전용 24.8㎡", meta: "월 65만원" },
    { id: 2, title: "203호 · B타입", subtitle: "전용 31.2㎡", meta: "월 78만원" },
    { id: 3, title: "504호 · D타입", subtitle: "전용 42.5㎡", meta: "월 95만원" },
  ],
  "sale-listings": [
    { id: 1, title: "여수 신축 레지던스", subtitle: "전라남도 여수시", meta: "분양 문의" },
    { id: 2, title: "역세권 상가", subtitle: "1층 코너", meta: "협의" },
    { id: 3, title: "도심형 오피스텔", subtitle: "풀옵션", meta: "분양 문의" },
  ],
  "blog-posts": [
    { id: 1, title: "입주 전 확인해야 할 다섯 가지", subtitle: "안내", meta: "2026-07-30" },
    { id: 2, title: "관리비는 어떻게 산정되나요", subtitle: "안내", meta: "2026-07-22" },
    { id: 3, title: "여수 생활 정보", subtitle: "소식", meta: "2026-07-11" },
  ],
};

const SCALE = 0.34;

export function BlockPreview({
  type,
  props,
  tokens,
  height = 160,
}: {
  type: string;
  props?: Record<string, unknown>;
  tokens: DesignTokens;
  height?: number;
}) {
  const block = createBlock(type);
  if (!block) return null;
  const filled: Block = { ...block, props: { ...block.props, ...(props ?? {}) } };

  return (
    <div className="overflow-hidden border-b bg-background" style={{ height }}>
      {/* Pointer events are off: this is a picture of the block, not a copy the
          editor can interact with. */}
      <div
        className="origin-top-left pointer-events-none select-none"
        style={{ transform: `scale(${SCALE})`, width: `${100 / SCALE}%` }}
        aria-hidden
      >
        <BlockRenderer blocks={[filled]} tokens={tokens} data={SAMPLE_ROWS} />
      </div>
    </div>
  );
}
