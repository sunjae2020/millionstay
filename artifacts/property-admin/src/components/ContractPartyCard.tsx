import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { AccountLookupSelect } from "@/components/AccountLookupSelect";
import { apiJson, ApiError } from "@/lib/apiFetch";
import { ExternalLink, Loader2, Pencil } from "lucide-react";
import { Link } from "wouter";
import { formatPostalAddress, orderFallbackFromLang, type AddressLang } from "@workspace/address";

/**
 * 계약 당사자(임대인 갑 / 임차인 을) 한 쪽을 담당하는 카드.
 *
 * 계약서 당사자 표에 인쇄되는 값은 전부 계정관리에서 온다(연락처 → 계정관리 →
 * 계약서). 그래서 계약 화면에서도 계정을 고르는 데서 끝내지 않고, 그 계정이
 * 실제로 어떤 주소·연락처·번호를 들고 있는지 그대로 펼쳐 보여준다 — 계약서를
 * 뽑고 나서야 빈칸을 발견하는 일이 없도록.
 *
 * 빈칸이 보이면 계정관리 페이지로 이동할 것 없이 여기서 팝업으로 고친다. 저장은
 * 계정 레코드(PUT /v1/accounts/:id)에 바로 쓰이므로 다른 계약서에도 함께 반영된다.
 */

/** 팝업에서 고칠 수 있는 계정 필드 — 계약서 당사자 표에 실리는 것들만. */
const EDITABLE_FIELDS = [
  "name", "account_email", "phone1", "phone2",
  "address_line1", "address_suburb", "address_state", "address_postcode", "address_country",
  "biz_registration_no", "ceo_name", "resident_no",
] as const;
type EditableField = (typeof EDITABLE_FIELDS)[number];

interface AccountRecord extends Partial<Record<EditableField, string | null>> {
  id: number;
  account_type?: string | null;
  primary_contact_id?: number | null;
}

interface Props {
  /** 화면 제목 — "임대인 (갑)" / "임차인 (을)". */
  title: string;
  accountId: number | null;
  onAccountChange: (id: number | null) => void;
  /** 아직 계정 상세를 못 읽었을 때 보여줄 이름(계약 목록이 준 값). */
  fallbackName?: string | null;
  /** 임대인 카드는 사업자등록번호를, 임차인 카드는 주민등록번호를 앞세운다. */
  variant: "landlord" | "tenant";
  required?: boolean;
}

/** 주민등록번호는 화면에서 뒷자리를 가린다 — 전체 값은 발급된 계약서에만 인쇄된다. */
function maskResidentNo(value: string): string {
  const m = value.match(/^(\d{6})[-\s]?(\d{7})$/);
  if (!m) return value;
  return `${m[1]}-${m[2].slice(0, 1)}${"•".repeat(6)}`;
}

