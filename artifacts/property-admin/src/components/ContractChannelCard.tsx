import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { Info, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { AccountLookupSelect } from "@/components/AccountLookupSelect";
import { ACQUISITION_CHANNELS, MANUAL_FEE_CHANNELS } from "@/lib/acquisitionChannels";
import { apiFetch } from "@/lib/apiFetch";
import { formatMoney } from "@/lib/currency";

export interface ChannelValue {
  channel: string;
  accountId: number | null;
  name: string;
  phone: string;
  email: string;
}

interface ChannelPreview {
  contact: { name: string; phone: string; email: string } | null;
  fee: { amount: number | null; currency: string; type_label: string | null; unit_type: string | null };
}

interface Props {
  /** 저장 전 신규 계약이면 null — 세대가 아직 없어 기준표 금액은 계산하지 않는다. */
  contractId: number | null;
  value: ChannelValue;
  onChange: (patch: Partial<ChannelValue>) => void;
  currency: string;
  /** 이 계약의 관련 비용 행들. origin='channel' 인 행이 이 카드가 만든 수수료다. */
  relatedCosts: any[];
  /** 관련 비용 탭으로 이동 — 자동 생성된 행을 바로 손보게. */
  onOpenCosts: () => void;
  /** 연결된 계정의 현재 이름(스냅숏과 다를 수 있다). */
  accountDisplayName?: string | null;
}

/**
 * 계약 경로 카드 — "이 계약을 누가 데려왔는가"를 하나 고르고, 그 상대를 계정관리에서
 * 연결한다.
 *
 * 경로를 고르고 계정을 연결하면 이름·연락처·이메일이 계정(대표 연락처 우선)에서
 * 채워져 계약에 스냅숏으로 저장되고, 저장 시점에 서버가 임대 수수료 기준표를 보고
 * 관련 비용에 수수료 한 행을 자동으로 만들어 둔다(송금일 없음 = 미지급). 금액·송금일
 * 수정은 관련 비용 탭 한 곳에서만 한다 — 같은 돈을 두 군데서 고치게 두지 않는다.
 */
export function ContractChannelCard({
  contractId, value, onChange, currency, relatedCosts, onOpenCosts, accountDisplayName,
}: Props) {
  const { t } = useTranslation();
  const [preview, setPreview] = useState<ChannelPreview | null>(null);
  const [busy, setBusy] = useState(false);

  // 경로가 바뀌면 기준표 예상액이 달라진다 — 화면의 안내 문구를 다시 읽어 온다.
  useEffect(() => {
    let cancelled = false;
    if (!value.channel) { setPreview(null); return; }
    (async () => {
      try {
        const r = await apiFetch(`/api/v1/contracts/${contractId ?? 0}/channel-preview?channel=${value.channel}`);
        if (!r.ok) return;
        const body = await r.json();
        if (!cancelled) setPreview(body);
      } catch { /* 안내용 값이라 실패해도 입력은 그대로 진행된다 */ }
    })();
    return () => { cancelled = true; };
  }, [value.channel, contractId]);

  /** 계정을 고르면 이름/연락처/이메일을 계정에서 가져와 채운다(사람이 고칠 수 있다). */
  const handleAccountChange = async (accountId: number | null) => {
    onChange({ accountId });
    if (!accountId || !value.channel) return;
    setBusy(true);
    try {
      const r = await apiFetch(
        `/api/v1/contracts/${contractId ?? 0}/channel-preview?channel=${value.channel}&account_id=${accountId}`,
      );
      if (!r.ok) return;
      const body: ChannelPreview = await r.json();
      setPreview(body);
      if (body.contact) {
        onChange({
          accountId,
          name: body.contact.name || value.name,
          phone: body.contact.phone || value.phone,
          email: body.contact.email || value.email,
        });
      }
    } catch { /* 자동 채움 실패 시 수기 입력으로 진행 */ } finally {
      setBusy(false);
    }
  };

  const channelCost = relatedCosts.find((c) => c.origin === "channel");
  const feeAmount = preview?.fee?.amount ?? null;

  return (
    <div className="border rounded-lg bg-white p-4 sm:p-6">
      <h2 className="text-sm font-semibold uppercase text-primary tracking-wide mb-1">{t('contract.section_channel')}</h2>
      <p className="text-xs text-muted-foreground mb-4">{t('contract.hint_channel')}</p>

      <RadioGroup
        value={value.channel}
        onValueChange={(v) => onChange({ channel: v })}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2"
      >
        {ACQUISITION_CHANNELS.map((c) => (
          <label
            key={c.value}
            className={`flex items-start gap-2 rounded-md border p-3 cursor-pointer transition-colors ${
              value.channel === c.value ? "border-primary bg-primary/5" : "hover:bg-muted/50"
            }`}
          >
            <RadioGroupItem value={c.value} id={`channel-${c.value}`} className="mt-0.5" />
            <span>
              <span className="block text-sm font-medium">{t(c.labelKey)}</span>
              <span className="block text-xs text-muted-foreground mt-0.5">{t(c.hintKey)}</span>
            </span>
          </label>
        ))}
      </RadioGroup>

      {value.channel && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <div className="sm:col-span-2">
              <Label>{t('contract.label_channel_account')}</Label>
              <AccountLookupSelect
                lookupUrl="/api/v1/lookup/accounts"
                value={value.accountId}
                onChange={(v) => void handleAccountChange(v as number | null)}
                placeholder={t('contract.ph_channel_account')}
                displayValue={accountDisplayName ?? value.name ?? null}
              />
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                {busy && <Loader2 className="w-3 h-3 animate-spin" />}
                {t('contract.hint_channel_account')}
              </p>
            </div>
            <div>
              <Label>{t('contract.label_channel_name')}</Label>
              <Input value={value.name} onChange={(e) => onChange({ name: e.target.value })} placeholder={t('contract.ph_channel_name')} />
            </div>
            <div>
              <Label>{t('contract.label_channel_phone')}</Label>
              <Input value={value.phone} onChange={(e) => onChange({ phone: e.target.value })} placeholder={t('contract.ph_channel_phone')} />
            </div>
            <div className="sm:col-span-2">
              <Label>{t('contract.label_channel_email')}</Label>
              <Input type="email" value={value.email} onChange={(e) => onChange({ email: e.target.value })} placeholder={t('contract.ph_channel_email')} />
            </div>
          </div>

          {/* 수수료 — 기준표 예상액과, 실제로 적재된 관련 비용 행의 현재 상태 */}
          <div className="mt-4 rounded-md border bg-muted/30 p-3 text-sm">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
              <div className="space-y-1">
                {MANUAL_FEE_CHANNELS.has(value.channel) ? (
                  <p className="text-muted-foreground">{t('contract.channel_fee_manual')}</p>
                ) : feeAmount != null ? (
                  <p>
                    {t('contract.channel_fee_expected', {
                      amount: formatMoney(feeAmount, preview?.fee.currency || currency),
                      type: preview?.fee.type_label ?? "—",
                    })}
                  </p>
                ) : (
                  <p className="text-muted-foreground">{t('contract.channel_fee_no_schedule')}</p>
                )}

                {channelCost ? (
                  <p className="flex flex-wrap items-center gap-2">
                    <span>{t('contract.channel_cost_linked', { type: channelCost.cost_type })}</span>
                    <span className="font-medium">{formatMoney(Number(channelCost.amount ?? 0), channelCost.currency || currency)}</span>
                    <Badge className={channelCost.remitted_on ? "bg-green-100 text-green-700 border-green-200" : "bg-amber-100 text-amber-700 border-amber-200"}>
                      {channelCost.remitted_on ? t('contract.cost_paid') : t('contract.cost_unpaid')}
                    </Badge>
                    <button type="button" className="text-primary underline underline-offset-2" onClick={onOpenCosts}>
                      {t('contract.channel_cost_manage')}
                    </button>
                  </p>
                ) : (
                  <p className="text-muted-foreground">{t('contract.channel_cost_pending')}</p>
                )}
              </div>
            </div>
          </div>

          <p className="text-xs text-muted-foreground mt-2">
            {t('contract.hint_channel_schedule')}{" "}
            <Link href="/settings/rental-fee-schedules" className="text-primary underline underline-offset-2">
              {t('contract.link_rental_fee_schedule')}
            </Link>
          </p>
        </>
      )}
    </div>
  );
}

export default ContractChannelCard;
