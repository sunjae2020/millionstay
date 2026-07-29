import { spacesTable } from "@workspace/db";
import { and, isNull, sql, type SQL } from "drizzle-orm";

/**
 * "Countable unit" scope for dashboards and reports.
 *
 * Some tenants model unit *types* as spaces so real units can hang off them via
 * `parent_space_id` — e.g. Metheim 여수 has 8 type rows (A타입 … E-1타입) parenting
 * 269 real units. Those parent rows are containers, not lettable units: they carry
 * no floor, no owner and no booking, so counting them inflates every unit metric
 * (269 → 277). They must stay visible and editable in the Spaces list, but never
 * show up in dashboard tiles, occupancy maths or reports.
 *
 * A space is a *type container* iff a live child points at it as its parent AND that
 * child names it as its unit type (`child.custom_type_name = parent.name`). The type
 * check matters: MillionStay's own data also uses `parent_space_id`, but there the
 * parent is an "Entire Apartment" that is itself lettable (rooms hang off it without
 * naming it as their type), so it must keep counting. No container → no-op.
 */

/** True for rows that other live spaces point at as their unit *type*. */
export const isContainerSpace: SQL = sql`exists (
  select 1 from spaces child
  where child.parent_space_id = ${spacesTable.id}
    and child.deleted_at is null
    and child.custom_type_name = ${spacesTable.name}
)`;

/** Live, lettable units only — excludes soft-deleted rows and type containers. */
export const countableUnitFilter: SQL = and(
  isNull(spacesTable.deleted_at),
  sql`not ${isContainerSpace}`,
)!;
