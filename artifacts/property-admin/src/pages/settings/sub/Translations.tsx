import { useMemo, useState } from "react";
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
    onError: (e: any) => toast({ title: "Failed", description: String(e?.message ?? e), variant: "destructive" }),
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
      toast({ title: `Saved ${entries.length} change${entries.length > 1 ? "s" : ""}` });
    } catch (e: any) {
      toast({ title: "Save failed", description: String(e?.message ?? e), variant: "destructive" });
    }
  }

  const addLang = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(LANG_API, { method: "POST", body: JSON.stringify({ ...newLang, sort_order: languages.length }) });
      if (!res.ok) throw new Error((await res.json())?.error?.message ?? "Failed");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Language added" });
      setNewLang(EMPTY_LANG);
      qc.invalidateQueries({ queryKey: ["tr-languages"] });
    },
    onError: (e: any) => toast({ title: "Failed", description: String(e?.message ?? e), variant: "destructive" }),
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
      toast({ title: "Language removed" });
      qc.invalidateQueries({ queryKey: ["tr-languages"] });
    },
    onError: (e: any) => toast({ title: "Cannot delete", description: String(e?.message ?? e), variant: "destructive" }),
  });

  const addKey = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(TR_API, { method: "PUT", body: JSON.stringify({ lang, key: newKey.key.trim(), value: newKey.value }) });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Key added" });
      setNewKey({ key: "", value: "" });
      setAddKeyOpen(false);
      qc.invalidateQueries({ queryKey: ["translations", lang] });
    },
    onError: (e: any) => toast({ title: "Failed", description: String(e?.message ?? e), variant: "destructive" }),
  });

  const removeKey = useMutation({
    mutationFn: async (key: string) => {
      const res = await apiFetch(`${TR_API}?key=${encodeURIComponent(key)}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Key deleted across all languages" });
      setDeleteKey(null);
      qc.invalidateQueries({ queryKey: ["translations", lang] });
    },
  });

  const isEn = lang === "en";

  return (
    <Layout>
      <PageHeader
        title={<><Languages className="h-5 w-5" />Languages & Translations</>}
        subtitle="Edit the public website's text per language. Changes appear on the landing page (English is the base)."
      />

      <div className="px-8 py-6">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div>
            <Label className="text-xs text-muted-foreground">Editing language</Label>
            <Select value={lang} onValueChange={(v) => { setLang(v); setEdits({}); }}>
              <SelectTrigger className="w-56 mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {languages.map((l) => (
                  <SelectItem key={l.code} value={l.code}>
                    {l.name} ({l.code}){!l.enabled ? " — disabled" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="relative flex-1 max-w-sm self-end">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search key or text…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="self-end ml-auto flex gap-2">
            <Button variant="outline" onClick={() => setLangDialog(true)}><Globe className="h-4 w-4 mr-2" />Languages</Button>
            <Button variant="outline" onClick={() => setAddKeyOpen(true)}><Plus className="h-4 w-4 mr-2" />Add Key</Button>
            <Button onClick={saveAll} disabled={dirtyCount === 0}>
              <Save className="h-4 w-4 mr-2" />Save{dirtyCount > 0 ? ` (${dirtyCount})` : ""}
            </Button>
          </div>
        </div>

        <div className="border rounded-lg bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[28%]">Key</TableHead>
                {!isEn && <TableHead className="w-[30%]">English (reference)</TableHead>}
                <TableHead>{isEn ? "English value" : "Translation"}</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rowsQ.isLoading ? (
                <TableRow><TableCell colSpan={isEn ? 3 : 4} className="text-center py-10 text-muted-foreground">Loading…</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={isEn ? 3 : 4} className="text-center py-10 text-muted-foreground">No keys found</TableCell></TableRow>
              ) : filtered.map((r) => {
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
                        <Button size="icon" variant="ghost" disabled={!dirty || saveOne.isPending} onClick={() => saveOne.mutate({ key: r.key, value: current })} title="Save this row">
                          <Save className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setDeleteKey(r.key)} title="Delete key (all languages)">
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
        <p className="text-xs text-muted-foreground mt-3">{filtered.length} of {rows.length} keys{dirtyCount > 0 ? ` · ${dirtyCount} unsaved` : ""}</p>
      </div>

      {/* Manage languages */}
      <Dialog open={langDialog} onOpenChange={setLangDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Manage Languages</DialogTitle></DialogHeader>
          <div className="space-y-1 max-h-64 overflow-auto -mx-1 px-1">
            {languages.map((l) => (
              <div key={l.code} className="flex items-center gap-3 py-1.5 border-b last:border-0">
                <Checkbox checked={l.enabled} onCheckedChange={(c) => toggleLang.mutate({ code: l.code, enabled: !!c })} />
                <span className="text-sm flex-1">{l.name} <span className="text-muted-foreground">({l.code})</span>{l.is_default ? <span className="ml-1 text-xs text-primary">default</span> : ""}</span>
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
              <Label className="text-xs">Code *</Label>
              <Input value={newLang.code} onChange={(e) => setNewLang((s) => ({ ...s, code: e.target.value }))} placeholder="es" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Native name *</Label>
              <Input value={newLang.name} onChange={(e) => setNewLang((s) => ({ ...s, name: e.target.value }))} placeholder="Español" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">English name</Label>
              <Input value={newLang.english_name} onChange={(e) => setNewLang((s) => ({ ...s, english_name: e.target.value }))} placeholder="Spanish" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Flag ISO</Label>
              <Input value={newLang.flag_iso} onChange={(e) => setNewLang((s) => ({ ...s, flag_iso: e.target.value }))} placeholder="es" className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLangDialog(false)}>Close</Button>
            <Button onClick={() => addLang.mutate()} disabled={!newLang.code.trim() || !newLang.name.trim() || addLang.isPending}>
              {addLang.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}Add Language
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add key */}
      <Dialog open={addKeyOpen} onOpenChange={setAddKeyOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Translation Key</DialogTitle></DialogHeader>
          <div className="space-y-3 py-1">
            <div>
              <Label className="text-xs">Key (dot notation) *</Label>
              <Input value={newKey.key} onChange={(e) => setNewKey((s) => ({ ...s, key: e.target.value }))} placeholder="home.hero_title" className="mt-1 font-mono" />
            </div>
            <div>
              <Label className="text-xs">Value for "{lang}"</Label>
              <Input value={newKey.value} onChange={(e) => setNewKey((s) => ({ ...s, value: e.target.value }))} className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddKeyOpen(false)}>Cancel</Button>
            <Button onClick={() => addKey.mutate()} disabled={!newKey.key.trim() || addKey.isPending}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteKey !== null} onOpenChange={(o) => !o && setDeleteKey(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete key</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-mono">{deleteKey}</span> will be removed for <strong>all languages</strong>. The landing page will fall back to its bundled default for this key.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button variant="destructive" onClick={() => deleteKey && removeKey.mutate(deleteKey)}>Delete</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
