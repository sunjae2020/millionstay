import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useLocation } from "wouter";
import { formatDate } from "@/lib/date";
import { useTranslation } from "react-i18next";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import {
  MLT_GUARANTEE_NONE_REASONS, MLT_GUARANTEE_STATUSES, MLT_HOUSING_TYPES, MLT_RENTAL_TYPES,
  MLT_SHARED_FIELDS, MLT_SUPPLY_KINDS, MLT_TERM_YEARS, fromTriState, mltFieldsFromRegistration,
  toTriState,
} from "@/lib/mlt";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useForm, Controller } from "react-hook-form";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import {
  useGetContract, useCreateContract, useUpdateContract,
  useSignContract, useActivateContract,
  useTerminateContract, useExpireContract, useDeleteContract,
  getListContractsQueryKey, getGetContractQueryKey,
} from "@workspace/api-client-react";
import { LookupSelect } from "@/components/LookupSelect";
import { ProductLookupSelect } from "@/components/ProductLookupSelect";
import { ContractPartyCard } from "@/components/ContractPartyCard";
import { ContractChannelCard, type ChannelValue } from "@/components/ContractChannelCard";
import { ArrowLeft, Save, Loader2, Trash2, CalendarDays, Plus, Pencil, List, FileDown, Eye, Mail, Receipt, ClipboardList, Wallet, Check, FileSignature, FileText, Scale, CopyPlus, LogOut } from "lucide-react";
import { apiFetch, apiJson } from "@/lib/apiFetch";
import { useToast } from "@/hooks/use-toast";
import { DocumentVersions } from "@/components/DocumentVersions";
import { HomestaySignatureCard } from "@/components/HomestaySignatureCard";
import { TenantOnboardingCard } from "@/components/TenantOnboardingCard";
import { TenantLinkCard } from "@/components/TenantLinkCard";
import ContractInspections from "@/components/ContractInspections";
import SettlementBoard from "@/components/SettlementBoard";
import ContractDocuments from "@/components/ContractDocuments";
import { DocumentPreviewDialog, useDocumentPreview } from "@/components/DocumentPreviewDialog";
import { DepositSettlementPanel } from "@/pages/booking/BookingDepositSettlement";
import { DocumentEmailDialog, type DocumentEmailTarget } from "@/components/DocumentEmailDialog";
import {
  ContractIssueWizard,
  LEASE_ATTACHMENT_OPTIONS,
  LEASE_FORM_OPTIONS,
  type SigningPolicy,
} from "@/components/ContractIssueWizard";
import { useBrand } from "@/contexts/ThemeContext";
import { SUPPORTED_CURRENCIES } from "@/lib/currency";

import { ExportableTable } from "@/components/ui/ExportCsvButton";
// Ordered so the tenant's own currency (from branding) leads; falls back to the full list.
const CURRENCIES = SUPPORTED_CURRENCIES.map((c) => c.code);
const CONTRACT_CATEGORIES = [
  { value: "sale", labelKey: "contract.cat_sale" },
  { value: "jeonse", labelKey: "contract.cat_jeonse" },
  { value: "wolse", labelKey: "contract.cat_wolse" },
  { value: "short_term", labelKey: "contract.cat_short" },
  { value: "long_term", labelKey: "contract.cat_long" },
];
/** contracts.doc_attachments 는 JSON 배열 문자열로 저장된다. 깨진 값도 빈 목록으로. */
function parseAttachments(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((v): v is string => typeof v === "string");
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return raw.split(",").map((v) => v.trim()).filter(Boolean);
  }
}

// 민간임대주택 법정 기재사항의 선택지·라벨은 임대사업자 등록증(계정관리)과 나눠 쓴다 —
// @/lib/mlt 한 벌만 고친다. 값은 api-server mltStandardLeaseForm.ts 의 타입과 1:1이라
// 여기서 임의로 바꾸면 서식 체크박스가 어긋난다.

/**
 * 임대 유형 — 계약이 어떤 결제 모델을 쓰는지. 상세 화면은 이 값에 따라 결제 조건
 * 섹션을 하나만 보여준다(예전에는 한국식 "결제 조건"과 호주식 "재무"가 동시에
 * 떠서 어느 칸을 채워야 하는지 알 수 없었다).
 *   long  — 계약금 · 중도금 · 잔금 · 보증금 · 월세 · 납입일
 *   short — 요금 주기(일·주·월) × 요금 · 총 임대료 · 선급금 · 잔금
 * 기간·잔금·보증금·통화는 두 유형이 같은 컬럼을 공유한다.
 */
type LeaseMode = "long" | "short";
const RATE_PERIODS = [
  { value: "daily", labelKey: "contract.rate_period_daily" },
  { value: "weekly", labelKey: "contract.rate_period_weekly" },
  { value: "monthly", labelKey: "contract.rate_period_monthly" },
];
/** 백필 전(lease_mode = NULL) 계약은 월세 유무로 유형을 갈음한다. */
function resolveLeaseMode(c: any): LeaseMode {
  if (c?.lease_mode === "long" || c?.lease_mode === "short") return c.lease_mode;
  return Number(c?.monthly_rent ?? 0) > 0 ? "long" : "short";
}
const statusColors: Record<string, string> = {
  Draft: "bg-gray-100 text-gray-700",
  Sent: "bg-blue-100 text-blue-700",
  Signed: "bg-purple-100 text-purple-700",
  Active: "bg-green-100 text-green-700",
  Expired: "bg-orange-100 text-orange-700",
  Terminated: "bg-red-100 text-red-700",
};

interface FormData {
  booking_id: number | null;
  product_id: number | null;
  tenant_account_id: number | null;
  landlord_account_id: number | null;
  space_id: number | null;
  start_date: string;
  end_date: string;
  lease_mode: LeaseMode;
  rate_period: string;
  rate_amount: string;
  weekly_rate: string;
  total_rent: string;
  bond_amount: string;
  advance_amount: string;
  contract_category: string;
  lease_form: string;
  rental_business_registration_id: number | null;
  rent_payment_info_id: number | null;
  deposit_payment_info_id: number | null;
  special_terms: string;
  doc_attachments: string[];
  acquisition_channel: string;
  channel_account_id: number | null;
  channel_contact_name: string;
  channel_contact_phone: string;
  channel_contact_email: string;
  mlt_landlord_rental_biz_no: string;
  mlt_housing_type: string;
  mlt_rental_type: string;
  mlt_rental_term_years: string;
  mlt_rental_type_other: string;
  mlt_supply_kind: string;
  mlt_mandatory_start_date: string;
  mlt_over_100_units: string;
  mlt_ancillary_facilities: string;
  mlt_senior_lien: string;
  mlt_senior_lien_kind: string;
  mlt_senior_lien_amount: string;
  mlt_senior_lien_date: string;
  mlt_tax_arrears: string;
  mlt_guarantee_status: string;
  mlt_guarantee_amount: string;
  mlt_guarantee_none_reason: string;
  mlt_late_fee_rate: string;
  interim_payment: string;
  interim_payment_date: string;
  down_payment: string;
  down_payment_date: string;
  balance_amount: string;
  balance_date: string;
  monthly_rent: string;
  rent_due_day: string;
  currency: string;
  document_url: string;
  terms_text: string;
  notes: string;
}

