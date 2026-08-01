import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Images, Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { MediaPickerDialog } from "@/components/MediaLibrary";
import {
  getBlockSpec,
  BLOCK_BG,
  BLOCK_ALIGN,
  BLOCK_WIDTH,
  SPACING_STEPS,
  type Block,
  type BlockImage,
  type BlockStyle,
  type FieldDef,
} from "@workspace/cms-blocks";

// The block edit form is GENERATED from the registry's field schema, so adding
// a block type to @workspace/cms-blocks gives it a working editor for free.

export function BlockForm({
  block,
  onChange,
}: {
  block: Block;
  onChange: (next: Block) => void;
}) {
  const { t } = useTranslation();
  const spec = getBlockSpec(block.type);
  if (!spec) return <p className="text-sm text-muted-foreground">{t("cms.unknown_block")}</p>;

  function setProp(key: string, value: unknown) {
    onChange({ ...block, props: { ...block.props, [key]: value } });
  }

  return (
    <div className="space-y-4">
      {spec.dataBacked && (
        <p className="rounded-md bg-blue-50 text-blue-800 text-xs px-3 py-2">{t("cms.data_backed_hint")}</p>
      )}
      {spec.fields.map((field) => (
        <FieldEditor
          key={field.key}
          field={field}
          value={block.props[field.key]}
          onChange={(value) => setProp(field.key, value)}
        />
      ))}

      <StylePanel style={block.style} onChange={(style) => onChange({ ...block, style })} />
    </div>
  );
}

