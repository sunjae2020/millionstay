import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, Link } from "wouter";
import { getApiBase } from "@/lib/api-base";
import { formatDate } from "@/lib/dateFormat";
import { useGetPublicSpace, useCreateGuestBooking } from "@/lib/guest-api";
import { useAuthStore } from "@/lib/store";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { DevNavbar, DevFooter } from "@/components/development/DevLayout";
import { isDevelopmentSite } from "@/lib/site-mode";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2, ChevronLeft, ChevronRight,
  CreditCard, Sparkles, Home, Calendar, Upload, X, Lock,
  Car, Briefcase, Map, Smartphone, LogIn,
  AlertCircle, Info, Banknote, Mail, ExternalLink, LayoutDashboard,
  Package, Zap, ConciergeBell,
} from "lucide-react";
import { APP_NAME } from "../lib/appName";
import { COMPANY } from "../lib/company";
import { formatCurrencyAmount } from "@/contexts/DisplayCurrencyContext";
import { DEFAULT_CURRENCY } from "@/lib/defaultCurrency";
import { PRICE_UNIT } from "@/lib/priceUnit";

// Instance base currency (KRW for Metheim, AUD default) + rate-period suffix.
// De-Australianises the booking flow: money() renders ₩ for a Korean instance,
// A$ for the primary. The numeric pricing model is unchanged.
const BASE_CCY = DEFAULT_CURRENCY || "AUD";
const money = (n: number) => formatCurrencyAmount(Number(n) || 0, BASE_CCY);
const RATE_UNIT = PRICE_UNIT === "month" ? "/월" : PRICE_UNIT === "day" ? "/일" : "/week";
const RATE_UNIT_SHORT = PRICE_UNIT === "month" ? "/월" : PRICE_UNIT === "day" ? "/일" : "/wk";

/* ────────────────────────────────────────────── */
/*  Constants                                     */
/* ────────────────────────────────────────────── */

// Step labels are i18n keys; StepIndicator translates them at render time.
const SHORT_STEPS = ["step_stay", "step_services", "step_payment", "step_confirmed"];
const LONG_STEPS  = ["step_stay", "step_services", "step_plans", "step_review", "step_account"];

type ServiceItem = {
  id: number;
  name: string;
  description: string | null;
  service_type: string;
  base_price: number | null;
  is_refundable: boolean;
  billing_trigger: string;
  requires_scheduling: boolean;
  scheduling_notes: string | null;
  is_mandatory?: boolean;
};

function serviceIcon(item: ServiceItem) {
  const n = item.name.toLowerCase();
  if (n.includes("airport") || n.includes("pickup") || n.includes("transfer")) return Car;
  if (n.includes("sim") || n.includes("phone") || n.includes("mobile")) return Smartphone;
  if (n.includes("tour") || n.includes("map")) return Map;
  if (n.includes("linen") || n.includes("bed") || n.includes("settle")) return Briefcase;
  if (item.service_type === "scheduled") return Calendar;
  if (item.service_type === "physical") return Package;
  return ConciergeBell;
}

const SESSION_KEY = "ms_booking_v2";

function loadSession(): Record<string, unknown> {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? "{}"); } catch { return {}; }
}
function saveSession(data: Record<string, unknown>) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
}

/* ────────────────────────────────────────────── */
/*  Step Indicator                                */
/* ────────────────────────────────────────────── */

