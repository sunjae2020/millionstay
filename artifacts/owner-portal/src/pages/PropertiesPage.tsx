import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { Layout } from "@/components/Layout";
import { apiGet } from "@/lib/api";
import { MapPin, Home, ChevronRight } from "lucide-react";

interface Space {
  id: number;
  name: string;
  space_type: string;
  status: string;
  property_id: number;
}

interface Property {
  id: number;
  name: string;
  address: string;
  city: string;
  state: string;
  postcode: string;
  approval_status: string;
  spaces: Space[];
}

export default function PropertiesPage() {
  const { t } = useTranslation();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    apiGet<{ success: boolean; data: Property[] }>("/v1/owner/properties")
      .then((d) => setProperties(d.data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const SPACE_STATUS_CLS: Record<string, string> = {
    Available: "bg-green-100 text-green-700",
    Occupied: "bg-blue-100 text-blue-700",
    Maintenance: "bg-yellow-100 text-yellow-700",
    Inactive: "bg-gray-100 text-gray-600",
    available: "bg-green-100 text-green-700",
    occupied: "bg-blue-100 text-blue-700",
  };

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">{t("properties.title")}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t("properties.subtitle")}</p>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive text-sm px-4 py-3 rounded-lg border border-destructive/20 mb-4">
          {error}
        </div>
      )}

      {loading && (
        <div className="space-y-4">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="bg-card border border-card-border rounded-xl p-6 animate-pulse h-48" />
          ))}
        </div>
      )}

      <div className="space-y-6">
        {properties.map((property) => (
          <div key={property.id} className="bg-card border border-card-border rounded-xl overflow-hidden">
            <Link href={`/properties/${property.id}`}>
              <a className="block p-6 border-b border-border hover:bg-muted/30 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center mt-0.5">
                      <Home className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground text-lg">{property.name}</h3>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground mt-0.5">
                        <MapPin className="w-3 h-3" />
                        {property.address}, {property.city}, {property.state} {property.postcode}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-xs font-medium px-3 py-1 rounded-full ${property.approval_status === "Approved" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                      {t(`status.${property.approval_status}`, property.approval_status)}
                    </span>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </div>
              </a>
            </Link>

            <div className="p-6">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-4">
                {t("properties.spaces_count", { count: property.spaces.length })}
              </p>
              {property.spaces.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("properties.no_spaces")}</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {property.spaces.map((space) => (
                    <div key={space.id} className="border border-border rounded-lg p-3 bg-muted/20">
                      <p className="font-medium text-foreground text-sm truncate">{space.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{space.space_type}</p>
                      <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full mt-2 ${SPACE_STATUS_CLS[space.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {t(`status.${space.status}`, space.status)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {!loading && properties.length === 0 && (
          <div className="text-center text-muted-foreground py-12">
            {t("properties.no_properties_account")}
          </div>
        )}
      </div>
    </Layout>
  );
}