export function ContractPartyCard({
  title, accountId, onAccountChange, fallbackName, variant, required,
}: Props) {
  const { t, i18n } = useTranslation();
  const [account, setAccount] = useState<AccountRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!accountId) { setAccount(null); setError(null); return; }
    setLoading(true);
    apiJson<AccountRecord>(`/api/v1/accounts/${accountId}`)
      .then((a) => { if (!cancelled) { setAccount(a); setError(null); } })
      .catch((e) => { if (!cancelled) setError(e instanceof ApiError ? e.message : String(e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [accountId]);

  // 주소는 그 나라 표기 순서대로, 국가명은 빼고 — 계약서에 찍히는 모양 그대로.
  // 한국 주소는 "전라남도 여수시 문수북5길 16, 203동 203호 (우) 59723".
  const addressLine = formatPostalAddress(
    {
      line1: account?.address_line1,
      suburb: account?.address_suburb,
      state: account?.address_state,
      postcode: account?.address_postcode,
      country: account?.address_country,
    },
    (i18n.language?.slice(0, 2) as AddressLang) || "en",
    { orderFallbackCountry: orderFallbackFromLang((i18n.language?.slice(0, 2) as AddressLang) || "en"), omitCountry: true },
  );

  const idLabel = variant === "landlord" ? t("account.label_biz_no") : t("account.label_resident_no");
  const idValueRaw = variant === "landlord" ? account?.biz_registration_no : account?.resident_no;
  const idValue = variant === "tenant" && idValueRaw ? maskResidentNo(idValueRaw) : idValueRaw;

  const rows: Array<[string, string | null | undefined]> = [
    [t("contract.party_address"), addressLine || null],
    [t("contract.party_phone"), account?.phone1 || account?.phone2 || null],
    [t("contract.party_email"), account?.account_email || null],
    [idLabel, idValue || null],
  ];
  if (variant === "landlord") rows.push([t("account.label_ceo"), account?.ceo_name || null]);

  function openEditor() {
    if (!account) return;
    const next: Record<string, string> = {};
    for (const f of EDITABLE_FIELDS) next[f] = (account[f] as string | null) ?? "";
    setDraft(next);
    setEditing(true);
  }

  async function save() {
    if (!account) return;
    setSaving(true);
    setError(null);
    try {
      const patch: Record<string, string | null> = {};
      for (const f of EDITABLE_FIELDS) patch[f] = draft[f]?.trim() ? draft[f].trim() : null;
      // 계정 PUT 은 전체 덮어쓰기라 읽어 온 나머지 필드도 함께 돌려보낸다.
      const body = { ...account, ...patch };
      const updated = await apiJson<AccountRecord>(`/api/v1/accounts/${account.id}`, {
        method: "PUT",
        body: JSON.stringify(body),
      });
      setAccount(updated);
      setEditing(false);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  const field = (key: EditableField, label: string, placeholder?: string) => (
    <div className="grid gap-1.5">
      <Label className="text-xs">{label}</Label>
      <Input
        value={draft[key] ?? ""}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
      />
    </div>
  );

  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="text-sm font-semibold">{title}{required ? " *" : ""}</h3>
        <div className="flex items-center gap-1">
          {accountId && (
            <Button asChild type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs">
              <Link href={`/crm/accounts/${accountId}`} target="_blank" rel="noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </Button>
          )}
          <Button
            type="button" variant="outline" size="sm" className="h-7 px-2 text-xs"
            disabled={!account} onClick={openEditor}
          >
            <Pencil className="h-3.5 w-3.5 mr-1" />
            {t("contract.party_edit_account")}
          </Button>
        </div>
      </div>

      <AccountLookupSelect
        lookupUrl="/api/v1/lookup/accounts"
        value={accountId}
        onChange={onAccountChange}
        placeholder={t("contract.ph_search_accounts")}
        displayValue={account?.name ?? fallbackName ?? null}
      />

      {loading && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />{t("common.loading")}
        </p>
      )}
      {!loading && !accountId && (
        <p className="mt-3 text-xs text-muted-foreground">{t("contract.party_none_selected")}</p>
      )}
      {!loading && account && (
        <dl className="mt-3 divide-y rounded-md border text-xs">
          {rows.map(([label, value]) => (
            <div key={label} className="flex gap-3 px-3 py-2">
              <dt className="w-24 shrink-0 text-muted-foreground">{label}</dt>
              <dd className={value ? "break-all" : "text-muted-foreground/60"}>
                {value || t("contract.party_missing")}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}

      <Dialog open={editing} onOpenChange={(open) => !open && setEditing(false)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("contract.party_edit_title", { name: account?.name ?? "" })}</DialogTitle>
            <DialogDescription>{t("contract.party_edit_hint")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 max-h-[60vh] overflow-y-auto pr-1">
            {field("name", t("account.label_name"))}
            <div className="grid grid-cols-2 gap-3">
              {field("phone1", `${t("account.label_phone")} 1`)}
              {field("phone2", `${t("account.label_phone")} 2`)}
            </div>
            {field("account_email", t("account.label_email"))}
            {field("address_line1", t("account.label_address"))}
            <div className="grid grid-cols-2 gap-3">
              {field("address_suburb", t("account.label_city"))}
              {field("address_state", t("account.label_state"))}
              {field("address_postcode", t("account.label_postcode"))}
              {field("address_country", t("account.label_country"))}
            </div>
            {variant === "landlord" ? (
              <div className="grid grid-cols-2 gap-3">
                {field("biz_registration_no", t("account.label_biz_no"), "000-00-00000")}
                {field("ceo_name", t("account.label_ceo"))}
              </div>
            ) : (
              <>
                {field("resident_no", t("account.label_resident_no"), "000000-0000000")}
                <p className="text-xs text-muted-foreground">{t("account.hint_resident_no")}</p>
              </>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditing(false)} disabled={saving}>
              {t("common.cancel")}
            </Button>
            <Button type="button" onClick={() => void save()} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ContractPartyCard;