function StepIndicator({ steps, current }: { steps: string[]; current: number }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-center gap-0 mb-8 overflow-x-auto px-2">
      {steps.map((label, i) => {
        const done   = i < current;
        const active = i === current;
        return (
          <div key={label} className="flex items-center shrink-0">
            <div className="flex flex-col items-center gap-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                done   ? "bg-primary text-white" :
                active ? "bg-primary text-white ring-4 ring-primary/20" :
                         "bg-gray-100 text-gray-400"
              }`}>
                {done ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
              </div>
              <span className={`text-[10px] font-medium hidden sm:block text-center max-w-[72px] leading-tight ${
                active ? "text-primary" : done ? "text-primary/60" : "text-gray-400"
              }`}>{t(`booking_new.${label}`)}</span>
            </div>
            {i < steps.length - 1 && (
              <div className={`w-8 sm:w-14 h-0.5 mx-1 mb-4 transition-all ${i < current ? "bg-primary" : "bg-gray-200"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ────────────────────────────────────────────── */
/*  Booking Summary Card                          */
/* ────────────────────────────────────────────── */

function SummaryCard({
  session, selectedServices, serviceItems, isLong,
}: {
  session: Record<string, unknown>;
  selectedServices: number[];
  serviceItems: ServiceItem[];
  isLong: boolean;
}) {
  const weeklyRate  = (session.agreed_weekly_rate as number) ?? 0;
  // null = fee not charged for this product
  const bond        = (session.bond_amount  as number | null) ?? 0;
  const adminFee    = (session.admin_fee    as number | null) ?? 0;
  const cleaningFee = (session.cleaning_fee as number | null) ?? 0;
  const servicesTotal = selectedServices.reduce((sum, id) => {
    const svc = serviceItems.find((s) => s.id === id);
    return sum + (svc?.base_price ?? 0);
  }, 0);
  // Calculate days and pro-rata rent
  const cardDays = (() => {
    const ci = session.check_in_date as string;
    const co = session.check_out_date as string;
    if (!ci || !co) return 0;
    return Math.max(1, Math.round((new Date(co).getTime() - new Date(ci).getTime()) / (24 * 60 * 60 * 1000)));
  })();
  const cardProRata = weeklyRate > 0 && cardDays > 0 && !isLong
    ? Math.round((weeklyRate / 7) * cardDays * 100) / 100
    : 0;
  const { t } = useTranslation();
  const cardLongBond = bond > 0 ? bond : weeklyRate * 4;
  const shortTotal   = cardProRata + bond + adminFee + cleaningFee + servicesTotal;
  const longInitial  = cardLongBond + adminFee + cleaningFee + (weeklyRate * 2) + servicesTotal;

  return (
    <div className="rounded-2xl border bg-white shadow-sm p-5 space-y-4 sticky top-24">
      <h3 className="font-semibold text-gray-800 text-sm">{t("booking_new.summary_title")}</h3>
      <div className="space-y-1.5 text-xs text-gray-600">
        {Boolean(session.space_name) && (
          <div className="flex items-start gap-1.5"><Home className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" /><span>{session.space_name as string}</span></div>
        )}
        {Boolean(session.check_in_date) && Boolean(session.check_out_date) && (
          <div className="flex items-start gap-1.5"><Calendar className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
            <span>
              {formatDate(session.check_in_date as string)}
              {" → "}
              {formatDate(session.check_out_date as string)}
              {cardDays > 0 ? ` (${cardDays}d)` : ""}
            </span>
          </div>
        )}
        {weeklyRate > 0 && <p className="text-primary font-bold text-sm">{money(weeklyRate)}{RATE_UNIT}</p>}
      </div>

      <Separator />

      {isLong ? (
        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between text-gray-500">
            <span>{bond > 0 ? t("booking_new.security_bond") : t("booking_new.security_bond_4wk")}</span>
            <span>{money(cardLongBond)}</span>
          </div>
          {adminFee > 0 && <div className="flex justify-between text-gray-500"><span>{t("booking_new.admin_fee")}</span><span>{money(adminFee)}</span></div>}
          {cleaningFee > 0 && <div className="flex justify-between text-gray-500"><span>{t("booking_new.cleaning_fee")}</span><span>{money(cleaningFee)}</span></div>}
          <div className="flex justify-between text-gray-500"><span>{t("booking_new.initial_rent_2wk")}</span><span>{money(weeklyRate * 2)}</span></div>
          {servicesTotal > 0 && <div className="flex justify-between text-gray-500"><span>{t("booking_new.extra_services")}</span><span>{money(servicesTotal)}</span></div>}
          <Separator />
          <div className="flex justify-between font-bold text-sm"><span>{t("booking_new.est_due_today")}</span><span className="text-primary">{money(longInitial)}</span></div>
          <p className="text-gray-400 text-[10px]">{t("booking_new.exact_before_payment")}</p>
        </div>
      ) : (
        <div className="space-y-1.5 text-xs">
          {cardProRata > 0 && (
            <div className="flex justify-between text-gray-500">
              <span>{t("booking_new.rent")} <span className="text-gray-400">({cardDays}d)</span></span>
              <span>{money(cardProRata)}</span>
            </div>
          )}
          {bond > 0 && <div className="flex justify-between text-gray-500"><span>{t("booking_new.security_bond")}</span><span>{money(bond)}</span></div>}
          {adminFee > 0 && <div className="flex justify-between text-gray-500"><span>{t("booking_new.admin_fee")}</span><span>{money(adminFee)}</span></div>}
          {cleaningFee > 0 && <div className="flex justify-between text-gray-500"><span>{t("booking_new.cleaning_fee")}</span><span>{money(cleaningFee)}</span></div>}
          {servicesTotal > 0 && <div className="flex justify-between text-gray-500"><span>{t("booking_new.extra_services")}</span><span>{money(servicesTotal)}</span></div>}
          <Separator />
          <div className="flex justify-between font-bold text-sm"><span>{t("booking_new.total_due_today")}</span><span className="text-primary">{money(shortTotal)}</span></div>
        </div>
      )}

      {selectedServices.length > 0 && (
        <>
          <Separator />
          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{t("booking_new.addons_selected")}</p>
            {selectedServices.map((id) => {
              const svc = serviceItems.find((s) => s.id === id);
              if (!svc) return null;
              return <div key={id} className="flex justify-between text-xs text-gray-600"><span>{svc.name}</span><span>{money(svc.base_price ?? 0)}</span></div>;
            })}
          </div>
        </>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────── */
/*  Bank Transfer Details                         */
/* ────────────────────────────────────────────── */

function BankTransferDetails({ total, ref_ }: { total: number; ref_: string }) {
  const { t } = useTranslation();
  const fields = [
    { label: t("booking_new.bank"),         value: COMPANY.bank.name },
    { label: t("booking_new.account_name"), value: COMPANY.bank.accountName },
    // BSB is an Australian bank code; hidden on non-AUD (e.g. Korean) instances.
    ...(BASE_CCY === "AUD" ? [{ label: "BSB", value: COMPANY.bank.bsb }] : []),
    { label: t("booking_new.account_no"),   value: COMPANY.bank.accountNo },
    { label: t("booking_new.amount"),       value: money(total) },
    { label: t("booking_new.reference"),    value: ref_ || t("booking_new.reference_hint") },
  ];
  return (
    <div className="rounded-xl border border-blue-100 bg-blue-50 p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Banknote className="h-5 w-5 text-blue-600" />
        <p className="font-semibold text-blue-800">{t("booking_new.bank_title")}</p>
      </div>
      <div className="space-y-2">
        {fields.map(({ label, value }) => (
          <div key={label} className="flex justify-between text-sm border-b border-blue-100 pb-2 last:border-0 last:pb-0">
            <span className="text-blue-600 font-medium">{label}</span>
            <span className="text-gray-800 font-mono font-semibold">{value}</span>
          </div>
        ))}
      </div>
      <div className="flex items-start gap-2 bg-white rounded-lg px-3 py-2.5 border border-blue-100">
        <Mail className="h-4 w-4 text-primary mt-0.5 shrink-0" />
        <p className="text-xs text-gray-600">
          {t("booking_new.bank_note")}
        </p>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────── */
/*  Main Component                                */
/* ────────────────────────────────────────────── */

// Metheim (development instance) wears the shared DevLayout header/footer so the
// booking flow reads as the same site as the landing page. See docs convention.
const DEV_SITE = isDevelopmentSite();

export default function BookingNew() {
  const { t } = useTranslation();
  const [location, setLocation] = useLocation();
  const { token, guest, logout } = useAuthStore();
  const { toast } = useToast();

  const params = new URLSearchParams(window.location.search);
  const spaceId    = parseInt(params.get("space_id") ?? "0", 10);
  const productId  = params.get("product_id") ? parseInt(params.get("product_id")!, 10) : undefined;
  const checkInParam  = params.get("check_in") ?? "";
  const checkOutParam = params.get("check_out") ?? "";

  const [step, setStep] = useState(0);
  const [session, setSession] = useState<Record<string, unknown>>(() => {
    const saved = loadSession();
    // URL params always override stale saved session dates
    return {
      num_guests: 1,
      ...saved,
      ...(checkInParam  ? { check_in_date:  checkInParam  } : {}),
      ...(checkOutParam ? { check_out_date: checkOutParam } : {}),
    };
  });

  /* form state */
  const [numGuests, setNumGuests]           = useState(1);
  const [specialRequests, setSpecialRequests] = useState("");
  const [guestName, setGuestName]           = useState(guest ? [guest.first_name, guest.last_name].filter(Boolean).join(" ") : "");
  const [guestEmail, setGuestEmail]         = useState(guest?.email ?? "");
  const [guestPhone, setGuestPhone]         = useState("");
  const [selectedServices, setSelectedServices] = useState<number[]>([]);
  const [serviceItems, setServiceItems]         = useState<ServiceItem[]>([]);
  const [documents, setDocuments]           = useState<{ type: string; name: string }[]>([]);
  const [cardName, setCardName]             = useState("");
  const [cardNumber, setCardNumber]         = useState("");
  const [cardExpiry, setCardExpiry]         = useState("");
  const [cardCvc, setCardCvc]               = useState("");
  const [paying, setPaying]                 = useState(false);
  const [bookingRef, setBookingRef]         = useState("");
  const [confirmed, setConfirmed]           = useState(false);
  const [paymentMethod, setPaymentMethod]   = useState<"card" | "bank">("card");
  const [redirectCountdown, setRedirectCountdown] = useState(3);

  /* login / register form for long-term step 4 */
  const [loginEmail, setLoginEmail]       = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [registerName, setRegisterName]   = useState(guestName ?? "");
  const [loginMode, setLoginMode]         = useState<"login" | "register">("register");
  const [loggingIn, setLoggingIn]         = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);

  const { data: spaceData, isLoading } = useGetPublicSpace(spaceId, {
    query: { enabled: !!spaceId },
  });
  const createBooking = useCreateGuestBooking();
  const space = spaceData?.data;

  /* Fetch add-on services from API — space-specific if available, else global */
  useEffect(() => {
    if (!spaceId) return;
    const url = `/api/v1/public/services?space_id=${spaceId}`;
    fetch(url)
      .then((r) => r.json())
      .then((j) => {
        if (!j.success) return;
        setServiceItems(j.data);
        // Auto-select mandatory services
        const mandatoryIds = (j.data as { id: number; is_mandatory?: boolean }[])
          .filter(s => s.is_mandatory)
          .map(s => s.id);
        if (mandatoryIds.length > 0) {
          setSelectedServices(prev => Array.from(new Set([...prev, ...mandatoryIds])));
        }
      })
      .catch(() => {});
  }, [spaceId]);

  /* Auto-redirect to portal after confirmation (logged-in users) */
  useEffect(() => {
    if (!confirmed || !token) return;
    setRedirectCountdown(3);
    const interval = setInterval(() => {
      setRedirectCountdown((c) => {
        if (c <= 1) {
          clearInterval(interval);
          sessionStorage.removeItem(SESSION_KEY);
          setLocation("/portal/bookings");
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [confirmed, token]);

  /* Derive stay type */
  const stayDays = (() => {
    const ci = session.check_in_date as string;
    const co = session.check_out_date as string;
    if (!ci || !co) return 0;
    return Math.max(1, Math.round((new Date(co).getTime() - new Date(ci).getTime()) / (24 * 60 * 60 * 1000)));
  })();
  const stayWeeks = Math.round(stayDays / 7);
  const isLong = stayDays >= 28;
  const STEPS = isLong ? LONG_STEPS : SHORT_STEPS;

  /* For short-term: require login upfront */
  useEffect(() => {
    if (!isLong && !token) {
      setLocation(`/login?redirect=${encodeURIComponent(`/booking/new?space_id=${spaceId}${productId ? `&product_id=${productId}` : ""}${checkInParam ? `&check_in=${checkInParam}` : ""}${checkOutParam ? `&check_out=${checkOutParam}` : ""}`)}`);
    }
  }, [isLong, token]);

  /* Populate session from space data */
  useEffect(() => {
    if (space) {
      // Use specified product, or fallback to first product if none specified
      const product   = productId
        ? (space.products?.find((p) => p.id === productId) ?? space.products?.[0] ?? null)
        : (space.products?.[0] ?? null);
      const weeklyRate = product?.price ?? space.base_weekly_price ?? 0;
      const updated = {
        ...session,
        space_id:          spaceId,
        product_id:        product?.id ?? productId,
        space_name:        space.name,
        property_address:  space.property_address ?? space.suburb_name ?? "",
        agreed_weekly_rate: weeklyRate,
        stay_weeks:        stayWeeks,
        // Fees come from the selected product (null = not charged for this product)
        bond_amount:    product?.bond_amount  ?? null,
        admin_fee:      product?.admin_fee    ?? null,
        cleaning_fee:   product?.cleaning_fee ?? null,
      };
      setSession(updated);
      saveSession(updated);
    }
  }, [space]);

  const updateSession = (patch: Record<string, unknown>) => {
    const updated = { ...session, ...patch };
    setSession(updated);
    saveSession(updated);
  };

  const toggleService = (id: number) =>
    setSelectedServices((prev) => prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]);

  const handleFileUpload = (docType: string, file: File) => {
    setDocuments((prev) => [...prev.filter((d) => d.type !== docType), { type: docType, name: file.name }]);
  };

  /* Services total */
  const servicesTotal = selectedServices.reduce((sum, id) => {
    return sum + (serviceItems.find((s) => s.id === id)?.base_price ?? 0);
  }, 0);

  const weeklyRate  = (session.agreed_weekly_rate as number) ?? 0;
  // null = fee not charged for this product; use 0 for calculation
  const bond        = (session.bond_amount  as number | null) ?? 0;
  const adminFee    = (session.admin_fee    as number | null) ?? 0;
  const cleaningFee = (session.cleaning_fee as number | null) ?? 0;
  // Pro-rata rent: weekly_rate / 7 × days
  const proRataRent = weeklyRate > 0 && stayDays > 0
    ? Math.round((weeklyRate / 7) * stayDays * 100) / 100
    : 0;
  const totalShort = proRataRent + bond + adminFee + cleaningFee + servicesTotal;
  // Long-term: bond = product bond_amount OR (bond_weeks × weeklyRate), default 4 wk
  const longBond   = bond > 0 ? bond : weeklyRate * 4;
  const totalLong  = longBond + adminFee + cleaningFee + (weeklyRate * 2) + servicesTotal;
  const totalDue   = isLong ? totalLong : totalShort;

  /* ─── Payment / Submit ─── */
  const handlePayment = async () => {
    if (paymentMethod === "card" && (!cardNumber || !cardExpiry || !cardCvc || !cardName)) {
      toast({ title: t("booking_new.err_card_details"), variant: "destructive" });
      return;
    }
    setPaying(true);
    try {
      const res = await new Promise<{ id: number; booking_ref: string }>((resolve, reject) => {
        createBooking.mutate(
          { data: { space_id: session.space_id as number, product_id: session.product_id as number | undefined,
              check_in_date: session.check_in_date as string, check_out_date: session.check_out_date as string,
              num_guests: numGuests, special_requests: specialRequests || undefined } },
          { onSuccess: (r) => resolve(r.data), onError: reject }
        );
      });

      /* Booking created successfully — confirmation email sent by backend */
      sessionStorage.removeItem(SESSION_KEY);
      setBookingRef(res.booking_ref);
      setConfirmed(true);
    } catch {
      toast({ title: t("booking_new.err_submit"), description: t("booking_new.err_submit_desc"), variant: "destructive" });
    } finally {
      setPaying(false);
    }
  };

  /* ─── Already-logged-in path from Review (Step 3) → create booking → My Bookings ─── */
  const [creatingBooking, setCreatingBooking] = useState(false);
  const handleProceedFromReview = async () => {
    if (!token) { setStep(4); return; }
    setCreatingBooking(true);
    try {
      const bookingRes = await fetch(`${getApiBase()}/api/v1/guest/bookings`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          space_id: session.space_id as number,
          product_id: (session.product_id as number | undefined) || undefined,
          check_in_date: session.check_in_date as string,
          check_out_date: session.check_out_date as string,
          num_guests: numGuests,
          special_requests: specialRequests || undefined,
        }),
      });
      if (!bookingRes.ok) throw new Error("Booking creation failed");
      sessionStorage.removeItem(SESSION_KEY);
      toast({ title: t("booking_new.created_title"), description: t("booking_new.created_desc_portal") });
      setLocation("/portal/bookings");
    } catch {
      toast({ title: t("booking_new.err_create"), description: t("booking_new.err_try_again"), variant: "destructive" });
    } finally {
      setCreatingBooking(false);
    }
  };

  /* ─── Inline login / register for long-term step 4 → create booking → My Bookings ─── */
  const handleInlineLogin = async () => {
    if (!loginEmail || !loginPassword) {
      toast({ title: t("booking_new.err_email_password"), variant: "destructive" }); return;
    }
    if (loginMode === "register" && !registerName.trim()) {
      toast({ title: t("booking_new.err_full_name"), variant: "destructive" }); return;
    }
    setLoggingIn(true);
    try {
      /* 1. Register or Login */
      const apiPath = loginMode === "register" ? "/api/v1/auth/guest/register" : "/api/v1/auth/guest/login";
      const nameParts = registerName.trim().split(" ");
      const regFirstName = nameParts[0] ?? "";
      const regLastName = nameParts.slice(1).join(" ") || (nameParts[0] ?? "");
      const body = loginMode === "register"
        ? { first_name: regFirstName, last_name: regLastName, email: loginEmail, password: loginPassword, marketing_consent: marketingConsent }
        : { email: loginEmail, password: loginPassword };

      const authRes = await fetch(`${getApiBase()}${apiPath}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!authRes.ok) {
        const errData = await authRes.json().catch(() => ({}));
        const errMsg = errData.error ?? (loginMode === "register" ? t("booking_new.register_failed") : t("booking_new.invalid_credentials"));
        throw new Error(errMsg);
      }

      const authData = await authRes.json();
      const newToken = authData.token;
      useAuthStore.getState().setAuth(newToken, authData.user);

      toast({ title: loginMode === "register" ? t("booking_new.account_created_creating") : t("booking_new.signed_in_creating") });

      /* 2. Create the booking with the fresh token */
      const bookingRes = await fetch(`${getApiBase()}/api/v1/guest/bookings`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${newToken}` },
        body: JSON.stringify({
          space_id: session.space_id as number,
          product_id: (session.product_id as number | undefined) || undefined,
          check_in_date: session.check_in_date as string,
          check_out_date: session.check_out_date as string,
          num_guests: numGuests,
          special_requests: specialRequests || undefined,
        }),
      });
      if (!bookingRes.ok) throw new Error("Booking creation failed");

      sessionStorage.removeItem(SESSION_KEY);

      /* 3. Go directly to My Bookings in the portal */
      toast({ title: t("booking_new.created_title"), description: t("booking_new.created_desc_pay") });
      setLocation("/portal/bookings");
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("booking_new.unknown_error");
      toast({ title: t("booking_new.failed"), description: msg, variant: "destructive" });
    } finally {
      setLoggingIn(false);
    }
  };

  if (!isLong && !token) return null;

  /* ─────────────────────────────────────────── */
  const stepContent = (
    <AnimatePresence mode="wait">
      <motion.div key={step}
        initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.22 }}>

        {/* ── STEP 0: Stay Details ── */}
        {step === 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-5">

              {/* Stay type badge */}
              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ${
                isLong ? "bg-blue-50 text-blue-700 border border-blue-100" : "bg-primary/5 text-primary border border-primary/20"
              }`}>
                <Calendar className="h-3.5 w-3.5" />
                {isLong
                  ? t("booking_new.badge_long", { weeks: stayWeeks, rate: weeklyRate ? `${money(weeklyRate)}${RATE_UNIT_SHORT}` : t("booking_new.tbd") })
                  : t("booking_new.badge_short", { weeks: stayWeeks })}
              </div>

              {/* Property */}
              <div className="bg-white rounded-2xl border p-6 space-y-4">
                <h2 className="font-semibold text-lg text-gray-800">{t("booking_new.your_stay")}</h2>
                {isLoading ? <div className="h-14 bg-gray-100 animate-pulse rounded-xl" /> :
                  space ? (
                    <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
                      <p className="font-semibold text-gray-800">{space.name}</p>
                      <p className="text-sm text-gray-500">{space.property_address ?? space.suburb_name ?? ""}</p>
                      {weeklyRate > 0 && <p className="text-sm font-bold text-primary mt-1">{money(weeklyRate)}{RATE_UNIT}</p>}
                    </div>
                  ) : null}

                <div className="grid grid-cols-2 gap-3">
                  {([
                    { label: t("booking_new.check_in"),  key: "check_in_date" },
                    { label: t("booking_new.check_out"), key: "check_out_date" },
                  ] as const).map(({ label, key }) => (
                    <div key={key}>
                      <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</label>
                      <DateInput
                        value={(session[key] as string) ?? ""}
                        onChange={(v) => updateSession({ [key]: v })}
                        min={key === "check_out_date" ? ((session.check_in_date as string) || new Date().toISOString().slice(0, 10)) : new Date().toISOString().slice(0, 10)}
                        className="mt-1 border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-primary"
                      />
                    </div>
                  ))}
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t("booking_new.num_guests")}</label>
                  <div className="flex items-center gap-3 mt-2">
                    <button onClick={() => setNumGuests(Math.max(1, numGuests - 1))}
                      className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center hover:border-primary text-lg">−</button>
                    <span className="w-8 text-center font-semibold">{numGuests}</span>
                    <button onClick={() => setNumGuests(Math.min(space?.max_occupancy ?? 6, numGuests + 1))}
                      className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center hover:border-primary text-lg">+</button>
                    <span className="text-sm text-gray-500">{t("booking_new.guests_unit", { count: numGuests })}</span>
                  </div>
                </div>
              </div>

              {/* Guest Details */}
              <div className="bg-white rounded-2xl border p-6 space-y-4">
                <h2 className="font-semibold text-lg text-gray-800">{t("booking_new.guest_details")}</h2>
                {guest ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-500 font-medium">{t("booking_new.first_name")}</label>
                      <div className="mt-1 h-10 border border-gray-100 bg-gray-50 rounded-lg px-3 flex items-center text-sm text-gray-700">{guest.first_name ?? ""}</div>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 font-medium">{t("booking_new.last_name")}</label>
                      <div className="mt-1 h-10 border border-gray-100 bg-gray-50 rounded-lg px-3 flex items-center text-sm text-gray-700">{guest.last_name ?? ""}</div>
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs text-gray-500 font-medium">{t("booking_new.email")}</label>
                      <div className="mt-1 h-10 border border-gray-100 bg-gray-50 rounded-lg px-3 flex items-center text-sm text-gray-700">{guest.email}</div>
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs text-gray-500 font-medium">{t("booking_new.phone")} <span className="text-gray-400">({t("booking_new.optional")})</span></label>
                      <Input value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} placeholder="010-0000-0000" className="mt-1 h-10" />
                    </div>
                  </div>
                ) : (
                  /* Long-term guest preview — no login yet */
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-500 font-medium">{t("booking_new.first_name")} <span className="text-red-400">*</span></label>
                      <Input value={guestName.split(" ")[0] ?? ""} onChange={(e) => setGuestName(e.target.value + " " + (guestName.split(" ")[1] ?? ""))} placeholder={t("booking_new.ph_first_name")} className="mt-1 h-10" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 font-medium">{t("booking_new.last_name")} <span className="text-red-400">*</span></label>
                      <Input value={guestName.split(" ").slice(1).join(" ")} onChange={(e) => setGuestName((guestName.split(" ")[0] ?? "") + " " + e.target.value)} placeholder={t("booking_new.ph_last_name")} className="mt-1 h-10" />
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs text-gray-500 font-medium">{t("booking_new.email")} <span className="text-red-400">*</span></label>
                      <Input type="email" value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} placeholder="jane@example.com" className="mt-1 h-10" />
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs text-gray-500 font-medium">{t("booking_new.phone")}</label>
                      <Input value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} placeholder="010-0000-0000" className="mt-1 h-10" />
                    </div>
                    <div className="col-span-2">
                      <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
                        <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                        <p className="text-xs text-blue-700">{t("booking_new.no_account_hint")}</p>
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t("booking_new.special_requests")}</label>
                  <textarea value={specialRequests} onChange={(e) => setSpecialRequests(e.target.value)}
                    maxLength={500} placeholder={t("booking_new.special_requests_ph")} rows={3}
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none" />
                  <p className="text-right text-xs text-gray-400 mt-1">{specialRequests.length}/500</p>
                </div>
              </div>

              <Button onClick={() => { updateSession({ num_guests: numGuests, special_requests: specialRequests, guest_name: guestName, guest_email: guestEmail, guest_phone: guestPhone }); setStep(1); }}
                className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-xl text-base">
                {t("booking_new.continue_services")} <ChevronRight className="h-5 w-5 ml-1" />
              </Button>
            </div>
            <div className="lg:col-span-1">
              <SummaryCard session={session} selectedServices={selectedServices} serviceItems={serviceItems} isLong={isLong} />
            </div>
          </div>
        )}

        {/* ── STEP 1: Extra Services ── */}
        {step === 1 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-5">
              <div className="bg-white rounded-2xl border p-6">
                <h2 className="font-semibold text-lg text-gray-800 mb-1">{t("booking_new.extra_services")}</h2>
                <p className="text-sm text-gray-500 mb-5">{t("booking_new.services_sub")}</p>
                <div className="space-y-3">
                  {serviceItems.length === 0 && (
                    <p className="text-xs text-gray-400 text-center py-4">{t("booking_new.services_loading")}</p>
                  )}
                  {serviceItems.map((svc) => {
                    const selected = selectedServices.includes(svc.id);
                    const mandatory = !!svc.is_mandatory;
                    const Icon = serviceIcon(svc);
                    return (
                      <button key={svc.id}
                        onClick={() => !mandatory && toggleService(svc.id)}
                        disabled={mandatory}
                        className={`w-full flex items-start gap-4 p-4 rounded-xl border-2 text-left transition-all ${
                          mandatory
                            ? "border-primary/40 bg-primary/5 cursor-default"
                            : selected ? "border-primary bg-primary/5" : "border-gray-100 hover:border-primary/30 bg-white"
                        }`}>
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${selected || mandatory ? "bg-primary text-white" : "bg-gray-100 text-gray-500"}`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <p className={`font-semibold text-sm ${selected || mandatory ? "text-primary" : "text-gray-800"}`}>{svc.name}</p>
                              {mandatory && (
                                <span className="text-xs bg-primary/10 text-primary font-semibold px-1.5 py-0.5 rounded">{t("booking_new.included")}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-sm font-bold text-gray-700">+{money(svc.base_price ?? 0)}</span>
                              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                                selected || mandatory ? "border-primary bg-primary" : "border-gray-300"
                              }`}>
                                {(selected || mandatory) && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
                              </div>
                            </div>
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{svc.description}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
                {selectedServices.length === 0 && (
                  <p className="text-xs text-gray-400 text-center mt-4">{t("booking_new.no_services")}</p>
                )}
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep(0)} className="flex-1 h-12 rounded-xl"><ChevronLeft className="h-4 w-4 mr-1" />{t("booking_new.back")}</Button>
                <Button onClick={() => setStep(2)} className="flex-[2] bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-xl">
                  {isLong ? t("booking_new.view_plans") : t("booking_new.continue_payment")} <ChevronRight className="h-5 w-5 ml-1" />
                </Button>
              </div>
            </div>
            <div className="lg:col-span-1">
              <SummaryCard session={session} selectedServices={selectedServices} serviceItems={serviceItems} isLong={isLong} />
            </div>
          </div>
        )}

        {/* ── STEP 2 (SHORT): Payment ─────────────────────────── */}
        {step === 2 && !isLong && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-5">
              <div className="bg-white rounded-2xl border p-6 space-y-5">
                <h2 className="font-semibold text-lg text-gray-800">{t("booking_new.payment_title")}</h2>

                {/* Amount breakdown */}
                <div className="bg-primary/5 border border-primary/20 rounded-xl px-5 py-4 space-y-2 text-sm">
                  {proRataRent > 0 && (
                    <div className="flex justify-between text-gray-600">
                      <span>
                        {t("booking_new.rent")}
                        {weeklyRate > 0 && stayDays > 0 && (
                          <span className="text-xs text-gray-400 ml-1">({money(weeklyRate)}{RATE_UNIT_SHORT} ÷ 7 × {stayDays} days)</span>
                        )}
                      </span>
                      <span>{money(proRataRent)}</span>
                    </div>
                  )}
                  {bond > 0 && <div className="flex justify-between text-gray-600"><span>{t("booking_new.security_bond")}</span><span>{money(bond)}</span></div>}
                  {adminFee > 0 && <div className="flex justify-between text-gray-600"><span>{t("booking_new.admin_fee")}</span><span>{money(adminFee)}</span></div>}
                  {cleaningFee > 0 && <div className="flex justify-between text-gray-600"><span>{t("booking_new.cleaning_fee")}</span><span>{money(cleaningFee)}</span></div>}
                  {selectedServices.map((id) => { const s = serviceItems.find((x) => x.id === id); if (!s) return null; return (
                    <div key={id} className="flex justify-between text-gray-600"><span>{s.name}</span><span>{money(s.base_price ?? 0)}</span></div>
                  ); })}
                  <Separator />
                  <div className="flex justify-between font-bold text-base"><span>{t("booking_new.total")}</span><span className="text-primary">{money(totalShort)}</span></div>
                </div>

                {/* Payment method toggle */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">{t("booking_new.payment_method")}</p>
                  <div className="flex rounded-xl overflow-hidden border border-gray-200">
                    {([["card", CreditCard, t("booking_new.method_card")], ["bank", Banknote, t("booking_new.method_bank")]] as const).map(([m, Icon, label]) => (
                      <button key={m} onClick={() => setPaymentMethod(m as "card" | "bank")}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-colors ${paymentMethod === m ? "bg-primary text-white" : "text-gray-500 hover:bg-gray-50"}`}>
                        <Icon className="h-4 w-4" />{label}
                      </button>
                    ))}
                  </div>
                </div>

                {paymentMethod === "card" ? (
                  <div className="space-y-3">
                    <div><label className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t("booking_new.name_on_card")}</label>
                      <Input value={cardName} onChange={(e) => setCardName(e.target.value)} placeholder={t("booking_new.ph_full_name")} className="mt-1 h-11" /></div>
                    <div><label className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t("booking_new.card_number")}</label>
                      <Input value={cardNumber} onChange={(e) => setCardNumber(e.target.value.replace(/\D/g, "").slice(0, 16))} placeholder="1234 5678 9012 3456" className="mt-1 h-11 font-mono" /></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><label className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t("booking_new.expiry")}</label>
                        <Input value={cardExpiry} onChange={(e) => setCardExpiry(e.target.value)} placeholder="MM/YY" className="mt-1 h-11 font-mono" /></div>
                      <div><label className="text-xs font-semibold uppercase tracking-wide text-gray-500">CVC</label>
                        <Input value={cardCvc} onChange={(e) => setCardCvc(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="123" className="mt-1 h-11 font-mono" /></div>
                    </div>
                    <p className="text-xs text-gray-400 flex items-center gap-1.5"><Lock className="h-3 w-3" />{t("booking_new.secure_note")}</p>
                  </div>
                ) : (
                  <BankTransferDetails total={totalShort} ref_={`${[guest?.first_name, guest?.last_name].filter(Boolean).join(" ") || "Guest"} ${session.check_in_date ?? ""}`} />
                )}
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep(1)} className="flex-1 h-12 rounded-xl"><ChevronLeft className="h-4 w-4 mr-1" />{t("booking_new.back")}</Button>
                <Button onClick={handlePayment} disabled={paying} className="flex-[2] bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-xl">
                  {paying ? t("booking_new.processing") :
                    paymentMethod === "card" ? t("booking_new.pay_amount", { amount: money(totalShort) }) : t("booking_new.submit_invoice")}
                  {paymentMethod === "card" ? <CreditCard className="h-4 w-4 ml-2" /> : <Mail className="h-4 w-4 ml-2" />}
                </Button>
              </div>
            </div>
            <div className="lg:col-span-1">
              <SummaryCard session={session} selectedServices={selectedServices} serviceItems={serviceItems} isLong={false} />
            </div>
          </div>
        )}

        {/* ── STEP 2 (LONG): Payment Plans ─────────────────────── */}
        {step === 2 && isLong && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-5">
              <div className="bg-white rounded-2xl border p-6 space-y-5">
                <div>
                  <h2 className="font-semibold text-lg text-gray-800">{t("booking_new.plans_title")}</h2>
                  <p className="text-sm text-gray-500 mt-1">{t("booking_new.plans_sub")}</p>
                </div>

                {[
                  { label: bond > 0 ? t("booking_new.security_bond") : t("booking_new.security_bond_4w"), amount: longBond, note: t("booking_new.note_bond"), color: "blue" },
                  ...(adminFee > 0   ? [{ label: t("booking_new.admin_fee"),    amount: adminFee,    note: t("booking_new.note_admin"), color: "orange" }] : []),
                  ...(cleaningFee > 0 ? [{ label: t("booking_new.cleaning_fee"), amount: cleaningFee, note: t("booking_new.note_cleaning"), color: "orange" }] : []),
                  { label: t("booking_new.initial_rent_2w"),  amount: weeklyRate * 2, note: t("booking_new.note_initial_rent"), color: "green" },
                  ...(servicesTotal > 0 ? [{ label: t("booking_new.extra_services"), amount: servicesTotal, note: selectedServices.map((id) => serviceItems.find((s) => s.id === id)?.name).join(", "), color: "purple" }] : []),
                ].map(({ label, amount, note, color }) => (
                  <div key={label} className={`flex items-start justify-between gap-4 p-4 rounded-xl border ${
                    color === "blue"   ? "border-blue-100 bg-blue-50" :
                    color === "green"  ? "border-green-100 bg-green-50" :
                    color === "purple" ? "border-purple-100 bg-purple-50" :
                                         "border-primary/20 bg-primary/5"
                  }`}>
                    <div>
                      <p className="font-semibold text-sm text-gray-800">{label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{note}</p>
                    </div>
                    <p className={`font-bold text-base shrink-0 ${
                      color === "blue" ? "text-blue-600" : color === "green" ? "text-green-600" : "text-primary"
                    }`}>{money(amount)}</p>
                  </div>
                ))}

                <Separator />
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-bold text-base text-gray-800">{t("booking_new.est_total_today")}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{t("booking_new.exact_on_approval")}</p>
                  </div>
                  <p className="font-black text-2xl text-primary">{money(totalLong)}</p>
                </div>

                <div className="bg-gray-50 rounded-xl px-4 py-3 space-y-1.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">{t("booking_new.ongoing_rent")}</p>
                  {weeklyRate > 0 && <p className="text-sm text-gray-700"><span className="font-bold">{money(weeklyRate)}{RATE_UNIT}</span> — {t("booking_new.rent_due_note")}</p>}
                  {proRataRent > 0 && stayDays > 0 && (
                    <p className="text-xs text-gray-500 mt-1">
                      {t("booking_new.est_total_rent")} <span className="font-semibold text-gray-700">{money(proRataRent)}</span>
                      <span className="text-gray-400"> ({money(weeklyRate)}{RATE_UNIT_SHORT} ÷ 7 × {stayDays} days)</span>
                    </p>
                  )}
                </div>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep(1)} className="flex-1 h-12 rounded-xl"><ChevronLeft className="h-4 w-4 mr-1" />{t("booking_new.back")}</Button>
                <Button onClick={() => setStep(3)} className="flex-[2] bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-xl">
                  {t("booking_new.review_confirm")} <ChevronRight className="h-5 w-5 ml-1" />
                </Button>
              </div>
            </div>
            <div className="lg:col-span-1">
              <SummaryCard session={session} selectedServices={selectedServices} serviceItems={serviceItems} isLong={true} />
            </div>
          </div>
        )}

        {/* ── STEP 3 (LONG): Review ─────────────────────────────── */}
        {step === 3 && isLong && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-5">
              <div className="bg-white rounded-2xl border p-6 space-y-5">
                <h2 className="font-semibold text-lg text-gray-800">{t("booking_new.review_title")}</h2>
                <div className="space-y-3 text-sm">
                  {[
                    [t("booking_new.f_property"), session.space_name as string],
                    [t("booking_new.f_address"),  session.property_address as string],
                    [t("booking_new.check_in"), formatDate(session.check_in_date as string)],
                    [t("booking_new.check_out"), formatDate(session.check_out_date as string)],
                    [t("booking_new.f_duration"), t("booking_new.weeks", { count: stayWeeks })],
                    [t("booking_new.f_weekly_rate"), weeklyRate ? `${money(weeklyRate)}${RATE_UNIT}` : t("booking_new.tbd")],
                    [t("booking_new.f_guests"), String(session.num_guests ?? numGuests)],
                    ...(selectedServices.length > 0 ? [[t("booking_new.extra_services"), selectedServices.map((id) => serviceItems.find((s) => s.id === id)?.name).join(", ")]] : []),
                    ...(session.special_requests ? [[t("booking_new.special_requests"), session.special_requests as string]] : []),
                  ].map(([label, value]) => value ? (
                    <div key={label} className="flex gap-3">
                      <span className="text-gray-500 w-36 shrink-0">{label}</span>
                      <span className="text-gray-800 font-medium">{value}</span>
                    </div>
                  ) : null)}
                </div>

                <div className="bg-primary/5 border border-primary/20 rounded-xl px-5 py-4">
                  <div className="flex justify-between font-bold"><span>{t("booking_new.est_total_confirm")}</span><span className="text-primary">{money(totalLong)}</span></div>
                </div>

                <div className="flex items-start gap-2 text-xs text-gray-500">
                  <AlertCircle className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
                  <p>{t("booking_new.agree_prefix")} <Link href="/house-rules" className="text-primary underline">{t("booking_new.house_rules")}</Link>{t("booking_new.agree_join")}<Link href="/privacy-policy" className="text-primary underline">{t("booking_new.privacy_policy")}</Link>{t("booking_new.agree_suffix")}</p>
                </div>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep(2)} className="flex-1 h-12 rounded-xl"><ChevronLeft className="h-4 w-4 mr-1" />{t("booking_new.back")}</Button>
                <Button onClick={handleProceedFromReview} disabled={creatingBooking}
                  className="flex-[2] bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-xl">
                  {creatingBooking ? t("booking_new.creating_booking") : token ? t("booking_new.create_booking_portal") : t("booking_new.create_account_continue")}
                  <ChevronRight className="h-5 w-5 ml-1" />
                </Button>
              </div>
            </div>
            <div className="lg:col-span-1">
              <SummaryCard session={session} selectedServices={selectedServices} serviceItems={serviceItems} isLong={true} />
            </div>
          </div>
        )}

        {/* ── STEP 4 (LONG): Account / Login ─────────────────────── */}
        {step === 4 && isLong && (
          <div className="max-w-md mx-auto">
            <div className="bg-white rounded-2xl border p-8 space-y-6">
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <LogIn className="h-6 w-6 text-primary" />
                </div>
                <h2 className="font-bold text-xl text-gray-800">{t("booking_new.account_title")}</h2>
                <p className="text-sm text-gray-500 mt-1">{t("booking_new.account_sub")}</p>
              </div>

              <div className="flex items-start gap-2.5 bg-primary/5 border border-primary/20 rounded-xl px-4 py-3">
                <LayoutDashboard className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <p className="text-xs text-gray-700">
                  {t("booking_new.portal_note")}
                </p>
              </div>

              {/* Tab toggle */}
              <div className="flex rounded-xl overflow-hidden border border-gray-200">
                {(["register", "login"] as const).map((mode) => (
                  <button key={mode} onClick={() => setLoginMode(mode)}
                    className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${loginMode === mode ? "bg-primary text-white" : "text-gray-500 hover:bg-gray-50"}`}>
                    {mode === "register" ? t("booking_new.tab_register") : t("booking_new.tab_login")}
                  </button>
                ))}
              </div>

              {/* Form fields */}
              <div className="space-y-3">
                {loginMode === "register" && (
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t("booking_new.full_name")} <span className="text-red-400">*</span></label>
                    <Input value={registerName} onChange={(e) => setRegisterName(e.target.value)}
                      placeholder={t("booking_new.ph_full_name")} className="mt-1 h-11" />
                  </div>
                )}
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t("booking_new.email_address")} <span className="text-red-400">*</span></label>
                  <Input type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="jane@example.com" className="mt-1 h-11" autoComplete="email" />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t("booking_new.password")} <span className="text-red-400">*</span></label>
                  <Input type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder={loginMode === "register" ? t("booking_new.ph_password") : "••••••••"} className="mt-1 h-11" autoComplete={loginMode === "register" ? "new-password" : "current-password"} />
                </div>
                {loginMode === "register" && (
                  <>
                    <p className="text-xs text-gray-400 flex items-center gap-1.5">
                      <Lock className="h-3 w-3 shrink-0" />
                      {t("booking_new.encrypted_note")}
                    </p>
                    {/* Sprint B-1: Marketing consent (Spam Act 2003) */}
                    <label className="flex items-start gap-2.5 cursor-pointer pt-1">
                      <input
                        type="checkbox"
                        checked={marketingConsent}
                        onChange={(e) => setMarketingConsent(e.target.checked)}
                        className="mt-0.5 h-4 w-4 accent-primary cursor-pointer shrink-0"
                        data-testid="checkbox-marketing-consent"
                      />
                      <span className="text-xs text-gray-600 leading-relaxed">
                        <span className="font-medium">{t("booking_new.optional_label")}</span> {t("booking_new.marketing_text", { appName: APP_NAME })}
                        <span className="block text-[11px] text-gray-400 mt-0.5">{t("booking_new.marketing_unsub")}</span>
                      </span>
                    </label>
                  </>
                )}
              </div>

              <Button onClick={handleInlineLogin} disabled={loggingIn}
                className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-xl">
                {loggingIn
                  ? t("booking_new.please_wait")
                  : loginMode === "register"
                    ? t("booking_new.register_go")
                    : t("booking_new.login_go")}
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>

              <div className="text-center">
                <button onClick={() => setStep(3)} className="text-sm text-gray-400 hover:text-gray-600">
                  ← {t("booking_new.back_to_review")}
                </button>
              </div>
            </div>
          </div>
        )}


      </motion.div>
    </AnimatePresence>
  );

  /* ────────────────────────── render ─────────────────────────── */
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {DEV_SITE ? <DevNavbar /> : <Navbar />}

      <div className="bg-gradient-to-r from-[#c05010] via-[#e07828] to-[#c86820] py-8 px-4">
        <div className="max-w-5xl mx-auto">
          <p className="text-white/70 text-sm italic mb-1">
            {isLong ? t("booking_new.hero_long") : t("booking_new.hero_short")}
          </p>
          <h1 className="text-2xl font-bold text-white tracking-wide">{t("booking_new.page_title")}</h1>
        </div>
      </div>

      <div className="flex-1 max-w-5xl mx-auto w-full px-4 py-8">
        {!confirmed && <StepIndicator steps={STEPS} current={step} />}
        {confirmed ? (
          <div className="max-w-xl mx-auto py-6 space-y-6">
            {/* Success header */}
            <div className="text-center">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200 }}
                className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <Sparkles className="h-10 w-10 text-green-600" />
              </motion.div>
              <h2 className="text-2xl font-bold text-gray-800">
                {paymentMethod === "bank" ? t("booking_new.app_submitted") : t("booking_new.booking_confirmed")}
              </h2>
              {bookingRef && (
                <p className="text-sm text-gray-500 mt-1">
                  {t("booking_new.reference")}: <span className="font-mono font-bold text-primary">{bookingRef}</span>
                </p>
              )}
              <p className="text-sm text-gray-500 mt-2">
                {isLong
                  ? t("booking_new.review_24_48")
                  : t("booking_new.confirmed_email")}
              </p>
            </div>

            {/* Bank transfer details on confirmation */}
            {paymentMethod === "bank" && (
              <BankTransferDetails
                total={isLong ? totalLong : totalShort}
                ref_={bookingRef || `${[guest?.first_name, guest?.last_name].filter(Boolean).join(" ") || guestName || "Guest"} ${session.check_in_date ?? ""}`}
              />
            )}

            {/* Guest Portal CTA */}
            <div className="bg-white rounded-2xl border p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <LayoutDashboard className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-gray-800">{t("booking_new.portal_cta_title")}</p>
                  <p className="text-xs text-gray-500">{t("booking_new.portal_cta_sub")}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                {[
                  ["📄", t("booking_new.feat_invoice")],
                  ["📁", t("booking_new.feat_docs")],
                  ["📅", t("booking_new.feat_status")],
                ].map(([icon, text]) => (
                  <div key={text} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                    <span>{icon}</span><span className="text-gray-600">{text}</span>
                  </div>
                ))}
              </div>
              {token ? (
                <div className="space-y-2">
                  <Button onClick={() => setLocation("/portal/bookings")}
                    className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-xl">
                    <LayoutDashboard className="h-4 w-4 mr-2" /> {t("booking_new.open_portal")}
                    <ExternalLink className="h-4 w-4 ml-2 opacity-70" />
                  </Button>
                  <p className="text-center text-xs text-gray-400">
                    {t("booking_new.redirect_note", { seconds: redirectCountdown })}
                  </p>
                </div>
              ) : (
                <Button onClick={() => setLocation("/login?redirect=/portal/bookings")}
                  className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-xl">
                  <LogIn className="h-4 w-4 mr-2" /> {t("booking_new.signin_portal")}
                </Button>
              )}
            </div>

            {/* Secondary actions */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button variant="outline" onClick={() => setLocation("/")} className="flex-1 rounded-xl">{t("booking_new.back_home")}</Button>
              <Button variant="outline" onClick={() => setLocation("/search")} className="flex-1 rounded-xl">{t("booking_new.browse_more")}</Button>
            </div>
          </div>
        ) : stepContent}
      </div>

      {DEV_SITE ? <DevFooter /> : <Footer />}
    </div>
  );
}
