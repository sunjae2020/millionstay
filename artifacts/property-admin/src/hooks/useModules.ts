import { useQuery } from "@tanstack/react-query";
import { apiFetch, getStoredToken } from "@/lib/apiFetch";

/**
 * Per-tenant module toggles, read from the integration-status endpoint.
 *
 * Toggles live in the `integration_settings` KV table (one per tenant DB) and
 * are edited from Settings → Integrations. Values default to ENABLED when the
 * row was never saved, so tenants that carry the feature (e.g. MillionStay's
 * homestay intake) are unaffected — only a tenant that explicitly disables a
 * module (e.g. Metheim) hides it.
 *
 * Shares the `integration-status` query key with the Integrations/AI settings
 * pages, so the payload is fetched once and cached.
 */
export function useModules(): { homestayEnabled: boolean } {
  const { data } = useQuery({
    queryKey: ["integration-status"],
    queryFn: () => apiFetch(`/api/v1/integrations/status?t=${Date.now()}`).then((r) => r.json()),
    // Only fetch once authenticated — Router mounts this even on /login.
    enabled: !!getStoredToken(),
  });
  const homestayEnabled = data?.data?.modules?.homestay_enabled ?? true;
  return { homestayEnabled };
}
