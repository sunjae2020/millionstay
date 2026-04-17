import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Layout } from "@/components/Layout";
import { apiGet } from "@/lib/api";
import { MapPin, Home, Search } from "lucide-react";

interface Space {
  id: number;
  name: string;
  space_type: string;
  status: string;
  property_id: number;
  property: {
    id: number;
    name: string;
    address: string;
    city: string;
    state: string;
  } | null;
}

export default function PropertiesPage() {
  const { t } = useTranslation();
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    apiGet<{ success: boolean; data: Space[] }>("/v1/agent/properties")
      .then((d) => setSpaces(d.data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const propertyMap = new Map<number, { property: Space["property"]; spaces: Space[] }>();
  spaces.forEach((s) => {
    const pid = s.property_id;
    if (!propertyMap.has(pid)) {
      propertyMap.set(pid, { property: s.property, spaces: [] });
    }
    propertyMap.get(pid)!.spaces.push(s);
  });

  const groups = Array.from(propertyMap.values()).filter((g) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      g.property?.name?.toLowerCase().includes(q) ||
      g.property?.city?.toLowerCase().includes(q) ||
      g.property?.state?.toLowerCase().includes(q)
    );
  });

  const STATUS_CLS: Record<string, string> = {
    available: "bg-green-100 text-green-700",
    occupied: "bg-blue-100 text-blue-700",
    maintenance: "bg-yellow-100 text-yellow-700",
    inactive: "bg-gray-100 text-gray-600",
    Available: "bg-green-100 text-green-700",
    Occupied: "bg-blue-100 text-blue-700",
  };

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">{t("properties.title")}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t("properties.subtitle")}</p>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("properties.search_placeholder")}
          className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
        />
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive text-sm px-4 py-3 rounded-lg border border-destructive/20 mb-4">
          {error}
        </div>
      )}

      {loading && (
        <div className="space-y-4">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="bg-card border border-card-border rounded-xl p-6 animate-pulse h-40" />
          ))}
        </div>
      )}

      <div className="space-y-4">
        {groups.map(({ property, spaces: propSpaces }) => (
          <div key={property?.id ?? Math.random()} className="bg-card border border-card-border rounded-xl p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                <Home className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">{property?.name ?? t("properties.unknown_property")}</h3>
                <div className="flex items-center gap-1 text-sm text-muted-foreground mt-0.5">
                  <MapPin className="w-3 h-3" />
                  {property?.address}, {property?.city}, {property?.state}
                </div>
              </div>
            </div>

            <div className="border-t border-border pt-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
                {t("properties.your_spaces", { count: propSpaces.length })}
              </p>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {propSpaces.map((space) => (
                  <div key={space.id} className="bg-muted/50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-foreground truncate">{space.name}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-1">{space.space_type}</p>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_CLS[space.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {t(`status.${space.status}`, space.status)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}

        {!loading && groups.length === 0 && (
          <div className="text-center text-muted-foreground py-12">
            {t("properties.no_properties")}
          </div>
        )}
      </div>
    </Layout>
  );
}
