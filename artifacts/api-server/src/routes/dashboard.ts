import { Router, type IRouter } from "express";
import { db, propertiesTable, spacesTable, contactsTable, accountsTable, bookingsTable, leadsTable, tasksTable, invoicesTable, contractsTable } from "@workspace/db";
import { eq, count, and } from "drizzle-orm";

const router: IRouter = Router();

router.get("/v1/dashboard/stats", async (_req, res) => {
  try {
    const [
      [props],
      [spaces],
      [contacts],
      [accounts],
      [leads],
      [tasks],
      [invoices],
      [contracts],
      [bookings],
      [confirmedBookings],
      [pendingBookings],
    ] = await Promise.all([
      db.select({ count: count() }).from(propertiesTable),
      db.select({ count: count() }).from(spacesTable),
      db.select({ count: count() }).from(contactsTable),
      db.select({ count: count() }).from(accountsTable),
      db.select({ count: count() }).from(leadsTable),
      db.select({ count: count() }).from(tasksTable),
      db.select({ count: count() }).from(invoicesTable),
      db.select({ count: count() }).from(contractsTable),
      db.select({ count: count() }).from(bookingsTable),
      db.select({ count: count() }).from(bookingsTable).where(eq(bookingsTable.booking_status, "Confirmed")),
      db.select({ count: count() }).from(bookingsTable).where(eq(bookingsTable.booking_status, "PendingApproval")),
    ]);

    res.json({
      total_properties: Number(props.count),
      total_spaces: Number(spaces.count),
      total_contacts: Number(contacts.count),
      total_accounts: Number(accounts.count),
      total_leads: Number(leads.count),
      total_tasks: Number(tasks.count),
      total_invoices: Number(invoices.count),
      total_contracts: Number(contracts.count),
      total_bookings: Number(bookings.count),
      active_bookings: Number(confirmedBookings.count),
      pending_approvals: Number(pendingBookings.count),
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch dashboard stats" });
  }
});

export default router;
