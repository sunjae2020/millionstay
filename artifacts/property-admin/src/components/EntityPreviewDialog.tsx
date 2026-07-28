import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { ExternalLink } from "lucide-react";

/**
 * One shared "quick look" modal for every related-record tab.
 *
 * Detail pages list related records (bookings, invoices, spaces, contacts…) in
 * tabs. Clicking a row should show as much as we already have WITHOUT a page
 * navigation, and leave the full detail page one click away. Rather than each
 * tab growing its own modal, every tab builds an `EntityPreview` and hands it
 * to this component.
 */

export interface PreviewField {
  label: string;
  value: ReactNode;
  /** Render across the full dialog width (long text, addresses, notes). */
  wide?: boolean;
}

export interface EntityPreview {
  title: string;
  subtitle?: string | null;
  /** Status chip next to the title. `className` carries the status colour. */
  badge?: { label: string; className?: string } | null;
  fields: PreviewField[];
  /** In-app route for the full record. Omit for records with no detail page. */
  detailUrl?: string | null;
  /** Overrides the default "Open detail page" wording. */
  detailLabel?: string;
}

interface Props {
  preview: EntityPreview | null;
  onClose: () => void;
}

export function EntityPreviewDialog({ preview, onClose }: Props) {
  const { t } = useTranslation();

  // Empty values are dropped rather than rendered as a wall of em-dashes.
  const fields = (preview?.fields ?? []).filter(
    (f) => f.value !== null && f.value !== undefined && f.value !== "",
  );

  return (
    <Dialog open={!!preview} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pr-6">
            <span className="truncate">{preview?.title}</span>
            {preview?.badge && (
              <Badge variant="outline" className={`text-xs shrink-0 ${preview.badge.className ?? ""}`}>
                {preview.badge.label}
              </Badge>
            )}
          </DialogTitle>
          {preview?.subtitle && <DialogDescription>{preview.subtitle}</DialogDescription>}
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto">
          {fields.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{t("common.no_data")}</p>
          ) : (
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
              {fields.map((f, i) => (
                <div key={`${f.label}-${i}`} className={f.wide ? "sm:col-span-2" : undefined}>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">{f.label}</dt>
                  <dd className="mt-0.5 break-words">{f.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="outline" size="sm" onClick={onClose}>{t("common.close")}</Button>
          {preview?.detailUrl && (
            <Link href={preview.detailUrl}>
              <Button size="sm" className="gap-1.5" onClick={onClose}>
                <ExternalLink className="h-4 w-4" />
                {preview.detailLabel ?? t("common.open_detail")}
              </Button>
            </Link>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default EntityPreviewDialog;