export default function ContractDetail() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const isNew = !id || id === "new";
  // Tenant default currency from branding settings (Metheim → KRW; MillionStay → AUD).
  const { currency: brandCurrency } = useBrand();

  const [terminateOpen, setTerminateOpen] = useState(false);
  const [terminateReason, setTerminateReason] = useState("");
  const [signDocUrl, setSignDocUrl] = useState("");
  const [signOpen, setSignOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("line-items");

  // Payment Schedule dialog state
  const [schedDialogOpen, setSchedDialogOpen] = useState(false);
  const [schedEditItem, setSchedEditItem] = useState<any | null>(null);
  const [schedType, setSchedType] = useState("Rent");
  const [schedFreq, setSchedFreq] = useState("Biweekly");
  const [schedAmount, setSchedAmount] = useState("");
  const [schedCurrency, setSchedCurrency] = useState(brandCurrency);
  const [schedStartDate, setSchedStartDate] = useState("");
  const [schedEndDate, setSchedEndDate] = useState("");
  const [schedNextDue, setSchedNextDue] = useState("");
  const [schedActive, setSchedActive] = useState(true);
  const [schedGst, setSchedGst] = useState(true);

  const resetSchedForm = () => {
    setSchedEditItem(null);
    setSchedType("Rent"); setSchedFreq("Biweekly"); setSchedAmount("");
    setSchedCurrency(brandCurrency); setSchedStartDate(""); setSchedEndDate("");
    setSchedNextDue(""); setSchedActive(true); setSchedGst(true);
  };

  // Line Items dialog state
  const [lineDialogOpen, setLineDialogOpen] = useState(false);
  const [lineEditItem, setLineEditItem] = useState<any | null>(null);
  const [lineItemType, setLineItemType] = useState("Service");
  const [lineName, setLineName] = useState("");
  const [lineTrigger, setLineTrigger] = useState("at_activation");
  const [lineFreq, setLineFreq] = useState("");
  const [lineUnitPrice, setLineUnitPrice] = useState("");
  const [lineQty, setLineQty] = useState("1");
  const [lineCurrency, setLineCurrency] = useState(brandCurrency);
  const [lineGst, setLineGst] = useState(true);
  const [lineNotes, setLineNotes] = useState("");

  const resetLineForm = () => {
    setLineEditItem(null);
    setLineItemType("Service"); setLineName(""); setLineTrigger("at_activation");
    setLineFreq(""); setLineUnitPrice(""); setLineQty("1");
    setLineCurrency(brandCurrency); setLineGst(true); setLineNotes("");
  };

  const openAddLine = () => { resetLineForm(); setLineDialogOpen(true); };
  const openEditLine = (item: any) => {
    setLineEditItem(item);
    setLineItemType(item.item_type ?? "Service");
    setLineName(item.name ?? "");
    setLineTrigger(item.billing_trigger ?? "at_activation");
    setLineFreq(item.billing_frequency ?? "");
    setLineUnitPrice(item.unit_price != null ? String(item.unit_price) : "");
    setLineQty(item.quantity != null ? String(item.quantity) : "1");
    setLineCurrency(item.currency ?? brandCurrency);
    setLineGst(item.gst_included !== false);
    setLineNotes(item.notes ?? "");
    setLineDialogOpen(true);
  };

  // Related Costs dialog state
  const [costDialogOpen, setCostDialogOpen] = useState(false);
  const [costEditItem, setCostEditItem] = useState<any | null>(null);
  const [costType, setCostType] = useState("");
  const [costRemittedOn, setCostRemittedOn] = useState("");
  const [costPayeeName, setCostPayeeName] = useState("");
  const [costAmount, setCostAmount] = useState("");
  const [costCurrency, setCostCurrency] = useState(brandCurrency);
  const [costNote, setCostNote] = useState("");

  const resetCostForm = () => {
    setCostEditItem(null);
    setCostType(""); setCostRemittedOn(""); setCostPayeeName("");
    setCostAmount(""); setCostCurrency(contract?.currency ?? brandCurrency); setCostNote("");
  };

  const openAddCost = () => { resetCostForm(); setCostDialogOpen(true); };
  const openEditCost = (c: any) => {
    setCostEditItem(c);
    setCostType(c.cost_type ?? "");
    setCostRemittedOn(c.remitted_on ?? "");
    setCostPayeeName(c.payee_name ?? "");
    setCostAmount(c.amount != null ? String(c.amount) : "");
    setCostCurrency(c.currency ?? contract?.currency ?? brandCurrency);
    setCostNote(c.note ?? "");
    setCostDialogOpen(true);
  };

  const openAddSched = () => { resetSchedForm(); setSchedDialogOpen(true); };
  const openEditSched = (s: any) => {
    setSchedEditItem(s);
    setSchedType(s.schedule_type ?? "Rent");
    setSchedFreq(s.frequency ?? "Biweekly");
    setSchedAmount(s.amount != null ? String(s.amount) : "");
    setSchedCurrency(s.currency ?? brandCurrency);
    setSchedStartDate(s.start_date ?? "");
    setSchedEndDate(s.end_date ?? "");
    setSchedNextDue(s.next_due_date ?? "");
    setSchedActive(s.is_active !== false);
    setSchedGst(s.gst_included !== false);
    setSchedDialogOpen(true);
  };

  const { data: contract, refetch } = useGetContract(Number(id), {
    query: { enabled: !isNew, queryKey: getGetContractQueryKey(Number(id)) },
  });

  const { data: scheduleData } = useQuery({
    queryKey: ["contract-schedule", id],
    queryFn: async () => { const r = await apiFetch(`/api/v1/contracts/${id}/payment-schedule`); return r.json(); },
    enabled: !isNew,
  });
  const schedules: any[] = scheduleData?.data ?? [];

  const { data: lineItemsData } = useQuery({
    queryKey: ["contract-line-items", id],
    queryFn: async () => { const r = await apiFetch(`/api/v1/contracts/${id}/line-items`); return r.json(); },
    enabled: !isNew,
  });
  const lineItems: any[] = lineItemsData?.data ?? [];

  const { data: relatedCostsData } = useQuery({
    queryKey: ["contract-related-costs", id],
    queryFn: async () => { const r = await apiFetch(`/api/v1/contracts/${id}/related-costs`); return r.json(); },
    enabled: !isNew,
  });
  const relatedCosts: any[] = relatedCostsData?.data ?? [];

  // Rent ledger — every invoice raised against this contract, grouped by the
  // month it falls due, so the tab reproduces the 12-column spreadsheet view.
  const { data: rentInvoicesData } = useQuery({
    queryKey: ["contract-invoices", id],
    queryFn: async () => { const r = await apiFetch(`/api/v1/invoices?contract_id=${id}`); return r.json(); },
    enabled: !isNew,
  });
  const rentInvoices: any[] = Array.isArray(rentInvoicesData) ? rentInvoicesData : (rentInvoicesData?.data ?? []);
  const ledgerYears = Array.from(new Set(rentInvoices
    .map((inv: any) => Number(String(inv.due_date ?? "").slice(0, 4)))
    .filter((y: number) => Number.isFinite(y) && y > 1900))).sort((a, b) => b - a);
  const [ledgerYear, setLedgerYear] = useState<number>(new Date().getFullYear());
  useEffect(() => {
    if (ledgerYears.length && !ledgerYears.includes(ledgerYear)) setLedgerYear(ledgerYears[0]);
  }, [ledgerYears.join(",")]);
  const ledgerByMonth = new Map<number, any>();
  for (const inv of rentInvoices) {
    const due = String(inv.due_date ?? "");
    if (Number(due.slice(0, 4)) !== ledgerYear) continue;
    ledgerByMonth.set(Number(due.slice(5, 7)), inv);
  }
  const ledgerRows = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, invoice: ledgerByMonth.get(i + 1) ?? null }));
  const ledgerPaid = ledgerRows.filter((r) => r.invoice?.status === "Paid");
  const ledgerOpen = ledgerRows.filter((r) => r.invoice && r.invoice.status !== "Paid");
  const sumAmount = (rows: typeof ledgerRows) => rows.reduce((s, r) => s + Number(r.invoice?.amount ?? 0), 0);

  const { register, handleSubmit, reset, control, watch, setValue } = useForm<FormData>({
    defaultValues: {
      booking_id: null, product_id: null, tenant_account_id: null,
      landlord_account_id: null, space_id: null,
      start_date: "", end_date: "", weekly_rate: "", total_rent: "",
      lease_mode: "long", rate_period: "monthly", rate_amount: "",
      bond_amount: "", advance_amount: "",
      contract_category: "", lease_form: "general", doc_attachments: [],
      // 임대사업자 등록번호는 기본이 "선택 안 함"이다 — 등록임대주택이 아닌 물건도
      // 계약하므로, 고르지 않으면 계약서의 그 칸은 비운 채로 발급된다.
      rental_business_registration_id: null,
      rent_payment_info_id: null, deposit_payment_info_id: null, special_terms: "",
      acquisition_channel: "", channel_account_id: null,
      channel_contact_name: "", channel_contact_phone: "", channel_contact_email: "",
      down_payment: "", down_payment_date: "", interim_payment: "", interim_payment_date: "",
      mlt_landlord_rental_biz_no: "", mlt_housing_type: "", mlt_rental_type: "", mlt_rental_term_years: "",
      mlt_rental_type_other: "", mlt_supply_kind: "", mlt_mandatory_start_date: "", mlt_over_100_units: "",
      mlt_ancillary_facilities: "", mlt_senior_lien: "", mlt_senior_lien_kind: "", mlt_senior_lien_amount: "",
      mlt_senior_lien_date: "", mlt_tax_arrears: "", mlt_guarantee_status: "", mlt_guarantee_amount: "",
      mlt_guarantee_none_reason: "", mlt_late_fee_rate: "",
      balance_amount: "", balance_date: "", monthly_rent: "", rent_due_day: "",
      currency: brandCurrency,
      document_url: "", terms_text: "", notes: "",
    },
  });

  useEffect(() => {
    if (contract) {
      reset({
        booking_id: contract.booking_id ?? null,
        product_id: (contract as any).product_id ?? null,
        tenant_account_id: contract.tenant_account_id ?? null,
        landlord_account_id: contract.landlord_account_id ?? null,
        space_id: contract.space_id ?? null,
        start_date: contract.start_date ?? "",
        end_date: contract.end_date ?? "",
        lease_mode: resolveLeaseMode(contract),
        rate_period: (contract as any).rate_period ?? (contract.weekly_rate != null ? "weekly" : "monthly"),
        rate_amount: (contract as any).rate_amount != null
          ? String((contract as any).rate_amount)
          : contract.weekly_rate != null ? String(contract.weekly_rate) : "",
        weekly_rate: contract.weekly_rate != null ? String(contract.weekly_rate) : "",
        total_rent: contract.total_rent != null ? String(contract.total_rent) : "",
        bond_amount: contract.bond_amount != null ? String(contract.bond_amount) : "",
        advance_amount: contract.advance_amount != null ? String(contract.advance_amount) : "",
        contract_category: (contract as any).contract_category ?? "",
        // 서식 기본값은 자사 일반 임대차계약서. 표준서식은 직접 고른다.
        lease_form: (contract as any).lease_form || "general",
        rental_business_registration_id: (contract as any).rental_business_registration_id ?? null,
        rent_payment_info_id: (contract as any).rent_payment_info_id ?? null,
        deposit_payment_info_id: (contract as any).deposit_payment_info_id ?? null,
        special_terms: (contract as any).special_terms ?? "",
        doc_attachments: parseAttachments((contract as any).doc_attachments),
        acquisition_channel: (contract as any).acquisition_channel ?? "",
        channel_account_id: (contract as any).channel_account_id ?? null,
        channel_contact_name: (contract as any).channel_contact_name ?? "",
        channel_contact_phone: (contract as any).channel_contact_phone ?? "",
        channel_contact_email: (contract as any).channel_contact_email ?? "",
        down_payment: (contract as any).down_payment != null ? String((contract as any).down_payment) : "",
        interim_payment: (contract as any).interim_payment != null ? String((contract as any).interim_payment) : "",
        interim_payment_date: (contract as any).interim_payment_date ?? "",
        mlt_landlord_rental_biz_no: (contract as any).mlt_landlord_rental_biz_no ?? "",
        mlt_housing_type: (contract as any).mlt_housing_type ?? "",
        mlt_rental_type: (contract as any).mlt_rental_type ?? "",
        mlt_rental_term_years: (contract as any).mlt_rental_term_years != null ? String((contract as any).mlt_rental_term_years) : "",
        mlt_rental_type_other: (contract as any).mlt_rental_type_other ?? "",
        mlt_supply_kind: (contract as any).mlt_supply_kind ?? "",
        mlt_mandatory_start_date: (contract as any).mlt_mandatory_start_date ?? "",
        mlt_over_100_units: toTriState((contract as any).mlt_over_100_units),
        mlt_ancillary_facilities: (contract as any).mlt_ancillary_facilities ?? "",
        mlt_senior_lien: toTriState((contract as any).mlt_senior_lien),
        mlt_senior_lien_kind: (contract as any).mlt_senior_lien_kind ?? "",
        mlt_senior_lien_amount: (contract as any).mlt_senior_lien_amount != null ? String((contract as any).mlt_senior_lien_amount) : "",
        mlt_senior_lien_date: (contract as any).mlt_senior_lien_date ?? "",
        mlt_tax_arrears: toTriState((contract as any).mlt_tax_arrears),
        mlt_guarantee_status: (contract as any).mlt_guarantee_status ?? "",
        mlt_guarantee_amount: (contract as any).mlt_guarantee_amount != null ? String((contract as any).mlt_guarantee_amount) : "",
        mlt_guarantee_none_reason: (contract as any).mlt_guarantee_none_reason ?? "",
        mlt_late_fee_rate: (contract as any).mlt_late_fee_rate != null ? String((contract as any).mlt_late_fee_rate) : "",
        down_payment_date: (contract as any).down_payment_date ?? "",
        balance_amount: (contract as any).balance_amount != null ? String((contract as any).balance_amount) : "",
        balance_date: (contract as any).balance_date ?? "",
        monthly_rent: (contract as any).monthly_rent != null ? String((contract as any).monthly_rent) : "",
        rent_due_day: (contract as any).rent_due_day != null ? String((contract as any).rent_due_day) : "",
        currency: contract.currency ?? brandCurrency,
        document_url: contract.document_url ?? "",
        terms_text: contract.terms_text ?? "",
        notes: contract.notes ?? "",
      });
    }
  }, [contract, reset]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getListContractsQueryKey() });
    if (!isNew) qc.invalidateQueries({ queryKey: getGetContractQueryKey(Number(id)) });
    // 계약 저장은 계약 경로에 딸린 수수료 행을 서버에서 함께 손보므로 같이 무효화한다.
    if (!isNew) qc.invalidateQueries({ queryKey: ["contract-related-costs", id] });
  };

  const { toast } = useToast();
  /**
   * 저장·발송·서명 같은 동작은 눌러도 화면이 그대로라 "됐나?" 하고 다시 누르게 된다.
   * 성공/실패를 모두 토스트로 알린다 — 실패했는데 조용히 지나가는 쪽이 더 위험하다.
   */
  const notify = (titleKey: string) => ({
    onSuccess: () => toast({ title: t(titleKey) }),
    onError: (err: unknown) => toast({
      title: t('contract.toast_action_failed'),
      description: err instanceof Error ? err.message : t('contract.error'),
      variant: "destructive" as const,
    }),
  });

  const createMutation = useCreateContract({ mutation: { ...notify('contract.toast_created'), onSuccess: (d) => { invalidate(); toast({ title: t('contract.toast_created') }); navigate(`/contracts/contracts/${d.id}`); } } });
  const updateMutation = useUpdateContract({ mutation: { ...notify('contract.toast_saved'), onSuccess: () => { invalidate(); refetch(); toast({ title: t('contract.toast_saved') }); } } });
  const signMutation = useSignContract({ mutation: { ...notify('contract.toast_signed'), onSuccess: () => { invalidate(); refetch(); setSignOpen(false); toast({ title: t('contract.toast_signed') }); } } });
  const activateMutation = useActivateContract({ mutation: { ...notify('contract.toast_activated'), onSuccess: () => { invalidate(); refetch(); toast({ title: t('contract.toast_activated') }); } } });
  const terminateMutation = useTerminateContract({ mutation: { ...notify('contract.toast_terminated'), onSuccess: () => { invalidate(); refetch(); setTerminateOpen(false); toast({ title: t('contract.toast_terminated') }); } } });
  const expireMutation = useExpireContract({ mutation: { ...notify('contract.toast_expired'), onSuccess: () => { invalidate(); refetch(); toast({ title: t('contract.toast_expired') }); } } });
  const deleteMutation = useDeleteContract({ mutation: { ...notify('contract.toast_deleted'), onSuccess: () => { invalidate(); toast({ title: t('contract.toast_deleted') }); navigate("/contracts/contracts"); } } });

  // 계약 연장 — 서버가 기존 계약을 그대로 복제하고, 새 계약 상세로 넘어간다.
  // 기간은 기존 종료일 다음 날부터 같은 길이로 잡혀 오고, 나머지는 여기서 고친다.
  const renewMutation = useMutation({
    mutationFn: async () => {
      const r = await apiFetch(`/api/v1/contracts/${id}/renew`, { method: "POST" });
      if (!r.ok) throw new Error(t('contract.toast_renew_failed'));
      return r.json();
    },
    onSuccess: (created: any) => {
      invalidate();
      toast({ title: t('contract.toast_renewed'), description: created?.contract_ref ?? "" });
      navigate(`/contracts/contracts/${created.id}`);
    },
    onError: (err: unknown) => toast({
      title: t('contract.toast_renew_failed'),
      description: err instanceof Error ? err.message : t('contract.error'),
      variant: "destructive",
    }),
  });

  const invalidateSchedule = () => qc.invalidateQueries({ queryKey: ["contract-schedule", id] });
  const invalidateLineItems = () => qc.invalidateQueries({ queryKey: ["contract-line-items", id] });

  const addLineMutation = useMutation({
    mutationFn: async (payload: any) => {
      const r = await apiFetch(`/api/v1/contracts/${id}/line-items`, { method: "POST", body: JSON.stringify(payload), headers: { "Content-Type": "application/json" } });
      if (!r.ok) throw new Error("Failed to add line item");
      return r.json();
    },
    onSuccess: () => { invalidateLineItems(); setLineDialogOpen(false); resetLineForm(); },
  });

  const updateLineMutation = useMutation({
    mutationFn: async ({ lineId, payload }: { lineId: number; payload: any }) => {
      const r = await apiFetch(`/api/v1/contracts/${id}/line-items/${lineId}`, { method: "PATCH", body: JSON.stringify(payload), headers: { "Content-Type": "application/json" } });
      if (!r.ok) throw new Error("Failed to update line item");
      return r.json();
    },
    onSuccess: () => { invalidateLineItems(); setLineDialogOpen(false); resetLineForm(); },
  });

  const deleteLineMutation = useMutation({
    mutationFn: async (lineId: number) => {
      const r = await apiFetch(`/api/v1/contracts/${id}/line-items/${lineId}`, { method: "DELETE" });
      if (!r.ok && r.status !== 204) throw new Error("Failed to delete line item");
    },
    onSuccess: () => invalidateLineItems(),
  });

  const submitLineForm = () => {
    const payload = {
      item_type: lineItemType, name: lineName, billing_trigger: lineTrigger,
      billing_frequency: lineTrigger === "recurring" ? (lineFreq || null) : null,
      unit_price: lineUnitPrice, quantity: Number(lineQty),
      currency: lineCurrency, gst_included: lineGst, notes: lineNotes || null,
    };
    if (lineEditItem) updateLineMutation.mutate({ lineId: lineEditItem.id, payload });
    else addLineMutation.mutate(payload);
  };

  const invalidateRelatedCosts = () => qc.invalidateQueries({ queryKey: ["contract-related-costs", id] });

  const addCostMutation = useMutation({
    mutationFn: async (payload: any) => {
      const r = await apiFetch(`/api/v1/contracts/${id}/related-costs`, { method: "POST", body: JSON.stringify(payload), headers: { "Content-Type": "application/json" } });
      if (!r.ok) throw new Error("Failed to add related cost");
      return r.json();
    },
    onSuccess: () => { invalidateRelatedCosts(); setCostDialogOpen(false); resetCostForm(); },
  });

  const updateCostMutation = useMutation({
    mutationFn: async ({ costId, payload }: { costId: number; payload: any }) => {
      const r = await apiFetch(`/api/v1/contracts/${id}/related-costs/${costId}`, { method: "PATCH", body: JSON.stringify(payload), headers: { "Content-Type": "application/json" } });
      if (!r.ok) throw new Error("Failed to update related cost");
      return r.json();
    },
    onSuccess: () => { invalidateRelatedCosts(); setCostDialogOpen(false); resetCostForm(); },
  });

  const deleteCostMutation = useMutation({
    mutationFn: async (costId: number) => {
      const r = await apiFetch(`/api/v1/contracts/${id}/related-costs/${costId}`, { method: "DELETE" });
      if (!r.ok && r.status !== 204) throw new Error("Failed to delete related cost");
    },
    onSuccess: () => invalidateRelatedCosts(),
  });

  // Rent ledger actions: settle a month, or pull its receipt PDF (posts to the GL
  // through the shared invoice payment endpoint — no separate accounting path).
  const payRentMutation = useMutation({
    mutationFn: async ({ invoiceId, method }: { invoiceId: number; method: string }) => {
      const r = await apiFetch(`/api/v1/invoices/${invoiceId}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payment_method: method }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "Failed to record payment");
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contract-invoices", id] }),
    onError: (err: any) => toast({ title: t('contract.rent_pay_failed'), description: String(err?.message ?? err), variant: "destructive" }),
  });

  // Receipt for a paid invoice — opens the shared preview (print / download / email).
  const previewReceipt = (invoice: any) => {
    openPreview({
      title: `${invoice.invoice_ref ?? t('contract.btn_receipt')} · ${t('contract.btn_receipt')}`,
      filename: `${invoice.invoice_ref ?? "receipt"}.pdf`,
      source: { kind: "api", path: `/api/v1/invoices/${invoice.id}/receipt/pdf` },
      email: {
        recipientsPath: `/api/v1/invoices/${invoice.id}/receipt/email-recipients`,
        send: async (to) => {
          try {
            const res = await apiFetch(`/api/v1/invoices/${invoice.id}/receipt/email`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ to }),
            });
            const body = await res.json().catch(() => null);
            if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
            toast({ title: t('contract.toast_email_sent'), description: t('contract.toast_email_sent_desc', { to: to.join(", ") }) });
          } catch (err) {
            toast({ title: t('contract.toast_email_failed'), description: err instanceof Error ? err.message : String(err), variant: "destructive" });
            throw err;
          }
        },
      },
    });
  };

  const submitCostForm = () => {
    const payload = {
      cost_type: costType.trim(), remitted_on: costRemittedOn || null, payee_name: costPayeeName.trim(),
      amount: Number(costAmount), currency: costCurrency, note: costNote.trim(),
    };
    if (costEditItem) updateCostMutation.mutate({ costId: costEditItem.id, payload });
    else addCostMutation.mutate(payload);
  };

  const addSchedMutation = useMutation({
    mutationFn: async (payload: any) => {
      const r = await apiFetch(`/api/v1/contracts/${id}/payment-schedule`, { method: "POST", body: JSON.stringify(payload), headers: { "Content-Type": "application/json" } });
      if (!r.ok) throw new Error("Failed to add schedule");
      return r.json();
    },
    onSuccess: () => { invalidateSchedule(); setSchedDialogOpen(false); resetSchedForm(); },
  });

  const updateSchedMutation = useMutation({
    mutationFn: async ({ schedId, payload }: { schedId: number; payload: any }) => {
      const r = await apiFetch(`/api/v1/contracts/${id}/payment-schedule/${schedId}`, { method: "PATCH", body: JSON.stringify(payload), headers: { "Content-Type": "application/json" } });
      if (!r.ok) throw new Error("Failed to update schedule");
      return r.json();
    },
    onSuccess: () => { invalidateSchedule(); setSchedDialogOpen(false); resetSchedForm(); },
  });

  const deleteSchedMutation = useMutation({
    mutationFn: async (schedId: number) => {
      const r = await apiFetch(`/api/v1/contracts/${id}/payment-schedule/${schedId}`, { method: "DELETE" });
      if (!r.ok && r.status !== 204) throw new Error("Failed to delete schedule");
    },
    onSuccess: () => invalidateSchedule(),
  });

  const submitSchedForm = () => {
    const payload = {
      schedule_type: schedType, frequency: schedFreq, amount: schedAmount,
      currency: schedCurrency, start_date: schedStartDate,
      end_date: schedEndDate || null, next_due_date: schedNextDue || schedStartDate,
      is_active: schedActive, gst_included: schedGst,
    };
    if (schedEditItem) updateSchedMutation.mutate({ schedId: schedEditItem.id, payload });
    else addSchedMutation.mutate(payload);
  };

  const buildPayload = (data: FormData) => {
  const isShort = data.lease_mode === "short";
  return ({
    booking_id: data.booking_id ?? null,
    product_id: data.product_id ?? null,
    tenant_account_id: data.tenant_account_id ?? null,
    landlord_account_id: data.landlord_account_id ?? null,
    space_id: data.space_id ?? null,
    start_date: data.start_date || null,
    end_date: data.end_date || null,
    // 선택하지 않은 유형의 금액은 비워서 보낸다 — 유형을 바꿨을 때 예전 모델의
    // 값이 남아 있으면 월세 자동청구·계약서 발급이 엉뚱한 금액을 집는다.
    lease_mode: data.lease_mode,
    rate_period: isShort ? (data.rate_period || null) : null,
    rate_amount: isShort && data.rate_amount ? Number(data.rate_amount) : null,
    // weekly_rate 는 문서 생성 등 기존 경로가 아직 읽으므로 주간 요금일 때만 동기화한다.
    weekly_rate: isShort && data.rate_period === "weekly" && data.rate_amount ? Number(data.rate_amount) : null,
    total_rent: isShort && data.total_rent ? Number(data.total_rent) : null,
    bond_amount: data.bond_amount ? Number(data.bond_amount) : null,
    advance_amount: isShort && data.advance_amount ? Number(data.advance_amount) : null,
    contract_category: data.contract_category || null,
    lease_form: data.lease_form || null,
    doc_attachments: data.doc_attachments ?? [],
    // 계약 경로 — 저장되면 서버가 관련 비용에 수수료 행을 자동으로 맞춰 준다.
    acquisition_channel: data.acquisition_channel || null,
    channel_account_id: data.acquisition_channel ? (data.channel_account_id ?? null) : null,
    channel_contact_name: data.acquisition_channel ? (data.channel_contact_name || null) : null,
    channel_contact_phone: data.acquisition_channel ? (data.channel_contact_phone || null) : null,
    channel_contact_email: data.acquisition_channel ? (data.channel_contact_email || null) : null,
    down_payment: !isShort && data.down_payment ? Number(data.down_payment) : null,
    interim_payment: !isShort && data.interim_payment ? Number(data.interim_payment) : null,
    interim_payment_date: !isShort ? (data.interim_payment_date || null) : null,
    rental_business_registration_id: data.rental_business_registration_id ?? null,
    mlt_landlord_rental_biz_no: data.mlt_landlord_rental_biz_no || null,
    mlt_housing_type: data.mlt_housing_type || null,
    mlt_rental_type: data.mlt_rental_type || null,
    mlt_rental_term_years: data.mlt_rental_term_years ? Number(data.mlt_rental_term_years) : null,
    mlt_rental_type_other: data.mlt_rental_type_other || null,
    mlt_supply_kind: data.mlt_supply_kind || null,
    mlt_mandatory_start_date: data.mlt_mandatory_start_date || null,
    mlt_over_100_units: fromTriState(data.mlt_over_100_units),
    mlt_ancillary_facilities: data.mlt_ancillary_facilities || null,
    mlt_senior_lien: fromTriState(data.mlt_senior_lien),
    mlt_senior_lien_kind: data.mlt_senior_lien_kind || null,
    mlt_senior_lien_amount: data.mlt_senior_lien_amount ? Number(data.mlt_senior_lien_amount) : null,
    mlt_senior_lien_date: data.mlt_senior_lien_date || null,
    mlt_tax_arrears: fromTriState(data.mlt_tax_arrears),
    mlt_guarantee_status: data.mlt_guarantee_status || null,
    mlt_guarantee_amount: data.mlt_guarantee_amount ? Number(data.mlt_guarantee_amount) : null,
    mlt_guarantee_none_reason: data.mlt_guarantee_none_reason || null,
    mlt_late_fee_rate: data.mlt_late_fee_rate ? Number(data.mlt_late_fee_rate) : null,
    down_payment_date: !isShort ? (data.down_payment_date || null) : null,
    balance_amount: data.balance_amount ? Number(data.balance_amount) : null,
    balance_date: data.balance_date || null,
    monthly_rent: !isShort && data.monthly_rent ? Number(data.monthly_rent) : null,
    rent_due_day: !isShort && data.rent_due_day ? Number(data.rent_due_day) : null,
    currency: data.currency || brandCurrency,
    document_url: data.document_url || null,
    rent_payment_info_id: data.rent_payment_info_id ?? null,
    deposit_payment_info_id: data.deposit_payment_info_id ?? null,
    special_terms: data.special_terms || null,
    terms_text: data.terms_text || null,
    notes: data.notes || null,
  });
  };

  // 서식·종류에 따라 보여 줄 칸이 달라진다(민간임대주택 표준임대차계약서 전용 항목).
  const leaseForm = watch("lease_form");
  const watchLeaseMode = watch("lease_mode");

  // 서식별 기본 납부 계좌 — Settings → Payment Info 에서 "기본 적용 서식"을 지정한
  // 계좌를 그 서식의 계약에 미리 채운다. 이미 고른 계좌는 건드리지 않고, 여기서
  // 다른 계좌로 바꾸면 그 선택이 그대로 저장된다.
  const { data: paymentAccounts } = useQuery<{ id: number; display: string; default_for_lease_form?: string | null }[]>({
    queryKey: ["lookup", "payment-info"],
    queryFn: () => apiJson("/api/v1/lookup/payment-info"),
  });
  const rentAccountId = watch("rent_payment_info_id");
  const depositAccountId = watch("deposit_payment_info_id");
  // LookupSelect 는 라벨을 모르면 "#3" 을 보여준다 — 아직 저장 안 된 기본값도
  // 은행·계좌번호로 읽히도록 조회 목록에서 표시명을 찾아 넘긴다.
  const accountLabel = (id: number | null | undefined, saved: string | null) =>
    saved ?? paymentAccounts?.find((a) => a.id === id)?.display ?? null;
  useEffect(() => {
    if (!leaseForm || !paymentAccounts?.length) return;
    const fallback = paymentAccounts.find((a) => a.default_for_lease_form === leaseForm);
    if (!fallback) return;
    if (rentAccountId == null) setValue("rent_payment_info_id", fallback.id);
    if (depositAccountId == null) setValue("deposit_payment_info_id", fallback.id);
  }, [leaseForm, paymentAccounts, rentAccountId, depositAccountId, setValue]);

  // 임대사업자 등록증 — 임대인 계정(계정관리 → 임대인·소유주 → 임대사업자)에 등록된
  // 등록증 중에서만 고른다. 등록임대주택이 아닌 물건도 계약하므로 기본은 "선택 안 함"
  // 이고, 임대인을 바꿔 그 계정의 등록증이 아니게 되면 골라 둔 값을 비운다 —
  // 남의 등록번호가 계약서에 실리는 일이 없어야 한다.
  const landlordAccountId = watch("landlord_account_id");
  const rentalBizRegistrationId = watch("rental_business_registration_id");
  type RentalBizReg = { id: number; registration_no: string; operator_name: string } & Record<string, unknown>;
  const { data: rentalBizRegs } = useQuery<{ data: RentalBizReg[] }>({
    queryKey: ["rental-business-registrations", landlordAccountId],
    queryFn: () => apiJson(`/api/v1/rental-business/registrations?account_id=${landlordAccountId}`),
    enabled: !!landlordAccountId,
  });
  const rentalBizOptions = rentalBizRegs?.data ?? [];
  useEffect(() => {
    if (rentalBizRegistrationId == null) return;
    if (!landlordAccountId) { setValue("rental_business_registration_id", null); return; }
    if (!rentalBizRegs) return;
    if (!rentalBizOptions.some((r) => r.id === rentalBizRegistrationId)) {
      setValue("rental_business_registration_id", null);
    }
  }, [landlordAccountId, rentalBizRegs, rentalBizOptions, rentalBizRegistrationId, setValue]);

  // 등록증에 적어 둔 법정 기재사항을 계약으로 가져온다.
  //
  // 임대인(갑)과 계약서 서식을 함께 골랐을 때만 움직인다 — 임대인이 등록증을 한 벌만
  // 가졌으면 그 등록증을 자동으로 고르고, 고른 등록증이 바뀌는 순간 그 등록증의 값을
  // 계약의 같은 칸으로 옮겨 담는다. 옮긴 뒤 계약에서 고친 값이 최종이다.
  //
  // `appliedRegRef` 가 없으면 저장된 계약을 열 때마다 등록증 값이 다시 덮어써서
  // 손으로 고쳐 둔 값이 사라진다 — 불러온 계약의 등록증은 "이미 반영됨"으로 표시해 둔다.
  const appliedRegRef = useRef<number | null | undefined>(undefined);
  useEffect(() => {
    appliedRegRef.current = isNew ? null : contract ? ((contract as any).rental_business_registration_id ?? null) : undefined;
  }, [isNew, contract]);

  /** 등록증 한 벌의 값을 계약 폼에 얹는다. 등록번호는 그 등록증의 번호가 곧 값이다. */
  const applyRegistration = useCallback((reg: RentalBizReg) => {
    setValue("mlt_landlord_rental_biz_no", reg.registration_no ?? "", { shouldDirty: true });
    const fields = mltFieldsFromRegistration(reg);
    for (const key of MLT_SHARED_FIELDS) {
      setValue(key, fields[key], { shouldDirty: true });
    }
  }, [setValue]);

  useEffect(() => {
    if (leaseForm !== "mlt_standard") return;
    if (!landlordAccountId || !rentalBizRegs) return;
    // 아직 계약을 불러오는 중이면 반영 여부를 알 수 없다 — 덮어쓰기 전에 기다린다.
    if (appliedRegRef.current === undefined) return;

    // 등록증이 한 벌뿐인 임대인은 고를 것이 없다 — 골라 준다.
    if (rentalBizRegistrationId == null && rentalBizOptions.length === 1) {
      setValue("rental_business_registration_id", rentalBizOptions[0]!.id, { shouldDirty: true });
      return;
    }
    if (rentalBizRegistrationId == null || rentalBizRegistrationId === appliedRegRef.current) return;
    const reg = rentalBizOptions.find((r) => r.id === rentalBizRegistrationId);
    if (!reg) return;
    appliedRegRef.current = rentalBizRegistrationId;
    applyRegistration(reg);
  }, [leaseForm, landlordAccountId, rentalBizRegs, rentalBizOptions, rentalBizRegistrationId, setValue, applyRegistration]);

  /** "등록증에서 다시 가져오기" — 손으로 고친 값을 등록증 기준으로 되돌린다. */
  const selectedRentalBizReg = rentalBizOptions.find((r) => r.id === rentalBizRegistrationId) ?? null;
  const reapplyRegistration = () => {
    if (!selectedRentalBizReg) return;
    applyRegistration(selectedRentalBizReg);
    toast({ title: t("contract.mlt_refilled") });
  };

  // 계약 경로 카드 — 5개 필드를 하나의 값처럼 다룬다.
  const channelValue: ChannelValue = {
    channel: watch("acquisition_channel"),
    accountId: watch("channel_account_id"),
    name: watch("channel_contact_name"),
    phone: watch("channel_contact_phone"),
    email: watch("channel_contact_email"),
  };
  const setChannelValue = (patch: Partial<ChannelValue>) => {
    if (patch.channel !== undefined) setValue("acquisition_channel", patch.channel, { shouldDirty: true });
    if (patch.accountId !== undefined) setValue("channel_account_id", patch.accountId, { shouldDirty: true });
    if (patch.name !== undefined) setValue("channel_contact_name", patch.name, { shouldDirty: true });
    if (patch.phone !== undefined) setValue("channel_contact_phone", patch.phone, { shouldDirty: true });
    if (patch.email !== undefined) setValue("channel_contact_email", patch.email, { shouldDirty: true });
  };
  const rentalType = watch("mlt_rental_type");
  const seniorLien = watch("mlt_senior_lien");
  const guaranteeStatus = watch("mlt_guarantee_status");

  const saving = createMutation.isPending || updateMutation.isPending;

  const onSubmit = (data: FormData) => {
    if (isNew) createMutation.mutate({ data: buildPayload(data) });
    else updateMutation.mutate({ id: Number(id), data: buildPayload(data) });
  };

  const status = contract?.status ?? "Draft";

  const [pdfBusy, setPdfBusy] = useState(false);
  const { previewConfig, openPreview, closePreview } = useDocumentPreview();
  const [wizardOpen, setWizardOpen] = useState(false);
  // 서명 방식은 서버가 판정한다(GET /v1/contracts/:id → signing_policy).
  const signingPolicy: SigningPolicy | null = (contract as any)?.signing_policy ?? null;
  /** 계약서 PDF 미리보기 — 위저드의 검토·발행 단계도 이 모달을 그대로 쓴다. */
  const openContractPreview = () => openPreview({
    title: contract?.contract_ref ?? t('contract.btn_preview'),
    filename: `${contract?.contract_ref ?? "contract"}.pdf`,
    source: { kind: "api", path: `/api/v1/contracts/${id}/pdf` },
    email: { recipientsPath: `/api/v1/contracts/${id}/email-recipients`, send: handleEmail },
    emailLabel: t('contract.btn_email'),
  });
  /**
   * "임차인에게 발송" — 미리보기를 거치지 않고 곧바로 수신자(임차인/부동산/임대인
   * + 직접 입력)를 고르는 팝업을 연다. 발송은 계약서 이메일 엔드포인트가 맡고,
   * 그쪽이 Draft → Sent 까지 올려준다.
   */
  const [sendTarget, setSendTarget] = useState<DocumentEmailTarget | null>(null);
  const openSendDialog = () => setSendTarget({
    title: `${contract?.contract_ref ?? ""} · ${t('contract.btn_email')}`.trim(),
    recipientsPath: `/api/v1/contracts/${id}/email-recipients`,
    send: handleEmail,
  });

  const handleEmail = async (to: string[]) => {
    setPdfBusy(true);
    try {
      const res = await apiFetch(`/api/v1/contracts/${id}/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
      toast({ title: t('contract.toast_email_sent'), description: t('contract.toast_email_sent_desc', { to: to.join(", ") }) });
      refetch();
    } catch (err) {
      toast({ title: t('contract.toast_email_failed'), description: err instanceof Error ? err.message : t('contract.error'), variant: "destructive" });
      throw err;
    } finally {
      setPdfBusy(false);
    }
  };

  const fsmActions = () => {
    if (isNew) return null;
    return (
      <div className="flex gap-2">
        {status === "Draft" && (
          <Button type="button" size="sm" className="bg-primary hover:bg-[#d4561a] text-white"
            onClick={openSendDialog}>
            {t('contract.btn_send')}
          </Button>
        )}
        {(status === "Draft" || status === "Sent") && (
          <Button type="button" size="sm" variant="outline" className="border-purple-400 text-purple-700"
            onClick={() => setSignOpen(true)}>
            {t('contract.btn_sign')}
          </Button>
        )}
        {status === "Signed" && (
          <Button type="button" size="sm" className="bg-green-600 hover:bg-green-700 text-white"
            onClick={() => activateMutation.mutate({ id: Number(id) })}>
            {t('contract.btn_activate')}
          </Button>
        )}
        {status === "Active" && (
          <Button type="button" size="sm" variant="outline" className="text-orange-600"
            onClick={() => expireMutation.mutate({ id: Number(id) })}>
            {t('contract.btn_mark_expired')}
          </Button>
        )}
        {(status === "Draft" || status === "Sent" || status === "Signed" || status === "Active") && (
          <Button type="button" size="sm" variant="outline" className="text-red-600"
            onClick={() => setTerminateOpen(true)}>
            {t('contract.btn_terminate')}
          </Button>
        )}
      </div>
    );
  };

  return (
    <Layout>
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="p-4 sm:p-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold font-mono">
                {isNew ? t('contract.new') : contract?.contract_ref}
              </h1>
              {!isNew && <p className="text-sm text-muted-foreground">{t('contract.contract_number', { id })}</p>}
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button type="button" variant="outline" onClick={() => navigate("/contracts/contracts")}>
                <ArrowLeft className="h-4 w-4 mr-2" />{t('common.back')}
              </Button>
              {!isNew && (
                <>
                  <Button type="button" onClick={() => setWizardOpen(true)}>
                    <FileSignature className="h-4 w-4 mr-2" />{t('contract.btn_issue')}
                  </Button>
                  <Button type="button" variant="outline" disabled={pdfBusy} onClick={openContractPreview}>
                    <Eye className="h-4 w-4 mr-2" />{t('contract.btn_preview')}
                  </Button>
                  <Button type="button" variant="outline" disabled={renewMutation.isPending}
                    onClick={() => { if (confirm(t('contract.confirm_renew'))) renewMutation.mutate(); }}>
                    <CopyPlus className="h-4 w-4 mr-2" />{t('contract.btn_renew')}
                  </Button>
                  <DocumentVersions entityType="contract" entityId={Number(id)} freezeUrl={`/api/v1/contracts/${id}/freeze`} />
                </>
              )}
              {!isNew && (
                <Button type="button" variant="outline" className="text-red-600"
                  onClick={() => { if (confirm(t('contract.confirm_delete'))) deleteMutation.mutate({ id: Number(id) }); }}>
                  <Trash2 className="h-4 w-4 mr-2" />{t('common.delete')}
                </Button>
              )}
              <Button type="submit" disabled={saving}>
                {saving
                  ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  : <Save className="h-4 w-4 mr-2" />}
                {saving ? t('common.saving') : t('common.save')}
              </Button>
            </div>
          </div>

          {/* Status bar */}
          {!isNew && contract && (
            <div className="border rounded-lg p-4 mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-blue-50/50">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-sm font-medium text-muted-foreground">{t('contract.status_label')}</span>
                <Badge className={statusColors[status] ?? ""}>{status}</Badge>
                {contract.sent_at && <span className="text-xs text-muted-foreground">{t('contract.sent_at_label', { date: formatDate(contract.sent_at) })}</span>}
                {contract.signed_at && <span className="text-xs text-muted-foreground">{t('contract.signed_at_label', { date: formatDate(contract.signed_at) })}</span>}
                {signingPolicy && (
                  <Badge variant="secondary" className="text-[11px]">
                    {t(signingPolicy.mode === "online" ? 'contract.signing_online' : 'contract.signing_wet')}
                    {signingPolicy.term_days != null && ` · ${t('contract.wiz_days', { count: signingPolicy.term_days })}`}
                  </Badge>
                )}
              </div>
              {fsmActions()}
            </div>
          )}

          <div className="grid grid-cols-1 gap-6 max-w-4xl">
            {/* E-signature — 온라인 서명은 단기(1달 이하) 계약만 발행할 수 있다.
                다만 이미 받아 둔 서명이 있으면 카드를 계속 보여 준다: 기간이
                늘거나 서식이 바뀌었다고 완료된 서명과 서명본 PDF 가 화면에서
                사라지면 안 된다. */}
            {!isNew && contract && (
              <HomestaySignatureCard
                contextType="contract"
                contextId={Number(id)}
                entityType="contract"
                issuePath={signingPolicy?.online_allowed ? `/api/v1/contracts/${id}/issue-signing` : undefined}
                hideIfEmpty={!signingPolicy?.online_allowed}
              />
            )}

            {/* 세입자 온보딩 — 신청부터 퇴거 정산까지 어디까지 갔는지 한 화면에. */}
            {!isNew && contract && <TenantOnboardingCard contractId={Number(id)} />}

            {/* 서류 제출 요청 — 신분증·통장 사본 등을 무로그인 링크로 받는다. */}
            {!isNew && contract && (
              <TenantLinkCard
                kind="doc_request"
                issuePath={`/api/v1/contracts/${id}/document-request`}
                listPath={`/api/v1/contracts/${id}/document-request`}
                defaultEmail={(contract as any)?.tenant_email ?? null}
              />
            )}

            {/* General */}
            <div className="border rounded-lg bg-white p-4 sm:p-6">
              <h2 className="text-sm font-semibold uppercase text-primary tracking-wide mb-4">{t('contract.section_general')}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>{t('invoice.label_booking')}</Label>
                  <Controller name="booking_id" control={control} render={({ field }) => (
                    <LookupSelect
                      lookupUrl="/api/v1/lookup/bookings"
                      value={field.value}
                      onChange={field.onChange}
                      placeholder={t('contract.ph_search_bookings')}
                      displayValue={(contract as any)?.booking_ref ?? null}
                    />
                  )} />
                </div>
                <div>
                  <Label>{t('contract.label_product_package')}</Label>
                  <Controller name="product_id" control={control} render={({ field }) => (
                    <ProductLookupSelect
                      lookupUrl="/api/v1/lookup/products"
                      value={field.value}
                      onChange={field.onChange}
                      placeholder={t('contract.ph_search_products')}
                      displayValue={(contract as any)?.product_name ?? (contract as any)?.contract_product_name ?? null}
                    />
                  )} />
                </div>
                <div>
                  <Label>{t('contract.label_space')}</Label>
                  <Controller name="space_id" control={control} render={({ field }) => (
                    <LookupSelect
                      lookupUrl="/api/v1/lookup/spaces"
                      value={field.value}
                      onChange={field.onChange}
                      placeholder={t('booking.placeholder_space')}
                      displayValue={(contract as any)?.space_name ?? null}
                    />
                  )} />
                </div>
                <div>
                  <Label>{t('contract.label_contract_category')}</Label>
                  <Controller name="contract_category" control={control} render={({ field }) => (
                    <Select value={field.value || undefined} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue placeholder={t('contract.ph_select_category')} /></SelectTrigger>
                      <SelectContent>
                        {CONTRACT_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{t(c.labelKey)}</SelectItem>)}
                        {/* Imported ledgers carry free-text categories (e.g. 시행사/신탁사) — keep them selectable so saving never drops the value. */}
                        {field.value && !CONTRACT_CATEGORIES.some(c => c.value === field.value) && (
                          <SelectItem value={field.value}>{field.value}</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  )} />
                </div>
                <div>
                  <Label>{t('contract.label_lease_form')}</Label>
                  <Controller name="lease_form" control={control} render={({ field }) => (
                    <Select value={field.value || undefined} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue placeholder={t('contract.ph_select_lease_form')} /></SelectTrigger>
                      <SelectContent>
                        {LEASE_FORM_OPTIONS.map(f => <SelectItem key={f.value} value={f.value}>{t(f.labelKey)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )} />
                  <p className="text-xs text-muted-foreground mt-1">{t('contract.hint_lease_form')}</p>
                </div>
                <div>
                  <Label>{t('contract.label_rental_business')}</Label>
                  <Controller name="rental_business_registration_id" control={control} render={({ field }) => (
                    <Select
                      value={field.value == null ? "none" : String(field.value)}
                      onValueChange={(v) => field.onChange(v === "none" ? null : Number(v))}
                    >
                      <SelectTrigger><SelectValue placeholder={t('contract.rental_business_none')} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t('contract.rental_business_none')}</SelectItem>
                        {rentalBizOptions.map((r) => (
                          <SelectItem key={r.id} value={String(r.id)}>
                            {r.registration_no || `#${r.id}`}
                            {r.operator_name ? ` · ${r.operator_name}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )} />
                  <p className="text-xs text-muted-foreground mt-1">
                    {!landlordAccountId
                      ? t('contract.hint_rental_business_no_landlord')
                      : rentalBizOptions.length === 0
                        ? t('contract.hint_rental_business_empty')
                        : t('contract.hint_rental_business')}
                  </p>
                </div>
              </div>

              {/* 계약서에 찍히는 입금 계좌 — Settings → Payment Info 에 등록된 계좌.
                  비워 두면 계좌 이름 규칙(임대료/보증금)으로 자동 지정된다. */}
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>{t('contract.label_rent_account')}</Label>
                  <Controller name="rent_payment_info_id" control={control} render={({ field }) => (
                    <LookupSelect
                      lookupUrl="/api/v1/lookup/payment-info"
                      value={field.value}
                      onChange={field.onChange}
                      placeholder={t('contract.ph_select_account')}
                      displayValue={accountLabel(rentAccountId, (contract as any)?.rent_payment_info_name ?? null)}
                    />
                  )} />
                </div>
                <div>
                  <Label>{t('contract.label_deposit_account')}</Label>
                  <Controller name="deposit_payment_info_id" control={control} render={({ field }) => (
                    <LookupSelect
                      lookupUrl="/api/v1/lookup/payment-info"
                      value={field.value}
                      onChange={field.onChange}
                      placeholder={t('contract.ph_select_account')}
                      displayValue={accountLabel(depositAccountId, (contract as any)?.deposit_payment_info_name ?? null)}
                    />
                  )} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{t('contract.hint_payment_accounts')}</p>

              {/* Attachments printed after the agreement itself */}
              <div className="mt-4">
                <Label>{t('contract.label_doc_attachments')}</Label>
                <Controller name="doc_attachments" control={control} render={({ field }) => (
                  <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {LEASE_ATTACHMENT_OPTIONS.map(a => {
                      const selected = (field.value ?? []).includes(a.value);
                      // 계약갱신 거절통지서는 주택임대차표준계약서 원본의 [별지2]다 —
                      // 다른 서식으로 발급하면 붙을 곳이 없으므로 고르지 못하게 막는다.
                      const unavailable = a.value === "renewal_refusal" && leaseForm !== "housing_standard";
                      return (
                        <label
                          key={a.value}
                          className={`flex items-center gap-2 text-sm ${unavailable ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
                        >
                          <Checkbox
                            disabled={unavailable}
                            checked={selected && !unavailable}
                            onCheckedChange={(checked) => field.onChange(
                              checked
                                ? [...(field.value ?? []), a.value]
                                : (field.value ?? []).filter((v: string) => v !== a.value),
                            )}
                          />
                          {t(a.labelKey)}
                        </label>
                      );
                    })}
                  </div>
                )} />
                <p className="text-xs text-muted-foreground mt-1">{t('contract.hint_doc_attachments')}</p>
              </div>
            </div>

            {/* 계약 경로 — 중개/자체/연장/온라인/기타 중 하나를 고르고, 그 상대를 계정관리에서
                연결한다. 저장하면 수수료가 관련 비용에 자동으로 적재된다. */}
            <ContractChannelCard
              contractId={isNew ? null : Number(id)}
              value={channelValue}
              onChange={setChannelValue}
              currency={watch("currency") || brandCurrency}
              relatedCosts={relatedCosts}
              onCostChanged={invalidateRelatedCosts}
              onOpenCosts={() => setActiveTab("related-costs")}
              accountDisplayName={(contract as any)?.channel_account_name ?? null}
            />

            {/* Parties — 임대인(갑)/임차인(을) 를 각각 독립된 카드로 나눠, 계약서
                당사자 표에 실제로 찍힐 계정관리 정보를 그대로 펼쳐 보여준다.
                빈칸은 카드 안 팝업에서 바로 고칠 수 있다(계정 레코드에 저장). */}
            <div className="border rounded-lg bg-white p-4 sm:p-6">
              <h2 className="text-sm font-semibold uppercase text-primary tracking-wide mb-4">{t('contract.section_parties')}</h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Controller name="landlord_account_id" control={control} render={({ field }) => (
                  <ContractPartyCard
                    title={t('contract.party_landlord')}
                    variant="landlord"
                    accountId={field.value ?? null}
                    onAccountChange={field.onChange}
                    fallbackName={(contract as any)?.landlord_name ?? null}
                  />
                )} />
                <Controller name="tenant_account_id" control={control} render={({ field }) => (
                  <ContractPartyCard
                    title={t('contract.party_tenant')}
                    variant="tenant"
                    required
                    accountId={field.value ?? null}
                    onAccountChange={field.onChange}
                    fallbackName={(contract as any)?.tenant_name ?? null}
                  />
                )} />
              </div>
            </div>

            {/* 민간임대주택 표준임대차계약서(별지 제24호서식) 법정 기재사항 — 그 서식으로 발급할 때만. */}
            {leaseForm === "mlt_standard" && (
            <div className="border rounded-lg bg-white p-4 sm:p-6">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-sm font-semibold uppercase text-primary tracking-wide mb-1">{t('contract.section_mlt')}</h2>
                  {/* 등록증에서 값을 가져왔다는 사실과, 여기서 고친 값이 최종이라는 것을 알려 준다. */}
                  <p className="text-xs text-muted-foreground">
                    {selectedRentalBizReg
                      ? t('contract.hint_mlt_from_registration', { no: selectedRentalBizReg.registration_no })
                      : t('contract.hint_mlt')}
                  </p>
                </div>
                {selectedRentalBizReg && (
                  <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={reapplyRegistration}>
                    {t('contract.mlt_refill')}
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>{t('contract.label_mlt_rental_biz_no')}</Label>
                  <Input {...register("mlt_landlord_rental_biz_no")} placeholder={t('contract.ph_mlt_rental_biz_no')} />
                </div>
                <div>
                  <Label>{t('contract.label_mlt_housing_type')}</Label>
                  <Controller name="mlt_housing_type" control={control} render={({ field }) => (
                    <Select value={field.value || undefined} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue placeholder={t('contract.ph_mlt_unset')} /></SelectTrigger>
                      <SelectContent>
                        {MLT_HOUSING_TYPES.map(v => <SelectItem key={v} value={v}>{t(`contract.mlt_housing_${v}`)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )} />
                </div>
                <div>
                  <Label>{t('contract.label_mlt_rental_type')}</Label>
                  <Controller name="mlt_rental_type" control={control} render={({ field }) => (
                    <Select value={field.value || undefined} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue placeholder={t('contract.ph_mlt_unset')} /></SelectTrigger>
                      <SelectContent>
                        {MLT_RENTAL_TYPES.map(v => <SelectItem key={v} value={v}>{t(`contract.mlt_rental_${v}`)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )} />
                </div>
                <div>
                  <Label>{t('contract.label_mlt_term_years')}</Label>
                  <Controller name="mlt_rental_term_years" control={control} render={({ field }) => (
                    <Select value={field.value || undefined} onValueChange={field.onChange} disabled={!rentalType}>
                      <SelectTrigger><SelectValue placeholder={t('contract.ph_mlt_unset')} /></SelectTrigger>
                      <SelectContent>
                        {(MLT_TERM_YEARS[rentalType] ?? []).map(y => (
                          <SelectItem key={y} value={String(y)}>{t('contract.mlt_years', { years: y })}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )} />
                </div>
                <div>
                  <Label>{t('contract.label_mlt_type_other')}</Label>
                  <Input {...register("mlt_rental_type_other")} placeholder={t('contract.ph_mlt_type_other')} />
                </div>
                <div>
                  <Label>{t('contract.label_mlt_supply_kind')}</Label>
                  <Controller name="mlt_supply_kind" control={control} render={({ field }) => (
                    <Select value={field.value || undefined} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue placeholder={t('contract.ph_mlt_unset')} /></SelectTrigger>
                      <SelectContent>
                        {MLT_SUPPLY_KINDS.map(v => <SelectItem key={v} value={v}>{t(`contract.mlt_supply_${v}`)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )} />
                </div>
                <div>
                  <Label>{t('contract.label_mlt_mandatory_start')}</Label>
                  <Controller name="mlt_mandatory_start_date" control={control} render={({ field }) => (
                    <DateInput value={field.value ?? ""} onChange={field.onChange} />
                  )} />
                </div>
                <div>
                  <Label>{t('contract.label_mlt_over_100')}</Label>
                  <Controller name="mlt_over_100_units" control={control} render={({ field }) => (
                    <Select value={field.value || undefined} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue placeholder={t('contract.ph_mlt_unset')} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yes">{t('contract.mlt_yes')}</SelectItem>
                        <SelectItem value="no">{t('contract.mlt_no')}</SelectItem>
                      </SelectContent>
                    </Select>
                  )} />
                </div>
                <div className="sm:col-span-2">
                  <Label>{t('contract.label_mlt_facilities')}</Label>
                  <Input {...register("mlt_ancillary_facilities")} placeholder={t('contract.ph_mlt_facilities')} />
                </div>

                <div>
                  <Label>{t('contract.label_mlt_senior_lien')}</Label>
                  <Controller name="mlt_senior_lien" control={control} render={({ field }) => (
                    <Select value={field.value || undefined} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue placeholder={t('contract.ph_mlt_unset')} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="no">{t('contract.mlt_lien_none')}</SelectItem>
                        <SelectItem value="yes">{t('contract.mlt_lien_exists')}</SelectItem>
                      </SelectContent>
                    </Select>
                  )} />
                </div>
                <div>
                  <Label>{t('contract.label_mlt_tax_arrears')}</Label>
                  <Controller name="mlt_tax_arrears" control={control} render={({ field }) => (
                    <Select value={field.value || undefined} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue placeholder={t('contract.ph_mlt_unset')} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="no">{t('contract.mlt_lien_none')}</SelectItem>
                        <SelectItem value="yes">{t('contract.mlt_lien_exists')}</SelectItem>
                      </SelectContent>
                    </Select>
                  )} />
                </div>
                {seniorLien === "yes" && (
                  <>
                    <div>
                      <Label>{t('contract.label_mlt_lien_kind')}</Label>
                      <Input {...register("mlt_senior_lien_kind")} placeholder={t('contract.ph_mlt_lien_kind')} />
                    </div>
                    <div>
                      <Label>{t('contract.label_mlt_lien_amount')}</Label>
                      <Input {...register("mlt_senior_lien_amount")} type="number" step="0.01" min="0" />
                    </div>
                    <div>
                      <Label>{t('contract.label_mlt_lien_date')}</Label>
                      <Controller name="mlt_senior_lien_date" control={control} render={({ field }) => (
                        <DateInput value={field.value ?? ""} onChange={field.onChange} />
                      )} />
                    </div>
                  </>
                )}

                <div>
                  <Label>{t('contract.label_mlt_guarantee')}</Label>
                  <Controller name="mlt_guarantee_status" control={control} render={({ field }) => (
                    <Select value={field.value || undefined} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue placeholder={t('contract.ph_mlt_unset')} /></SelectTrigger>
                      <SelectContent>
                        {MLT_GUARANTEE_STATUSES.map(v => <SelectItem key={v} value={v}>{t(`contract.mlt_guarantee_${v}`)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )} />
                </div>
                {(guaranteeStatus === "joined" || guaranteeStatus === "partial") && (
                  <div>
                    <Label>{t('contract.label_mlt_guarantee_amount')}</Label>
                    <Input {...register("mlt_guarantee_amount")} type="number" step="0.01" min="0" />
                  </div>
                )}
                {guaranteeStatus === "not_joined" && (
                  <div>
                    <Label>{t('contract.label_mlt_guarantee_reason')}</Label>
                    <Controller name="mlt_guarantee_none_reason" control={control} render={({ field }) => (
                      <Select value={field.value || undefined} onValueChange={field.onChange}>
                        <SelectTrigger><SelectValue placeholder={t('contract.ph_mlt_unset')} /></SelectTrigger>
                        <SelectContent>
                          {MLT_GUARANTEE_NONE_REASONS.map(v => <SelectItem key={v} value={v}>{t(`contract.mlt_reason_${v}`)}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )} />
                  </div>
                )}
                <div>
                  <Label>{t('contract.label_mlt_late_fee_rate')}</Label>
                  <Input {...register("mlt_late_fee_rate")} type="number" step="0.01" min="0" max="100" />
                </div>
              </div>
            </div>
            )}

            {/* 임대 조건 — 유형(장기/단기) 하나만 펼쳐진다 */}
            <div className="border rounded-lg bg-white p-4 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h2 className="text-sm font-semibold uppercase text-primary tracking-wide">
                  {watchLeaseMode === "short" ? t('contract.section_terms_short') : t('contract.section_terms_long')}
                </h2>
                <Controller name="lease_mode" control={control} render={({ field }) => (
                  <div className="inline-flex rounded-md border overflow-hidden text-xs">
                    {(["long", "short"] as const).map(m => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => field.onChange(m)}
                        className={`px-3 py-1.5 ${field.value === m ? "bg-primary text-primary-foreground" : "bg-white text-muted-foreground hover:bg-muted"}`}
                      >
                        {t(m === "long" ? 'contract.lease_mode_long' : 'contract.lease_mode_short')}
                      </button>
                    ))}
                  </div>
                )} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 공통 — 기간·통화·보증금 */}
                <div>
                  <Label>{t('contract.label_move_in')}</Label>
                  <Controller name="start_date" control={control} render={({ field }) => (
                    <DateInput value={field.value ?? ""} onChange={field.onChange} />
                  )} />
                </div>
                <div>
                  <Label>{t('contract.label_move_out')}</Label>
                  <Controller name="end_date" control={control} render={({ field }) => (
                    <DateInput value={field.value ?? ""} onChange={field.onChange} />
                  )} />
                </div>
                <div>
                  <Label>{t('contract.label_currency')}</Label>
                  <Controller name="currency" control={control} render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )} />
                </div>
                <div>
                  <Label>{t('contract.label_deposit')}</Label>
                  <Input {...register("bond_amount")} type="number" step="0.01" min="0" />
                </div>

                {watchLeaseMode === "short" ? (
                  <>
                    <div>
                      <Label>{t('contract.label_rate_period')}</Label>
                      <Controller name="rate_period" control={control} render={({ field }) => (
                        <Select value={field.value || "weekly"} onValueChange={field.onChange}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {RATE_PERIODS.map(pd => <SelectItem key={pd.value} value={pd.value}>{t(pd.labelKey)}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      )} />
                    </div>
                    <div>
                      <Label>{t('contract.label_rate_amount')}</Label>
                      <Input {...register("rate_amount")} type="number" step="0.01" min="0" />
                    </div>
                    <div>
                      <Label>{t('contract.label_total_rent')}</Label>
                      <Input {...register("total_rent")} type="number" step="0.01" min="0" />
                    </div>
                    <div>
                      <Label>{t('contract.label_advance')}</Label>
                      <Input {...register("advance_amount")} type="number" step="0.01" min="0" />
                    </div>
                    <div>
                      <Label>{t('contract.label_balance')}</Label>
                      <Input {...register("balance_amount")} type="number" step="0.01" min="0" />
                    </div>
                    <div>
                      <Label>{t('contract.label_balance_date')}</Label>
                      <Controller name="balance_date" control={control} render={({ field }) => (
                        <DateInput value={field.value ?? ""} onChange={field.onChange} />
                      )} />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <Label>{t('contract.label_down_payment')}</Label>
                      <Input {...register("down_payment")} type="number" step="0.01" min="0" />
                    </div>
                    <div>
                      <Label>{t('contract.label_down_payment_date')}</Label>
                      <Controller name="down_payment_date" control={control} render={({ field }) => (
                        <DateInput value={field.value ?? ""} onChange={field.onChange} />
                      )} />
                    </div>
                    <div>
                      <Label>{t('contract.label_interim_payment')}</Label>
                      <Input {...register("interim_payment")} type="number" step="0.01" min="0" />
                    </div>
                    <div>
                      <Label>{t('contract.label_interim_payment_date')}</Label>
                      <Controller name="interim_payment_date" control={control} render={({ field }) => (
                        <DateInput value={field.value ?? ""} onChange={field.onChange} />
                      )} />
                    </div>
                    <div>
                      <Label>{t('contract.label_balance')}</Label>
                      <Input {...register("balance_amount")} type="number" step="0.01" min="0" />
                    </div>
                    <div>
                      <Label>{t('contract.label_balance_date')}</Label>
                      <Controller name="balance_date" control={control} render={({ field }) => (
                        <DateInput value={field.value ?? ""} onChange={field.onChange} />
                      )} />
                    </div>
                    <div>
                      <Label>{t('contract.label_monthly_rent')}</Label>
                      <Input {...register("monthly_rent")} type="number" step="0.01" min="0" />
                    </div>
                    <div>
                      <Label>{t('contract.label_rent_due_day')}</Label>
                      <Input {...register("rent_due_day")} type="number" step="1" min="1" max="31" />
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Document */}
            <div className="border rounded-lg bg-white p-4 sm:p-6">
              <h2 className="text-sm font-semibold uppercase text-primary tracking-wide mb-4">{t('contract.section_document')}</h2>
              <div className="space-y-4">
                <div>
                  <Label>{t('contract.label_document_url')}</Label>
                  <Input {...register("document_url")} placeholder="https://..." />
                </div>
                <div>
                  <Label>{t('contract.label_special_terms')}</Label>
                  <Textarea {...register("special_terms")} placeholder={t('contract.ph_special_terms')} rows={6} />
                  <p className="text-xs text-muted-foreground mt-1">{t('contract.hint_special_terms')}</p>
                </div>
                <div>
                  <Label>{t('contract.label_notes')}</Label>
                  <Textarea {...register("notes")} placeholder={t('contract.ph_notes')} rows={3} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>

      {/* Payment Schedule & Services Tabs.

          The strip sits outside the <form> (no nested forms), so it has to repeat
          the form body's own padding and column width to line up with the cards
          above — `max-w-7xl mx-auto` centred it instead, which pushed its left
          edge inwards on wide screens. */}
      {!isNew && (
        <div className="px-4 sm:px-6 pb-8">
          <div className="max-w-4xl space-y-4">
          <div className="flex flex-wrap border-b gap-1">
            {[
              { id: "line-items", label: `${t('contract.tab_line_items')}${lineItems.length ? ` (${lineItems.length})` : ""}`, icon: <List className="w-3.5 h-3.5" /> },
              { id: "related-costs", label: `${t('contract.tab_related_costs')}${relatedCosts.length ? ` (${relatedCosts.length})` : ""}`, icon: <Receipt className="w-3.5 h-3.5" /> },
              { id: "settlement", label: t('settlement.tab_title'), icon: <Scale className="w-3.5 h-3.5" /> },
              { id: "rent-ledger", label: `${t('contract.tab_rent_ledger')}${rentInvoices.length ? ` (${rentInvoices.length})` : ""}`, icon: <Wallet className="w-3.5 h-3.5" /> },
              { id: "schedule", label: `${t('contract.tab_schedule')}${schedules.length ? ` (${schedules.length})` : ""}`, icon: <CalendarDays className="w-3.5 h-3.5" /> },
              { id: "inspections", label: t('inspection.tab_title'), icon: <ClipboardList className="w-3.5 h-3.5" /> },
              { id: "documents", label: t('entity_docs.tab_title'), icon: <FileText className="w-3.5 h-3.5" /> },
              { id: "move-out", label: t('deposit_settlement.tab_title'), icon: <LogOut className="w-3.5 h-3.5" /> },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              >
                {tab.icon}{tab.label}
              </button>
            ))}
          </div>

          {activeTab === "line-items" && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="font-medium text-sm">{t('contract.line_items_title')}</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">{t('contract.line_items_desc')}</p>
                </div>
                <Button size="sm" variant="outline" onClick={openAddLine}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> {t('contract.btn_add_line')}
                </Button>
              </div>
              <div className="rounded-lg border bg-white overflow-x-auto">
                <ExportableTable fileName="contract-line-items" className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      {[t('common.type'), t('common.name'), t('contract.col_billing'), t('contract.col_frequency'), t('contract.col_unit_price'), t('contract.col_qty'), t('common.total'), t('contract.col_gst'), ""].map((h, hi) => (
                        <th key={hi} className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {!lineItems.length ? (
                      <tr><td colSpan={9} className="text-center py-10 text-muted-foreground">{t('contract.no_line_items')}</td></tr>
                    ) : lineItems.map((item: any) => (
                      <tr key={item.id} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${item.item_type === "Rent" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>
                            {item.item_type}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium">{item.name}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {item.billing_trigger === "recurring" ? t('contract.billing_recurring') : item.billing_trigger === "at_activation" ? t('contract.billing_onetime') : item.billing_trigger}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{item.billing_frequency ?? "—"}</td>
                        <td className="px-4 py-3 font-mono">{item.unit_price != null ? `$${Number(item.unit_price).toFixed(2)}` : "—"}</td>
                        <td className="px-4 py-3 text-center">{item.quantity ?? 1}</td>
                        <td className="px-4 py-3 font-mono font-medium">{item.total_price != null ? `$${Number(item.total_price).toFixed(2)}` : "—"}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${item.gst_included ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"}`}>
                            {item.gst_included ? t('contract.gst_incl') : t('contract.gst_ex')}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEditLine(item)}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500 hover:text-red-700" onClick={() => deleteLineMutation.mutate(item.id)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {lineItems.length > 0 && (
                    <tfoot className="bg-gray-50 border-t">
                      <tr>
                        <td colSpan={6} className="px-4 py-3 text-right font-medium text-sm text-muted-foreground">{t('contract.total_contract_value')}</td>
                        <td className="px-4 py-3 font-mono font-bold text-sm">
                          ${lineItems.reduce((sum: number, i: any) => sum + Number(i.total_price ?? 0), 0).toFixed(2)}
                        </td>
                        <td colSpan={2} />
                      </tr>
                    </tfoot>
                  )}
                </ExportableTable>
              </div>
            </div>
          )}

          {activeTab === "rent-ledger" && (
            <div className="space-y-3">
              <div className="flex flex-wrap justify-between items-center gap-2">
                <div>
                  <h4 className="font-medium text-sm">{t('contract.rent_ledger_title')}</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">{t('contract.rent_ledger_desc')}</p>
                </div>
                <div className="flex items-center gap-1">
                  {(ledgerYears.length ? ledgerYears : [ledgerYear]).map((y) => (
                    <Button key={y} size="sm" variant={y === ledgerYear ? "default" : "outline"} onClick={() => setLedgerYear(y)}>
                      {y}
                    </Button>
                  ))}
                </div>
              </div>

              {/* 12-month strip — the spreadsheet's 월별 입금 현황 at a glance */}
              <div className="grid grid-cols-3 sm:grid-cols-6 lg:grid-cols-12 gap-1.5">
                {ledgerRows.map(({ month, invoice }) => {
                  const paid = invoice?.status === "Paid";
                  const open = Boolean(invoice) && !paid;
                  return (
                    <div
                      key={month}
                      className={`rounded-md border px-2 py-1.5 text-center ${paid ? "bg-green-50 border-green-200" : open ? "bg-red-50 border-red-200" : "bg-gray-50"}`}
                      title={invoice?.notes ?? ""}
                    >
                      <div className="text-[11px] text-muted-foreground">{t('contract.month_label', { n: month })}</div>
                      <div className={`text-xs font-medium ${paid ? "text-green-700" : open ? "text-red-600" : "text-muted-foreground"}`}>
                        {paid
                          ? (invoice.paid_at ? `${new Date(invoice.paid_at).getDate()}${t('contract.day_suffix')}` : t('invoice.status_paid'))
                          : open ? t('contract.rent_unpaid') : "—"}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="rounded-lg border bg-white overflow-x-auto">
                <ExportableTable fileName="contract-rent-schedule" className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      {[t('contract.col_month'), t('contract.col_invoice_ref'), t('contract.col_due_date'), t('contract.col_paid_on'),
                        t('common.amount'), t('common.status'), t('contract.col_payment_method'), t('contract.col_remarks'), ""].map((h, hi) => (
                        <th key={hi} className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {!rentInvoices.length ? (
                      <tr><td colSpan={9} className="text-center py-10 text-muted-foreground">{t('contract.no_rent_ledger')}</td></tr>
                    ) : ledgerRows.filter((r) => r.invoice).map(({ month, invoice }) => (
                      <tr key={month} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium whitespace-nowrap">{t('contract.month_label', { n: month })}</td>
                        <td className="px-4 py-3">
                          <button type="button" className="text-primary hover:underline" onClick={() => navigate(`/finance/invoices/${invoice.id}`)}>
                            {invoice.invoice_ref}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{invoice.due_date ? formatDate(invoice.due_date) : "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{invoice.paid_at ? formatDate(invoice.paid_at) : "—"}</td>
                        <td className="px-4 py-3 font-mono whitespace-nowrap">{Number(invoice.amount ?? 0).toLocaleString()} {invoice.currency}</td>
                        <td className="px-4 py-3">
                          <Badge className={invoice.status === "Paid" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}>{invoice.status}</Badge>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{invoice.payment_method || "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground whitespace-pre-line">{invoice.notes || "—"}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            {invoice.status === "Paid" ? (
                              <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => previewReceipt(invoice)}>
                                <FileDown className="w-3.5 h-3.5 mr-1" />{t('contract.btn_receipt')}
                              </Button>
                            ) : (
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-green-700"
                                disabled={payRentMutation.isPending}
                                onClick={() => payRentMutation.mutate({ invoiceId: invoice.id, method: t('contract.method_bank_transfer') })}>
                                <Check className="w-3.5 h-3.5 mr-1" />{t('contract.btn_mark_paid')}
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {rentInvoices.length > 0 && (
                    <tfoot className="bg-gray-50 border-t">
                      <tr>
                        <td colSpan={4} className="px-4 py-3 text-right font-medium text-sm text-muted-foreground">{t('contract.total_rent_paid')}</td>
                        <td className="px-4 py-3 font-mono font-bold text-sm whitespace-nowrap text-green-700">
                          {sumAmount(ledgerPaid).toLocaleString()} {contract?.currency ?? ""}
                        </td>
                        <td colSpan={4} className="px-4 py-3 text-sm text-muted-foreground">
                          {ledgerOpen.length > 0 && (
                            <span className="text-red-600 font-medium">
                              {t('contract.total_rent_outstanding')}: {sumAmount(ledgerOpen).toLocaleString()} {contract?.currency ?? ""} ({ledgerOpen.length})
                            </span>
                          )}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </ExportableTable>
              </div>

            </div>
          )}

          {activeTab === "related-costs" && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="font-medium text-sm">{t('contract.related_costs_title')}</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">{t('contract.related_costs_desc')}</p>
                </div>
                <Button size="sm" variant="outline" onClick={openAddCost}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> {t('contract.btn_add_cost')}
                </Button>
              </div>
              <div className="rounded-lg border bg-white overflow-x-auto">
                <ExportableTable fileName="contract-related-costs" className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      {[t('contract.col_cost_type'), t('contract.col_cost_status'), t('contract.col_remitted_on'), t('contract.col_payee_name'), t('common.amount'), t('contract.col_remarks'), ""].map((h, hi) => (
                        <th key={hi} className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {!relatedCosts.length ? (
                      <tr><td colSpan={7} className="text-center py-10 text-muted-foreground">{t('contract.no_related_costs')}</td></tr>
                    ) : relatedCosts.map((c: any) => (
                      <tr key={c.id} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">
                          <span className="flex items-center gap-1.5">
                            {c.cost_type}
                            {/* 계약 경로에서 자동으로 만들어진 행 — 사람이 추가한 행과 구분한다. */}
                            {c.origin === "channel" && (
                              <Badge className="bg-violet-100 text-violet-700 border-violet-200 text-[10px] px-1.5 py-0">{t('contract.cost_auto')}</Badge>
                            )}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Badge className={c.remitted_on ? "bg-green-100 text-green-700 border-green-200" : "bg-amber-100 text-amber-700 border-amber-200"}>
                            {c.remitted_on ? t('contract.cost_paid') : t('contract.cost_unpaid')}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{c.remitted_on ? formatDate(c.remitted_on) : "—"}</td>
                        <td className="px-4 py-3">{c.payee_name || "—"}</td>
                        <td className="px-4 py-3 font-mono">{c.amount != null ? `${Number(c.amount).toLocaleString()} ${c.currency ?? ""}`.trim() : "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground">{c.note || "—"}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEditCost(c)}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500 hover:text-red-700" onClick={() => deleteCostMutation.mutate(c.id)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {relatedCosts.length > 0 && (
                    <tfoot className="bg-gray-50 border-t">
                      <tr>
                        <td colSpan={4} className="px-4 py-3 text-right font-medium text-sm text-muted-foreground">{t('contract.total_related_costs')}</td>
                        <td className="px-4 py-3 font-mono font-bold text-sm whitespace-nowrap">
                          {relatedCosts.reduce((sum: number, c: any) => sum + Number(c.amount ?? 0), 0).toLocaleString()} {relatedCosts[0]?.currency ?? ""}
                        </td>
                        {/* 미지급 = 송금일이 비어 있는 행. 결제 관리의 핵심 숫자라 합계 옆에 세운다. */}
                        <td colSpan={2} className="px-4 py-3 text-sm">
                          {relatedCosts.some((c: any) => !c.remitted_on) && (
                            <span className="text-amber-700 font-medium">
                              {t('contract.total_costs_unpaid')}: {relatedCosts.filter((c: any) => !c.remitted_on).reduce((sum: number, c: any) => sum + Number(c.amount ?? 0), 0).toLocaleString()} {relatedCosts[0]?.currency ?? ""} ({relatedCosts.filter((c: any) => !c.remitted_on).length})
                            </span>
                          )}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </ExportableTable>
              </div>
            </div>
          )}

          {/* 정산 — who this contract's receipts get split between, and what
              was left for us after each split. */}
          {activeTab === "settlement" && <SettlementBoard contractId={id!} />}

          {activeTab === "schedule" && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <h4 className="font-medium text-sm">{t('contract.tab_schedule')}</h4>
                <Button size="sm" variant="outline" onClick={openAddSched}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> {t('contract.btn_add_entry')}
                </Button>
              </div>
              <div className="rounded-lg border bg-white overflow-x-auto">
                <ExportableTable fileName="contract-schedule" className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      {[t('common.type'), t('common.amount'), t('contract.label_currency'), t('contract.label_start'), t('contract.label_end'), t('contract.col_next_due'), t('contract.col_frequency'), t('contract.col_gst'), t('common.active'), ""].map((h, hi) => (
                        <th key={hi} className="text-left px-4 py-3 font-medium text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {!schedules.length ? (
                      <tr><td colSpan={10} className="text-center py-10 text-muted-foreground">{t('contract.no_schedule')}</td></tr>
                    ) : schedules.map((s: any) => (
                      <tr key={s.id} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">{s.schedule_type ?? "Rent"}</td>
                        <td className="px-4 py-3 font-mono">{s.amount != null ? `$${Number(s.amount).toFixed(2)}` : "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground">{s.currency ?? brandCurrency}</td>
                        <td className="px-4 py-3 text-muted-foreground">{s.start_date ?? "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground">{s.end_date ?? "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground">{s.next_due_date ?? "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground">{s.frequency ?? "—"}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${s.gst_included ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"}`}>
                            {s.gst_included ? t('contract.gst_incl') : t('contract.gst_ex')}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${s.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}`}>
                            {s.is_active ? t('common.active') : t('common.inactive')}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEditSched(s)}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500 hover:text-red-700" onClick={() => deleteSchedMutation.mutate(s.id)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </ExportableTable>
              </div>
            </div>
          )}

          {activeTab === "inspections" && <ContractInspections contractId={id!} />}

          {/* 계약 서류함 — 업로드도 목록도 이 컴포넌트 하나가 갖는다.
              신분증·비자는 여기 올리지 않는다: 30일 파기(APP 11) 대상이라
              7년 보관하는 계약에 붙이면 보존기간이 어긋난다. */}
          {activeTab === "documents" && contract && <ContractDocuments contractId={Number(id)} />}

          {/* 퇴거세대 정산 — 확인서가 정본이다. 보증금(B) − 차감/환급 합계(A) = 최종
              반환 차액(C)이고, C가 마이너스일 때만 회수 인보이스를 따로 붙인다. */}
          {activeTab === "move-out" && <DepositSettlementPanel scope="contract" id={id} />}

          </div>
        </div>
      )}

      {/* Terminate Dialog */}
      <Dialog open={terminateOpen} onOpenChange={setTerminateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('contract.btn_terminate')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label>{t('contract.label_termination_reason')} *</Label>
            <Textarea
              value={terminateReason}
              onChange={e => setTerminateReason(e.target.value)}
              placeholder={t('contract.ph_termination_reason')}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTerminateOpen(false)}>{t('common.cancel')}</Button>
            <Button variant="destructive" disabled={!terminateReason}
              onClick={() => terminateMutation.mutate({ id: Number(id), data: { termination_reason: terminateReason } })}>
              {t('contract.btn_terminate')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sign Dialog */}
      <Dialog open={signOpen} onOpenChange={setSignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('contract.btn_sign')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label>{t('contract.label_signed_doc_url')}</Label>
            <Input
              value={signDocUrl}
              onChange={e => setSignDocUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSignOpen(false)}>{t('common.cancel')}</Button>
            <Button className="bg-purple-600 hover:bg-purple-700 text-white"
              onClick={() => signMutation.mutate({ id: Number(id), data: { document_url: signDocUrl || null } })}>
              {t('contract.btn_confirm_signed')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add / Edit Line Item Dialog */}
      <Dialog open={lineDialogOpen} onOpenChange={(open) => { if (!open) { setLineDialogOpen(false); resetLineForm(); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{lineEditItem ? t('contract.dlg_edit_line') : t('contract.dlg_add_line')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t('common.type')}</Label>
                <Select value={lineItemType} onValueChange={setLineItemType}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[
                      { v: "Rent", l: t('contract.item_type_rent') },
                      { v: "Service", l: t('contract.item_type_service') },
                      { v: "Bond", l: t('contract.item_type_bond') },
                      { v: "Admin Fee", l: t('contract.item_type_admin_fee') },
                      { v: "Other", l: t('contract.item_type_other') },
                    ].map(o => (
                      <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t('contract.col_billing')}</Label>
                <Select value={lineTrigger} onValueChange={v => { setLineTrigger(v); if (v !== "recurring") setLineFreq(""); }}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recurring">{t('contract.billing_recurring')}</SelectItem>
                    <SelectItem value="at_activation">{t('contract.billing_onetime_full')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>{t('common.name')} *</Label>
              <Input value={lineName} onChange={e => setLineName(e.target.value)} placeholder={t('contract.ph_line_name')} className="mt-1" />
            </div>
            {lineTrigger === "recurring" && (
              <div>
                <Label>{t('contract.col_frequency')}</Label>
                <Select value={lineFreq} onValueChange={setLineFreq}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder={t('contract.ph_select_frequency')} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Weekly">{t('contract.freq_weekly')}</SelectItem>
                    <SelectItem value="Biweekly">{t('contract.freq_fortnightly')}</SelectItem>
                    <SelectItem value="Monthly">{t('contract.freq_monthly')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <Label>{t('contract.col_unit_price')} *</Label>
                <Input type="number" step="0.01" min="0" value={lineUnitPrice} onChange={e => setLineUnitPrice(e.target.value)} placeholder="0.00" className="mt-1" />
              </div>
              <div>
                <Label>{t('contract.col_qty')}</Label>
                <Input type="number" min="1" value={lineQty} onChange={e => setLineQty(e.target.value)} className="mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t('contract.label_currency')}</Label>
                <Select value={lineCurrency} onValueChange={setLineCurrency}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input type="checkbox" checked={lineGst} onChange={e => setLineGst(e.target.checked)} className="rounded" />
                  {t('contract.gst_included')}
                </label>
              </div>
            </div>
            <div>
              <Label>{t('common.notes')}</Label>
              <Input value={lineNotes} onChange={e => setLineNotes(e.target.value)} placeholder={t('contract.ph_optional_notes')} className="mt-1" />
            </div>
            {lineUnitPrice && lineQty && (
              <div className="bg-gray-50 rounded p-3 text-sm">
                <span className="text-muted-foreground">{t('common.total')}: </span>
                <span className="font-mono font-bold">${(Number(lineUnitPrice) * Number(lineQty)).toFixed(2)} {lineCurrency}</span>
                {lineTrigger === "recurring" && lineFreq && <span className="text-muted-foreground ml-2">{t('contract.per_period', { period: lineFreq.toLowerCase() })}</span>}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setLineDialogOpen(false); resetLineForm(); }}>{t('common.cancel')}</Button>
            <Button
              className="bg-primary hover:bg-[#d4561a] text-white"
              disabled={!lineName || !lineUnitPrice || addLineMutation.isPending || updateLineMutation.isPending}
              onClick={submitLineForm}
            >
              {lineEditItem ? t('contract.btn_save_changes') : t('contract.dlg_add_line')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add / Edit Related Cost Dialog */}
      <Dialog open={costDialogOpen} onOpenChange={(open) => { if (!open) { setCostDialogOpen(false); resetCostForm(); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{costEditItem ? t('contract.dlg_edit_cost') : t('contract.dlg_add_cost')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t('contract.col_cost_type')} *</Label>
              <Input
                value={costType}
                onChange={e => setCostType(e.target.value)}
                placeholder={t('contract.ph_cost_type')}
                list="related-cost-type-suggestions"
                className="mt-1"
              />
              <datalist id="related-cost-type-suggestions">
                <option value={t('contract.cost_type_move_in_cleaning')} />
                <option value={t('contract.cost_type_rental_fee')} />
                <option value={t('contract.cost_type_agency_fee')} />
              </datalist>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                {/* 송금 전 비용도 등록해 둘 수 있어야 한다 — 비워 두면 "미지급"으로 잡힌다. */}
                <Label>{t('contract.col_remitted_on')}</Label>
                <DateInput value={costRemittedOn} onChange={setCostRemittedOn} className="mt-1" />
                <p className="text-xs text-muted-foreground mt-1">{t('contract.hint_remitted_on')}</p>
              </div>
              <div>
                <Label>{t('contract.col_payee_name')} *</Label>
                <Input value={costPayeeName} onChange={e => setCostPayeeName(e.target.value)} placeholder={t('contract.ph_payee_name')} className="mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <Label>{t('common.amount')} *</Label>
                <Input type="number" step="0.01" min="0" value={costAmount} onChange={e => setCostAmount(e.target.value)} placeholder="0.00" className="mt-1" />
              </div>
              <div>
                <Label>{t('contract.label_currency')}</Label>
                <Select value={costCurrency} onValueChange={setCostCurrency}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>{t('contract.col_remarks')}</Label>
              <Input value={costNote} onChange={e => setCostNote(e.target.value)} placeholder={t('contract.ph_remarks')} className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCostDialogOpen(false); resetCostForm(); }}>{t('common.cancel')}</Button>
            <Button
              className="bg-primary hover:bg-[#d4561a] text-white"
              disabled={!costType.trim() || !costPayeeName.trim() || !costAmount || addCostMutation.isPending || updateCostMutation.isPending}
              onClick={submitCostForm}
            >
              {costEditItem ? t('contract.btn_save_changes') : t('contract.dlg_add_cost')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add / Edit Payment Schedule Dialog */}
      <Dialog open={schedDialogOpen} onOpenChange={(open) => { if (!open) { setSchedDialogOpen(false); resetSchedForm(); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{schedEditItem ? t('contract.dlg_edit_sched') : t('contract.dlg_add_sched')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t('common.type')}</Label>
                <Select value={schedType} onValueChange={setSchedType}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[
                      { v: "Rent", l: t('contract.item_type_rent') },
                      { v: "Bond", l: t('contract.item_type_bond') },
                      { v: "Advance", l: t('contract.sched_type_advance') },
                      { v: "Water", l: t('contract.sched_type_water') },
                      { v: "Electricity", l: t('contract.sched_type_electricity') },
                      { v: "Gas", l: t('contract.sched_type_gas') },
                      { v: "Internet", l: t('contract.sched_type_internet') },
                      { v: "Parking", l: t('contract.sched_type_parking') },
                      { v: "Other", l: t('contract.item_type_other') },
                    ].map(o => (
                      <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t('contract.col_frequency')}</Label>
                <Select value={schedFreq} onValueChange={setSchedFreq}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Weekly">{t('contract.freq_weekly')}</SelectItem>
                    <SelectItem value="Biweekly">{t('contract.freq_fortnightly')}</SelectItem>
                    <SelectItem value="Monthly">{t('contract.freq_monthly')}</SelectItem>
                    <SelectItem value="Quarterly">{t('contract.freq_quarterly')}</SelectItem>
                    <SelectItem value="Once">{t('contract.freq_once')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t('common.amount')} *</Label>
                <Input type="number" step="0.01" min="0" value={schedAmount} onChange={e => setSchedAmount(e.target.value)} placeholder="0.00" className="mt-1" />
              </div>
              <div>
                <Label>{t('contract.label_currency')}</Label>
                <Select value={schedCurrency} onValueChange={setSchedCurrency}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t('contract.label_start')} *</Label>
                <DateInput value={schedStartDate} onChange={setSchedStartDate} className="mt-1" />
              </div>
              <div>
                <Label>{t('contract.label_end')}</Label>
                <DateInput value={schedEndDate} onChange={setSchedEndDate} className="mt-1" />
              </div>
            </div>
            <div>
              <Label>{t('contract.col_next_due')} *</Label>
              <DateInput value={schedNextDue} onChange={setSchedNextDue} className="mt-1" />
            </div>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input type="checkbox" checked={schedGst} onChange={e => setSchedGst(e.target.checked)} className="rounded" />
                {t('contract.gst_included')}
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input type="checkbox" checked={schedActive} onChange={e => setSchedActive(e.target.checked)} className="rounded" />
                {t('common.active')}
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setSchedDialogOpen(false); resetSchedForm(); }}>{t('common.cancel')}</Button>
            <Button
              className="bg-primary hover:bg-[#d4561a] text-white"
              disabled={!schedAmount || !schedStartDate || addSchedMutation.isPending || updateSchedMutation.isPending}
              onClick={submitSchedForm}
            >
              {schedEditItem ? t('contract.btn_save_changes') : t('contract.btn_add_entry')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {!isNew && contract && (
        <ContractIssueWizard
          open={wizardOpen}
          onClose={() => setWizardOpen(false)}
          contractId={Number(id)}
          contractRef={contract.contract_ref}
          leaseForm={(contract as any).lease_form ?? null}
          attachments={parseAttachments((contract as any).doc_attachments)}
          signingPolicy={signingPolicy}
          onOpenPreview={openContractPreview}
          onIssued={() => qc.invalidateQueries({ queryKey: getGetContractQueryKey(Number(id)) })}
        />
      )}
      <DocumentPreviewDialog config={previewConfig} onClose={closePreview} />
      <DocumentEmailDialog target={sendTarget} onClose={() => setSendTarget(null)} />
    </Layout>
  );
}
