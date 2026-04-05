import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useForm, Controller } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetContract, useCreateContract, useUpdateContract,
  useSendContract, useSignContract, useActivateContract,
  useTerminateContract, useExpireContract, useDeleteContract,
  getListContractsQueryKey, getGetContractQueryKey,
} from "@workspace/api-client-react";
import { LookupSelect } from "@/components/LookupSelect";
import { ArrowLeft, Save, Trash2 } from "lucide-react";

const CURRENCIES = ["AUD", "USD", "SGD", "MYR", "GBP"];
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
  contract_product_id: number | null;
  tenant_account_id: number | null;
  landlord_account_id: number | null;
  space_id: number | null;
  start_date: string;
  end_date: string;
  weekly_rate: string;
  total_rent: string;
  bond_amount: string;
  advance_amount: string;
  currency: string;
  document_url: string;
  terms_text: string;
  notes: string;
}

export default function ContractDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const isNew = id === "new";

  const [terminateOpen, setTerminateOpen] = useState(false);
  const [terminateReason, setTerminateReason] = useState("");
  const [signDocUrl, setSignDocUrl] = useState("");
  const [signOpen, setSignOpen] = useState(false);

  const { data: contract, refetch } = useGetContract(Number(id), {
    query: { enabled: !isNew },
  });

  const { register, handleSubmit, reset, control } = useForm<FormData>({
    defaultValues: {
      booking_id: null, contract_product_id: null, tenant_account_id: null,
      landlord_account_id: null, space_id: null,
      start_date: "", end_date: "", weekly_rate: "", total_rent: "",
      bond_amount: "", advance_amount: "", currency: "AUD",
      document_url: "", terms_text: "", notes: "",
    },
  });

  useEffect(() => {
    if (contract) {
      reset({
        booking_id: contract.booking_id ?? null,
        contract_product_id: contract.contract_product_id ?? null,
        tenant_account_id: contract.tenant_account_id ?? null,
        landlord_account_id: contract.landlord_account_id ?? null,
        space_id: contract.space_id ?? null,
        start_date: contract.start_date ?? "",
        end_date: contract.end_date ?? "",
        weekly_rate: contract.weekly_rate != null ? String(contract.weekly_rate) : "",
        total_rent: contract.total_rent != null ? String(contract.total_rent) : "",
        bond_amount: contract.bond_amount != null ? String(contract.bond_amount) : "",
        advance_amount: contract.advance_amount != null ? String(contract.advance_amount) : "",
        currency: contract.currency ?? "AUD",
        document_url: contract.document_url ?? "",
        terms_text: contract.terms_text ?? "",
        notes: contract.notes ?? "",
      });
    }
  }, [contract, reset]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getListContractsQueryKey() });
    if (!isNew) qc.invalidateQueries({ queryKey: getGetContractQueryKey(Number(id)) });
  };

  const createMutation = useCreateContract({ mutation: { onSuccess: (d) => { invalidate(); navigate(`/contracts/contracts/${d.id}`); } } });
  const updateMutation = useUpdateContract({ mutation: { onSuccess: () => { invalidate(); refetch(); } } });
  const sendMutation = useSendContract({ mutation: { onSuccess: () => { invalidate(); refetch(); } } });
  const signMutation = useSignContract({ mutation: { onSuccess: () => { invalidate(); refetch(); setSignOpen(false); } } });
  const activateMutation = useActivateContract({ mutation: { onSuccess: () => { invalidate(); refetch(); } } });
  const terminateMutation = useTerminateContract({ mutation: { onSuccess: () => { invalidate(); refetch(); setTerminateOpen(false); } } });
  const expireMutation = useExpireContract({ mutation: { onSuccess: () => { invalidate(); refetch(); } } });
  const deleteMutation = useDeleteContract({ mutation: { onSuccess: () => { invalidate(); navigate("/contracts/contracts"); } } });

  const buildPayload = (data: FormData) => ({
    booking_id: data.booking_id ?? null,
    contract_product_id: data.contract_product_id ?? null,
    tenant_account_id: data.tenant_account_id ?? null,
    landlord_account_id: data.landlord_account_id ?? null,
    space_id: data.space_id ?? null,
    start_date: data.start_date || null,
    end_date: data.end_date || null,
    weekly_rate: data.weekly_rate ? Number(data.weekly_rate) : null,
    total_rent: data.total_rent ? Number(data.total_rent) : null,
    bond_amount: data.bond_amount ? Number(data.bond_amount) : null,
    advance_amount: data.advance_amount ? Number(data.advance_amount) : null,
    currency: data.currency || "AUD",
    document_url: data.document_url || null,
    terms_text: data.terms_text || null,
    notes: data.notes || null,
  });

  const onSubmit = (data: FormData) => {
    if (isNew) createMutation.mutate({ data: buildPayload(data) });
    else updateMutation.mutate({ id: Number(id), data: buildPayload(data) });
  };

  const status = contract?.status ?? "Draft";

  const fsmActions = () => {
    if (isNew) return null;
    return (
      <div className="flex gap-2">
        {status === "Draft" && (
          <Button type="button" size="sm" className="bg-[#E8621A] hover:bg-[#d4561a] text-white"
            onClick={() => sendMutation.mutate({ id: Number(id) })}>
            Send to Tenant
          </Button>
        )}
        {(status === "Draft" || status === "Sent") && (
          <Button type="button" size="sm" variant="outline" className="border-purple-400 text-purple-700"
            onClick={() => setSignOpen(true)}>
            Mark Signed
          </Button>
        )}
        {status === "Signed" && (
          <Button type="button" size="sm" className="bg-green-600 hover:bg-green-700 text-white"
            onClick={() => activateMutation.mutate({ id: Number(id) })}>
            Activate
          </Button>
        )}
        {status === "Active" && (
          <Button type="button" size="sm" variant="outline" className="text-orange-600"
            onClick={() => expireMutation.mutate({ id: Number(id) })}>
            Mark Expired
          </Button>
        )}
        {(status === "Draft" || status === "Sent" || status === "Signed" || status === "Active") && (
          <Button type="button" size="sm" variant="outline" className="text-red-600"
            onClick={() => setTerminateOpen(true)}>
            Terminate
          </Button>
        )}
      </div>
    );
  };

  return (
    <Layout>
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold font-mono">
                {isNew ? "New Contract" : contract?.contract_ref}
              </h1>
              {!isNew && <p className="text-sm text-muted-foreground">Contract #{id}</p>}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => navigate("/contracts/contracts")}>
                <ArrowLeft className="h-4 w-4 mr-2" />Back
              </Button>
              {!isNew && (
                <Button type="button" variant="outline" className="text-red-600"
                  onClick={() => { if (confirm("Delete this contract?")) deleteMutation.mutate({ id: Number(id) }); }}>
                  <Trash2 className="h-4 w-4 mr-2" />Delete
                </Button>
              )}
              <Button type="submit"><Save className="h-4 w-4 mr-2" />Save</Button>
            </div>
          </div>

          {/* Status bar */}
          {!isNew && contract && (
            <div className="border rounded-lg p-4 mb-6 flex items-center justify-between bg-blue-50/50">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-muted-foreground">Status:</span>
                <Badge className={statusColors[status] ?? ""}>{status}</Badge>
                {contract.sent_at && <span className="text-xs text-muted-foreground">Sent: {new Date(contract.sent_at).toLocaleDateString()}</span>}
                {contract.signed_at && <span className="text-xs text-muted-foreground">Signed: {new Date(contract.signed_at).toLocaleDateString()}</span>}
              </div>
              {fsmActions()}
            </div>
          )}

          <div className="grid grid-cols-1 gap-6 max-w-4xl">
            {/* General */}
            <div className="border rounded-lg bg-white p-6">
              <h2 className="text-sm font-semibold uppercase text-[#E8621A] tracking-wide mb-4">General</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Linked Booking</Label>
                  <Controller name="booking_id" control={control} render={({ field }) => (
                    <LookupSelect
                      lookupUrl="/api/v1/lookup/bookings"
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Search bookings..."
                      displayValue={(contract as any)?.booking_ref ?? null}
                    />
                  )} />
                </div>
                <div>
                  <Label>Contract Product</Label>
                  <Controller name="contract_product_id" control={control} render={({ field }) => (
                    <LookupSelect
                      lookupUrl="/api/v1/lookup/contract-products"
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Search products..."
                      displayValue={(contract as any)?.contract_product_name ?? null}
                    />
                  )} />
                </div>
                <div>
                  <Label>Space</Label>
                  <Controller name="space_id" control={control} render={({ field }) => (
                    <LookupSelect
                      lookupUrl="/api/v1/lookup/spaces"
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Search spaces..."
                      displayValue={(contract as any)?.space_name ?? null}
                    />
                  )} />
                </div>
              </div>
            </div>

            {/* Parties */}
            <div className="border rounded-lg bg-white p-6">
              <h2 className="text-sm font-semibold uppercase text-[#E8621A] tracking-wide mb-4">Parties</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Tenant (Guest Account) *</Label>
                  <Controller name="tenant_account_id" control={control} render={({ field }) => (
                    <LookupSelect
                      lookupUrl="/api/v1/lookup/accounts"
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Search accounts..."
                      displayValue={(contract as any)?.tenant_name ?? null}
                    />
                  )} />
                </div>
                <div>
                  <Label>Landlord Account</Label>
                  <Controller name="landlord_account_id" control={control} render={({ field }) => (
                    <LookupSelect
                      lookupUrl="/api/v1/lookup/accounts"
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Search accounts..."
                      displayValue={(contract as any)?.landlord_name ?? null}
                    />
                  )} />
                </div>
              </div>
            </div>

            {/* Terms */}
            <div className="border rounded-lg bg-white p-6">
              <h2 className="text-sm font-semibold uppercase text-[#E8621A] tracking-wide mb-4">Financial Terms</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Start Date</Label>
                  <Input {...register("start_date")} type="date" />
                </div>
                <div>
                  <Label>End Date</Label>
                  <Input {...register("end_date")} type="date" />
                </div>
                <div>
                  <Label>Currency</Label>
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
                  <Label>Weekly Rate</Label>
                  <Input {...register("weekly_rate")} type="number" step="0.01" min="0" />
                </div>
                <div>
                  <Label>Total Rent</Label>
                  <Input {...register("total_rent")} type="number" step="0.01" min="0" />
                </div>
                <div>
                  <Label>Bond Amount</Label>
                  <Input {...register("bond_amount")} type="number" step="0.01" min="0" />
                </div>
                <div>
                  <Label>Advance Amount</Label>
                  <Input {...register("advance_amount")} type="number" step="0.01" min="0" />
                </div>
              </div>
            </div>

            {/* Document */}
            <div className="border rounded-lg bg-white p-6">
              <h2 className="text-sm font-semibold uppercase text-[#E8621A] tracking-wide mb-4">Document & Terms</h2>
              <div className="space-y-4">
                <div>
                  <Label>Document URL (Signed Copy)</Label>
                  <Input {...register("document_url")} placeholder="https://..." />
                </div>
                <div>
                  <Label>Contract Terms</Label>
                  <Textarea {...register("terms_text")} placeholder="Enter contract terms and conditions..." rows={6} />
                </div>
                <div>
                  <Label>Notes</Label>
                  <Textarea {...register("notes")} placeholder="Internal notes..." rows={3} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>

      {/* Terminate Dialog */}
      <Dialog open={terminateOpen} onOpenChange={setTerminateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Terminate Contract</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label>Termination Reason *</Label>
            <Textarea
              value={terminateReason}
              onChange={e => setTerminateReason(e.target.value)}
              placeholder="Reason for termination..."
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTerminateOpen(false)}>Cancel</Button>
            <Button variant="destructive" disabled={!terminateReason}
              onClick={() => terminateMutation.mutate({ id: Number(id), data: { termination_reason: terminateReason } })}>
              Terminate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sign Dialog */}
      <Dialog open={signOpen} onOpenChange={setSignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Contract as Signed</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label>Signed Document URL (Optional)</Label>
            <Input
              value={signDocUrl}
              onChange={e => setSignDocUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSignOpen(false)}>Cancel</Button>
            <Button className="bg-purple-600 hover:bg-purple-700 text-white"
              onClick={() => signMutation.mutate({ id: Number(id), data: { document_url: signDocUrl || null } })}>
              Confirm Signed
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
