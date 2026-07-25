import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout, PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Languages, Plus, Search, Trash2, Save, Globe, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";
import { useToast } from "@/hooks/use-toast";
import { useSortableData } from "@/components/ui/SortableTable";

type Lang = {
  code: string;
  name: string;
  english_name: string | null;
  flag_iso: string | null;
  enabled: boolean;
  is_default: boolean;
  sort_order: number;
};

type Row = { key: string; en: string; value: string; id: number | null };

const LANG_API = "/api/v1/translations/languages";
const TR_API = "/api/v1/translations";

async function fetchLanguages(): Promise<Lang[]> {
  const res = await apiFetch(LANG_API);
  if (!res.ok) throw new Error("Failed to load languages");
  return (await res.json()).data ?? [];
}

async function fetchRows(lang: string): Promise<Row[]> {
  const res = await apiFetch(`${TR_API}?lang=${encodeURIComponent(lang)}`);
  if (!res.ok) throw new Error("Failed to load translations");
  return (await res.json()).data ?? [];
}

const EMPTY_LANG = { code: "", name: "", english_name: "", flag_iso: "" };

export default function TranslationsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { toast } = useToast();

  const langsQ = useQuery({ queryKey: ["tr-languages"], queryFn: fetchLanguages });
  const languages = langsQ.data ?? [];

  const [lang, setLang] = useState("en");
  const [q, setQ] = useState("");
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [langDialog, setLangDialog] = useState(false);
  const [newLang, setNewLang] = useState(EMPTY_LANG);
  const [addKeyOpen, setAddKeyOpen] = useState(false);
  const [newKey, setNewKey] = useState({ key: "", value: "" });
  const [deleteKey, setDeleteKey] = useState<string | null>(null);

  const rowsQ = useQuery({ queryKey: ["translations", lang], queryFn: () => fetchRows(lang) });
  const rows = rowsQ.data ?? [];

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter(
      (r) => r.key.toLowerCase().includes(needle) || r.en.toLowerCase().includes(needle) || r.value.toLowerCase().includes(needle),
    );
  }, [rows, q]);

  const { sorted, sortKey, sortDir, toggleSort } = useSortableData(filtered);

  const dirtyCount = Object.keys(edits).length;

  const saveOne = useMutation({
    mutationFn: async (p: { key: string; value: string }) => {
      const res = await apiFetch(TR_API, { method: "PUT", body: JSON.stringify({ lang, key: p.key, value: p.value }) });
      if (!res.ok) throw new Error("Save failed");
      return res.json();
    },
    onSuccess: (_d, p) => {
      setEdits((e) => { const n = { ...e }; delete n[p.key]; return n; });
      qc.invalidateQueries({ queryKey: ["translations", lang] });
    },
    onError: (e: any) => toast({ title: t("settings_translations.toast_failed"), description: String(e?.message ?? e), variant: "destructive" }),
  });

  async function saveAll() {
    const entries = Object.entries(edits);
    if (entries.length === 0) return;
    try {
      for (const [key, value] of entries) {
        const res = await apiFetch(TR_API, { method: "PUT", body: JSON.stringify({ lang, key, value }) });
        if (!res.ok) throw new Error(`Failed on ${key}`);
      }
      setEdits({});
      qc.invalidateQueries({ queryKey: ["translations", lang] });
      toast({ title: t("settings_translations.toast_saved_changes", { count: entries.length }) });
    } catch (e: any) {
      toast({ title: t("settings_translations.toast_save_failed"), description: String(e?.message ?? e), variant: "destructive" });
    }
  }

  const addLang = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(LANG_API, { method: "POST", body: JSON.stringify({ ...newLang, sort_order: languages.length }) });
      if (!res.ok) throw new Error((await res.json())?.error?.message ?? "Failed");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: t("settings_translations.toast_language_added") });
      setNewLang(EMPTY_LANG);
      qc.invalidateQueries({ queryKey: ["tr-languages"] });
    },
    onError: (e: any) => toast({ title: t("settings_translations.toast_failed"), description: String(e?.message ?? e), variant: "destructive" }),
  });

  const toggleLang = useMutation({
    mutationFn: async (p: { code: string; enabled: boolean }) => {
      const res = await apiFetch(`${LANG_API}/${p.code}`, { method: "PATCH", body: JSON.stringify({ enabled: p.enabled }) });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tr-languages"] }),
  });

  const removeLang = useMutation({
    mutationFn: async (code: string) => {
      const res = await apiFetch(`${LANG_API}/${code}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json())?.error?.message ?? "Failed");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: t("settings_translations.toast_language_removed") });
      qc.invalidateQueries({ queryKey: ["tr-languages"] });
    },
    onError: (e: any) => toast({ title: t("settings_translations.toast_cannot_delete"), description: String(e?.message ?? e), variant: "destructive" }),
  });

  const addKey = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(TR_API, { method: "PUT", body: JSON.stringify({ lang, key: newKey.key.trim(), value: newKey.value }) });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: t("settings_translations.toast_key_added") });
      setNewKey({ key: "", value: "" });
      setAddKeyOpen(false);
      qc.invalidateQueries({ queryKey: ["translations", lang] });
    },
    onError: (e: any) => toast({ title: t("settings_translations.toast_failed"), description: String(e?.message ?? e), variant: "destructive" }),
  });

  const removeKey = useMutation({
    mutationFn: async (key: string) => {
      const res = await apiFetch(`${TR_API}?key=${encodeURIComponent(key)}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: t("settings_translations.toast_key_deleted") });
      setDeleteKey(null);
      qc.invalidateQueries({ queryKey: ["translations", lang] });
    },
  });

  const isEn = lang === "en";

  return (
    <Layout>
      <PageHeader
        title={<><Languages className="h-5 w-5" />{t("settings_translations.page_title")}</>}
        subtitle={t("settings_translations.page_subtitle")}
      />

      <div className="px-8 py-6">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div>
            <Label className="text-xs text-muted-foreground">{t("settings_translations.editing_language")}</Label>
            <Select value={lang} onValueChange={(v) => { setLang(v); setEdits({}); }}>
              <SelectTrigger className="w-56 mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {languages.map((l) => (
                  <SelectItem key={l.code} value={l.code}>
                    {l.name} ({l.code}){!l.enabled ? ` — ${t("settings_translations.disabled")}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="relative flex-1 max-w-sm self-end">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder={t("settings_translations.search_placeholder")} value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="self-end ml-auto flex gap-2">
            <Button variant="outline" onClick={() => setLangDialog(true)}><Globe className="h-4 w-4 mr-2" />{t("settings_translations.languages")}</Button>
            <Button variant="outline" onClick={() => setAddKeyOpen(true)}><Plus className="h-4 w-4 mr-2" />{t("settings_translations.add_key")}</Button>
            <Button onClick={saveAll} disabled={dirtyCount === 0}>
              <Save className="h-4 w-4 mr-2" />{t("common.save")}{dirtyCount > 0 ? ` (${dirtyCount})` : ""}
            </Button>
          </div>
        </div>

        <div className="border rounded-lg bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[28%]" sortKey="key" activeKey={sortKey} sortDir={sortDir} onSort={toggleSort}>{t("settings_translations.col_key")}</TableHead>
                {!isEn && <TableHead className="w-[30%]" sortKey="en" activeKey={sortKey} sortDir={sortDir} onSort={toggleSort}>{t("settings_translations.col_english_reference")}</TableHead>}
                <TableHead sortKey="value" activeKey={sortKey} sortDir={sortDir} onSort={toggleSort}>{isEn ? t("settings_translations.col_english_value") : t("settings_translations.col_translation")}</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rowsQ.isLoading ? (
                <TableRow><TableCell colSpan={isEn ? 3 : 4} className="text-center py-10 text-muted-foreground">{t("common.loading")}</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={isEn ? 3 : 4} className="text-center py-10 text-muted-foreground">{t("settings_translations.no_keys_found")}</TableCell></TableRow>
              ) : sorted.map((r) => {
                const current = edits[r.key] ?? r.value;
                const dirty = edits[r.key] !== undefined && edits[r.key] !== r.value;
                return (
                  <TableRow key={r.key} className={dirty ? "bg-amber-50/50" : ""}>
                    <TableCell className="font-mono text-xs align-top pt-3.5 break-all">{r.key}</TableCell>
                    {!isEn && <TableCell className="text-sm text-muted-foreground align-top pt-3.5">{r.en || <span className="italic opacity-40">—</span>}</TableCell>}
                    <TableCell>
                      <Input
                        value={current}
                        onChange={(e) => setEdits((prev) => ({ ...prev, [r.key]: e.target.value }))}
                        className="h-9"
                        placeholder={isEn ? "" : r.en}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 justify-end">
                        <Button size="icon" variant="ghost" disabled={!dirty || saveOne.isPending} onClick={() => saveOne.mutate({ key: r.key, value: current })} title={t("settings_translations.save_row_title")}>
                          <Save className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setDeleteKey(r.key)} title={t("settings_translations.delete_key_title")}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <p className="text-xs text-muted-foreground mt-3">{t("settings_translations.keys_count", { shown: filtered.length, total: rows.length })}{dirtyCount > 0 ? ` · ${t("settings_translations.unsaved_count", { count: dirtyCount })}` : ""}</p>
      </div>

      {/* Manage languages */}
      <Dialog open={langDialog} onOpenChange={setLangDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{t("settings_translations.manage_languages")}</DialogTitle></DialogHeader>
          <div className="space-y-1 max-h-64 overflow-auto -mx-1 px-1">
            {languages.map((l) => (
              <div key={l.code} className="flex items-center gap-3 py-1.5 border-b last:border-0">
                <Checkbox checked={l.enabled} onCheckedChange={(c) => toggleLang.mutate({ code: l.code, enabled: !!c })} />
                <span className="text-sm flex-1">{l.name} <span className="text-muted-foreground">({l.code})</span>{l.is_default ? <span className="ml-1 text-xs text-primary">{t("settings_translations.default")}</span> : ""}</span>
                {l.code !== "en" && (
                  <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive h-7 w-7" onClick={() => removeLang.mutate(l.code)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </div>
          <div className="border-t pt-3 mt-1 grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">{t("settings_translations.field_code")} *</Label>
              <Input value={newLang.code} onChange={(e) => setNewLang((s) => ({ ...s, code: e.target.value }))} placeholder="es" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">{t("settings_translations.field_native_name")} *</Label>
              <Input value={newLang.name} onChange={(e) => setNewLang((s) => ({ ...s, name: e.target.value }))} placeholder="Español" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">{t("settings_translations.field_english_name")}</Label>
              <Input value={newLang.english_name} onChange={(e) => setNewLang((s) => ({ ...s, english_name: e.target.value }))} placeholder="Spanish" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">{t("settings_translations.field_flag_iso")}</Label>
              <Input value={newLang.flag_iso} onChange={(e) => setNewLang((s) => ({ ...s, flag_iso: e.target.value }))} placeholder="es" className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLangDialog(false)}>{t("common.close")}</Button>
            <Button onClick={() => addLang.mutate()} disabled={!newLang.code.trim() || !newLang.name.trim() || addLang.isPending}>
              {addLang.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}{t("settings_translations.add_language")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add key */}
      <Dialog open={addKeyOpen} onOpenChange={setAddKeyOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{t("settings_translations.add_translation_key")}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-1">
            <div>
              <Label className="text-xs">{t("settings_translations.field_key_dot_notation")} *</Label>
              <Input value={newKey.key} onChange={(e) => setNewKey((s) => ({ ...s, key: e.target.value }))} placeholder="home.hero_title" className="mt-1 font-mono" />
            </div>
            <div>
              <Label className="text-xs">{t("settings_translations.field_value_for_lang", { lang })}</Label>
              <Input value={newKey.value} onChange={(e) => setNewKey((s) => ({ ...s, value: e.target.value }))} className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddKeyOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={() => addKey.mutate()} disabled={!newKey.key.trim() || addKey.isPending}>{t("common.add")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteKey !== null} onOpenChange={(o) => !o && setDeleteKey(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("settings_translations.delete_key")}</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-mono">{deleteKey}</span>{" "}{t("settings_translations.delete_key_description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <Button variant="destructive" onClick={() => deleteKey && removeKey.mutate(deleteKey)}>{t("common.delete")}</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
