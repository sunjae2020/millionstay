/**
 * "Countable unit" scope for dashboard tiles and reports.
 *
 * Some tenants model unit *types* as spaces so real units hang off them via
 * `parent_space_id` — e.g. Metheim 여수 has 8 type rows (A타입 … E-1타입) parenting
 * 269 real units. Those parent rows are containers, not lettable units, so counting
 * them inflates every unit metric (269 → 277). They stay visible and editable in the
 * Spaces list; dashboards and reports must use `unitSpaces()` instead of the raw list.
 *
 * A space is a *type container* iff another space in the list points at it as its
 * parent AND names it as its unit type (`custom_type_name === parent.name`). The type
 * check matters: MillionStay's own data also uses `parent_space_id`, but there the
 * parent is an "Entire Apartment" that is itself lettable, so it must keep counting.
 * Derived client-side from the list payload — no extra request, no API change.
 */

interface SpaceLike {
  id: number;
  name?: string | null;
  parent_space_id?: number | null;
  parent_space_name?: string | null;
  custom_type_name?: string | null;
}

/** Ids of spaces that act as a type container for other spaces in the list. */
export function containerSpaceIds<T extends SpaceLike>(spaces: T[] | undefined): Set<number> {
  const list = spaces ?? [];
  const nameById = new Map(list.map((s) => [s.id, s.name ?? null]));
  const ids = new Set<number>();
  for (const s of list) {
    const parentId = s.parent_space_id;
    if (parentId == null || !s.custom_type_name) continue;
    const parentName = nameById.get(parentId) ?? s.parent_space_name ?? null;
    if (parentName && parentName === s.custom_type_name) ids.add(parentId);
  }
  return ids;
}

/** The list with type containers removed — the real, lettable units. */
export function unitSpaces<T extends SpaceLike>(spaces: T[] | undefined): T[] {
  const containers = containerSpaceIds(spaces);
  return (spaces ?? []).filter((s) => !containers.has(s.id));
}
