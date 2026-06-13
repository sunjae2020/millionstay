import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { formatDateTime } from "@/lib/date";
import { useTranslation } from "react-i18next";
import { Layout, PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm, Controller } from "react-hook-form";
import {
  useGetTask, useCreateTask, useUpdateTask, useCompleteTask,
  getListTasksQueryKey, getGetTaskQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Save, CheckCircle2 } from "lucide-react";
import { Link } from "wouter";
import { LookupSelect } from "@/components/LookupSelect";
import { StatusBadge } from "@/components/StatusBadge";

interface TaskForm {
  name: string;
  subject: string;
  task_status: string;
  priority: string;
  task_category: string;
  primary_contact_id: number | null;
  secondary_contact_id: number | null;
  account_id: number | null;
  start_date: string;
  due_date: string;
  description: string;
  status: string;
}

export default function TaskDetail() {
  const { t } = useTranslation();
  const params = useParams<{ id: string }>();
  const isNew = params.id === "new";
  const id = isNew ? null : parseInt(params.id ?? "0", 10);
  const [, navigate] = useLocation();
  const qc = useQueryClient();

  const { data: task, isLoading } = useGetTask(
    id!, { query: { enabled: !isNew && !!id, queryKey: getGetTaskQueryKey(id!) } }
  );

  const { register, handleSubmit, reset, control, watch, formState: { errors } } = useForm<TaskForm>({
    defaultValues: {
      name: "", subject: "", task_status: "Todo", priority: "Medium",
      task_category: "", primary_contact_id: null, secondary_contact_id: null,
      account_id: null, start_date: "", due_date: "", description: "", status: "Active",
    },
  });

  useEffect(() => {
    if (task) {
      reset({
        name: task.name ?? "",
        subject: task.subject ?? "",
        task_status: task.task_status ?? "Todo",
        priority: task.priority ?? "Medium",
        task_category: task.task_category ?? "",
        primary_contact_id: task.primary_contact_id ?? null,
        secondary_contact_id: task.secondary_contact_id ?? null,
        account_id: task.account_id ?? null,
        start_date: task.start_date ?? "",
        due_date: task.due_date ?? "",
        description: task.description ?? "",
        status: task.status ?? "Active",
      });
    }
  }, [task, reset]);

  const createMutation = useCreateTask({
    mutation: {
      onSuccess: (data) => {
        qc.invalidateQueries({ queryKey: getListTasksQueryKey() });
        navigate(`/sales/tasks/${data.id}`);
      },
    },
  });

  const updateMutation = useUpdateTask({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListTasksQueryKey() });
        if (id) qc.invalidateQueries({ queryKey: getGetTaskQueryKey(id) });
      },
    },
  });

  const completeMutation = useCompleteTask({
    mutation: {
      onSuccess: () => {
        if (id) qc.invalidateQueries({ queryKey: getGetTaskQueryKey(id) });
        qc.invalidateQueries({ queryKey: getListTasksQueryKey() });
      },
    },
  });

  const onSubmit = (values: TaskForm) => {
    const data = {
      name: values.name,
      subject: values.subject || null,
      task_status: values.task_status,
      priority: values.priority,
      task_category: values.task_category || null,
      primary_contact_id: values.primary_contact_id ?? null,
      secondary_contact_id: values.secondary_contact_id ?? null,
      account_id: values.account_id ?? null,
      start_date: values.start_date || null,
      due_date: values.due_date || null,
      description: values.description || null,
      status: values.status,
    };
    if (isNew) {
      createMutation.mutate({ data });
    } else {
      updateMutation.mutate({ id: id!, data });
    }
  };

  const today = new Date().toISOString().split("T")[0]!;
  const dueDate = watch("due_date");
  const taskStatus = watch("task_status");
  const isOverdue = dueDate && dueDate < today && taskStatus !== "Done";

  if (!isNew && isLoading) return <Layout><p className="p-6 text-sm text-muted-foreground">Loading…</p></Layout>;

  return (
    <Layout>
      <PageHeader
        title={isNew ? `${t("common.new")} ${t("nav.task")}` : (task?.name ?? t("nav.task"))}
        actions={
          <div className="flex gap-2">
            <Link href="/sales/tasks">
              <Button variant="outline" size="sm" className="gap-1.5"><ArrowLeft className="h-4 w-4" /> {t("common.back")}</Button>
            </Link>
            {!isNew && task?.task_status !== "Done" && (
              <Button size="sm" variant="outline" className="gap-1.5 text-green-700 border-green-300 hover:bg-green-50"
                onClick={() => completeMutation.mutate({ id: id! })}
                disabled={completeMutation.isPending}>
                <CheckCircle2 className="h-4 w-4" /> {t("task.btn_complete")}
              </Button>
            )}
            <Button size="sm" className="gap-1.5" onClick={handleSubmit(onSubmit)}
              disabled={createMutation.isPending || updateMutation.isPending}>
              <Save className="h-4 w-4" /> {t("common.save")}
            </Button>
          </div>
        }
      />
      <div className="p-4 sm:p-6 max-w-2xl">
        <div className="grid gap-5">
          {/* General */}
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-orange-50 border-b px-4 py-2 text-xs font-semibold text-[#E8621A] uppercase tracking-wider">{t("task.section_general")}</div>
            <div className="p-4 grid gap-4">
              <div className="grid gap-1.5">
                <Label>{t("task.label_title")} *</Label>
                <Input {...register("name", { required: true })} placeholder="Task name" />
                {errors.name && <p className="text-xs text-destructive">Name is required</p>}
              </div>
              <div className="grid gap-1.5">
                <Label>Subject</Label>
                <Input {...register("subject")} placeholder="Brief description" />
              </div>
            </div>
          </div>

          {/* Main */}
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-orange-50 border-b px-4 py-2 text-xs font-semibold text-[#E8621A] uppercase tracking-wider">{t("task.section_details")}</div>
            <div className="p-4 grid gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="grid gap-1.5">
                  <Label>{t("task.label_status")}</Label>
                  <Controller name="task_status" control={control} render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Todo">{t("task.status_todo")}</SelectItem>
                        <SelectItem value="InProgress">{t("task.status_in_progress")}</SelectItem>
                        <SelectItem value="Done">{t("task.status_done")}</SelectItem>
                        <SelectItem value="Cancelled">{t("task.status_cancelled")}</SelectItem>
                      </SelectContent>
                    </Select>
                  )} />
                </div>
                <div className="grid gap-1.5">
                  <Label>{t("task.label_priority")}</Label>
                  <Controller name="priority" control={control} render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="High">{t("task.priority_high")}</SelectItem>
                        <SelectItem value="Medium">{t("task.priority_medium")}</SelectItem>
                        <SelectItem value="Low">{t("task.priority_low")}</SelectItem>
                      </SelectContent>
                    </Select>
                  )} />
                </div>
              </div>

              <div className="grid gap-1.5">
                <Label>{t("task.label_category")}</Label>
                <Controller name="task_category" control={control} render={({ field }) => (
                  <Select value={field.value || "__none"} onValueChange={(v) => field.onChange(v === "__none" ? "" : v)}>
                    <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">— None —</SelectItem>
                      <SelectItem value="CS">CS</SelectItem>
                      <SelectItem value="Maintenance">Maintenance</SelectItem>
                      <SelectItem value="Follow-up">Follow-up</SelectItem>
                      <SelectItem value="Admin">Admin</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                )} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="grid gap-1.5">
                  <Label>Start Date</Label>
                  <Controller name="start_date" control={control} render={({ field }) => (
                    <DateInput value={field.value ?? ""} onChange={field.onChange} />
                  )} />
                </div>
                <div className="grid gap-1.5">
                  <Label>
                    {t("task.label_due_date")}
                    {isOverdue && <span className="ml-2 text-xs text-red-600 font-medium">⚠ Overdue</span>}
                  </Label>
                  <Controller name="due_date" control={control} render={({ field }) => (
                    <DateInput value={field.value ?? ""} onChange={field.onChange}
                      className={isOverdue ? "border-red-400 focus-visible:ring-red-400" : ""} />
                  )} />
                </div>
              </div>
            </div>
          </div>

          {/* Links */}
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-orange-50 border-b px-4 py-2 text-xs font-semibold text-[#E8621A] uppercase tracking-wider">Links</div>
            <div className="p-4 grid gap-4">
              <div className="grid gap-1.5">
                <Label>{t("task.label_related_contact")}</Label>
                <Controller name="primary_contact_id" control={control} render={({ field }) => (
                  <LookupSelect
                    value={field.value}
                    onChange={field.onChange}
                    lookupUrl="/api/v1/lookup/contacts"
                    placeholder="Search contacts…"
                  />
                )} />
              </div>
              <div className="grid gap-1.5">
                <Label>{t("task.label_related_contact")} (Secondary)</Label>
                <Controller name="secondary_contact_id" control={control} render={({ field }) => (
                  <LookupSelect
                    value={field.value}
                    onChange={field.onChange}
                    lookupUrl="/api/v1/lookup/contacts"
                    placeholder="Search contacts…"
                  />
                )} />
              </div>
              <div className="grid gap-1.5">
                <Label>{t("account.account_type")}</Label>
                <Controller name="account_id" control={control} render={({ field }) => (
                  <LookupSelect
                    value={field.value}
                    onChange={field.onChange}
                    lookupUrl="/api/v1/lookup/accounts"
                    placeholder="Search accounts…"
                  />
                )} />
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-orange-50 border-b px-4 py-2 text-xs font-semibold text-[#E8621A] uppercase tracking-wider">{t("task.label_notes")}</div>
            <div className="p-4">
              <Textarea {...register("description")} placeholder="Task notes…" rows={4} />
            </div>
          </div>

          {/* Admin */}
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-orange-50 border-b px-4 py-2 text-xs font-semibold text-[#E8621A] uppercase tracking-wider">Admin</div>
            <div className="p-4 grid gap-4">
              <div className="grid gap-1.5">
                <Label>Record Status</Label>
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
              {!isNew && task && (
                <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                  <div><span className="font-medium text-foreground">Created:</span> {formatDateTime(task.created_at)}</div>
                  <div><span className="font-medium text-foreground">Updated:</span> {formatDateTime(task.updated_at)}</div>
                  {task.completed_at && (
                    <div><span className="font-medium text-foreground">Completed:</span> {formatDateTime(task.completed_at)}</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
