import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";
import { Layout, PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/date";
import {
  listMarketingLists, createMarketingList, deleteMarketingList, previewSegment,
  type MarketingList,
} from "@/lib/marketing/api";

const SEGMENTS = ["owner", "agency", "corporate", "education", "service"] as const;

export default function MarketingLists() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({ queryKey: ["marketing", "lists"], queryFn: listMarketingLists });
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState("");
  const [listType, setListType] = useState<"static" | "dynamic">("dynamic");
  const [segment, setSegment] = useState("");
  const [country, setCountry] = useState("");
  const [minScore, setMinScore] = useState("");
  const [neverContacted, setNeverContacted] = useState(false);
  const [matchCount, setMatchCount] = useState<number | null>(null);

  function criteria(): Record<string, unknown> {
    const c: Record<string, unknown> = {};
    if (segment) c.segment = segment;
    if (country) c.country = country;
    if (minScore) c.min_score = Number(minScore);
    if (neverContacted) c.never_contacted = true;
    return c;
  }

  async function checkCount() {
    try {
      setMatchCount(await previewSegment(criteria()));
    } catch {
      toast({ title: t("marketing.preview_failed"), variant: "destructive" });
    }
  }

  async function create() {
    setBusy(true);
    try {
      await createMarketingList({
        name: name.trim(),
        list_type: listType,
        filter_criteria: listType === "dynamic" ? criteria() : null,
      });
      toast({ title: t("marketing.list_created") });
      qc.invalidateQueries({ queryKey: ["marketing", "lists"] });
      setOpen(false);
      setName(""); setSegment(""); setCountry(""); setMinScore(""); setNeverContacted(false); setMatchCount(null);
    } catch {
      toast({ title: t("marketing.save_failed"), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  async function remove(list: MarketingList) {
    try {
      await deleteMarketingList(list.id);
      qc.invalidateQueries({ queryKey: ["marketing", "lists"] });
    } catch {
      toast({ title: t("marketing.save_failed"), variant: "destructive" });
    }
  }

  return (
    <Layout>
      <PageHeader
        title={t("marketing.lists")}
        subtitle={t("marketing.lists_desc")}
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />{t("marketing.new_list")}
          </Button>
        }
      />

      <div className="p-4 sm:p-6">
        {isLoading ? (
          <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : !data?.length ? (
          <p className="text-sm text-muted-foreground">{t("marketing.no_lists")}</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.map((list) => (
              <Card key={list.id}>
                <CardHeader className="flex flex-row items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{list.name}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t(`marketing.list_type_${list.list_type}`)} · {formatDate(list.updated_at)}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => void remove(list)}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-semibold">{list.member_count.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">{t("marketing.members")}</div>
                  {list.filter_criteria && Object.keys(list.filter_criteria).length > 0 && (
                    <div className="mt-3 text-xs text-muted-foreground">
                      {Object.entries(list.filter_criteria)
                        .map(([k, v]) => `${t(`marketing.filter_${k}`, { defaultValue: k })}: ${String(v)}`)
                        .join(" · ")}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("marketing.new_list")}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">{t("marketing.list_name")}</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t("marketing.list_type")}</Label>
              <Select value={listType} onValueChange={(v) => setListType(v as "static" | "dynamic")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="dynamic">{t("marketing.list_type_dynamic")}</SelectItem>
                  <SelectItem value="static">{t("marketing.list_type_static")}</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{t("marketing.list_type_help")}</p>
            </div>

            {listType === "dynamic" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">{t("marketing.segment")}</Label>
                  <Select value={segment || "__none"} onValueChange={(v) => setSegment(v === "__none" ? "" : v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">{t("common.all")}</SelectItem>
                      {SEGMENTS.map((s) => <SelectItem key={s} value={s}>{t(`marketing.segment_${s}`)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t("marketing.country")}</Label>
                  <Input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="KR" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t("marketing.min_score")}</Label>
                  <Input type="number" value={minScore} onChange={(e) => setMinScore(e.target.value)} />
                </div>
                <label className="flex items-center gap-2 text-sm mt-6">
                  <input type="checkbox" checked={neverContacted} onChange={(e) => setNeverContacted(e.target.checked)} />
                  {t("marketing.never_contacted")}
                </label>
                <div className="col-span-2 flex items-center gap-3">
                  <Button variant="outline" size="sm" onClick={checkCount}>
                    <RefreshCw className="h-4 w-4 mr-2" />{t("marketing.check_match")}
                  </Button>
                  {matchCount !== null && (
                    <span className="text-sm text-muted-foreground">{t("marketing.match_count", { count: matchCount })}</span>
                  )}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={create} disabled={busy || !name.trim()}>
              {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
