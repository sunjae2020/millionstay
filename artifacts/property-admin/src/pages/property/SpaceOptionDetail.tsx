import { useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { useTranslation } from "react-i18next";
import { Layout, PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ContentTranslationsPanel } from "@/components/ContentTranslationsPanel";
import { useForm, Controller } from "react-hook-form";
import {
  useGetSpaceOption,
  useCreateSpaceOption,
  useUpdateSpaceOption,
  getListSpaceOptionsQueryKey,
  getGetSpaceOptionQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Save } from "lucide-react";
import { Link } from "wouter";

interface OptionForm {
  name: string;
  display_name: string;
  category: string;
  status: string;
}

export default function SpaceOptionDetail() {
  const { t } = useTranslation();
  const params = useParams<{ id: string }>();
  const isNew = !params.id || params.id === "new";
  const id = isNew ? null : parseInt(params.id ?? "0", 10);
  const [, navigate] = useLocation();
  const qc = useQueryClient();

  const { data: option, isLoading } = useGetSpaceOption(
    id!,
    { query: { enabled: !isNew && !!id, queryKey: getGetSpaceOptionQueryKey(id!) } }
  );

  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<OptionForm>({
    defaultValues: { name: "", display_name: "", category: "", status: "Active" },
  });

  useEffect(() => {
    if (option) {
      reset({
        name: option.name ?? "",
        display_name: option.display_name ?? "",
        category: option.category ?? "",
        status: option.status ?? "Active",
      });
    }
  }, [option, reset]);

  const createMutation = useCreateSpaceOption({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListSpaceOptionsQueryKey() });
        navigate("/property/space-options");
      },
    },
  });

  const updateMutation = useUpdateSpaceOption({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListSpaceOptionsQueryKey() });
        if (id) qc.invalidateQueries({ queryKey: getGetSpaceOptionQueryKey(id) });
        navigate("/property/space-options");
      },
    },
  });

  function onSubmit(data: OptionForm) {
    const payload = {
      name: data.name,
      display_name: data.display_name || null,
      category: data.category || null,
      status: data.status,
    };
    if (isNew) {
      createMutation.mutate({ data: payload });
    } else if (id) {
      updateMutation.mutate({ id, data: payload });
    }
  }

  if (!isNew && isLoading) {
    return <Layout><PageHeader title={t("common.loading")} /><div className="p-6 text-sm text-muted-foreground">{t("common.loading")}</div></Layout>;
  }

  return (
    <Layout>
      <PageHeader
        title={isNew ? `${t("common.new")} ${t("nav.space_option")}` : (option?.name ?? t("nav.space_option"))}
        subtitle={isNew ? t("space_option.subtitle_new") : `ID: ${id}`}
        actions={
          <div className="flex items-center gap-2">
            <Link href="/property/space-options">
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
      <div className="p-4 sm:p-6">
        <div className="max-w-xl">
          <form className="bg-card rounded-lg border p-6 flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {t("space_option.label_name")} <span className="text-destructive">*</span>
              </Label>
              <Input
                {...register("name", { required: true })}
                placeholder={t("space_option.placeholder_name")}
                className={errors.name ? "border-destructive" : ""}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("space_option.label_display_name")}</Label>
              <Input {...register("display_name")} placeholder={t("space_option.placeholder_display_name")} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("space_option.label_category")}</Label>
              <Input {...register("category")} placeholder={t("space_option.placeholder_category")} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("space_option.label_status")}</Label>
              <Controller
                name="status"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Active">{t("common.active")}</SelectItem>
                      <SelectItem value="Inactive">{t("common.inactive")}</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </form>

          {!isNew && id && (
            <div className="mt-6">
              <ContentTranslationsPanel entity="space-options" id={id} sourceLang="ko" />
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
