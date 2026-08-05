import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { useTranslation } from "react-i18next";
import { Layout, PageHeader } from "@/components/Layout";
import { StatusBadge } from "@/components/StatusBadge";
import { LookupField, MultiLookupField, LookupOption } from "@/components/LookupField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useForm, Controller } from "react-hook-form";
import {
  useGetSpace,
  useCreateSpace,
  useUpdateSpace,
  useListProperties,
  useListSpaces,
  useListSpacePolicies,
  useListSpaceOptions,
  useGetSpaceAvailability,
  useBlockSpaceAvailability,
  getListSpacesQueryKey,
  getGetSpaceQueryKey,
  getGetSpaceAvailabilityQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Save, CalendarDays, Images, Plus, Trash2, PackagePlus, Copy, Check, RefreshCw, CalendarClock, Languages, FileText } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { apiFetch } from "@/lib/apiFetch";
import { spaceStatusValuesWith, DEFAULT_SPACE_STATUS } from "@/lib/spaceStatus";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { SpacePhotoManager } from "@/components/SpacePhotoManager";
import { ChannelSyncPanel } from "@/components/ChannelSyncPanel";
import { ContentTranslationsPanel } from "@/components/ContentTranslationsPanel";
import EntityDocuments from "@/components/EntityDocuments";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { format, parseISO, startOfMonth, endOfMonth, addMonths, getDay } from "date-fns";
import { formatDateTime } from "@/lib/date";
import { useBrand } from "@/contexts/ThemeContext";
import { formatMoney } from "@/lib/currency";
import { AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";

interface SpaceForm {
  name: string;
  manual_input: boolean;
  space_type: string;
  custom_type_name: string;
  max_occupancy: string;
  booking_mode: string;
  base_weekly_price: string;
  base_daily_price: string;
  base_currency: string;
  monthly_rent: string;
  deposit_amount: string;
  purchase_price: string;
  estimated_sale_price: string;
  floor_number: string;
  floor_area_sqm: string;
  exclusive_area_m2: string;
  residential_common_area_m2: string;
  supply_area_m2: string;
  other_common_area_m2: string;
  contract_area_m2: string;
  land_share_m2: string;
  description: string;
  ical_import_url: string;
  status: string;
  landlord_account_id: string;
}

export default function SpaceDetail() {
  const { t } = useTranslation();
  const { currency, currencyPosition } = useBrand();
  const params = useParams<{ id: string }>();
  const isNew = !params.id || params.id === "new";
  const id = isNew ? null : parseInt(params.id ?? "0", 10);
  const [, navigate] = useLocation();
  const qc = useQueryClient();

  // Lookup states
  const [propertyId, setPropertyId] = useState<number | null>(null);
  const [propertyName, setPropertyName] = useState<string | null>(null);
  const [propertySearch, setPropertySearch] = useState("");

  const [parentSpaceId, setParentSpaceId] = useState<number | null>(null);
  const [parentSpaceName, setParentSpaceName] = useState<string | null>(null);
  const [parentSpaceSearch, setParentSpaceSearch] = useState("");

  const [policyId, setPolicyId] = useState<number | null>(null);
  const [policyName, setPolicyName] = useState<string | null>(null);
  const [policySearch, setPolicySearch] = useState("");

  const [optionIds, setOptionIds] = useState<number[]>([]);
  const [optionNames, setOptionNames] = useState<string[]>([]);
  const [optionSearch, setOptionSearch] = useState("");

  // Privacy state
  const [privacyHideUnitNo, setPrivacyHideUnitNo] = useState(true);
  const [privacyHideStreetNo, setPrivacyHideStreetNo] = useState(true);
  const [privacyMapBlur, setPrivacyMapBlur] = useState(true);

  // Availability state
  const [selectedDates, setSelectedDates] = useState<string[]>([]);

  // Space services state
  type SpaceService = {
    id: number; space_id: number; service_id: number;
    service_name: string; service_type: string;
    base_price: number | null; custom_price: number | null;
    currency: string; billing_trigger: string;
    is_optional: boolean; is_mandatory: boolean;
    sort_order: number; status: string;
  };
  type CatalogService = { id: number; name: string; service_type: string; base_price: number | null; currency: string; status: string; };
  const [spaceServices, setSpaceServices] = useState<SpaceService[]>([]);
  const [catalogServices, setCatalogServices] = useState<CatalogService[]>([]);
  const [svcLoading, setSvcLoading] = useState(false);
  const [addSvcOpen, setAddSvcOpen] = useState(false);
  const [addSvcId, setAddSvcId] = useState<string>("");
  const [addSvcMandatory, setAddSvcMandatory] = useState(false);
  const [addSvcPrice, setAddSvcPrice] = useState<string>("");
  const [addSvcSaving, setAddSvcSaving] = useState(false);
  const { toast } = useToast();

  // OTA calendar feed (iCal export) state
  const [feedUrl, setFeedUrl] = useState<string | null>(null);
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedCopied, setFeedCopied] = useState(false);
  const [rotateConfirmOpen, setRotateConfirmOpen] = useState(false);
  const [revokeConfirmOpen, setRevokeConfirmOpen] = useState(false);

  // OTA channel connections (iCal import) state
  type Channel = { id: number; code: string; name: string };
  type ChannelListing = {
    id: number; channel_id: number; channel_name: string | null;
    ical_import_url: string | null; sync_enabled: boolean;
    last_import_at: string | null; last_export_at: string | null; last_sync_status: string | null; status: string;
  };
  const [channels, setChannels] = useState<Channel[]>([]);
  const [listings, setListings] = useState<ChannelListing[]>([]);
  const [listingUrls, setListingUrls] = useState<Record<number, string>>({});
  const [addChannelId, setAddChannelId] = useState<string>("");
  const [addImportUrl, setAddImportUrl] = useState<string>("");
  const [addListingSaving, setAddListingSaving] = useState(false);
  const [busyListingId, setBusyListingId] = useState<number | null>(null);
  const [deleteListingId, setDeleteListingId] = useState<number | null>(null);

  // Unified channel calendar state
  type CalDay = {
    date: string;
    status: "available" | "blocked" | "booked" | "contracted";
    source: string | null; channel_name: string | null;
    booking_ref: string | null; block_reason: string | null; conflict: boolean;
  };
  type CalData = { days: CalDay[]; summary: { conflicts: number }; channels: { listing_id: number }[] };
  const [calData, setCalData] = useState<CalData | null>(null);
  const [calLoading, setCalLoading] = useState(false);
  const [calMonth, setCalMonth] = useState<Date>(startOfMonth(new Date()));

  const loadSpaceServices = async () => {
    if (!id) return;
    setSvcLoading(true);
    try {
      const [sRes, cRes] = await Promise.all([
        apiFetch(`/api/v1/spaces/${id}/services`),
        apiFetch(`/api/v1/services?status=Active&limit=200`),
      ]);
      const sJson = await sRes.json();
      const cJson = await cRes.json();
      if (sJson.success) setSpaceServices(sJson.data ?? []);
      if (cJson.success) setCatalogServices(cJson.data ?? []);
    } finally {
      setSvcLoading(false);
    }
  };

  const handleAddService = async () => {
    if (!id || !addSvcId) return;
    setAddSvcSaving(true);
    try {
      const res = await apiFetch(`/api/v1/spaces/${id}/services`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service_id: parseInt(addSvcId, 10),
          is_mandatory: addSvcMandatory,
          custom_price: addSvcPrice ? parseFloat(addSvcPrice) : null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? t("space.svc_add_failed"));
      toast({ title: t("space.svc_added_toast") });
      setAddSvcOpen(false);
      setAddSvcId(""); setAddSvcMandatory(false); setAddSvcPrice("");
      await loadSpaceServices();
    } catch (e: unknown) {
      toast({ title: t("common.error"), description: e instanceof Error ? e.message : t("common.unknown_error"), variant: "destructive" });
    } finally {
      setAddSvcSaving(false);
    }
  };

  const handleToggleMandatory = async (mapId: number, val: boolean) => {
    if (!id) return;
    await apiFetch(`/api/v1/spaces/${id}/services/${mapId}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_mandatory: val }),
    });
    setSpaceServices(prev => prev.map(s => s.id === mapId ? { ...s, is_mandatory: val } : s));
  };

  const handleRemoveService = async (mapId: number) => {
    if (!id || !confirm(t("space.svc_remove_confirm"))) return;
    const res = await apiFetch(`/api/v1/spaces/${id}/services/${mapId}`, { method: "DELETE" });
    if (res.ok) {
      toast({ title: t("space.svc_removed_toast") });
      setSpaceServices(prev => prev.filter(s => s.id !== mapId));
    }
  };

  const loadCalendarFeed = async () => {
    if (!id) return;
    try {
      const res = await apiFetch(`/api/v1/spaces/${id}/calendar-feed`);
      const json = await res.json();
      if (json.success) setFeedUrl(json.data.feed_url ?? null);
    } catch {
      /* non-critical; leave feedUrl as-is */
    }
  };

  const generateCalendarFeed = async () => {
    if (!id) return;
    setFeedLoading(true);
    try {
      const res = await apiFetch(`/api/v1/spaces/${id}/calendar-feed/token`, { method: "POST" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error ?? "Failed to generate feed");
      setFeedUrl(json.data.feed_url);
      toast({ title: t("space.feed_generated_toast") });
    } catch (e) {
      toast({ title: t("common.error"), description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setFeedLoading(false);
      setRotateConfirmOpen(false);
    }
  };

  const revokeCalendarFeed = async () => {
    if (!id) return;
    setFeedLoading(true);
    try {
      const res = await apiFetch(`/api/v1/spaces/${id}/calendar-feed/token`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to revoke feed");
      setFeedUrl(null);
      toast({ title: t("space.feed_revoked_toast") });
    } catch (e) {
      toast({ title: t("common.error"), description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setFeedLoading(false);
      setRevokeConfirmOpen(false);
    }
  };

  const handleCopyFeed = async () => {
    if (!feedUrl) return;
    try {
      await navigator.clipboard.writeText(feedUrl);
      setFeedCopied(true);
      setTimeout(() => setFeedCopied(false), 2000);
    } catch {
      /* clipboard blocked; ignore */
    }
  };

  useEffect(() => {
    if (!isNew && id) loadCalendarFeed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isNew]);

  const loadChannels = async () => {
    try {
      const res = await apiFetch(`/api/v1/channels`);
      const json = await res.json();
      if (json.success) setChannels(json.data ?? []);
    } catch { /* non-critical */ }
  };

  const loadListings = async () => {
    if (!id) return;
    try {
      const res = await apiFetch(`/api/v1/spaces/${id}/channel-listings`);
      const json = await res.json();
      if (json.success) {
        const rows: ChannelListing[] = json.data ?? [];
        setListings(rows);
        setListingUrls(Object.fromEntries(rows.map((r) => [r.id, r.ical_import_url ?? ""])));
      }
    } catch { /* non-critical */ }
  };

  const handleAddListing = async () => {
    if (!id || !addChannelId) return;
    setAddListingSaving(true);
    try {
      const res = await apiFetch(`/api/v1/spaces/${id}/channel-listings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel_id: Number(addChannelId), ical_import_url: addImportUrl || null }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error ?? "Failed to add connection");
      setAddChannelId(""); setAddImportUrl("");
      await loadListings();
      toast({ title: t("space.ch_added_toast") });
    } catch (e) {
      toast({ title: t("common.error"), description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setAddListingSaving(false);
    }
  };

  const handleSaveListingUrl = async (listingId: number) => {
    setBusyListingId(listingId);
    try {
      const res = await apiFetch(`/api/v1/channel-listings/${listingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ical_import_url: listingUrls[listingId] || null }),
      });
      if (!res.ok) throw new Error("Failed to save URL");
      await loadListings();
      toast({ title: t("space.ch_url_saved_toast") });
    } catch (e) {
      toast({ title: t("common.error"), description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setBusyListingId(null);
    }
  };

  const handleToggleListingSync = async (listing: ChannelListing, val: boolean) => {
    setListings((prev) => prev.map((l) => (l.id === listing.id ? { ...l, sync_enabled: val } : l)));
    try {
      await apiFetch(`/api/v1/channel-listings/${listing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sync_enabled: val }),
      });
    } catch {
      // revert on failure
      setListings((prev) => prev.map((l) => (l.id === listing.id ? { ...l, sync_enabled: !val } : l)));
    }
  };

  const handleSyncListing = async (listingId: number) => {
    setBusyListingId(listingId);
    try {
      const res = await apiFetch(`/api/v1/channel-listings/${listingId}/import`, { method: "POST" });
      const json = await res.json();
      if (res.ok && json.success) {
        toast({ title: t("space.ch_synced_toast"), description: `${json.data?.processed ?? 0} blocked dates` });
      } else {
        toast({ title: t("space.ch_sync_failed_toast"), description: json.data?.error ?? json.error ?? "", variant: "destructive" });
      }
      await loadListings();
      if (id) qc.invalidateQueries({ queryKey: getGetSpaceAvailabilityQueryKey(id) });
    } catch (e) {
      toast({ title: t("space.ch_sync_failed_toast"), description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setBusyListingId(null);
    }
  };

  const handlePushListing = async (listingId: number, kind: "availability" | "rates") => {
    setBusyListingId(listingId);
    try {
      const res = await apiFetch(`/api/v1/channel-listings/${listingId}/push-${kind}`, { method: "POST" });
      const json = await res.json();
      if (res.ok && json.success) {
        toast({ title: t("space.ch_push_ok"), description: json.data?.message ?? "" });
      } else {
        toast({ title: t("space.ch_push_failed"), description: json.data?.message ?? json.error ?? "", variant: "destructive" });
      }
      await loadListings();
    } catch (e) {
      toast({ title: t("space.ch_push_failed"), description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setBusyListingId(null);
    }
  };

  const handleDeleteListing = async (listingId: number) => {
    setBusyListingId(listingId);
    try {
      const res = await apiFetch(`/api/v1/channel-listings/${listingId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to remove connection");
      await loadListings();
      if (id) qc.invalidateQueries({ queryKey: getGetSpaceAvailabilityQueryKey(id) });
      toast({ title: t("space.ch_removed_toast") });
    } catch (e) {
      toast({ title: t("common.error"), description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setBusyListingId(null);
      setDeleteListingId(null);
    }
  };

  useEffect(() => {
    if (!isNew && id) { loadChannels(); loadListings(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isNew]);

  const loadChannelCalendar = async (month: Date) => {
    if (!id) return;
    setCalLoading(true);
    try {
      const from = format(startOfMonth(month), "yyyy-MM-dd");
      const to = format(endOfMonth(month), "yyyy-MM-dd");
      const res = await apiFetch(`/api/v1/spaces/${id}/channel-calendar?from=${from}&to=${to}`);
      const json = await res.json();
      if (json.success) setCalData(json.data);
    } catch { /* non-critical */ } finally {
      setCalLoading(false);
    }
  };

  const goToMonth = (month: Date) => { setCalMonth(month); loadChannelCalendar(month); };

  const calCellClasses = (d?: CalDay): string => {
    if (!d || d.status === "available") return "bg-green-50 border-green-200 text-green-700";
    if (d.status === "booked") return "bg-blue-50 border-blue-300 text-blue-800";
    if (d.status === "contracted") return "bg-purple-50 border-purple-300 text-purple-800";
    if (d.source === "manual") return "bg-slate-100 border-slate-300 text-slate-600";
    return "bg-amber-50 border-amber-300 text-amber-800"; // ical / channel_api block
  };

  const { data: space, isLoading } = useGetSpace(
    id!,
    { query: { enabled: !isNew && !!id, queryKey: getGetSpaceQueryKey(id!) } }
  );

  const { data: properties } = useListProperties({ search: propertySearch || undefined });
  const { data: allSpaces } = useListSpaces({ search: parentSpaceSearch || undefined });
  const { data: policies } = useListSpacePolicies({ search: policySearch || undefined });
  const { data: spaceOptions } = useListSpaceOptions({ search: optionSearch || undefined });
  const { data: availability, refetch: refetchAvailability } = useGetSpaceAvailability(
    id!,
    { query: { enabled: !isNew && !!id, queryKey: getGetSpaceAvailabilityQueryKey(id!) } }
  );

  const propertyOptions: LookupOption[] = (properties ?? []).map((p) => ({
    id: p.id, label: p.name, sublabel: p.address ?? undefined,
  }));
  const spaceOptions2: LookupOption[] = (allSpaces ?? [])
    .filter((s) => s.id !== id)
    .map((s) => ({ id: s.id, label: s.name, sublabel: s.space_type ?? undefined }));
  const policyOptions: LookupOption[] = (policies ?? []).map((p) => ({
    id: p.id, label: p.name,
  }));
  const optionLookupOptions: LookupOption[] = (spaceOptions ?? []).map((o) => ({
    id: o.id, label: o.name, sublabel: o.display_name ?? undefined,
  }));

  const { register, handleSubmit, reset, control, watch, formState: { errors } } = useForm<SpaceForm>({
    defaultValues: {
      name: "", manual_input: false, space_type: "", custom_type_name: "",
      max_occupancy: "", booking_mode: "", base_weekly_price: "", base_daily_price: "", base_currency: currency,
      monthly_rent: "", deposit_amount: "", purchase_price: "", estimated_sale_price: "",
      floor_number: "", floor_area_sqm: "",
      exclusive_area_m2: "", residential_common_area_m2: "", supply_area_m2: "",
      other_common_area_m2: "", contract_area_m2: "", land_share_m2: "",
      description: "",
      ical_import_url: "", status: DEFAULT_SPACE_STATUS, landlord_account_id: "",
    },
  });

  const watchedSpaceType = watch("space_type");

  useEffect(() => {
    if (space) {
      reset({
        name: space.name ?? "",
        manual_input: space.manual_input ?? false,
        space_type: space.space_type ?? "",
        custom_type_name: space.custom_type_name ?? "",
        max_occupancy: space.max_occupancy?.toString() ?? "",
        booking_mode: space.booking_mode ?? "",
        base_weekly_price: space.base_weekly_price?.toString() ?? "",
        base_daily_price: space.base_daily_price?.toString() ?? "",
        base_currency: space.base_currency ?? currency,
        monthly_rent: space.monthly_rent?.toString() ?? "",
        deposit_amount: space.deposit_amount?.toString() ?? "",
        purchase_price: space.purchase_price?.toString() ?? "",
        estimated_sale_price: space.estimated_sale_price?.toString() ?? "",
        floor_number: space.floor_number?.toString() ?? "",
        floor_area_sqm: space.floor_area_sqm?.toString() ?? "",
        exclusive_area_m2: space.exclusive_area_m2?.toString() ?? "",
        residential_common_area_m2: space.residential_common_area_m2?.toString() ?? "",
        supply_area_m2: space.supply_area_m2?.toString() ?? "",
        other_common_area_m2: space.other_common_area_m2?.toString() ?? "",
        contract_area_m2: space.contract_area_m2?.toString() ?? "",
        land_share_m2: space.land_share_m2?.toString() ?? "",
        description: space.description ?? "",
        ical_import_url: space.ical_import_url ?? "",
        status: space.status ?? DEFAULT_SPACE_STATUS,
        landlord_account_id: space.landlord_account_id?.toString() ?? "",
      });
      setPropertyId(space.property_id ?? null);
      setPropertyName(space.property_name ?? null);
      setParentSpaceId(space.parent_space_id ?? null);
      setParentSpaceName(space.parent_space_name ?? null);
      setPolicyId(space.space_policy_id ?? null);
      setPolicyName(space.policy_name ?? null);
      setOptionIds(space.space_option_ids ?? []);
      const names = (space.space_option_ids ?? []).map((oid) => {
        const opt = (spaceOptions ?? []).find((o) => o.id === oid);
        return opt?.name ?? `Option #${oid}`;
      });
      setOptionNames(names);
      setPrivacyHideUnitNo((space as any).privacy_hide_unit_no ?? true);
      setPrivacyHideStreetNo((space as any).privacy_hide_street_no ?? true);
      setPrivacyMapBlur((space as any).privacy_map_blur ?? true);
    }
  }, [space, reset]);

  const blockMutation = useBlockSpaceAvailability({
    mutation: {
      onSuccess: () => {
        if (id) qc.invalidateQueries({ queryKey: getGetSpaceAvailabilityQueryKey(id) });
        setSelectedDates([]);
        refetchAvailability();
      },
    },
  });

  const createMutation = useCreateSpace({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListSpacesQueryKey() });
        navigate("/property/spaces");
      },
    },
  });

  const updateMutation = useUpdateSpace({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListSpacesQueryKey() });
        if (id) qc.invalidateQueries({ queryKey: getGetSpaceQueryKey(id) });
        navigate("/property/spaces");
      },
    },
  });

  function onSubmit(data: SpaceForm) {
    const payload = {
      name: data.name,
      manual_input: data.manual_input,
      space_type: data.space_type || null,
      custom_type_name: data.custom_type_name || null,
      max_occupancy: data.max_occupancy ? parseInt(data.max_occupancy, 10) : null,
      booking_mode: data.booking_mode || null,
      base_weekly_price: data.base_weekly_price ? parseFloat(data.base_weekly_price) : null,
      base_daily_price: data.base_daily_price ? parseFloat(data.base_daily_price) : null,
      base_currency: data.base_currency || null,
      monthly_rent: data.monthly_rent ? parseFloat(data.monthly_rent) : null,
      deposit_amount: data.deposit_amount ? parseFloat(data.deposit_amount) : null,
      purchase_price: data.purchase_price ? parseFloat(data.purchase_price) : null,
      estimated_sale_price: data.estimated_sale_price ? parseFloat(data.estimated_sale_price) : null,
      floor_number: data.floor_number ? parseInt(data.floor_number, 10) : null,
      floor_area_sqm: data.floor_area_sqm ? parseFloat(data.floor_area_sqm) : null,
      exclusive_area_m2: data.exclusive_area_m2 ? parseFloat(data.exclusive_area_m2) : null,
      residential_common_area_m2: data.residential_common_area_m2 ? parseFloat(data.residential_common_area_m2) : null,
      supply_area_m2: data.supply_area_m2 ? parseFloat(data.supply_area_m2) : null,
      other_common_area_m2: data.other_common_area_m2 ? parseFloat(data.other_common_area_m2) : null,
      contract_area_m2: data.contract_area_m2 ? parseFloat(data.contract_area_m2) : null,
      land_share_m2: data.land_share_m2 ? parseFloat(data.land_share_m2) : null,
      description: data.description || null,
      ical_import_url: data.ical_import_url || null,
      status: data.status,
      property_id: propertyId,
      parent_space_id: parentSpaceId,
      space_policy_id: policyId,
      landlord_account_id: data.landlord_account_id ? parseInt(data.landlord_account_id, 10) : null,
      space_option_ids: optionIds,
      privacy_hide_unit_no: privacyHideUnitNo,
      privacy_hide_street_no: privacyHideStreetNo,
      privacy_map_blur: privacyMapBlur,
    };
    if (isNew) {
      createMutation.mutate({ data: payload });
    } else if (id) {
      updateMutation.mutate({ id, data: payload });
    }
  }

  function toggleDate(date: string) {
    setSelectedDates((prev) =>
      prev.includes(date) ? prev.filter((d) => d !== date) : [...prev, date]
    );
  }

  if (!isNew && isLoading) {
    return <Layout><PageHeader title={t("common.loading")} /><div className="p-6 text-sm text-muted-foreground">{t("common.loading")}</div></Layout>;
  }

  return (
    <Layout>
      <PageHeader
        title={isNew ? `${t("common.new")} ${t("nav.space")}` : (space?.name ?? t("nav.space"))}
        subtitle={!isNew ? `ID: ${id}` : t("space.subtitle_new")}
        actions={
          <div className="flex items-center gap-2">
            <Link href="/property/spaces">
              <Button variant="outline" size="sm" className="gap-1.5">
                <ArrowLeft className="h-4 w-4" /> {t("common.back")}
              </Button>
            </Link>
            <Button size="sm" className="gap-1.5" onClick={handleSubmit(onSubmit)} disabled={createMutation.isPending || updateMutation.isPending}>
              <Save className="h-4 w-4" /> {t("common.save")}
            </Button>
          </div>
        }
      />

      <div className="p-6">
        <Tabs defaultValue="details" onValueChange={(v) => { if (v === "services") loadSpaceServices(); if (v === "channel-calendar") loadChannelCalendar(calMonth); }}>
          <TabsList className="mb-5 flex-wrap h-auto gap-1">
            <TabsTrigger value="details">{t("space.tab_details")}</TabsTrigger>
            {!isNew && <TabsTrigger value="availability">{t("space.tab_availability")}</TabsTrigger>}
            {!isNew && <TabsTrigger value="channel-calendar">{t("space.tab_channel_calendar")}</TabsTrigger>}
            {!isNew && <TabsTrigger value="channel-sync">{t("space.tab_channel_sync")}</TabsTrigger>}
            {!isNew && (
              <TabsTrigger value="photos" className="gap-1.5">
                <Images className="h-3.5 w-3.5" /> {t("space.tab_photos")}
              </TabsTrigger>
            )}
            {!isNew && (
              <TabsTrigger value="services" className="gap-1.5">
                <PackagePlus className="h-3.5 w-3.5" /> {t("space.tab_services")}
              </TabsTrigger>
            )}
            {!isNew && (
              <TabsTrigger value="documents" className="gap-1.5">
                <FileText className="h-3.5 w-3.5" /> {t("space.tab_documents", "서류")}
              </TabsTrigger>
            )}
            {!isNew && (
              <TabsTrigger value="translations" className="gap-1.5">
                <Languages className="h-3.5 w-3.5" /> {t("space.tab_translations")}
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="details">
            <form className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-4xl">

              {/* ① GENERAL — 기본 정보 */}
              <div className="col-span-2 bg-card rounded-lg border p-5 flex flex-col gap-4">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b pb-2">{t("space.section_general")}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="col-span-2 flex flex-col gap-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      {t("space.label_name")} <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      {...register("name", { required: true })}
                      placeholder={t("space.placeholder_name")}
                      className={errors.name ? "border-destructive" : ""}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("space.label_status")}</Label>
                    <Controller
                      name="status"
                      control={control}
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {spaceStatusValuesWith(field.value).map((s) => (
                              <SelectItem key={s} value={s}>{s}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-6">
                    <Controller
                      name="manual_input"
                      control={control}
                      render={({ field }) => (
                        <Checkbox
                          id="manual_input"
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      )}
                    />
                    <Label htmlFor="manual_input" className="font-normal cursor-pointer text-sm">{t("space.label_manual_input")}</Label>
                  </div>
                </div>
              </div>

              {/* ② MAIN — 매물 유형 및 설정 */}
              <div className="col-span-2 bg-card rounded-lg border p-5 flex flex-col gap-4">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b pb-2">{t("space.section_settings")}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("space.label_space_type")}</Label>
                    <Controller
                      name="space_type"
                      control={control}
                      render={({ field }) => (
                        <Select value={field.value || ""} onValueChange={field.onChange}>
                          <SelectTrigger>
                            <SelectValue placeholder={t("space.placeholder_type")} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Private Room">{t("space.type_private")}</SelectItem>
                            <SelectItem value="Shared Room">{t("space.type_shared")}</SelectItem>
                            <SelectItem value="Whole Property">{t("space.type_whole")}</SelectItem>
                            <SelectItem value="Homestay">{t("nav.homestay_placements", "Homestay")}</SelectItem>
                            <SelectItem value="Other">{t("space.type_other")}</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                  {watchedSpaceType === "Other" && (
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("space.label_custom_type")}</Label>
                      <Input {...register("custom_type_name")} placeholder={t("space.placeholder_custom_type")} />
                    </div>
                  )}
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("space.label_booking_mode")}</Label>
                    <Controller
                      name="booking_mode"
                      control={control}
                      render={({ field }) => (
                        <Select value={field.value || ""} onValueChange={field.onChange}>
                          <SelectTrigger>
                            <SelectValue placeholder={t("space.placeholder_booking_mode")} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Instant">{t("space.mode_instant")}</SelectItem>
                            <SelectItem value="Request">{t("space.mode_request")}</SelectItem>
                            <SelectItem value="Manual">{t("space.mode_manual")}</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("space.label_max_occupancy")}</Label>
                    <Input {...register("max_occupancy")} type="number" min={1} placeholder={t("space.placeholder_max_occupancy")} />
                  </div>
                  <div className="col-span-2">
                    <MultiLookupField
                      label={t("space.label_amenities")}
                      values={optionIds}
                      displayTexts={optionNames}
                      onSelect={(id, label) => {
                        setOptionIds((prev) => [...prev, id]);
                        setOptionNames((prev) => [...prev, label]);
                      }}
                      onRemove={(id) => {
                        const idx = optionIds.indexOf(id);
                        setOptionIds((prev) => prev.filter((x) => x !== id));
                        setOptionNames((prev) => prev.filter((_, i) => i !== idx));
                      }}
                      options={optionLookupOptions}
                      onSearch={setOptionSearch}
                      searchPlaceholder={t("space.placeholder_amenities")}
                    />
                  </div>
                  <div className="col-span-2 flex flex-col gap-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("space.label_description")}</Label>
                    <Textarea {...register("description")} rows={4} placeholder={t("space.placeholder_description")} />
                  </div>
                </div>
              </div>

              {/* ③ PROPERTY & PARENT SPACE — 나란히 */}
              <div className="bg-card rounded-lg border p-5 flex flex-col gap-4">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b pb-2">{t("space.section_property")}</h3>
                <LookupField
                  label={t("space.label_property")}
                  value={propertyId}
                  displayText={propertyName}
                  onSelect={(id, label) => { setPropertyId(id); setPropertyName(label); }}
                  onClear={() => { setPropertyId(null); setPropertyName(null); }}
                  options={propertyOptions}
                  onSearch={setPropertySearch}
                  searchPlaceholder={t("space.placeholder_property")}
                />
              </div>

              <div className="bg-card rounded-lg border p-5 flex flex-col gap-4">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b pb-2">{t("space.section_parent_space")}</h3>
                <LookupField
                  label={t("space.label_parent_space")}
                  value={parentSpaceId}
                  displayText={parentSpaceName}
                  onSelect={(id, label) => { setParentSpaceId(id); setParentSpaceName(label); }}
                  onClear={() => { setParentSpaceId(null); setParentSpaceName(null); }}
                  options={spaceOptions2}
                  onSearch={setParentSpaceSearch}
                  searchPlaceholder={t("space.placeholder_parent_space")}
                />
              </div>


              {/* ④ PRICING & POLICY — 나란히 */}
              <div className="bg-card rounded-lg border p-5 flex flex-col gap-4">
                <div className="flex items-end justify-between gap-3 border-b pb-2">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("space.section_pricing")}</h3>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap">{t("space.label_currency")}</Label>
                    <Input {...register("base_currency")} placeholder={currency} maxLength={3} className="w-20 h-8 text-sm uppercase" />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("space.label_daily_price")}</Label>
                    <Input {...register("base_daily_price")} type="number" step="5" min={0} placeholder="0.00" />
                    <p className="text-xs text-muted-foreground">{t("space.desc_daily_price")}</p>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("space.label_weekly_price")}</Label>
                    <Input {...register("base_weekly_price")} type="number" step="0.01" min={0} placeholder="0.00" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("space.label_monthly_rent")}</Label>
                    <Input {...register("monthly_rent")} type="number" step="0.01" min={0} placeholder="0.00" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("space.label_deposit_amount")}</Label>
                    <Input {...register("deposit_amount")} type="number" step="0.01" min={0} placeholder="0.00" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("space.label_purchase_price")}</Label>
                    <Input {...register("purchase_price")} type="number" step="0.01" min={0} placeholder="0.00" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("space.label_estimated_sale_price")}</Label>
                    <Input {...register("estimated_sale_price")} type="number" step="0.01" min={0} placeholder="0.00" />
                  </div>
                </div>
              </div>

              <div className="bg-card rounded-lg border p-5 flex flex-col gap-4">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b pb-2">{t("space.section_policy")}</h3>
                <LookupField
                  label={t("space.label_policy")}
                  value={policyId}
                  displayText={policyName}
                  onSelect={(id, label) => { setPolicyId(id); setPolicyName(label); }}
                  onClear={() => { setPolicyId(null); setPolicyName(null); }}
                  options={policyOptions}
                  onSearch={setPolicySearch}
                  searchPlaceholder={t("space.placeholder_policy")}
                />
              </div>

              {/* ⑤ PHYSICAL DETAILS & ACCOUNTS — 나란히 */}
              <div className="bg-card rounded-lg border p-5 flex flex-col gap-4">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b pb-2">{t("space.section_location")}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("space.label_floor_number")}</Label>
                    <Input {...register("floor_number")} type="number" placeholder={t("space.placeholder_floor_number")} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("space.label_floor_area")}</Label>
                    <Input {...register("floor_area_sqm")} type="number" step="0.1" placeholder={t("space.placeholder_floor_area")} />
                  </div>
                </div>
              </div>

              <div className="bg-card rounded-lg border p-5 flex flex-col gap-4">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b pb-2">{t("space.section_accounts")}</h3>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("space.label_landlord_account")}</Label>
                  <Input {...register("landlord_account_id")} type="number" placeholder={t("space.placeholder_landlord_account")} />
                </div>
              </div>

              {/* ⑤-b AREA BREAKDOWN — 면적 상세 (전용/공용/공급/계약/대지지분) */}
              <div className="col-span-2 bg-card rounded-lg border p-5 flex flex-col gap-3">
                <div className="border-b pb-2">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("space.section_area")}</h3>
                  <p className="text-xs text-muted-foreground mt-1">{t("space.desc_area")}</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("space.label_exclusive_area")}</Label>
                    <Input {...register("exclusive_area_m2")} type="number" step="0.001" min={0} placeholder="0.000" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("space.label_residential_common_area")}</Label>
                    <Input {...register("residential_common_area_m2")} type="number" step="0.001" min={0} placeholder="0.000" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("space.label_supply_area")}</Label>
                    <Input {...register("supply_area_m2")} type="number" step="0.001" min={0} placeholder="0.000" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("space.label_other_common_area")}</Label>
                    <Input {...register("other_common_area_m2")} type="number" step="0.001" min={0} placeholder="0.000" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("space.label_contract_area")}</Label>
                    <Input {...register("contract_area_m2")} type="number" step="0.001" min={0} placeholder="0.000" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("space.label_land_share")}</Label>
                    <Input {...register("land_share_m2")} type="number" step="0.001" min={0} placeholder="0.000" />
                  </div>
                </div>
              </div>

              {/* ⑥ PRIVACY — 전체 너비 */}
              <div className="col-span-2 bg-card rounded-lg border p-5 flex flex-col gap-3">
                <div className="border-b pb-2">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("space.section_privacy")}</h3>
                  <p className="text-xs text-muted-foreground mt-1">{t("space.desc_privacy")}</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
                  <div className="flex items-start justify-between gap-4 rounded-lg bg-muted/40 border px-4 py-3">
                    <div>
                      <p className="text-sm font-medium leading-tight">{t("space.label_hide_unit")}</p>
                      <p className="text-xs text-muted-foreground mt-1">{t("space.desc_hide_unit")}</p>
                    </div>
                    <Switch checked={privacyHideUnitNo} onCheckedChange={setPrivacyHideUnitNo} className="shrink-0 mt-0.5" />
                  </div>
                  <div className="flex items-start justify-between gap-4 rounded-lg bg-muted/40 border px-4 py-3">
                    <div>
                      <p className="text-sm font-medium leading-tight">{t("space.label_hide_street")}</p>
                      <p className="text-xs text-muted-foreground mt-1">{t("space.desc_hide_street")}</p>
                    </div>
                    <Switch checked={privacyHideStreetNo} onCheckedChange={setPrivacyHideStreetNo} className="shrink-0 mt-0.5" />
                  </div>
                  <div className="flex items-start justify-between gap-4 rounded-lg bg-muted/40 border px-4 py-3">
                    <div>
                      <p className="text-sm font-medium leading-tight">{t("space.label_map_blur")}</p>
                      <p className="text-xs text-muted-foreground mt-1">{t("space.desc_map_blur")}</p>
                    </div>
                    <Switch checked={privacyMapBlur} onCheckedChange={setPrivacyMapBlur} className="shrink-0 mt-0.5" />
                  </div>
                </div>
              </div>

              {/* ⑦ OTA SYNC — 하단 고급 설정 */}
              <div className="col-span-2 bg-card rounded-lg border p-5 flex flex-col gap-4">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b pb-2">{t("space.section_external")}</h3>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("space.label_ical_url")}</Label>
                  <Input {...register("ical_import_url")} type="url" placeholder="https://..." />
                </div>
              </div>

              {/* ⑧ OTA CALENDAR FEED (iCal export) — saved spaces only */}
              {!isNew && (
                <div className="col-span-2 bg-card rounded-lg border p-5 flex flex-col gap-3">
                  <div className="border-b pb-2">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                      <CalendarClock className="h-3.5 w-3.5" />
                      {t("space.feed_section")}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">{t("space.feed_desc")}</p>
                  </div>

                  <div className="flex flex-col gap-1.5 pt-1">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("space.feed_url_label")}</Label>
                    {feedUrl ? (
                      <div className="flex items-center gap-2">
                        <code className="text-xs bg-muted px-2 py-1.5 rounded font-mono flex-1 truncate" title={feedUrl}>
                          {feedUrl}
                        </code>
                        <Button type="button" size="sm" variant="outline" onClick={handleCopyFeed} className="shrink-0 gap-1.5">
                          {feedCopied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                          {feedCopied ? t("space.feed_copied") : t("space.feed_copy")}
                        </Button>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">{t("space.feed_none")}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    {feedUrl ? (
                      <>
                        <Button type="button" size="sm" variant="outline" disabled={feedLoading} onClick={() => setRotateConfirmOpen(true)} className="gap-1.5">
                          <RefreshCw className="h-3.5 w-3.5" />
                          {t("space.feed_rotate")}
                        </Button>
                        <Button type="button" size="sm" variant="destructive" disabled={feedLoading} onClick={() => setRevokeConfirmOpen(true)}>
                          {t("space.feed_revoke")}
                        </Button>
                      </>
                    ) : (
                      <Button type="button" size="sm" disabled={feedLoading} onClick={generateCalendarFeed} className="gap-1.5">
                        <CalendarClock className="h-3.5 w-3.5" />
                        {t("space.feed_generate")}
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* ⑨ CHANNEL CONNECTIONS (iCal import) — saved spaces only */}
              {!isNew && (
                <div className="col-span-2 bg-card rounded-lg border p-5 flex flex-col gap-4">
                  <div className="border-b pb-2">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {t("space.ch_section")}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">{t("space.ch_desc")}</p>
                  </div>

                  {/* Existing connections */}
                  {listings.length === 0 ? (
                    <p className="text-xs text-muted-foreground">{t("space.ch_none")}</p>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {listings.map((l) => (
                        <div key={l.id} className="rounded-lg border bg-muted/30 p-4 flex flex-col gap-3">
                          <div className="flex items-center justify-between gap-3 flex-wrap">
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary">{l.channel_name ?? `#${l.channel_id}`}</Badge>
                              {l.last_sync_status && (
                                <Badge variant={l.last_sync_status === "success" ? "outline" : "destructive"} className="text-[10px]">
                                  {l.last_sync_status}
                                </Badge>
                              )}
                              <span className="text-xs text-muted-foreground">
                                {l.last_import_at
                                  ? `${t("space.ch_last_synced")}: ${formatDateTime(l.last_import_at)}`
                                  : t("space.ch_never_synced")}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">{t("space.ch_sync_on")}</span>
                              <Switch checked={l.sync_enabled} onCheckedChange={(v) => handleToggleListingSync(l, v)} />
                            </div>
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("space.ch_import_url")}</Label>
                            <div className="flex items-center gap-2">
                              <Input
                                type="url"
                                value={listingUrls[l.id] ?? ""}
                                placeholder={t("space.ch_url_placeholder")}
                                onChange={(e) => setListingUrls((prev) => ({ ...prev, [l.id]: e.target.value }))}
                                onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
                                className="flex-1 font-mono text-xs"
                              />
                              <Button type="button" size="sm" variant="outline" disabled={busyListingId === l.id} onClick={() => handleSaveListingUrl(l.id)}>
                                {t("space.ch_save_url")}
                              </Button>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <Button type="button" size="sm" disabled={busyListingId === l.id || !l.ical_import_url} onClick={() => handleSyncListing(l.id)} className="gap-1.5">
                              <RefreshCw className={cn("h-3.5 w-3.5", busyListingId === l.id && "animate-spin")} />
                              {t("space.ch_sync_now")}
                            </Button>
                            <Button type="button" size="sm" variant="outline" disabled={busyListingId === l.id} onClick={() => handlePushListing(l.id, "availability")}>
                              {t("space.ch_push_availability")}
                            </Button>
                            <Button type="button" size="sm" variant="outline" disabled={busyListingId === l.id} onClick={() => handlePushListing(l.id, "rates")}>
                              {t("space.ch_push_rates")}
                            </Button>
                            {l.last_export_at && (
                              <span className="text-[11px] text-muted-foreground">{t("space.ch_last_pushed")}: {formatDateTime(l.last_export_at)}</span>
                            )}
                            <Button type="button" size="sm" variant="ghost" className="text-destructive hover:text-destructive ml-auto" disabled={busyListingId === l.id} onClick={() => setDeleteListingId(l.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add a new connection */}
                  <div className="border-t pt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
                    <div className="flex flex-col gap-1.5 sm:w-48">
                      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("space.ch_channel")}</Label>
                      <Select value={addChannelId} onValueChange={setAddChannelId}>
                        <SelectTrigger><SelectValue placeholder={t("space.ch_select")} /></SelectTrigger>
                        <SelectContent>
                          {channels
                            .filter((c) => c.code !== "direct" && !listings.some((l) => l.channel_id === c.id))
                            .map((c) => (
                              <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-1.5 flex-1">
                      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("space.ch_import_url")}</Label>
                      <Input
                        type="url"
                        value={addImportUrl}
                        placeholder={t("space.ch_url_placeholder")}
                        onChange={(e) => setAddImportUrl(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
                        className="font-mono text-xs"
                      />
                    </div>
                    <Button type="button" size="sm" disabled={!addChannelId || addListingSaving} onClick={handleAddListing} className="gap-1.5">
                      <Plus className="h-3.5 w-3.5" />
                      {t("space.ch_add")}
                    </Button>
                  </div>
                </div>
              )}
            </form>
          </TabsContent>

          {!isNew && (
            <TabsContent value="availability">
              <div className="max-w-2xl">
                <div className="bg-card rounded-lg border p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-medium text-sm">{t("space.avail_title")}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">{t("space.avail_hint")}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedDates.length > 0 && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs"
                            onClick={() => id && blockMutation.mutate({ id, data: { dates: selectedDates, action: "unblock" } })}
                            disabled={blockMutation.isPending}
                          >
                            {t("space.avail_unblock", { count: selectedDates.length })}
                          </Button>
                          <Button
                            size="sm"
                            className="text-xs"
                            onClick={() => id && blockMutation.mutate({ id, data: { dates: selectedDates, action: "block" } })}
                            disabled={blockMutation.isPending}
                          >
                            {t("space.avail_block", { count: selectedDates.length })}
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mb-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-green-100 border border-green-300 inline-block"></span>{t("space.cal_available")}</span>
                    <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-rose-100 border border-rose-300 inline-block"></span>{t("space.avail_blocked")}</span>
                    <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-primary/20 border border-primary/50 inline-block"></span>{t("space.avail_selected")}</span>
                  </div>
                  <div className="grid grid-cols-7 gap-1.5">
                    {Array.isArray(availability) ? availability.map((day: any) => {
                      const isSelected = selectedDates.includes(day.date);
                      const isBlocked = !day.is_available;
                      return (
                        <button
                          key={day.date}
                          type="button"
                          onClick={() => toggleDate(day.date)}
                          className={cn(
                            "text-xs p-2 rounded flex flex-col items-center transition-colors",
                            isSelected
                              ? "bg-primary/20 border border-primary/50 text-primary"
                              : isBlocked
                              ? "bg-rose-50 border border-rose-200 text-rose-600"
                              : "bg-green-50 border border-green-200 text-green-700 hover:bg-green-100"
                          )}
                        >
                          <span className="font-medium">{format(parseISO(day.date), "d")}</span>
                          <span className="text-[10px] opacity-70">{format(parseISO(day.date), "MMM")}</span>
                        </button>
                      );
                    }) : (
                      <div className="col-span-7 py-8 text-center text-sm text-muted-foreground">
                        {t("common.loading")}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>
          )}

          {!isNew && (
            <TabsContent value="channel-calendar">
              <div className="max-w-3xl">
                <div className="bg-card rounded-lg border p-5">
                  {/* Month navigation */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Button type="button" size="icon" variant="outline" className="h-8 w-8" onClick={() => goToMonth(addMonths(calMonth, -1))}>
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-sm font-medium w-36 text-center">{format(calMonth, "MMMM yyyy")}</span>
                      <Button type="button" size="icon" variant="outline" className="h-8 w-8" onClick={() => goToMonth(addMonths(calMonth, 1))}>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => goToMonth(startOfMonth(new Date()))}>{t("space.cal_today")}</Button>
                    </div>
                  </div>

                  {/* Conflict alert */}
                  {calData && calData.summary.conflicts > 0 && (
                    <div className="flex items-center gap-2 mb-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      {t("space.cal_conflict_alert", { count: calData.summary.conflicts })}
                    </div>
                  )}

                  {/* Legend */}
                  <div className="flex flex-wrap items-center gap-3 mb-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-green-100 border border-green-300 inline-block" />{t("space.cal_available")}</span>
                    <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-blue-100 border border-blue-300 inline-block" />{t("space.cal_booked")}</span>
                    <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-amber-100 border border-amber-300 inline-block" />{t("space.cal_ota_block")}</span>
                    <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-slate-200 border border-slate-300 inline-block" />{t("space.cal_manual_block")}</span>
                    <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-purple-100 border border-purple-300 inline-block" />{t("space.cal_contracted")}</span>
                    <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded border-2 border-red-500 inline-block" />{t("space.cal_conflict")}</span>
                  </div>

                  {/* Weekday header */}
                  <div className="grid grid-cols-7 gap-1.5 mb-1.5 text-center text-[10px] font-medium text-muted-foreground">
                    {["S", "M", "T", "W", "T", "F", "S"].map((w, i) => <div key={i}>{w}</div>)}
                  </div>

                  {calLoading ? (
                    <div className="py-8 text-center text-sm text-muted-foreground">{t("common.loading")}</div>
                  ) : (() => {
                    const dayMap = new Map((calData?.days ?? []).map((d) => [d.date, d]));
                    const offset = getDay(calMonth); // leading blanks (0 = Sun)
                    const total = endOfMonth(calMonth).getDate();
                    const cells: (string | null)[] = [
                      ...Array(offset).fill(null),
                      ...Array.from({ length: total }, (_, i) => format(new Date(calMonth.getFullYear(), calMonth.getMonth(), i + 1), "yyyy-MM-dd")),
                    ];
                    return (
                      <div className="grid grid-cols-7 gap-1.5">
                        {cells.map((dateStr, idx) => {
                          if (!dateStr) return <div key={`b${idx}`} />;
                          const d = dayMap.get(dateStr);
                          const dayNum = Number(dateStr.slice(-2));
                          const secondary = d?.status === "booked"
                            ? (d.source ?? "")
                            : d?.status === "blocked"
                              ? (d.channel_name ?? (d.source === "manual" ? "" : "OTA"))
                              : "";
                          const title = [dateStr, d?.status, d?.channel_name, d?.booking_ref, d?.block_reason, d?.conflict ? "⚠ conflict" : ""].filter(Boolean).join(" · ");
                          return (
                            <div
                              key={dateStr}
                              title={title}
                              className={cn(
                                "relative min-h-[3.25rem] rounded border p-1.5 flex flex-col",
                                calCellClasses(d),
                                d?.conflict && "ring-2 ring-red-500",
                              )}
                            >
                              <span className="text-xs font-medium">{dayNum}</span>
                              {secondary && <span className="text-[9px] leading-tight truncate mt-0.5 opacity-80">{secondary}</span>}
                              {d?.conflict && <AlertTriangle className="h-3 w-3 text-red-600 absolute top-1 right-1" />}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}

                  {!calLoading && (!calData || calData.channels.length === 0) && (
                    <p className="text-xs text-muted-foreground mt-4">{t("space.cal_no_channels")}</p>
                  )}
                </div>
              </div>
            </TabsContent>
          )}

          {!isNew && id && (
            <TabsContent value="channel-sync">
              <ChannelSyncPanel spaceId={id} channels={channels} listings={listings} />
            </TabsContent>
          )}

          {!isNew && id && (
            <TabsContent value="photos">
              <SpacePhotoManager spaceId={id} />
            </TabsContent>
          )}

          {!isNew && id && (
            <TabsContent value="services">
              <div className="max-w-3xl space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-base">{t("space.svc_title")}</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {t("space.svc_desc")}
                      {spaceServices.length === 0 && !svcLoading && (
                        <span className="text-amber-600">{t("space.svc_desc_none")}</span>
                      )}
                    </p>
                  </div>
                  <Button size="sm" className="gap-1.5" onClick={() => setAddSvcOpen(true)}>
                    <Plus className="h-4 w-4" /> {t("space.svc_add")}
                  </Button>
                </div>

                {svcLoading ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">{t("common.loading")}</p>
                ) : spaceServices.length === 0 ? (
                  <div className="border border-dashed rounded-lg py-12 text-center text-muted-foreground text-sm">
                    {t("space.svc_empty")}
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/40 text-xs text-muted-foreground uppercase tracking-wider">
                          <th className="px-4 py-2.5 text-left font-medium">{t("space.svc_col_service")}</th>
                          <th className="px-4 py-2.5 text-left font-medium">{t("space.svc_col_type")}</th>
                          <th className="px-4 py-2.5 text-right font-medium">{t("space.svc_col_price")}</th>
                          <th className="px-4 py-2.5 text-center font-medium">{t("space.svc_col_mandatory")}</th>
                          <th className="px-4 py-2.5 text-center font-medium">{t("space.svc_col_action")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {spaceServices.map((svc, idx) => (
                          <tr key={svc.id} className={cn("border-b last:border-0", idx % 2 === 0 ? "bg-background" : "bg-muted/20")}>
                            <td className="px-4 py-3 font-medium">
                              {svc.service_name}
                              {!svc.is_optional && (
                                <Badge variant="secondary" className="ml-2 text-xs">{t("space.svc_required")}</Badge>
                              )}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground capitalize">
                              {svc.service_type.replace("_", " ")}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {svc.custom_price != null ? (
                                <span className="font-semibold text-orange-600">
                                  {formatMoney(svc.custom_price, svc.currency ?? currency, currencyPosition)}
                                  <span className="ml-1 text-xs text-muted-foreground font-normal">({t("space.svc_custom")})</span>
                                </span>
                              ) : svc.base_price != null ? (
                                <span>{formatMoney(svc.base_price, svc.currency ?? currency, currencyPosition)}</span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <Switch
                                checked={svc.is_mandatory}
                                onCheckedChange={(val) => handleToggleMandatory(svc.id, val)}
                              />
                            </td>
                            <td className="px-4 py-3 text-center">
                              <Button
                                variant="ghost" size="icon"
                                className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => handleRemoveService(svc.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Add Service Dialog */}
              <Dialog open={addSvcOpen} onOpenChange={setAddSvcOpen}>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>{t("space.svc_dialog_title")}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-2">
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("space.svc_field_service")} *</Label>
                      <Select value={addSvcId} onValueChange={setAddSvcId}>
                        <SelectTrigger>
                          <SelectValue placeholder={t("space.svc_field_service_ph")} />
                        </SelectTrigger>
                        <SelectContent>
                          {catalogServices
                            .filter(c => !spaceServices.some(s => s.service_id === c.id))
                            .map(c => (
                              <SelectItem key={c.id} value={String(c.id)}>
                                {c.name}
                                {c.base_price != null && (
                                  <span className="text-muted-foreground ml-1">({c.currency} {c.base_price})</span>
                                )}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {t("space.svc_field_price", { currency })}
                      </Label>
                      <Input
                        type="number" min="0" step="0.01"
                        placeholder={t("space.svc_field_price_ph")}
                        value={addSvcPrice}
                        onChange={e => setAddSvcPrice(e.target.value)}
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <Switch checked={addSvcMandatory} onCheckedChange={setAddSvcMandatory} id="mandatory-sw" />
                      <Label htmlFor="mandatory-sw" className="cursor-pointer text-sm font-normal">
                        {t("space.svc_mandatory_label")}
                      </Label>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setAddSvcOpen(false)}>{t("common.cancel")}</Button>
                    <Button disabled={!addSvcId || addSvcSaving} onClick={handleAddService}>
                      {addSvcSaving ? t("space.svc_adding") : t("space.svc_add")}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </TabsContent>
          )}

          {/* Paperwork that belongs to the unit itself (등기부등본, 관리비 내역,
              점검 결과 …) rather than to a lease on it — and where a document
              filed straight onto this 호수 from bulk intake shows up. */}
          {!isNew && id && (
            <TabsContent value="documents">
              <EntityDocuments entityType="space" entityId={id} defaultDocType="property_document" />
            </TabsContent>
          )}

          {!isNew && id && (
            <TabsContent value="translations">
              <ContentTranslationsPanel entity="spaces" id={id} sourceLang="ko" />
            </TabsContent>
          )}
        </Tabs>
      </div>

      {/* OTA feed — rotate confirmation (invalidates the existing URL) */}
      <AlertDialog open={rotateConfirmOpen} onOpenChange={setRotateConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("space.feed_rotate_title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("space.feed_rotate_desc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={generateCalendarFeed}>{t("space.feed_rotate")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* OTA feed — revoke confirmation */}
      <AlertDialog open={revokeConfirmOpen} onOpenChange={setRevokeConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("space.feed_revoke_title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("space.feed_revoke_desc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={revokeCalendarFeed}
            >
              {t("space.feed_revoke")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Channel connection — remove confirmation */}
      <AlertDialog open={deleteListingId !== null} onOpenChange={(open) => { if (!open) setDeleteListingId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("space.ch_delete_title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("space.ch_delete_desc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteListingId && handleDeleteListing(deleteListingId)}
            >
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
