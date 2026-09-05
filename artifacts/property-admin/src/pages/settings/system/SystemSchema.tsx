import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { apiJson } from "@/lib/apiFetch";
import { Loader2, Search, KeyRound, ArrowUpRight, ArrowDownLeft, Table2 } from "lucide-react";
import { Card } from "./ui";

type TableInfo = { name: string; columnCount: number };
type Column = {
  name: string;
  type: string;
  nullable: boolean;
  isPrimaryKey: boolean;
  references: { table: string; column: string } | null;
};
type TableDetail = {
  schema: string;
  table: string;
  columns: Column[];
  referencedBy: { table: string; column: string }[];
};

export default function SystemSchema({ schemas }: { schemas: string[] }) {
  const { t } = useTranslation();
  const [schema, setSchema] = useState("public");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const { data: list, isLoading } = useQuery<{ schema: string; tables: TableInfo[] }>({
    queryKey: ["system-map-schema-tables", schema],
    queryFn: () => apiJson(`/api/v1/admin/system-map/schema?schema=${encodeURIComponent(schema)}`),
  });

  const { data: detail, isFetching: detailLoading } = useQuery<TableDetail>({
    queryKey: ["system-map-schema-table", schema, selected],
    queryFn: () =>
      apiJson(
        `/api/v1/admin/system-map/schema?schema=${encodeURIComponent(schema)}&table=${encodeURIComponent(selected!)}`,
      ),
    enabled: !!selected,
  });

  const tables = (list?.tables ?? []).filter((t) => t.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4">
      {schemas.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mr-1">{t("system_map.schema_label")}</span>
          {schemas.map((s) => (
            <button
              key={s}
              onClick={() => { setSchema(s); setSelected(null); }}
              className={`text-[12px] px-2.5 py-1 rounded-lg border transition-colors font-mono ${
                schema === s ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground hover:border-primary/40"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4">
        {/* Table list */}
        <Card className="p-3 h-fit">
          <div className="relative mb-2">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("system_map.schema_filter")}
              className="w-full pl-8 pr-2 py-1.5 text-[13px] rounded-lg border bg-background focus:outline-none focus:border-primary"
            />
          </div>
          <p className="text-[11px] text-muted-foreground mb-1.5 px-1">{t("system_map.schema_n_tables", { n: tables.length })}</p>
          <div className="max-h-[560px] overflow-y-auto space-y-0.5">
            {isLoading && (
              <div className="flex justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-primary" /></div>
            )}
            {tables.map((t) => (
              <button
                key={t.name}
                onClick={() => setSelected(t.name)}
                className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-left transition-colors ${
                  selected === t.name ? "bg-primary/10" : "hover:bg-accent/40"
                }`}
              >
                <span className={`text-[12.5px] font-mono truncate ${selected === t.name ? "text-primary" : "text-foreground"}`}>{t.name}</span>
                <span className="text-[11px] text-muted-foreground shrink-0">{t.columnCount}</span>
              </button>
            ))}
          </div>
        </Card>

        {/* Detail */}
        <div>
          {!selected && (
            <Card className="p-10 flex flex-col items-center justify-center text-center h-full">
              <Table2 className="h-7 w-7 text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">{t("system_map.schema_select_prompt")}</p>
            </Card>
          )}
          {selected && detailLoading && !detail && (
            <div className="flex items-center justify-center h-40"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          )}
          {selected && detail && (
            <div className="space-y-4">
              <Card className="overflow-hidden">
                <div className="px-4 py-3 border-b bg-muted/50 flex items-center justify-between">
                  <p className="font-mono font-bold text-foreground text-[13px]">{schema}.{detail.table}</p>
                  <p className="text-[11px] text-muted-foreground">{t("system_map.schema_n_columns", { n: detail.columns.length })}</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-sm">
                    <thead>
                      <tr className="text-[11px] uppercase tracking-wide text-muted-foreground border-b">
                        <th className="text-left font-semibold px-4 py-2">{t("system_map.schema_col_column")}</th>
                        <th className="text-left font-semibold px-3 py-2 w-[160px]">{t("system_map.schema_col_type")}</th>
                        <th className="text-left font-semibold px-3 py-2 w-[90px]">{t("system_map.schema_col_null")}</th>
                        <th className="text-left font-semibold px-4 py-2 w-[200px]">{t("system_map.schema_col_refs")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.columns.map((c) => (
                        <tr key={c.name} className="border-b last:border-0">
                          <td className="px-4 py-2 font-mono text-[12.5px] text-foreground">
                            <span className="inline-flex items-center gap-1.5">
                              {c.isPrimaryKey && <KeyRound className="h-3 w-3 text-amber-600" />}
                              {c.name}
                            </span>
                          </td>
                          <td className="px-3 py-2 font-mono text-[12px] text-muted-foreground">{c.type}</td>
                          <td className="px-3 py-2 text-[12px] text-muted-foreground">{c.nullable ? "null" : "not null"}</td>
                          <td className="px-4 py-2 font-mono text-[12px]">
                            {c.references ? (
                              <span className="inline-flex items-center gap-1 text-sky-600">
                                <ArrowUpRight className="h-3 w-3" />
                                {c.references.table}.{c.references.column}
                              </span>
                            ) : (
                              <span className="text-muted-foreground/40">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              <Card className="p-4">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <ArrowDownLeft className="h-3 w-3" /> {t("system_map.schema_referenced_by", { n: detail.referencedBy.length })}
                </p>
                {detail.referencedBy.length === 0 ? (
                  <p className="text-[12.5px] text-muted-foreground">{t("system_map.schema_no_inbound")}</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {detail.referencedBy.map((r, i) => (
                      <button
                        key={i}
                        onClick={() => setSelected(r.table)}
                        className="text-[12px] font-mono px-2 py-1 rounded-lg border bg-muted/40 hover:border-primary/40 transition-colors"
                      >
                        {r.table}.{r.column}
                      </button>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
