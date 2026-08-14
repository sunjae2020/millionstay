import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { ClipboardPaste, Link2, Plus, Save, Search, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { LookupSelect } from "@/components/LookupSelect";
import { ExportableTable } from "@/components/ui/ExportCsvButton";
import { useToast } from "@/hooks/use-toast";
import { apiFetch, apiJson } from "@/lib/apiFetch";
import { formatDate } from "@/lib/date";

/**
 * Settings → Organisation → 임대사업자 등록증.
 *
 * 민간임대주택에 관한 특별법 시행규칙 별지 제3호서식. 등록증 머릿말(등록번호·
 * 최초등록일·임대사업자·주소·전화)과, 등록증에 열거된 민간임대주택 목록을 함께
 * 관리한다. 목록의 각 줄은 우리 spaces 원장의 세대와 연결되며, 연결된 세대는
 * 공간 상세에서 "임대사업자 등록 세대"로 되짚어 볼 수 있다.
 *
 * 등록증은 수백 세대가 수십 쪽에 걸쳐 적혀 있어 한 줄씩 입력받지 않는다 —
 * 표를 통째로 붙여넣으면 파싱해 등재하고 호수로 자동 연결한다.
 */

interface Registration {
  registration_no?: string;
  first_registered_on?: string;
  operator_name?: string;
  operator_reg_no?: string;
  foreigner_reg_no?: string;
  nationality?: string;
  visa_status?: string;
  visa_period?: string;
  address?: string;
  phone?: string;
  mobile?: string;
  issuing_authority?: string;
  note?: string;
}

interface RegisteredUnit {
  id: number;
  unit_no: string;
  building_address: string;
  acquisition_type: string | null;
  housing_kind: string | null;
  housing_type: string | null;
  exclusive_area_label: string | null;
  registered_on: string | null;
  lease_started_on: string | null;
  registration_history: string | null;
  note: string;
  space_id: number | null;
  space_name: string | null;
  space_type: string | null;
  property_name: string | null;
}

const REG_ENDPOINT = "/api/v1/rental-business";
const UNITS_ENDPOINT = "/api/v1/rental-business/units";

const REG_DEFAULTS: Registration = {
  registration_no: "", first_registered_on: "", operator_name: "", operator_reg_no: "",
  foreigner_reg_no: "", nationality: "", visa_status: "", visa_period: "",
  address: "", phone: "", mobile: "", issuing_authority: "", note: "",
};

export function RentalBusinessRegistration() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [query, setQuery] = useState("");
  const [unlinkedOnly, setUnlinkedOnly] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [adding, setAdding] = useState(false);

  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm<Registration>({
    defaultValues: REG_DEFAULTS,
  });

  const { data: regData } = useQuery<{ data: Registration }>({
    queryKey: ["rental-business"],
    queryFn: () => apiJson(REG_ENDPOINT),
  });

  useEffect(() => {
    if (regData?.data) reset({ ...REG_DEFAULTS, ...regData.data });
  }, [regData, reset]);

  const { data: unitsData, isLoading } = useQuery<{ data: RegisteredUnit[]; meta?: { total: number; unlinked: number } }>({
    queryKey: ["rental-business-units"],
    queryFn: () => apiJson(UNITS_ENDPOINT),
  });

  const units = unitsData?.data ?? [];
  const invalidateUnits = () => qc.invalidateQueries({ queryKey: ["rental-business-units"] });

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return units.filter((u) => {
      if (unlinkedOnly && u.space_id) return false;
      if (!q) return true;
      return [u.unit_no, u.building_address, u.housing_type, u.space_name]
        .some((v) => (v ?? "").toLowerCase().includes(q));
    });
  }, [units, query, unlinkedOnly]);

  const unlinkedCount = unitsData?.meta?.unlinked ?? units.filter((u) => !u.space_id).length;

  const saveReg = async (values: Registration) => {
    const res = await apiFetch(REG_ENDPOINT, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      toast({ title: t("settings_rental_biz.save_failed"), description: body?.error ?? `HTTP ${res.status}`, variant: "destructive" });
      return;
    }
    qc.invalidateQueries({ queryKey: ["rental-business"] });
    toast({ title: t("settings_rental_biz.saved") });
  };

  const autoLink = useMutation({
    mutationFn: () => apiJson<{ data: { linked: number; remaining: number } }>(`${UNITS_ENDPOINT}/auto-link`, { method: "POST" }),
    onSuccess: (body) => {
      invalidateUnits();
      toast({
        title: t("settings_rental_biz.auto_link_done"),
        description: t("settings_rental_biz.auto_link_result", {
          linked: body.data.linked, remaining: body.data.remaining,
        }),
      });
    },
  });

  const removeUnit = useMutation({
    mutationFn: (id: number) => apiFetch(`${UNITS_ENDPOINT}/${id}`, { method: "DELETE" }),
    onSuccess: invalidateUnits,
  });

  return (
    <div className="space-y-6">
      {/* ── 등록증 머릿말 ─────────────────────────────────────────────── */}
      <form onSubmit={handleSubmit(saveReg)} className="space-y-4">
        <div>
          <h3 className="text-base font-semibold">{t("settings_rental_biz.cert_title")}</h3>
          <p className="text-sm text-muted-foreground mt-0.5">{t("settings_rental_biz.cert_subtitle")}</p>
        </div>

        <div className="grid grid-cols-2 gap-4 max-w-3xl">
          <div className="space-y-1.5">
            <Label>{t("settings_rental_biz.registration_no")}</Label>
            <Input {...register("registration_no")} placeholder="2026-여수시-임대사업자-11" />
          </div>
          <div className="space-y-1.5">
            <Label>{t("settings_rental_biz.first_registered_on")}</Label>
            <Input {...register("first_registered_on")} type="date" />
          </div>
          <div className="space-y-1.5">
            <Label>{t("settings_rental_biz.operator_name")}</Label>
            <Input {...register("operator_name")} placeholder={t("settings_rental_biz.operator_name_ph")} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("settings_rental_biz.operator_reg_no")}</Label>
            <Input {...register("operator_reg_no")} placeholder="000000-0000000" />
          </div>
          <div className="space-y-1.5 col-span-2">
            <Label>{t("settings_rental_biz.address")}</Label>
            <Input {...register("address")} placeholder={t("settings_rental_biz.address_ph")} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("settings_rental_biz.phone")}</Label>
            <Input {...register("phone")} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("settings_rental_biz.mobile")}</Label>
            <Input {...register("mobile")} placeholder="010-0000-0000" />
          </div>
          <div className="space-y-1.5">
            <Label>{t("settings_rental_biz.issuing_authority")}</Label>
            <Input {...register("issuing_authority")} placeholder={t("settings_rental_biz.issuing_authority_ph")} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("settings_rental_biz.nationality")}</Label>
            <Input {...register("nationality")} placeholder={t("settings_rental_biz.foreign_only")} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("settings_rental_biz.foreigner_reg_no")}</Label>
            <Input {...register("foreigner_reg_no")} placeholder={t("settings_rental_biz.foreign_only")} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("settings_rental_biz.visa_status")}</Label>
            <Input {...register("visa_status")} placeholder={t("settings_rental_biz.foreign_only")} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("settings_rental_biz.visa_period")}</Label>
            <Input {...register("visa_period")} placeholder={t("settings_rental_biz.foreign_only")} />
          </div>
          <div className="space-y-1.5 col-span-2">
            <Label>{t("common.note")}</Label>
            <Input {...register("note")} />
          </div>
        </div>

        <div className="flex justify-end max-w-3xl">
          <Button type="submit" disabled={isSubmitting}>
            <Save className="h-4 w-4 mr-2" />
            {isSubmitting ? t("common.saving") : t("common.save")}
          </Button>
        </div>
      </form>

      <Separator />

      {/* ── 등재된 민간임대주택 목록 ───────────────────────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">{t("settings_rental_biz.units_title")}</h3>
          <p className="text-sm text-muted-foreground mt-0.5">{t("settings_rental_biz.units_subtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("common.search")}
              className="h-9 w-48 pl-8"
            />
          </div>
          <Button size="sm" variant={unlinkedOnly ? "default" : "outline"} onClick={() => setUnlinkedOnly((v) => !v)}>
            {t("settings_rental_biz.unlinked_only")} ({unlinkedCount})
          </Button>
          <Button size="sm" variant="outline" disabled={autoLink.isPending} onClick={() => autoLink.mutate()}>
            <Link2 className="h-3.5 w-3.5 mr-1" />
            {t("settings_rental_biz.auto_link")}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
            <ClipboardPaste className="h-3.5 w-3.5 mr-1" />
            {t("settings_rental_biz.import")}
          </Button>
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            {t("settings_rental_biz.add_unit")}
          </Button>
        </div>
      </div>

      {adding && (
        <div className="rounded-lg border bg-gray-50 p-3">
          <UnitForm onDone={() => { setAdding(false); invalidateUnits(); }} onCancel={() => setAdding(false)} />
        </div>
      )}

      <div className="rounded-lg border bg-white overflow-x-auto">
        <ExportableTable fileName="rental-business-units" className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              {["unit_no", "acquisition_type", "housing_kind", "housing_type", "area", "registered_on", "lease_started_on", "history", "space"].map((h) => (
                <th key={h} className="text-left px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap">
                  {t(`settings_rental_biz.col_${h}`)}
                </th>
              ))}
              <th className="px-3 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={10} className="text-center py-8 text-muted-foreground">{t("common.loading")}</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={10} className="text-center py-8 text-muted-foreground">{t("settings_rental_biz.no_units")}</td></tr>
            ) : rows.map((u) => (
              <UnitRow key={u.id} row={u} onChanged={invalidateUnits} onDelete={() => removeUnit.mutate(u.id)} />
            ))}
          </tbody>
        </ExportableTable>
      </div>

      <p className="text-[11px] text-muted-foreground leading-relaxed">
        {t("settings_rental_biz.footnote")}
      </p>

      <ImportDialog open={importOpen} onOpenChange={setImportOpen} onImported={invalidateUnits} />
    </div>
  );
}

function UnitRow({ row, onChanged, onDelete }: { row: RegisteredUnit; onChanged: () => void; onDelete: () => void }) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <tr>
        <td colSpan={10} className="p-3 bg-gray-50">
          <UnitForm row={row} onDone={() => { setEditing(false); onChanged(); }} onCancel={() => setEditing(false)} />
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b last:border-0 hover:bg-gray-50/60">
      <td className="px-3 py-2 font-medium whitespace-nowrap">{row.unit_no}</td>
      <td className="px-3 py-2 whitespace-nowrap">{row.acquisition_type ?? "—"}</td>
      <td className="px-3 py-2">{row.housing_kind ?? "—"}</td>
      <td className="px-3 py-2">{row.housing_type ?? "—"}</td>
      <td className="px-3 py-2 whitespace-nowrap">{row.exclusive_area_label ?? "—"}</td>
      <td className="px-3 py-2 whitespace-nowrap">{row.registered_on ? formatDate(row.registered_on) : "—"}</td>
      <td className="px-3 py-2 whitespace-nowrap">{row.lease_started_on ? formatDate(row.lease_started_on) : "—"}</td>
      <td className="px-3 py-2 whitespace-nowrap">{row.registration_history ?? "—"}</td>
      <td className="px-3 py-2 whitespace-nowrap">
        {row.space_id ? (
          <Link href={`/property/spaces/${row.space_id}`} className="text-primary underline underline-offset-2">
            {row.space_name ?? `#${row.space_id}`}
            {row.space_type ? <span className="text-muted-foreground"> · {row.space_type}</span> : null}
          </Link>
        ) : (
          <span className="text-amber-600">{t("settings_rental_biz.unlinked")}</span>
        )}
      </td>
      <td className="px-3 py-2 text-right whitespace-nowrap">
        <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>{t("common.edit")}</Button>
        <Button size="sm" variant="ghost" onClick={onDelete} aria-label={t("common.delete")}>
          <Trash2 className="h-3.5 w-3.5 text-red-500" />
        </Button>
      </td>
    </tr>
  );
}

type UnitDraft = Omit<RegisteredUnit, "id" | "space_name" | "space_type" | "property_name">;

function UnitForm({ row, onDone, onCancel }: { row?: RegisteredUnit; onDone: () => void; onCancel: () => void }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [spaceId, setSpaceId] = useState<number | null>(row?.space_id ?? null);
  const { register, handleSubmit } = useForm<UnitDraft>({
    defaultValues: {
      unit_no: row?.unit_no ?? "",
      building_address: row?.building_address ?? "",
      acquisition_type: row?.acquisition_type ?? "매입",
      housing_kind: row?.housing_kind ?? "장기일반민간임대주택(10년)",
      housing_type: row?.housing_type ?? "아파트(도시형생활주택)",
      exclusive_area_label: row?.exclusive_area_label ?? "",
      registered_on: row?.registered_on ?? "",
      lease_started_on: row?.lease_started_on ?? "",
      registration_history: row?.registration_history ?? "최초",
      note: row?.note ?? "",
    },
  });

  async function submit(values: UnitDraft) {
    setSaving(true);
    try {
      const payload = { ...values, space_id: spaceId };
      const res = await apiFetch(row ? `${UNITS_ENDPOINT}/${row.id}` : UNITS_ENDPOINT, {
        method: row ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      onDone();
    } catch (err) {
      toast({
        title: t("settings_rental_biz.save_failed"),
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-3">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="space-y-1">
          <Label className="text-xs">{t("settings_rental_biz.col_unit_no")}</Label>
          <Input {...register("unit_no", { required: true })} placeholder="1001호" className="h-9" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t("settings_rental_biz.col_acquisition_type")}</Label>
          <Input {...register("acquisition_type")} list="rb-acquisition-types" className="h-9" />
          <datalist id="rb-acquisition-types">
            <option value="매입" />
            <option value="건설" />
          </datalist>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t("settings_rental_biz.col_housing_kind")}</Label>
          <Input {...register("housing_kind")} list="rb-housing-kinds" className="h-9" />
          <datalist id="rb-housing-kinds">
            <option value="장기일반민간임대주택(10년)" />
            <option value="공공지원민간임대주택" />
            <option value="단기민간임대주택" />
          </datalist>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t("settings_rental_biz.col_housing_type")}</Label>
          <Input {...register("housing_type")} list="rb-housing-types" className="h-9" />
          <datalist id="rb-housing-types">
            <option value="아파트(도시형생활주택)" />
            <option value="아파트" />
            <option value="다세대주택" />
            <option value="오피스텔" />
          </datalist>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t("settings_rental_biz.col_area")}</Label>
          <Input {...register("exclusive_area_label")} placeholder="40㎡이하" className="h-9" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t("settings_rental_biz.col_registered_on")}</Label>
          <Input {...register("registered_on")} type="date" className="h-9" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t("settings_rental_biz.col_lease_started_on")}</Label>
          <Input {...register("lease_started_on")} type="date" className="h-9" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t("settings_rental_biz.col_history")}</Label>
          <Input {...register("registration_history")} list="rb-histories" className="h-9" />
          <datalist id="rb-histories">
            <option value="최초" />
            <option value="변경" />
            <option value="말소" />
          </datalist>
        </div>
        <div className="space-y-1 col-span-2">
          <Label className="text-xs">{t("settings_rental_biz.col_building_address")}</Label>
          <Input {...register("building_address")} placeholder="전라남도 여수시 좌수영로 101" className="h-9" />
        </div>
        <div className="space-y-1 col-span-2">
          <Label className="text-xs">{t("settings_rental_biz.col_space")}</Label>
          <LookupSelect
            value={spaceId}
            onChange={setSpaceId}
            lookupUrl="/api/v1/lookup/spaces"
            displayValue={row?.space_name ?? null}
            placeholder={t("settings_rental_biz.space_picker_ph")}
          />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>{t("common.cancel")}</Button>
        <Button type="submit" size="sm" disabled={saving}>{saving ? t("common.saving") : t("common.save")}</Button>
      </div>
    </form>
  );
}

/**
 * 등록증 표 붙여넣기. 관청 문서를 그대로 긁어 오면 열 순서가
 * 호수 / 주택구분 / 주택종류 / 주택유형 / 전용면적 / 주택등록일 / 임대개시일 / 등록이력
 * 이라 그 순서대로 읽는다. 탭·쉼표·2칸 이상 공백 모두 열 구분자로 본다.
 */
function parsePastedRows(text: string, address: string): UnitDraft[] {
  const out: UnitDraft[] = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const cells = trimmed.split(/\t|,|\s{2,}/).map((c) => c.trim()).filter(Boolean);
    if (!cells.length) continue;
    // 머리글 줄(호수 / 주택구분 …)은 건너뛴다.
    if (/^(호수|호\/실|호실|번호|unit)/i.test(cells[0]!)) continue;
    // 첫 칸에 숫자가 없으면 세대 줄이 아니다 — 등록증 안내문·쪽번호를 걸러낸다.
    if (!/\d/.test(cells[0]!)) continue;
    const [unit_no, acquisition_type, housing_kind, housing_type, area, registered_on, lease_started_on, history] = cells;
    out.push({
      unit_no: unit_no!,
      building_address: address,
      acquisition_type: acquisition_type ?? null,
      housing_kind: housing_kind ?? null,
      housing_type: housing_type ?? null,
      exclusive_area_label: area ?? null,
      registered_on: normaliseDate(registered_on),
      lease_started_on: normaliseDate(lease_started_on),
      registration_history: history ?? null,
      space_id: null,
      note: "",
    });
  }
  return out;
}

