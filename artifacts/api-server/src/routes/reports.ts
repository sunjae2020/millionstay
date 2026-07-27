import { Router, type IRouter } from "express";
import { DEFAULT_CURRENCY } from "../lib/currency";
import { db, bookingsTable, contactsTable, accountsTable, spacesTable } from "@workspace/db";
import { eq, and, SQL, inArray } from "drizzle-orm";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/v1/reports/bookings", async (req, res): Promise<void> => {
  try {
    const { from, to, status } = req.query as Record<string, string>;

    const conditions: SQL[] = [eq(bookingsTable.status, "Active")];
    if (from) conditions.push(sql`${bookingsTable.check_in_date} >= ${from}::date`);
    if (to) conditions.push(sql`${bookingsTable.check_in_date} <= ${to}::date`);
    if (status) conditions.push(eq(bookingsTable.booking_status, status));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db
      .select({
        id: bookingsTable.id,
        booking_ref: bookingsTable.booking_ref,
        check_in_date: bookingsTable.check_in_date,
        check_out_date: bookingsTable.check_out_date,
        agreed_weekly_rate: bookingsTable.agreed_weekly_rate,
        booking_status: bookingsTable.booking_status,
        booking_source: bookingsTable.booking_source,
        contact_id: bookingsTable.contact_id,
        account_id: bookingsTable.account_id,
        space_id: bookingsTable.space_id,
        stay_weeks: bookingsTable.stay_weeks,
        total_rent: bookingsTable.total_rent,
      })
      .from(bookingsTable)
      .where(where)
      .orderBy(sql`${bookingsTable.created_at} DESC`)
      .limit(500);

    const contactIds = [...new Set(rows.map(r => r.contact_id).filter(Boolean))] as number[];
    const accountIds = [...new Set(rows.map(r => r.account_id).filter(Boolean))] as number[];
    const spaceIds = [...new Set(rows.map(r => r.space_id).filter(Boolean))] as number[];

    const [contacts, accounts, spaces] = await Promise.all([
      contactIds.length ? db.select({ id: contactsTable.id, first_name: contactsTable.first_name, last_name: contactsTable.last_name }).from(contactsTable).where(inArray(contactsTable.id, contactIds)) : [],
      accountIds.length ? db.select({ id: accountsTable.id, name: accountsTable.name }).from(accountsTable).where(inArray(accountsTable.id, accountIds)) : [],
      spaceIds.length ? db.select({ id: spacesTable.id, name: spacesTable.name }).from(spacesTable).where(inArray(spacesTable.id, spaceIds)) : [],
    ]);

    const contactMap: Record<number, string> = Object.fromEntries(
      contacts.map((c: any) => [c.id, `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim()])
    );
    const accountMap: Record<number, string> = Object.fromEntries(accounts.map((a: any) => [a.id, a.name]));
    const spaceMap: Record<number, string> = Object.fromEntries(spaces.map((s: any) => [s.id, s.name]));

    const data = rows.map(r => {
      const checkin = r.check_in_date ? r.check_in_date : null;
      const checkout = r.check_out_date ? r.check_out_date : null;
      const weeks = r.stay_weeks ? Number(r.stay_weeks) : null;
      const totalRent = r.total_rent ? Number(r.total_rent) : (
        r.agreed_weekly_rate && weeks ? Math.round(Number(r.agreed_weekly_rate) * weeks * 100) / 100 : 0
      );
      const guest_name = r.contact_id
        ? contactMap[r.contact_id] || "—"
        : r.account_id ? accountMap[r.account_id] || "—" : "—";
      return {
        id: r.id,
        booking_ref: r.booking_ref,
        guest_name,
        space_name: r.space_id ? spaceMap[r.space_id] ?? "—" : "—",
        check_in_date: checkin,
        check_out_date: checkout,
        weeks,
        agreed_weekly_rate: r.agreed_weekly_rate,
        total_rent: totalRent,
        booking_status: r.booking_status,
        booking_source: r.booking_source,
      };
    });

    const totalRevenue = data.reduce((sum, r) => sum + (r.total_rent ?? 0), 0);

    res.json({
      success: true,
      data,
      meta: {
        total: data.length,
        total_revenue: Math.round(totalRevenue * 100) / 100,
        currency: DEFAULT_CURRENCY,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to generate booking report" });
  }
});

export default router;
