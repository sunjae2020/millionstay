import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Eye,
  EyeOff,
  GripVertical,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { getBlockSpec, createBlock, newBlockId, type Block } from "@workspace/cms-blocks";
import { BlockForm } from "./BlockForm";
import { BlockInsertDialog } from "./BlockInsertDialog";

// The page body canvas: an ordered list of block cards with inline editing,
// drag-to-reorder, show/hide, duplicate and (for container blocks) nesting.

export function BlockCanvas({
  blocks,
  onChange,
  siteKey,
}: {
  blocks: Block[];
  onChange: (blocks: Block[]) => void;
  siteKey: string;
}) {
  const { t } = useTranslation();
  const [insertOpen, setInsertOpen] = useState(false);
  const [insertTarget, setInsertTarget] = useState<string | null>(null); // parent block id, null = root
  const [expanded, setExpanded] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  function insert(type: string, defaultProps: Record<string, unknown>) {
    const block = createBlock(type);
    if (!block) return;
    block.props = { ...block.props, ...defaultProps };
    if (insertTarget === null) {
      onChange([...blocks, block]);
    } else {
      onChange(mapBlock(blocks, insertTarget, (b) => ({ ...b, children: [...(b.children ?? []), block] })));
    }
    setExpanded(block.id);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button
          onClick={() => {
            setInsertTarget(null);
            setInsertOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          {t("cms.add_block")}
        </Button>
        <span className="text-xs text-muted-foreground">{t("cms.blocks_count", { count: blocks.length })}</span>
      </div>

      <div className="space-y-2">
        {blocks.map((block, index) => (
          <BlockCard
            key={block.id}
            block={block}
            index={index}
            total={blocks.length}
            expanded={expanded === block.id}
            onToggleExpand={() => setExpanded(expanded === block.id ? null : block.id)}
            onChange={(next) => onChange(blocks.map((b) => (b.id === next.id ? next : b)))}
            onRemove={() => onChange(blocks.filter((b) => b.id !== block.id))}
            onDuplicate={() => {
              const copy = deepCloneWithNewIds(block);
              const next = [...blocks];
              next.splice(index + 1, 0, copy);
              onChange(next);
            }}
            onMove={(to) => onChange(moveItem(blocks, index, to))}
            onDragStart={() => setDragId(block.id)}
            onDropOn={() => {
              if (!dragId || dragId === block.id) return;
              const from = blocks.findIndex((b) => b.id === dragId);
              if (from === -1) return;
              onChange(moveItem(blocks, from, index));
              setDragId(null);
            }}
            renderChildren={(parent) => (
              <div className="mt-3 rounded-md border-l-2 border-primary/30 pl-3">
                <BlockCanvas
                  blocks={parent.children ?? []}
                  siteKey={siteKey}
                  onChange={(children) =>
                    onChange(blocks.map((b) => (b.id === parent.id ? { ...b, children } : b)))
                  }
                />
              </div>
            )}
          />
        ))}

        {blocks.length === 0 && (
          <div className="rounded-lg border border-dashed p-10 text-center">
            <p className="text-sm text-muted-foreground">{t("cms.canvas_empty")}</p>
          </div>
        )}
      </div>

      <BlockInsertDialog open={insertOpen} onOpenChange={setInsertOpen} siteKey={siteKey} onPick={insert} />
    </div>
  );
}

function BlockCard({
  block,
  index,
  total,
  expanded,
  onToggleExpand,
  onChange,
  onRemove,
  onDuplicate,
  onMove,
  onDragStart,
  onDropOn,
  renderChildren,
}: {
  block: Block;
  index: number;
  total: number;
  expanded: boolean;
  onToggleExpand: () => void;
  onChange: (block: Block) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  onMove: (to: number) => void;
  onDragStart: () => void;
  onDropOn: () => void;
  renderChildren: (block: Block) => React.ReactNode;
}) {
  const { t } = useTranslation();
  const spec = getBlockSpec(block.type);

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDropOn}
      className={`rounded-lg border bg-white transition-opacity ${block.hidden ? "opacity-50" : ""}`}
    >
      <div className="flex items-center gap-2 p-3">
        <GripVertical className="h-4 w-4 text-muted-foreground/40 cursor-grab" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{spec?.name ?? block.type}</span>
            <Badge variant="outline" className="text-[10px] px-1 py-0 font-normal">
              {block.type}
            </Badge>
            {block.hidden && (
              <Badge variant="outline" className="text-[10px] px-1 py-0 text-muted-foreground">
                {t("cms.hidden")}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{summarise(block)}</p>
        </div>
        <div className="flex items-center gap-0.5">
          <Button size="icon" variant="ghost" className="h-7 w-7" disabled={index === 0} onClick={() => onMove(index - 1)}>
            <ChevronUp className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            disabled={index === total - 1}
            onClick={() => onMove(index + 1)}
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onChange({ ...block, hidden: !block.hidden })}>
            {block.hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onDuplicate}>
            <Copy className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={onRemove}>
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button size="sm" variant={expanded ? "secondary" : "outline"} className="h-7 ml-1" onClick={onToggleExpand}>
            <Pencil className="h-3.5 w-3.5 mr-1" />
            {t("common.edit")}
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="border-t p-4 bg-muted/10">
          <BlockForm block={block} onChange={onChange} />
          {spec?.container && renderChildren(block)}
        </div>
      )}
    </div>
  );
}

// ── helpers ────────────────────────────────────────────────────────────────

function summarise(block: Block): string {
  const props = block.props as Record<string, unknown>;
  for (const key of ["title", "quote", "html", "body", "name", "address"]) {
    const value = props[key];
    if (typeof value === "string" && value.trim()) return value.replace(/<[^>]+>/g, "").slice(0, 90);
  }
  const items = props["items"] ?? props["slides"] ?? props["plans"];
  if (Array.isArray(items)) return `${items.length} items`;
  return "—";
}

function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item!);
  return next;
}

function mapBlock(blocks: Block[], id: string, fn: (block: Block) => Block): Block[] {
  return blocks.map((block) => {
    if (block.id === id) return fn(block);
    if (block.children) return { ...block, children: mapBlock(block.children, id, fn) };
    return block;
  });
}

/** Duplicating must not clone block ids — they key drag/drop and translations. */
function deepCloneWithNewIds(block: Block): Block {
  return {
    ...JSON.parse(JSON.stringify(block)),
    id: newBlockId(),
    children: block.children?.map(deepCloneWithNewIds),
  };
}
