import { sql, or, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { phoneDigits } from "./nameFormat";

/**
 * A person may sign in with EITHER their email address or their mobile number —
 * both are valid personal IDs across every portal (guest, agent, owner, service
 * host). Korean tenants imported from the lease ledger frequently have no email
 * at all, so phone is not a convenience alias, it is the only ID they have.
 *
 * Stored numbers are not normalised (01052525232, 010-5252-5232, +82 10 5252
 * 5232 all occur), so the phone branch compares digits-only on both sides and
 * treats a +82 prefix as equivalent to a leading 0.
 */

export type LoginIdentifier =
  | { kind: "email"; email: string }
  | { kind: "phone"; digits: string }
  | { kind: "invalid" };

export function parseLoginIdentifier(raw: string | null | undefined): LoginIdentifier {
  const v = (raw ?? "").trim();
  if (!v) return { kind: "invalid" };
  if (v.includes("@")) return { kind: "email", email: v.toLowerCase() };
  const digits = phoneDigits(v);
  // Shortest real KR/AU subscriber number is 9 digits; anything less is a typo,
  // and matching on it would scan far too many rows.
  if (digits.length >= 9) return { kind: "phone", digits };
  return { kind: "invalid" };
}

/**
 * SQL predicate matching `column` against a digits-only phone number, ignoring
 * whatever separators the stored value happens to use. `01052525232` also
 * matches a stored `+82 10 5252 5232`.
 */
export function phoneMatches(column: AnyPgColumn, digits: string): SQL {
  const normalised = sql`regexp_replace(coalesce(${column}, ''), '[^0-9]', '', 'g')`;
  const variants = [digits];
  if (digits.startsWith("0")) variants.push(`82${digits.slice(1)}`);
  else if (digits.startsWith("82")) variants.push(`0${digits.slice(2)}`);
  return or(...variants.map((v) => sql`${normalised} = ${v}`))!;
}

/**
 * Predicate for "this row belongs to the person who typed `raw` at the login
 * prompt" — email match or phone match, whichever the input looks like.
 * Returns null when the input is neither, so the caller can 400 out.
 */
export function loginIdentityFilter(
  raw: string | null | undefined,
  emailColumn: AnyPgColumn,
  phoneColumn: AnyPgColumn,
): { filter: SQL; id: LoginIdentifier } | null {
  const id = parseLoginIdentifier(raw);
  if (id.kind === "email") return { filter: sql`lower(${emailColumn}) = ${id.email}`, id };
  if (id.kind === "phone") return { filter: phoneMatches(phoneColumn, id.digits), id };
  return null;
}

/**
 * Key the login-lockout counter is recorded under. Normalising here keeps
 * "010-5252-5232" and "01052525232" from getting a fresh attempt budget each.
 */
export function lockoutKey(id: LoginIdentifier, fallback: string): string {
  if (id.kind === "email") return id.email;
  if (id.kind === "phone") return id.digits;
  return (fallback || "").toLowerCase().trim();
}
