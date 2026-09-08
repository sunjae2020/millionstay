import { asc, eq } from "drizzle-orm";
import { db, cmsSitesTable } from "@workspace/db";
import { auditAndPersist, loadSiteMeta, resolveAllEntities } from "./service.js";

/**
 * Nightly SEO / GEO audit of every active site.
 *
 * Audit-only, deliberately: it never asks for AI drafts and never applies one.
 * A scheduled job that spent money on a model every night, or that quietly
 * rewrote published copy, would be a bad thing to discover after the fact. The
 * job's whole output is a new score row per entity, which is what makes the
 * drift column meaningful the next morning.
 */
export async function runSeoGeoAudit(): Promise<{
  sites: number;
  audited: number;
  failures: number;
}> {
  const sites = await db
    .select({ site_key: cmsSitesTable.site_key })
    .from(cmsSitesTable)
    .where(eq(cmsSitesTable.is_active, true))
    .orderBy(asc(cmsSitesTable.sort_order));

  let audited = 0;
  let failures = 0;

  for (const row of sites) {
    try {
      const site = await loadSiteMeta(row.site_key);
      if (!site) continue;
      const entities = await resolveAllEntities(site);
      for (const entity of entities) {
        try {
          await auditAndPersist(site, entity, { source: "scheduled", auditedBy: null });
          audited += 1;
        } catch {
          // One entity failing must not end the site, let alone the run.
          failures += 1;
        }
      }
    } catch {
      failures += 1;
    }
  }

  return { sites: sites.length, audited, failures };
}
