import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { LookupSelect } from "@/components/LookupSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Trash2, Save, Plus, FileDown, Eye, Mail } from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";
import { useToast } from "@/hooks/use-toast";

interface LineItem { name: string; quantity: number; unit_price: number; }

const statusColors: Record<string, string> = {
  Draft: "bg-gray-100 text-gray-600",
  Sent: "bg-blue-100 text-blue-700",
  Accepted: "bg-green-100 text-green-700",
  Declined: "bg-red-100 text-red-600",
  Expired: "bg-amber-100 text-amber-700",
};

export default function QuoteDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const isNew = id === "new";

  const [accountId, setAccountId] = useState<number | null>(null);
  const [leadId, setLeadId] = useState<number | null>(null);
  const [spaceId, setSpaceId] = useState<number | null>(null);
  const [currency, setCurrency] = useState("AUD");
  const [validUntil, setValidUntil] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<LineItem[]>([{ name: "", quantity: 1, unit_price: 0 }]);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: quote, refetch } = useQuery({
    queryKey: ["quote", id],
    queryFn: async () => (await apiFetch(`/api/v1/quotes/${id}`)).json(),
    enabled: !isNew,
  });
  const { data: lineItems } = useQuery({
    queryKey: ["quote-lines", id],
    queryFn: async () => (await apiFetch(`/api/v1/quotes/${id}/line-items`)).json(),
    enabled: !isNew,
  });

  useEffect(() => {
    if (quote) {
      setAccountId(quote.account_id ?? null);
      setLeadId(quote.lead_id ?? null);
      setSpaceId(quote.space_id ?? null);
      setCurrency(quote.currency ?? "AUD");
      setValidUntil(quote.valid_until ?? "");
      setDescription(quote.description ?? "");
      setNotes(quote.notes ?? "");
    }
  }, [quote]);

  useEffect(() => {
    if (Array.isArray(lineItems) && lineItems.length) {
      setItems(lineItems.map((li: any) => ({ name: li.name, quantity: li.quantity, unit_price: Number(li.unit_price) })));
    }
  }, [lineItems]);

  const total = items.reduce((sum, i) => sum + (Number(i.unit_price) || 0) * (Number(i.quantity) || 0), 0);
  const status = quote?.status ?? "Draft";

  const updateItem = (idx: number, patch: Partial<LineItem>) =>
    setItems(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  const addItem = () => setItems([...items, { name: "", quantity: 1, unit_price: 0 }]);
  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["quotes"] });
    if (!isNew) { qc.invalidateQueries({ queryKey: ["quote", id] }); qc.invalidateQueries({ queryKey: ["quote-lines", id] }); }
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        account_id: accountId, lead_id: leadId, space_id: spaceId, currency,
        valid_until: validUntil || null, description: description || null, notes: notes || null,
        line_items: items.filter(i => i.name.trim()).map(i => ({
          name: i.name, quantity: Number(i.quantity) || 1, unit_price: Number(i.unit_price) || 0,
        })),
      };
      const res = await apiFetch(isNew ? "/api/v1/quotes" : `/api/v1/quotes/${id}`, {
        method: isNew ? "POST" : "PUT",
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) { const b = await res.json().catch(() => null); throw new Error(b?.error ?? `HTTP ${res.status}`); }
      const saved = await res.json();
      invalidate();
      toast({ title: "Saved", description: `Quote ${saved.quote_ref} saved.` });
      if (isNew) navigate(`/documents/quotes/${saved.id}`); else refetch();
    } catch (err) {
      toast({ title: "Save failed", description: err instanceof Error ? err.message : "Error", variant: "destructive" });
    } finally { setSaving(false); }
  };

  const transition = async (action: "send" | "accept" | "decline") => {
    try {
      const res = await apiFetch(`/api/v1/quotes/${id}/${action}`, { method: "POST" });
      if (!res.ok) { const b = await res.json().catch(() => null); throw new Error(b?.error ?? `HTTP ${res.status}`); }
      invalidate(); refetch();
    } catch (err) {
      toast({ title: "Action failed", description: err instanceof Error ? err.message : "Error", variant: "destructive" });
    }
  };

  const remove = async () => {
    const res = await apiFetch(`/api/v1/quotes/${id}`, { method: "DELETE" });
    if (res.ok) { invalidate(); navigate("/documents/quotes"); }
  };

  const handlePdf = async (mode: "download" | "preview") => {
    setPdfBusy(true);
    try {
      const path = mode === "preview" ? `/api/v1/quotes/${id}/pdf?format=html` : `/api/v1/quotes/${id}/pdf`;
      const res = await apiFetch(path);
      if (!res.ok) { const b = await res.json().catch(() => null); throw new Error(b?.error ?? `HTTP ${res.status}`); }
      const url = URL.createObjectURL(await res.blob());
      if (mode === "preview") window.open(url, "_blank", "noopener,noreferrer");
      else { const a = document.createElement("a"); a.href = url; a.download = `${quote?.quote_ref ?? "quote"}.pdf`; document.body.appendChild(a); a.click(); a.remove(); }
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      toast({ title: "PDF unavailable", description: err instanceof Error ? err.message : "Error", variant: "destructive" });
    } finally { setPdfBusy(false); }
  };

  const handleEmail = async () => {
    if (!window.confirm("Email this quote (PDF) to the recipient?")) return;
    setPdfBusy(true);
    try {
      const res = await apiFetch(`/api/v1/quotes/${id}/email`, { method: "POST" });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
      toast({ title: "Email sent", description: `Quote emailed to ${body?.to ?? "recipient"}.` });
      refetch();
    } catch (err) {
      toast({ title: "Email failed", description: err instanceof Error ? err.message : "Error", variant: "destructive" });
    } finally { setPdfBusy(false); }
  };

  return (
    <Layout>
      <div className="p-4 sm:p-6 max-w-4xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight font-mono">{isNew ? "New Quote" : quote?.quote_ref ?? "Quote"}</h1>
            {!isNew && <p className="text-sm text-muted-foreground">Quote #{id}</p>}
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={() => navigate("/documents/quotes")}><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
            {!isNew && (
              <>
                <Button variant="outline" disabled={pdfBusy} onClick={() => handlePdf("preview")}><Eye className="h-4 w-4 mr-1" /> Preview</Button>
                <Button variant="outline" disabled={pdfBusy} onClick={() => handlePdf("download")}><FileDown className="h-4 w-4 mr-1" /> PDF</Button>
                <Button variant="outline" disabled={pdfBusy} onClick={handleEmail}><Mail className="h-4 w-4 mr-1" /> Email</Button>
                <Button variant="destructive" onClick={remove}><Trash2 className="h-4 w-4 mr-1" /> Delete</Button>
              </>
            )}
            <Button disabled={saving} onClick={save}><Save className="h-4 w-4 mr-1" /> Save</Button>
          </div>
        </div>

        {!isNew && (
          <div className="border rounded-lg bg-white p-4 mb-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">Status:</span>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[status] ?? "bg-gray-100 text-gray-600"}`}>{status}</span>
            </div>
            <div className="flex gap-2 sm:ml-auto flex-wrap">
              {status === "Draft" && <Button onClick={() => transition("send")}>Send</Button>}
              {status === "Sent" && <Button className="bg-green-600 hover:bg-green-700" onClick={() => transition("accept")}>Mark Accepted</Button>}
              {status === "Sent" && <Button variant="outline" className="text-red-600 border-red-200" onClick={() => transition("decline")}>Decline</Button>}
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div className="border rounded-lg bg-white p-4 sm:p-6">
            <h2 className="text-sm font-semibold uppercase text-[#E8621A] tracking-wide mb-4">Recipient</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label>Account</Label>
                <LookupSelect lookupUrl="/api/v1/lookup/accounts" value={accountId} onChange={setAccountId}
                  placeholder="Search accounts…" displayValue={quote?.account_name ?? null} />
              </div>
              <div>
                <Label>Lead</Label>
                <LookupSelect lookupUrl="/api/v1/lookup/leads" value={leadId} onChange={setLeadId} placeholder="Search leads…" />
              </div>
              <div>
                <Label>Space</Label>
                <LookupSelect lookupUrl="/api/v1/lookup/spaces" value={spaceId} onChange={setSpaceId}
                  placeholder="Search spaces…" displayValue={quote?.space_name ?? null} />
              </div>
            </div>
          </div>

          <div className="border rounded-lg bg-white p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold uppercase text-[#E8621A] tracking-wide">Line Items</h2>
              <Button type="button" size="sm" variant="outline" onClick={addItem}><Plus className="h-3.5 w-3.5 mr-1" /> Add Item</Button>
            </div>
            <div className="space-y-2">
              <div className="hidden sm:grid grid-cols-12 gap-2 text-xs uppercase text-muted-foreground px-1">
                <div className="col-span-6">Description</div><div className="col-span-2 text-right">Qty</div>
                <div className="col-span-2 text-right">Unit Price</div><div className="col-span-2 text-right">Amount</div>
              </div>
              {items.map((it, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <Input className="col-span-12 sm:col-span-6" placeholder="Item description" value={it.name} onChange={(e) => updateItem(idx, { name: e.target.value })} />
                  <Input className="col-span-4 sm:col-span-2 text-right" type="number" min="1" value={it.quantity} onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) })} />
                  <Input className="col-span-5 sm:col-span-2 text-right" type="number" step="0.01" value={it.unit_price} onChange={(e) => updateItem(idx, { unit_price: Number(e.target.value) })} />
                  <div className="col-span-2 sm:col-span-1 text-right text-sm tabular-nums">{((Number(it.unit_price) || 0) * (Number(it.quantity) || 0)).toLocaleString("en-AU", { minimumFractionDigits: 2 })}</div>
                  <button className="col-span-1 text-red-500 hover:text-red-700" onClick={() => removeItem(idx)} title="Remove"><Trash2 className="h-4 w-4 mx-auto" /></button>
                </div>
              ))}
            </div>
            <div className="flex justify-end mt-4 pt-4 border-t">
              <div className="text-right">
                <span className="text-sm text-muted-foreground mr-3">Total</span>
                <span className="text-lg font-bold">{total.toLocaleString("en-AU", { minimumFractionDigits: 2 })} {currency}</span>
              </div>
            </div>
          </div>

          <div className="border rounded-lg bg-white p-4 sm:p-6">
            <h2 className="text-sm font-semibold uppercase text-[#E8621A] tracking-wide mb-4">Details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Currency</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AUD">AUD</SelectItem><SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="SGD">SGD</SelectItem><SelectItem value="NZD">NZD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Valid Until</Label>
                <DateInput value={validUntil} onChange={setValidUntil} />
              </div>
              <div className="sm:col-span-2">
                <Label>Description</Label>
                <Input placeholder="Quote summary…" value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <Label>Notes</Label>
                <Textarea rows={3} placeholder="Notes shown on the quote…" value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
