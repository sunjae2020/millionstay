// Resolve the API base URL.
//
// Dev: VITE_API_URL points at the local API server (e.g. http://localhost:8080).
// Prod: when running under millionstay.com we hit the production Railway
//       host directly. We do NOT use VITE_API_URL here because some prod
//       builds were pinned to api.millionstay.com which is not registered
//       as a Railway custom domain (SSL mismatch + 404).
const PROD_API = "https://workspaceapi-server-production-ff8e.up.railway.app";

export function getApiBase(): string {
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host.endsWith("millionstay.com")) return PROD_API;
  }
  return (import.meta.env.VITE_API_URL ?? "").trim();
}