function FieldEditor({
  field,
  value,
  onChange,
}: {
  field: FieldDef;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const { t } = useTranslation();

  if (field.type === "items") {
    const rows = Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
    const move = (from: number, to: number) => {
      if (to < 0 || to >= rows.length) return;
      const next = [...rows];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item!);
      onChange(next);
    };
    return (
      <div className="rounded-lg border p-3">
        <div className="flex items-center justify-between mb-2">
          <Label className="text-sm font-medium">{field.label}</Label>
          <Button
            size="sm"
            variant="outline"
            disabled={field.max !== undefined && rows.length >= field.max}
            onClick={() => onChange([...rows, {}])}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            {t("cms.add_item")}
          </Button>
        </div>
        <div className="space-y-3">
          {rows.map((row, index) => (
            <div key={index} className="rounded-md border bg-muted/20 p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground">#{index + 1}</span>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => move(index, index - 1)}>
                    <ChevronUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => move(index, index + 1)}>
                    <ChevronDown className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 text-destructive"
                    onClick={() => onChange(rows.filter((_, i) => i !== index))}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <div className="space-y-3">
                {(field.fields ?? []).map((sub) => (
                  <FieldEditor
                    key={sub.key}
                    field={sub}
                    value={row[sub.key]}
                    onChange={(next) => {
                      const copy = [...rows];
                      copy[index] = { ...row, [sub.key]: next };
                      onChange(copy);
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
          {rows.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-3">{t("cms.no_items")}</p>
          )}
        </div>
      </div>
    );
  }

  if (field.type === "image") {
    return <ImageField field={field} value={value as BlockImage | undefined} onChange={onChange} />;
  }

  if (field.type === "boolean") {
    return (
      <div className="flex items-center justify-between">
        <Label className="text-sm">{field.label}</Label>
        <Switch checked={Boolean(value)} onCheckedChange={onChange} />
      </div>
    );
  }

  if (field.type === "select") {
    return (
      <div>
        <Label className="text-sm">{field.label}</Label>
        <Select value={String(value ?? "")} onValueChange={onChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(field.options ?? []).map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  if (field.type === "number") {
    return (
      <div>
        <Label className="text-sm">{field.label}</Label>
        <Input
          type="number"
          value={value === undefined || value === null ? "" : String(value)}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        />
      </div>
    );
  }

  const multiline = field.type === "textarea" || field.type === "richtext" || field.type === "html";
  return (
    <div>
      <Label className="text-sm">{field.label}</Label>
      {multiline ? (
        <Textarea
          rows={field.type === "html" ? 8 : 3}
          className={field.type === "html" ? "font-mono text-xs" : ""}
          value={String(value ?? "")}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <Input
          value={String(value ?? "")}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {field.hint && <p className="text-xs text-muted-foreground mt-1">{field.hint}</p>}
    </div>
  );
}

function ImageField({
  field,
  value,
  onChange,
}: {
  field: FieldDef;
  value: BlockImage | undefined;
  onChange: (value: BlockImage) => void;
}) {
  const { t } = useTranslation();
  const [pickerOpen, setPickerOpen] = useState(false);
  const image: BlockImage = value ?? { url: "" };

  return (
    <div>
      <Label className="text-sm">{field.label}</Label>
      <div className="flex items-start gap-3">
        <div className="h-16 w-24 shrink-0 rounded-md border bg-muted/30 overflow-hidden flex items-center justify-center">
          {image.url ? (
            <img src={image.url} alt="" className="h-full w-full object-cover" />
          ) : (
            <Images className="h-5 w-5 text-muted-foreground/40" />
          )}
        </div>
        <div className="flex-1 space-y-2">
          <div className="flex gap-2">
            <Input
              value={image.url}
              placeholder="https://…"
              onChange={(e) => onChange({ ...image, url: e.target.value })}
            />
            <Button variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
              <Images className="h-4 w-4" />
            </Button>
          </div>
          {/* Alt text is required for accessibility and is what search engines read. */}
          <Input
            value={image.alt ?? ""}
            placeholder={t("cms.alt_text_placeholder")}
            onChange={(e) => onChange({ ...image, alt: e.target.value })}
          />
        </div>
      </div>
      <MediaPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onPick={(url: string) => onChange({ ...image, url })}
      />
    </div>
  );
}

/**
 * The guardrail. Editors pick token ROLES and spacing STEPS — never a hex code
 * or a pixel value — so pages stay visually consistent as content is added.
 */
export function StylePanel({
  style,
  onChange,
}: {
  style: BlockStyle | undefined;
  onChange: (style: BlockStyle) => void;
}) {
  const { t } = useTranslation();
  const current = style ?? {};
  const set = (patch: Partial<BlockStyle>) => onChange({ ...current, ...patch });

  return (
    <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
      <p className="text-xs font-medium text-muted-foreground">{t("cms.style_section")}</p>

      <div>
        <Label className="text-xs">{t("cms.style_bg")}</Label>
        <div className="flex flex-wrap gap-1 mt-1">
          {BLOCK_BG.map((bg) => (
            <button
              key={bg}
              onClick={() => set({ bg })}
              className={`rounded-md border px-2 py-1 text-xs transition-colors ${
                (current.bg ?? "transparent") === bg
                  ? "border-primary bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {t(`cms.bg_${bg}`, { defaultValue: bg })}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StepPicker
          label={t("cms.style_spacing_top")}
          value={current.spacingTop ?? 2}
          onChange={(spacingTop) => set({ spacingTop })}
        />
        <StepPicker
          label={t("cms.style_spacing_bottom")}
          value={current.spacingBottom ?? 2}
          onChange={(spacingBottom) => set({ spacingBottom })}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">{t("cms.style_align")}</Label>
          <Select value={current.align ?? "left"} onValueChange={(v) => set({ align: v as BlockStyle["align"] })}>
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BLOCK_ALIGN.map((a) => (
                <SelectItem key={a} value={a}>
                  {t(`cms.align_${a}`, { defaultValue: a })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">{t("cms.style_width")}</Label>
          <Select value={current.width ?? "contained"} onValueChange={(v) => set({ width: v as BlockStyle["width"] })}>
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BLOCK_WIDTH.map((w) => (
                <SelectItem key={w} value={w}>
                  {t(`cms.width_${w}`, { defaultValue: w })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

function StepPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (step: 0 | 1 | 2 | 3 | 4) => void;
}) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <div className="flex gap-1 mt-1">
        {SPACING_STEPS.map((step) => (
          <button
            key={step}
            onClick={() => onChange(step)}
            className={`h-8 flex-1 rounded-md border text-xs transition-colors ${
              value === step ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {step}
          </button>
        ))}
      </div>
    </div>
  );
}
