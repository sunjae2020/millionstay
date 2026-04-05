import { useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useForm, Controller } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetWorkOrder,
  useCreateWorkOrder,
  useUpdateWorkOrder,
  useDeleteWorkOrder,
  useStartWorkOrder,
  useReviewWorkOrder,
  useCompleteWorkOrder,
  useCancelWorkOrder,
  getGetWorkOrderQueryKey,
  getListWorkOrdersQueryKey,
} from "@workspace/api-client-react";
import { Layout } from "@/components/Layout";
import { LookupSelect } from "@/components/LookupSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Trash2, Save } from "lucide-react";

const statusColors: Record<string, string> = {
  Open: "bg-blue-100 text-blue-700",
  InProgress: "bg-yellow-100 text-yellow-700",
  PendingReview: "bg-purple-100 text-purple-700",
  Completed: "bg-green-100 text-green-700",
  Cancelled: "bg-gray-100 text-gray-600",
};

interface FormData {
  property_id: number | null;
  space_id: number | null;
  title: string;
  description: string;
  priority: string;
  category: string;
  assigned_contact_id: number | null;
  reported_at: string;
  scheduled_at: string;
  cost: string;
  notes: string;
}

export default function WorkOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const isNew = id === "new";

  const { data: wo, refetch } = useGetWorkOrder(Number(id), {
    query: { enabled: !isNew },
  });

  const { register, handleSubmit, reset, control } = useForm<FormData>({
    defaultValues: {
      property_id: null, space_id: null, title: "", description: "",
      priority: "Normal", category: "", assigned_contact_id: null,
      reported_at: "", scheduled_at: "", cost: "", notes: "",
    },
  });

  useEffect(() => {
    if (wo) {
      reset({
        property_id: wo.property_id ?? null,
        space_id: wo.space_id ?? null,
        title: wo.title ?? "",
        description: wo.description ?? "",
        priority: wo.priority ?? "Normal",
        category: wo.category ?? "",
        assigned_contact_id: wo.assigned_contact_id ?? null,
        reported_at: wo.reported_at ?? "",
        scheduled_at: wo.scheduled_at ?? "",
        cost: wo.cost != null ? String(wo.cost) : "",
        notes: wo.notes ?? "",
      });
    }
  }, [wo, reset]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getListWorkOrdersQueryKey() });
    if (!isNew) qc.invalidateQueries({ queryKey: getGetWorkOrderQueryKey(Number(id)) });
  };

  const createMutation = useCreateWorkOrder({ mutation: { onSuccess: (d) => { invalidate(); navigate(`/maintenance/work-orders/${d.id}`); } } });
  const updateMutation = useUpdateWorkOrder({ mutation: { onSuccess: () => { invalidate(); refetch(); } } });
  const startMutation = useStartWorkOrder({ mutation: { onSuccess: () => { invalidate(); refetch(); } } });
  const reviewMutation = useReviewWorkOrder({ mutation: { onSuccess: () => { invalidate(); refetch(); } } });
  const completeMutation = useCompleteWorkOrder({ mutation: { onSuccess: () => { invalidate(); refetch(); } } });
  const cancelMutation = useCancelWorkOrder({ mutation: { onSuccess: () => { invalidate(); refetch(); } } });
  const deleteMutation = useDeleteWorkOrder({ mutation: { onSuccess: () => { invalidate(); navigate("/maintenance/work-orders"); } } });

  const buildPayload = (data: FormData) => ({
    property_id: data.property_id ?? null,
    space_id: data.space_id ?? null,
    title: data.title,
    description: data.description || null,
    priority: data.priority || "Normal",
    category: data.category || null,
    assigned_contact_id: data.assigned_contact_id ?? null,
    reported_at: data.reported_at || null,
    scheduled_at: data.scheduled_at || null,
    cost: data.cost ? Number(data.cost) : null,
    notes: data.notes || null,
  });

  const onSubmit = (data: FormData) => {
    if (isNew) createMutation.mutate({ data: buildPayload(data) });
    else updateMutation.mutate({ id: Number(id), data: buildPayload(data) });
  };

  const status = wo?.status ?? "Open";

  const statusLabel = (s: string) => {
    if (s === "InProgress") return "In Progress";
    if (s === "PendingReview") return "Pending Review";
    return s;
  };

  return (
    <Layout>
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {isNew ? "New Work Order" : wo?.order_ref ?? "Work Order"}
            </h1>
            {!isNew && wo && <p className="text-sm text-muted-foreground">{wo.title}</p>}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/maintenance/work-orders")}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Button>
            {!isNew && (
              <Button variant="destructive" onClick={() => deleteMutation.mutate({ id: Number(id) })}>
                <Trash2 className="h-4 w-4 mr-1" /> Delete
              </Button>
            )}
            <Button onClick={handleSubmit(onSubmit)}>
              <Save className="h-4 w-4 mr-1" /> Save
            </Button>
          </div>
        </div>

        {/* FSM Actions */}
        {!isNew && (
          <div className="border rounded-lg bg-white p-4 mb-4 flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">Status:</span>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[status] ?? "bg-gray-100 text-gray-600"}`}>
                {statusLabel(status)}
              </span>
            </div>
            <div className="flex gap-2 ml-auto">
              {status === "Open" && (
                <Button variant="default" onClick={() => startMutation.mutate({ id: Number(id) })}>
                  Start Work
                </Button>
              )}
              {status === "InProgress" && (
                <Button variant="default" className="bg-purple-600 hover:bg-purple-700" onClick={() => reviewMutation.mutate({ id: Number(id) })}>
                  Submit for Review
                </Button>
              )}
              {status === "PendingReview" && (
                <Button variant="default" className="bg-green-600 hover:bg-green-700" onClick={() => completeMutation.mutate({ id: Number(id), data: {} })}>
                  Mark Complete
                </Button>
              )}
              {(status === "Open" || status === "InProgress") && (
                <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => cancelMutation.mutate({ id: Number(id), data: {} })}>
                  Cancel
                </Button>
              )}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Details */}
          <div className="border rounded-lg bg-white p-6">
            <h2 className="text-sm font-semibold uppercase text-blue-600 tracking-wide mb-4">Work Order Details</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Title *</Label>
                <Input placeholder="Describe the work required..." {...register("title")} />
              </div>
              <div>
                <Label>Priority</Label>
                <Controller name="priority" control={control} render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Low">Low</SelectItem>
                      <SelectItem value="Normal">Normal</SelectItem>
                      <SelectItem value="High">High</SelectItem>
                      <SelectItem value="Urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                )} />
              </div>
              <div>
                <Label>Category</Label>
                <Controller name="category" control={control} render={({ field }) => (
                  <Select value={field.value || "_none"} onValueChange={(v) => field.onChange(v === "_none" ? "" : v)}>
                    <SelectTrigger><SelectValue placeholder="Select category..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">— No category —</SelectItem>
                      <SelectItem value="Plumbing">Plumbing</SelectItem>
                      <SelectItem value="Electrical">Electrical</SelectItem>
                      <SelectItem value="HVAC">HVAC</SelectItem>
                      <SelectItem value="Cleaning">Cleaning</SelectItem>
                      <SelectItem value="Painting">Painting</SelectItem>
                      <SelectItem value="Carpentry">Carpentry</SelectItem>
                      <SelectItem value="Pest Control">Pest Control</SelectItem>
                      <SelectItem value="Landscaping">Landscaping</SelectItem>
                      <SelectItem value="Security">Security</SelectItem>
                      <SelectItem value="General">General</SelectItem>
                    </SelectContent>
                  </Select>
                )} />
              </div>
              <div className="col-span-2">
                <Label>Description</Label>
                <Textarea rows={3} placeholder="Detailed description of the issue..." {...register("description")} />
              </div>
            </div>
          </div>

          {/* Location */}
          <div className="border rounded-lg bg-white p-6">
            <h2 className="text-sm font-semibold uppercase text-blue-600 tracking-wide mb-4">Location</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Property</Label>
                <Controller name="property_id" control={control} render={({ field }) => (
                  <LookupSelect
                    lookupUrl="/api/v1/lookup/properties"
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Search properties..."
                    displayValue={(wo as any)?.property_name ?? null}
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
                    displayValue={(wo as any)?.space_name ?? null}
                  />
                )} />
              </div>
            </div>
          </div>

          {/* Schedule */}
          <div className="border rounded-lg bg-white p-6">
            <h2 className="text-sm font-semibold uppercase text-blue-600 tracking-wide mb-4">Schedule & Assignment</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Reported Date</Label>
                <Input type="date" {...register("reported_at")} />
              </div>
              <div>
                <Label>Scheduled Date</Label>
                <Input type="date" {...register("scheduled_at")} />
              </div>
              <div>
                <Label>Assigned To</Label>
                <Controller name="assigned_contact_id" control={control} render={({ field }) => (
                  <LookupSelect
                    lookupUrl="/api/v1/lookup/contacts"
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Search contacts..."
                    displayValue={(wo as any)?.assigned_contact_name ?? null}
                  />
                )} />
              </div>
              <div>
                <Label>Estimated Cost (AUD)</Label>
                <Input type="number" step="0.01" placeholder="0.00" {...register("cost")} />
              </div>
            </div>
          </div>

          {/* Completion info (read-only) */}
          {wo?.completed_at && (
            <div className="border rounded-lg bg-green-50 p-6">
              <h2 className="text-sm font-semibold uppercase text-green-600 tracking-wide mb-2">Completed</h2>
              <p className="text-sm text-green-700">
                Completed on {new Date(wo.completed_at).toLocaleDateString()}
                {wo.cost != null && ` — Final cost: $${wo.cost.toFixed(2)} AUD`}
              </p>
            </div>
          )}

          {/* Notes */}
          <div className="border rounded-lg bg-white p-6">
            <h2 className="text-sm font-semibold uppercase text-blue-600 tracking-wide mb-4">Notes</h2>
            <Textarea rows={3} placeholder="Internal notes..." {...register("notes")} />
          </div>
        </form>
      </div>
    </Layout>
  );
}
