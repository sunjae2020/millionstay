import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { ExternalLink, Loader2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KoreanAddressSearch } from "@/components/KoreanAddressSearch";
import { apiFetch } from "@/lib/apiFetch";

/** 계약서의 개업공인중개사 표에 그대로 인쇄될 값 — 서버가 만들어 준다. */
export interface BrokerInfo {
  office_name: string | null;
  ceo_name: string | null;
  office_address: string | null;
  reg_no: string | null;
  phone: string | null;
  agent_name: string | null;
}

interface Props {
  /** 계약 경로에서 고른 중개업체 계정. */
  accountId: number;
  broker: BrokerInfo | null;
  /** 저장 후 계약 경로 미리보기를 다시 읽는다. */
  onSaved: () => void;
}

/** 다이얼로그가 편집하는 원본 칸들 — 계정관리의 같은 칸이다. */
interface BrokerDraft {
  name: string;
  ceo_name: string;
  address_line1: string;
  address_suburb: string;
  address_state: string;
  address_postcode: string;
  phone1: string;
  broker_reg_no: string;
  broker_agent_name: string;
}

const EMPTY_DRAFT: BrokerDraft = {
  name: "", ceo_name: "", address_line1: "", address_suburb: "", address_state: "",
  address_postcode: "", phone1: "", broker_reg_no: "", broker_agent_name: "",
};

/**
 * 개업공인중개사 정보 — 계약 경로를 "중개"로 잡고 업체를 고르면 계약 상세에서 바로
 * 보이는 패널.
 *
 * 표에 적히는 항목과 순서는 표준임대차계약서의 "2. 공인중개사" 표를 그대로 따른다.
 * 값은 서버의 `channel-preview.broker` 에서 오는데, 그건 계약서 PDF 가 받는 값과
 * **같은 함수**의 결과라 화면에 보이는 것이 곧 인쇄되는 것이다 — 주소 표기 규칙도,
 * 소속공인중개사가 비었을 때 대표자 성명으로 대체되는 규칙도 여기서 다시 쓰지 않는다.
 *
 * 값이 비어 있으면 계정관리로 건너가지 않고 이 자리에서 고친다(저장은 계정에 남는다 —
 * 계약마다 다른 값이 아니라 업체의 정보이기 때문). 계정의 다른 항목까지 손봐야 하면
 * "계정 상세" 로 넘어간다.
 */
