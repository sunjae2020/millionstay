import { Router, type IRouter } from "express";
import { eq, and, desc, inArray } from "drizzle-orm";
import {
  db,
  bookingsTable,
  bookingServicesTable,
  spacesTable,
  propertiesTable,
  serviceHostsTable,
  accountsTable,
  invoicesTable,
  contactsTable,
} from "@workspace/db";
import { requirePartnerAuth, type PartnerAuthPayload } from "../middlewares/requirePartnerAuth";

const router: IRouter = Router();

function requireServiceHostAuth(req: any, res: any, next: any) {
  requirePartnerAuth(req, res, () => {
    const partner = req.partner as PartnerAuthPayload;
    if (partner.portal_type !== "service_host") {
      res.status(403).json({ success: false, error: { code: "FORBIDDEN", message: "Service host access only" } });
      return;
    }
    next();
  });
}

async function getHostServiceIds(accountId: number): Promise<number[]> {
  const hosts = await db
    .select({ id: serviceHostsTable.id })
    .from(serviceHostsTable)
    .where(and(eq(serviceHostsTable.account_id, accountId), eq(serviceHostsTable.status, "Active")));
  return hosts.map((h) => h.id);
}

/* GET /api/v1/service-host/dashboard */
router.get("/v1/service-host/dashboard", requireServiceHostAuth, async (req, res): Promise<void> => {
  try {
    const partner = (req as any).partner as PartnerAuthPayload;
    const accountId = partner.account_id;

    const [account] = await db
      .select({ id: accountsTable.id, name: accountsTable.name })
      .from(accountsTable)
      .where(eq(accountsTable.id, accountId))
      .limit(1);

    const hostIds = await getHostServiceIds(accountId);

    let totalJobs = 0;
    let pendingJobs = 0;
    let completedJobs = 0;
    let totalEarnings = 0;
    let recentJobs: any[] = [];

    if (hostIds.length > 0) {
      const services = await db
        .select({
          id: bookingServicesTable.id,
          booking_id: bookingServicesTable.booking_id,
          name: bookingServicesTable.name,
          service_type: bookingServicesTable.service_type,
          quantity: bookingServicesTable.quantity,
          unit_price: bookingServicesTable.unit_price,
          total_price: bookingServicesTable.total_price,
          status: bookingServicesTable.status,
          billing_trigger: bookingServicesTable.billing_trigger,
          created_at: bookingServicesTable.created_at,
        })
        .from(bookingServicesTable)
        .where(
          and(
            inArray(bookingServicesTable.service_id, hostIds),
            eq(bookingServicesTable.status, "Active")
          )
        )
        .orderBy(desc(bookingServicesTable.created_at))
        .limit(100);

      totalJobs = services.length;
      completedJobs = services.filter((s) => s.billing_trigger === "at_checkout").length;
      pendingJobs = totalJobs - completedJobs;
      totalEarnings = services.reduce((sum, s) => sum + parseFloat(s.total_price ?? "0"), 0);

      // Enrich recent 5 jobs with booking info
      const recent = services.slice(0, 5);
      if (recent.length > 0) {
        const bookingIds = [...new Set(recent.map((s) => s.booking_id))];
        const bookings = await db
          .select({
            id: bookingsTable.id,
            booking_ref: bookingsTable.booking_ref,
            check_in_date: bookingsTable.check_in_date,
            check_out_date: bookingsTable.check_out_date,
            booking_status: bookingsTable.booking_status,
            space_id: bookingsTable.space_id,
          })
          .from(bookingsTable)
          .where(inArray(bookingsTable.id, bookingIds));

        const bookingMap = Object.fromEntries(bookings.map((b) => [b.id, b]));
        recentJobs = recent.map((s) => ({
          ...s,
          booking: bookingMap[s.booking_id] ?? null,
        }));
      }
    }

    res.json({
      success: true,
      data: {
        account_name: account?.name ?? "—",
        stats: {
          total_jobs: totalJobs,
          pending_jobs: pendingJobs,
          completed_jobs: completedJobs,
          total_earnings: totalEarnings.toFixed(2),
        },
        recent_jobs: recentJobs,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

/* GET /api/v1/service-host/jobs */
router.get("/v1/service-host/jobs", requireServiceHostAuth, async (req, res): Promise<void> => {
  try {
    const partner = (req as any).partner as PartnerAuthPayload;
    const accountId = partner.account_id;
    const hostIds = await getHostServiceIds(accountId);

    if (hostIds.length === 0) {
      res.json({ success: true, data: [] });
      return;
    }

    const services = await db
      .select({
        id: bookingServicesTable.id,
        booking_id: bookingServicesTable.booking_id,
        service_id: bookingServicesTable.service_id,
        name: bookingServicesTable.name,
        service_type: bookingServicesTable.service_type,
        quantity: bookingServicesTable.quantity,
        unit_price: bookingServicesTable.unit_price,
        total_price: bookingServicesTable.total_price,
        currency: bookingServicesTable.currency,
        billing_trigger: bookingServicesTable.billing_trigger,
        frequency: bookingServicesTable.frequency,
        notes: bookingServicesTable.notes,
        status: bookingServicesTable.status,
        created_at: bookingServicesTable.created_at,
      })
      .from(bookingServicesTable)
      .where(
        and(
          inArray(bookingServicesTable.service_id, hostIds),
          eq(bookingServicesTable.status, "Active")
        )
      )
      .orderBy(desc(bookingServicesTable.created_at));

    if (services.length === 0) {
      res.json({ success: true, data: [] });
      return;
    }

    const bookingIds = [...new Set(services.map((s) => s.booking_id))];
    const bookings = await db
      .select({
        id: bookingsTable.id,
        booking_ref: bookingsTable.booking_ref,
        booking_status: bookingsTable.booking_status,
        check_in_date: bookingsTable.check_in_date,
        check_out_date: bookingsTable.check_out_date,
        space_id: bookingsTable.space_id,
        guest_user_id: bookingsTable.guest_user_id,
      })
      .from(bookingsTable)
      .where(inArray(bookingsTable.id, bookingIds));

    const spaceIds = [...new Set(bookings.map((b) => b.space_id).filter(Boolean))] as number[];
    let spaces: any[] = [];
    if (spaceIds.length > 0) {
      spaces = await db
        .select({
          id: spacesTable.id,
          name: spacesTable.name,
          property_id: spacesTable.property_id,
        })
        .from(spacesTable)
        .where(inArray(spacesTable.id, spaceIds));
    }

    const propertyIds = [...new Set(spaces.map((s) => s.property_id).filter(Boolean))] as number[];
    let properties: any[] = [];
    if (propertyIds.length > 0) {
      properties = await db
        .select({ id: propertiesTable.id, name: propertiesTable.name, address: propertiesTable.address })
        .from(propertiesTable)
        .where(inArray(propertiesTable.id, propertyIds));
    }

    const spaceMap = Object.fromEntries(spaces.map((s) => [s.id, s]));
    const propertyMap = Object.fromEntries(properties.map((p) => [p.id, p]));
    const bookingMap = Object.fromEntries(
      bookings.map((b) => {
        const space = spaceMap[b.space_id ?? 0];
        const property = propertyMap[space?.property_id ?? 0];
        return [b.id, { ...b, space, property }];
      })
    );

    const enriched = services.map((s) => ({
      ...s,
      booking: bookingMap[s.booking_id] ?? null,
    }));

    res.json({ success: true, data: enriched });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

/* GET /api/v1/service-host/schedule */
router.get("/v1/service-host/schedule", requireServiceHostAuth, async (req, res): Promise<void> => {
  try {
    const partner = (req as any).partner as PartnerAuthPayload;
    const accountId = partner.account_id;
    const hostIds = await getHostServiceIds(accountId);

    if (hostIds.length === 0) {
      res.json({ success: true, data: [] });
      return;
    }

    const services = await db
      .select({
        id: bookingServicesTable.id,
        booking_id: bookingServicesTable.booking_id,
        name: bookingServicesTable.name,
        service_type: bookingServicesTable.service_type,
        total_price: bookingServicesTable.total_price,
        currency: bookingServicesTable.currency,
        billing_trigger: bookingServicesTable.billing_trigger,
        status: bookingServicesTable.status,
      })
      .from(bookingServicesTable)
      .where(
        and(
          inArray(bookingServicesTable.service_id, hostIds),
          eq(bookingServicesTable.status, "Active")
        )
      );

    if (services.length === 0) {
      res.json({ success: true, data: [] });
      return;
    }

    const bookingIds = [...new Set(services.map((s) => s.booking_id))];
    const bookings = await db
      .select({
        id: bookingsTable.id,
        booking_ref: bookingsTable.booking_ref,
        booking_status: bookingsTable.booking_status,
        check_in_date: bookingsTable.check_in_date,
        check_out_date: bookingsTable.check_out_date,
        space_id: bookingsTable.space_id,
      })
      .from(bookingsTable)
      .where(inArray(bookingsTable.id, bookingIds));

    const spaceIds = [...new Set(bookings.map((b) => b.space_id).filter(Boolean))] as number[];
    let spaces: any[] = [];
    if (spaceIds.length > 0) {
      spaces = await db
        .select({ id: spacesTable.id, name: spacesTable.name, property_id: spacesTable.property_id })
        .from(spacesTable)
        .where(inArray(spacesTable.id, spaceIds));
    }

    const propertyIds = [...new Set(spaces.map((s) => s.property_id).filter(Boolean))] as number[];
    let properties: any[] = [];
    if (propertyIds.length > 0) {
      properties = await db
        .select({ id: propertiesTable.id, name: propertiesTable.name })
        .from(propertiesTable)
        .where(inArray(propertiesTable.id, propertyIds));
    }

    const spaceMap = Object.fromEntries(spaces.map((s) => [s.id, s]));
    const propertyMap = Object.fromEntries(properties.map((p) => [p.id, p]));
    const bookingMap = Object.fromEntries(
      bookings.map((b) => {
        const space = spaceMap[b.space_id ?? 0];
        const property = propertyMap[space?.property_id ?? 0];
        return [b.id, { ...b, space_name: space?.name, property_name: property?.name }];
      })
    );

    const schedule = services.map((s) => {
      const booking = bookingMap[s.booking_id];
      return {
        id: s.id,
        service_name: s.name,
        service_type: s.service_type,
        total_price: s.total_price,
        currency: s.currency,
        billing_trigger: s.billing_trigger,
        booking_ref: booking?.booking_ref,
        booking_status: booking?.booking_status,
        check_in_date: booking?.check_in_date,
        check_out_date: booking?.check_out_date,
        space_name: booking?.space_name,
        property_name: booking?.property_name,
        // Scheduled date based on billing trigger
        scheduled_date:
          s.billing_trigger === "at_checkin"
            ? booking?.check_in_date
            : s.billing_trigger === "at_checkout"
            ? booking?.check_out_date
            : booking?.check_in_date,
      };
    });

    // Sort by scheduled_date
    schedule.sort((a, b) => {
      const da = a.scheduled_date ? new Date(a.scheduled_date).getTime() : 0;
      const db_ = b.scheduled_date ? new Date(b.scheduled_date).getTime() : 0;
      return da - db_;
    });

    res.json({ success: true, data: schedule });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

/* GET /api/v1/service-host/earnings */
router.get("/v1/service-host/earnings", requireServiceHostAuth, async (req, res): Promise<void> => {
  try {
    const partner = (req as any).partner as PartnerAuthPayload;
    const accountId = partner.account_id;
    const hostIds = await getHostServiceIds(accountId);

    if (hostIds.length === 0) {
      res.json({ success: true, data: { total_earned: "0.00", by_service: [], by_booking: [] } });
      return;
    }

    const services = await db
      .select({
        id: bookingServicesTable.id,
        booking_id: bookingServicesTable.booking_id,
        name: bookingServicesTable.name,
        service_type: bookingServicesTable.service_type,
        quantity: bookingServicesTable.quantity,
        unit_price: bookingServicesTable.unit_price,
        total_price: bookingServicesTable.total_price,
        currency: bookingServicesTable.currency,
        billing_trigger: bookingServicesTable.billing_trigger,
        created_at: bookingServicesTable.created_at,
      })
      .from(bookingServicesTable)
      .where(
        and(
          inArray(bookingServicesTable.service_id, hostIds),
          eq(bookingServicesTable.status, "Active")
        )
      )
      .orderBy(desc(bookingServicesTable.created_at));

    const totalEarned = services.reduce((sum, s) => sum + parseFloat(s.total_price ?? "0"), 0);

    // Group by service name
    const byServiceMap: Record<string, { name: string; count: number; total: number }> = {};
    for (const s of services) {
      if (!byServiceMap[s.name]) {
        byServiceMap[s.name] = { name: s.name, count: 0, total: 0 };
      }
      byServiceMap[s.name].count++;
      byServiceMap[s.name].total += parseFloat(s.total_price ?? "0");
    }
    const byService = Object.values(byServiceMap).sort((a, b) => b.total - a.total);

    // Group by booking
    const bookingIds = [...new Set(services.map((s) => s.booking_id))];
    let bookingInfoMap: Record<number, any> = {};
    if (bookingIds.length > 0) {
      const bookings = await db
        .select({
          id: bookingsTable.id,
          booking_ref: bookingsTable.booking_ref,
          check_in_date: bookingsTable.check_in_date,
          check_out_date: bookingsTable.check_out_date,
          booking_status: bookingsTable.booking_status,
        })
        .from(bookingsTable)
        .where(inArray(bookingsTable.id, bookingIds));
      bookingInfoMap = Object.fromEntries(bookings.map((b) => [b.id, b]));
    }

    const byBookingMap: Record<number, any> = {};
    for (const s of services) {
      if (!byBookingMap[s.booking_id]) {
        const b = bookingInfoMap[s.booking_id];
        byBookingMap[s.booking_id] = {
          booking_id: s.booking_id,
          booking_ref: b?.booking_ref ?? `#${s.booking_id}`,
          check_in_date: b?.check_in_date,
          booking_status: b?.booking_status,
          services: [],
          total: 0,
        };
      }
      byBookingMap[s.booking_id].services.push(s.name);
      byBookingMap[s.booking_id].total += parseFloat(s.total_price ?? "0");
    }
    const byBooking = Object.values(byBookingMap).sort((a, b) => b.total - a.total);

    res.json({
      success: true,
      data: {
        total_earned: totalEarned.toFixed(2),
        by_service: byService.map((s) => ({ ...s, total: s.total.toFixed(2) })),
        by_booking: byBooking.map((b) => ({ ...b, total: b.total.toFixed(2) })),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

/* GET /api/v1/service-host/profile */
router.get("/v1/service-host/profile", requireServiceHostAuth, async (req, res): Promise<void> => {
  try {
    const partner = (req as any).partner as PartnerAuthPayload;
    const accountId = partner.account_id;

    const [account] = await db
      .select()
      .from(accountsTable)
      .where(eq(accountsTable.id, accountId))
      .limit(1);

    const hosts = await db
      .select()
      .from(serviceHostsTable)
      .where(eq(serviceHostsTable.account_id, accountId));

    res.json({ success: true, data: { account, service_hosts: hosts } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

export default router;