/** 등록증의 "2026-04-27" / "2026.04.27" / "2026년 4월 27일" 을 YYYY-MM-DD 로. */
function normaliseDate(raw: string | undefined): string | null {
  if (!raw) return null;
  const m = raw.match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
  if (!m) return null;
  return `${m[1]}-${m[2]!.padStart(2, "0")}-${m[3]!.padStart(2, "0")}`;
}

function ImportDialog({ open, onOpenChange, onImported }: {
  open: boolean; onOpenChange: (v: boolean) => void; onImported: () => void;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [text, setText] = useState("");
  const [address, setAddress] = useState("");
  const [replace, setReplace] = useState(false);
  const [busy, setBusy] = useState(false);

  const preview = useMemo(() => parsePastedRows(text, address), [text, address]);

  async function submit() {
    if (!preview.length) return;
    setBusy(true);
    try {
      const res = await apiFetch(`${UNITS_ENDPOINT}/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: preview, replace }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
      toast({
        title: t("settings_rental_biz.import_done"),
        description: t("settings_rental_biz.import_result", {
          imported: body?.data?.imported ?? preview.length,
          linked: body?.data?.linked ?? 0,
        }),
      });
      setText("");
      onOpenChange(false);
      onImported();
    } catch (err) {
      toast({
        title: t("settings_rental_biz.import_failed"),
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t("settings_rental_biz.import_title")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{t("settings_rental_biz.import_help")}</p>
          <div className="space-y-1.5">
            <Label>{t("settings_rental_biz.import_address")}</Label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="전라남도 여수시 좌수영로 101 (연등동, 메트하임 여수)" />
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={10}
            spellCheck={false}
            className="w-full rounded-md border p-2 font-mono text-xs"
            placeholder={"1001호\t매입\t장기일반민간임대주택(10년)\t아파트(도시형생활주택)\t40㎡이하\t2026-04-27\t\t최초"}
          />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} />
            {t("settings_rental_biz.import_replace")}
          </label>
          <p className="text-sm">
            {t("settings_rental_biz.import_preview", { count: preview.length })}
          </p>
          {preview.length > 0 && (
            <div className="max-h-40 overflow-auto rounded border bg-gray-50 p-2 text-xs">
              {preview.slice(0, 10).map((r, i) => (
                <div key={i} className="whitespace-nowrap">
                  {[r.unit_no, r.acquisition_type, r.housing_type, r.exclusive_area_label, r.registered_on].filter(Boolean).join(" · ")}
                </div>
              ))}
              {preview.length > 10 && <div className="text-muted-foreground">…</div>}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4 mr-1" />{t("common.cancel")}
          </Button>
          <Button onClick={submit} disabled={busy || preview.length === 0}>
            {busy ? t("common.saving") : t("settings_rental_biz.import_submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