export function BrokerInfoPanel({ accountId, broker, onSaved }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<BrokerDraft>(EMPTY_DRAFT);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 다이얼로그를 열 때 계정의 현재값을 읽는다 — 미리보기는 인쇄용으로 다듬어진
  // 값(주소 한 줄, 폴백 적용)이라 편집 원본으로 쓸 수 없다.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const r = await apiFetch(`/api/v1/accounts/${accountId}`);
        if (!r.ok) throw new Error("load failed");
        const a = await r.json();
        if (cancelled) return;
        setDraft({
          name: a.name ?? "",
          ceo_name: a.ceo_name ?? "",
          address_line1: a.address_line1 ?? "",
          address_suburb: a.address_suburb ?? "",
          address_state: a.address_state ?? "",
          address_postcode: a.address_postcode ?? "",
          phone1: a.phone1 ?? "",
          broker_reg_no: a.broker_reg_no ?? "",
          broker_agent_name: a.broker_agent_name ?? "",
        });
      } catch {
        if (!cancelled) setError(t("contract.broker_load_failed"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, accountId, t]);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const r = await apiFetch(`/api/v1/accounts/${accountId}`, {
        method: "PUT",
        // 고친 칸만 보낸다 — 계정의 나머지 항목은 이 화면의 관심사가 아니다.
        body: JSON.stringify({
          name: draft.name || null,
          ceo_name: draft.ceo_name || null,
          address_line1: draft.address_line1 || null,
          address_suburb: draft.address_suburb || null,
          address_state: draft.address_state || null,
          address_postcode: draft.address_postcode || null,
          phone1: draft.phone1 || null,
          broker_reg_no: draft.broker_reg_no || null,
          broker_agent_name: draft.broker_agent_name || null,
        }),
      });
      if (!r.ok) throw new Error("save failed");
      setOpen(false);
      onSaved();
    } catch {
      setError(t("contract.broker_save_failed"));
    } finally {
      setSaving(false);
    }
  }

  const set = (key: keyof BrokerDraft) => (e: { target: { value: string } }) =>
    setDraft((d) => ({ ...d, [key]: e.target.value }));

  const rows: Array<{ label: string; value: string | null; hint?: string }> = [
    { label: t("contract.broker_office_name"), value: broker?.office_name ?? null },
    { label: t("contract.broker_ceo_name"), value: broker?.ceo_name ?? null },
    { label: t("contract.broker_office_address"), value: broker?.office_address ?? null },
    { label: t("contract.broker_reg_no"), value: broker?.reg_no ?? null },
    { label: t("contract.broker_phone"), value: broker?.phone ?? null },
    {
      label: t("contract.broker_agent_name"),
      value: broker?.agent_name ?? null,
      // 소속중개사를 따로 적지 않아 대표자 성명이 대신 들어간 경우를 화면에서도 밝힌다.
      hint: broker?.agent_name && broker.agent_name === broker.ceo_name
        ? t("contract.broker_agent_from_ceo")
        : undefined,
    },
  ];

  return (
    <div className="mt-4 rounded-md border p-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h3 className="text-sm font-medium">{t("contract.broker_section")}</h3>
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => setOpen(true)}>
            <Pencil className="h-3.5 w-3.5" />
            {t("contract.broker_edit")}
          </Button>
          <Link
            href={`/account/accounts/${accountId}`}
            className="inline-flex items-center gap-1.5 text-xs text-primary underline underline-offset-2"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {t("contract.broker_open_account")}
          </Link>
        </div>
      </div>
      <p className="text-xs text-muted-foreground mb-3">{t("contract.broker_section_hint")}</p>

      <dl className="divide-y text-sm">
        {rows.map((row) => (
          <div key={row.label} className="grid grid-cols-[9rem_1fr] gap-2 py-1.5">
            <dt className="text-muted-foreground">{row.label}</dt>
            <dd className={row.value ? "" : "text-muted-foreground"}>
              {row.value || t("contract.broker_empty")}
              {row.hint && <span className="ml-1.5 text-xs text-muted-foreground">({row.hint})</span>}
            </dd>
          </div>
        ))}
      </dl>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("contract.broker_edit_title")}</DialogTitle>
          </DialogHeader>
          {loading ? (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("common.loading")}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label>{t("contract.broker_office_name")}</Label>
                  <Input value={draft.name} onChange={set("name")} />
                </div>
                <div className="grid gap-1.5">
                  <Label>{t("contract.broker_ceo_name")}</Label>
                  <Input value={draft.ceo_name} onChange={set("ceo_name")} />
                </div>
                <div className="grid gap-1.5">
                  <Label>{t("contract.broker_reg_no")}</Label>
                  <Input value={draft.broker_reg_no} onChange={set("broker_reg_no")} placeholder="00000-0000-00000" />
                </div>
                <div className="grid gap-1.5">
                  <Label>{t("contract.broker_phone")}</Label>
                  <Input value={draft.phone1} onChange={set("phone1")} />
                </div>
                <div className="grid gap-1.5 sm:col-span-2">
                  <Label>{t("contract.broker_agent_name")}</Label>
                  <Input value={draft.broker_agent_name} onChange={set("broker_agent_name")} />
                  <p className="text-xs text-muted-foreground">{t("contract.broker_agent_hint")}</p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>{t("contract.broker_office_address")}</Label>
                  <KoreanAddressSearch
                    onSelect={(a) => setDraft((d) => ({
                      ...d,
                      address_line1: a.address,
                      address_suburb: a.suburb,
                      address_state: a.state,
                      address_postcode: a.postcode,
                    }))}
                  />
                </div>
                <Input value={draft.address_line1} onChange={set("address_line1")} />
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <Input value={draft.address_suburb} onChange={set("address_suburb")} placeholder={t("account.label_city")} />
                  <Input value={draft.address_state} onChange={set("address_state")} placeholder={t("account.label_state")} />
                  <Input value={draft.address_postcode} onChange={set("address_postcode")} placeholder={t("account.label_postcode")} />
                </div>
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                <Link
                  href={`/account/accounts/${accountId}`}
                  className="inline-flex items-center gap-1.5 text-sm text-primary underline underline-offset-2 mr-auto"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  {t("contract.broker_open_account")}
                </Link>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
                <Button type="button" disabled={saving} onClick={() => void save()}>
                  {saving ? t("common.saving") : t("common.save")}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default BrokerInfoPanel;
