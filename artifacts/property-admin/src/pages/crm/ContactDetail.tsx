import { useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { Layout, PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useForm, Controller } from "react-hook-form";
import {
  useGetContact, useCreateContact, useUpdateContact,
  getListContactsQueryKey, getGetContactQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Save, AlertTriangle } from "lucide-react";
import { Link } from "wouter";
import { differenceInDays, parseISO } from "date-fns";

const COUNTRIES = [
  "Australia", "China", "South Korea", "Japan", "United States", "United Kingdom",
  "New Zealand", "Singapore", "India", "Canada", "Germany", "France", "Brazil",
  "Hong Kong", "Taiwan", "Vietnam", "Malaysia", "Indonesia", "Thailand",
];

const NATIONALITIES = COUNTRIES;

interface ContactForm {
  first_name: string;
  last_name: string;
  title: string;
  other_name: string;
  email: string;
  mobile_number: string;
  office_number: string;
  date_of_birth: string;
  nationality: string;
  gender: string;
  sns_id: string;
  passport_number: string;
  passport_expiry: string;
  visa_type: string;
  visa_expiry: string;
  address_line1: string;
  suburb: string;
  state: string;
  postcode: string;
  country: string;
  portal_enabled: boolean;
  portal_user_id: string;
  profile_photo_url: string;
  description: string;
  manual_input: boolean;
  status: string;
}

function ExpiryWarning({ label, dateStr }: { label: string; dateStr?: string | null }) {
  if (!dateStr) return null;
  const days = differenceInDays(parseISO(dateStr), new Date());
  if (days > 90) return null;
  const color = days < 0 ? "text-red-600" : days < 30 ? "text-orange-600" : "text-yellow-600";
  return (
    <div className={`flex items-center gap-1 text-xs ${color} mt-0.5`}>
      <AlertTriangle className="h-3 w-3" />
      {days < 0 ? `${label} expired ${-days}d ago` : `${label} expires in ${days}d`}
    </div>
  );
}

export default function ContactDetail() {
  const params = useParams<{ id: string }>();
  const isNew = params.id === "new";
  const id = isNew ? null : parseInt(params.id ?? "0", 10);
  const [, navigate] = useLocation();
  const qc = useQueryClient();

  const { data: contact, isLoading } = useGetContact(
    id!, { query: { enabled: !isNew && !!id, queryKey: getGetContactQueryKey(id!) } }
  );

  const { register, handleSubmit, reset, control, watch, formState: { errors } } = useForm<ContactForm>({
    defaultValues: {
      first_name: "", last_name: "", title: "", other_name: "", email: "",
      mobile_number: "", office_number: "", date_of_birth: "", nationality: "",
      gender: "", sns_id: "", passport_number: "", passport_expiry: "", visa_type: "",
      visa_expiry: "", address_line1: "", suburb: "", state: "", postcode: "",
      country: "Australia", portal_enabled: false, portal_user_id: "", profile_photo_url: "",
      description: "", manual_input: false, status: "Active",
    },
  });

  const passportExpiry = watch("passport_expiry");
  const visaExpiry = watch("visa_expiry");
  const profilePhoto = watch("profile_photo_url");

  useEffect(() => {
    if (contact) {
      reset({
        first_name: contact.first_name ?? "",
        last_name: contact.last_name ?? "",
        title: contact.title ?? "",
        other_name: contact.other_name ?? "",
        email: contact.email ?? "",
        mobile_number: contact.mobile_number ?? "",
        office_number: contact.office_number ?? "",
        date_of_birth: contact.date_of_birth ?? "",
        nationality: contact.nationality ?? "",
        gender: contact.gender ?? "",
        sns_id: contact.sns_id ?? "",
        passport_number: contact.passport_number ?? "",
        passport_expiry: contact.passport_expiry ?? "",
        visa_type: contact.visa_type ?? "",
        visa_expiry: contact.visa_expiry ?? "",
        address_line1: contact.address_line1 ?? "",
        suburb: contact.suburb ?? "",
        state: contact.state ?? "",
        postcode: contact.postcode ?? "",
        country: contact.country ?? "Australia",
        portal_enabled: contact.portal_enabled ?? false,
        portal_user_id: contact.portal_user_id ?? "",
        profile_photo_url: contact.profile_photo_url ?? "",
        description: contact.description ?? "",
        manual_input: contact.manual_input ?? false,
        status: contact.status ?? "Active",
      });
    }
  }, [contact, reset]);

  const createMutation = useCreateContact({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListContactsQueryKey() });
        navigate("/crm/contacts");
      },
    },
  });

  const updateMutation = useUpdateContact({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListContactsQueryKey() });
        if (id) qc.invalidateQueries({ queryKey: getGetContactQueryKey(id) });
        navigate("/crm/contacts");
      },
    },
  });

  const onSubmit = (values: ContactForm) => {
    const data = {
      ...values,
      date_of_birth: values.date_of_birth || null,
      nationality: values.nationality || null,
      gender: values.gender || null,
      mobile_number: values.mobile_number || null,
      office_number: values.office_number || null,
      passport_number: values.passport_number || null,
      passport_expiry: values.passport_expiry || null,
      visa_type: values.visa_type || null,
      visa_expiry: values.visa_expiry || null,
      address_line1: values.address_line1 || null,
      suburb: values.suburb || null,
      state: values.state || null,
      postcode: values.postcode || null,
      country: values.country || null,
      portal_user_id: values.portal_user_id || null,
      profile_photo_url: values.profile_photo_url || null,
      description: values.description || null,
      title: values.title || null,
      other_name: values.other_name || null,
      sns_id: values.sns_id || null,
    };
    if (isNew) {
      createMutation.mutate({ data });
    } else {
      updateMutation.mutate({ id: id!, data });
    }
  };

  if (!isNew && isLoading) return <Layout><p className="p-6 text-sm text-muted-foreground">Loading…</p></Layout>;

  return (
    <Layout>
      <PageHeader
        title={isNew ? "New Contact" : contact ? `${contact.first_name} ${contact.last_name}` : "Contact"}
        actions={
          <div className="flex gap-2">
            <Link href="/crm/contacts">
              <Button variant="outline" size="sm" className="gap-1.5"><ArrowLeft className="h-4 w-4" /> Back</Button>
            </Link>
            <Button size="sm" className="gap-1.5" onClick={handleSubmit(onSubmit)}
              disabled={createMutation.isPending || updateMutation.isPending}>
              <Save className="h-4 w-4" /> Save
            </Button>
          </div>
        }
      />
      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Info */}
            <div className="rounded-lg border p-4 space-y-4">
              <h3 className="font-semibold text-sm">Basic Information</h3>
              <div className="grid grid-cols-4 gap-3">
                <div className="grid gap-1.5">
                  <Label>Title</Label>
                  <Controller name="title" control={control} render={({ field }) => (
                    <Select value={field.value || "__none"} onValueChange={(v) => field.onChange(v === "__none" ? "" : v)}>
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none">—</SelectItem>
                        <SelectItem value="Mr">Mr</SelectItem>
                        <SelectItem value="Ms">Ms</SelectItem>
                        <SelectItem value="Mrs">Mrs</SelectItem>
                        <SelectItem value="Dr">Dr</SelectItem>
                      </SelectContent>
                    </Select>
                  )} />
                </div>
                <div className="grid gap-1.5">
                  <Label>First Name *</Label>
                  <Input {...register("first_name", { required: true })} />
                  {errors.first_name && <p className="text-xs text-destructive">Required</p>}
                </div>
                <div className="grid gap-1.5">
                  <Label>Last Name *</Label>
                  <Input {...register("last_name", { required: true })} />
                  {errors.last_name && <p className="text-xs text-destructive">Required</p>}
                </div>
                <div className="grid gap-1.5">
                  <Label>Other Name</Label>
                  <Input {...register("other_name")} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="grid gap-1.5">
                  <Label>Email *</Label>
                  <Input {...register("email", { required: true })} type="email" />
                  {errors.email && <p className="text-xs text-destructive">Required</p>}
                </div>
                <div className="grid gap-1.5">
                  <Label>Mobile</Label>
                  <Input {...register("mobile_number")} />
                </div>
                <div className="grid gap-1.5">
                  <Label>Office Phone</Label>
                  <Input {...register("office_number")} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="grid gap-1.5">
                  <Label>Date of Birth</Label>
                  <Input {...register("date_of_birth")} type="date" />
                </div>
                <div className="grid gap-1.5">
                  <Label>Gender</Label>
                  <Controller name="gender" control={control} render={({ field }) => (
                    <Select value={field.value || "__none"} onValueChange={(v) => field.onChange(v === "__none" ? "" : v)}>
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none">—</SelectItem>
                        <SelectItem value="Male">Male</SelectItem>
                        <SelectItem value="Female">Female</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                        <SelectItem value="PreferNotToSay">Prefer not to say</SelectItem>
                      </SelectContent>
                    </Select>
                  )} />
                </div>
                <div className="grid gap-1.5">
                  <Label>Nationality</Label>
                  <Controller name="nationality" control={control} render={({ field }) => (
                    <Select value={field.value || "__none"} onValueChange={(v) => field.onChange(v === "__none" ? "" : v)}>
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none">—</SelectItem>
                        {NATIONALITIES.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )} />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label>SNS ID</Label>
                <Input {...register("sns_id")} placeholder="WeChat / KakaoTalk / LINE ID" />
              </div>
            </div>

            {/* KYC */}
            <div className="rounded-lg border p-4 space-y-4">
              <h3 className="font-semibold text-sm">KYC / Identity</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label>Passport Number</Label>
                  <Input {...register("passport_number")} />
                </div>
                <div className="grid gap-1.5">
                  <Label>Passport Expiry</Label>
                  <Input {...register("passport_expiry")} type="date" />
                  <ExpiryWarning label="Passport" dateStr={passportExpiry} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label>Visa Type</Label>
                  <Input {...register("visa_type")} placeholder="e.g. Student 500" />
                </div>
                <div className="grid gap-1.5">
                  <Label>Visa Expiry</Label>
                  <Input {...register("visa_expiry")} type="date" />
                  <ExpiryWarning label="Visa" dateStr={visaExpiry} />
                </div>
              </div>
            </div>

            {/* Address */}
            <div className="rounded-lg border p-4 space-y-4">
              <h3 className="font-semibold text-sm">Address</h3>
              <div className="grid gap-1.5">
                <Label>Address Line 1</Label>
                <Input {...register("address_line1")} />
              </div>
              <div className="grid grid-cols-4 gap-3">
                <div className="grid gap-1.5 col-span-2">
                  <Label>Suburb</Label>
                  <Input {...register("suburb")} />
                </div>
                <div className="grid gap-1.5">
                  <Label>State</Label>
                  <Input {...register("state")} />
                </div>
                <div className="grid gap-1.5">
                  <Label>Postcode</Label>
                  <Input {...register("postcode")} />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label>Country</Label>
                <Controller name="country" control={control} render={({ field }) => (
                  <Select value={field.value || "__none"} onValueChange={(v) => field.onChange(v === "__none" ? "" : v)}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">—</SelectItem>
                      {COUNTRIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )} />
              </div>
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-4">
            {/* Photo */}
            {profilePhoto && (
              <div className="rounded-lg border p-4">
                <Label className="mb-2 block">Photo Preview</Label>
                <img src={profilePhoto} alt="Profile" className="w-full max-h-40 object-contain rounded" />
              </div>
            )}
            <div className="rounded-lg border p-4 space-y-4">
              <h3 className="font-semibold text-sm">Profile Photo URL</h3>
              <Input {...register("profile_photo_url")} placeholder="https://..." />
            </div>

            {/* Portal */}
            <div className="rounded-lg border p-4 space-y-4">
              <h3 className="font-semibold text-sm">Portal Access</h3>
              <div className="flex items-center justify-between">
                <Label>Portal Enabled</Label>
                <Controller name="portal_enabled" control={control} render={({ field }) => (
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                )} />
              </div>
              <div className="grid gap-1.5">
                <Label>Portal User ID</Label>
                <Input {...register("portal_user_id")} placeholder="Linked user ID" />
              </div>
            </div>

            {/* Settings */}
            <div className="rounded-lg border p-4 space-y-4">
              <h3 className="font-semibold text-sm">Settings</h3>
              <div className="grid gap-1.5">
                <Label>Status</Label>
                <Controller name="status" control={control} render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                )} />
              </div>
              <div className="flex items-center justify-between">
                <Label>Manual Input</Label>
                <Controller name="manual_input" control={control} render={({ field }) => (
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                )} />
              </div>
            </div>

            {/* Notes */}
            <div className="rounded-lg border p-4 space-y-2">
              <Label>Description / Notes</Label>
              <Input {...register("description")} placeholder="Internal notes" />
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
