import type Anthropic from "@anthropic-ai/sdk";
import { db, chatConversationsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { insertLeadWithGeneratedRef } from "../leadRef";
import { sendLeadNotificationEmail } from "../email";

/** Context passed to every tool executor for the current conversation. */
export interface ToolContext {
  conversationId: string;
  sessionId: string;
}

/** Internal base URL for calling this server's own public API. */
function internalBase(): string {
  const port = process.env["PORT"] || "5100";
  return `http://127.0.0.1:${port}`;
}

/** Public website base URL used to build booking links shared with visitors. */
function webBase(): string {
  return (process.env["PUBLIC_WEB_URL"] || "https://www.millionstay.com").replace(/\/$/, "");
}

function bookingLink(spaceId: number | string): string {
  return `${webBase()}/spaces/${spaceId}`;
}

async function getJson(path: string): Promise<any> {
  const res = await fetch(`${internalBase()}${path}`, { headers: { accept: "application/json" } });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Internal API ${path} failed (${res.status}): ${text.slice(0, 200)}`);
  }
  return res.json();
}

/** Tool schemas advertised to the model. */
export const TOOLS: Anthropic.Tool[] = [
  {
    name: "search_spaces",
    description:
      "Search MillionStay for available rooms/spaces. Returns a list of matching rooms with prices and booking links. Use this whenever the visitor asks what's available, by location, type, price, or dates.",
    input_schema: {
      type: "object",
      properties: {
        city: { type: "string", description: "City name to search within (free text, e.g. 'Sydney')." },
        suburb: { type: "string", description: "Suburb/area name (free text, e.g. 'Ultimo'). Resolved to a suburb filter when possible." },
        space_type: {
          type: "string",
          enum: ["EntireSpace", "RoomSpace", "BedSpace"],
          description: "EntireSpace = whole property, RoomSpace = private room, BedSpace = shared room/bed.",
        },
        min_price: { type: "number", description: "Minimum weekly price." },
        max_price: { type: "number", description: "Maximum weekly price." },
        start_date: { type: "string", description: "Desired check-in date, YYYY-MM-DD." },
        end_date: { type: "string", description: "Desired check-out date, YYYY-MM-DD." },
        limit: { type: "number", description: "Max results to return (default 6, max 12)." },
      },
    },
  },
  {
    name: "get_space_details",
    description: "Get full details and the booking link for a single room/space by its numeric id.",
    input_schema: {
      type: "object",
      properties: { space_id: { type: "number", description: "Numeric space id." } },
      required: ["space_id"],
    },
  },
  {
    name: "get_space_availability",
    description: "Check whether a specific room/space is available for a date range.",
    input_schema: {
      type: "object",
      properties: {
        space_id: { type: "number", description: "Numeric space id." },
        start_date: { type: "string", description: "Check-in date, YYYY-MM-DD." },
        end_date: { type: "string", description: "Check-out date, YYYY-MM-DD." },
      },
      required: ["space_id", "start_date", "end_date"],
    },
  },
  {
    name: "create_inquiry",
    description:
      "Register the visitor's interest as a lead so the MillionStay team can follow up. Only call after the visitor has given their name and a valid email and agreed to be contacted.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Visitor's full name." },
        email: { type: "string", description: "Visitor's email address." },
        phone: { type: "string", description: "Visitor's phone number (optional)." },
        message: { type: "string", description: "What the visitor is looking for / their question." },
        space_id: { type: "number", description: "Numeric space id the visitor is interested in (optional)." },
        preferred_check_in: { type: "string", description: "Preferred check-in date, YYYY-MM-DD (optional)." },
        preferred_duration_weeks: { type: "number", description: "Preferred stay length in weeks (optional)." },
      },
      required: ["name", "email", "message"],
    },
  },
];

/** Trim the public /spaces row to a compact shape for the model + UI cards. */
function compactSpace(s: any) {
  return {
    space_id: s.id,
    name: s.name,
    space_type: s.space_type,
    weekly_price: s.base_weekly_price,
    currency: s.base_currency,
    city: s.property_city,
    property_name: s.property_name,
    image: s.primary_thumbnail ?? s.primary_image ?? null,
    booking_link: bookingLink(s.id),
  };
}

async function resolveSuburbId(suburb: string): Promise<number | null> {
  try {
    const rows = await getJson(`/api/v1/suburbs?search=${encodeURIComponent(suburb)}`);
    if (Array.isArray(rows) && rows.length > 0 && rows[0]?.id != null) return Number(rows[0].id);
  } catch {
    /* fall through — suburb filter is best-effort */
  }
  return null;
}

/**
 * Execute a tool call. Returns a JSON-serialisable result for the model and an
 * optional `ui` payload the route can forward to the widget for rich rendering.
 */
export async function executeTool(
  name: string,
  input: Record<string, any>,
  ctx: ToolContext,
): Promise<{ result: unknown; ui?: { kind: string; data: unknown } }> {
  switch (name) {
    case "search_spaces": {
      const params = new URLSearchParams();
      if (input.city) params.set("city", String(input.city));
      if (input.suburb) {
        const sid = await resolveSuburbId(String(input.suburb));
        if (sid != null) params.set("suburb_id", String(sid));
        else if (!input.city) params.set("city", String(input.suburb));
      }
      if (input.space_type) params.set("space_type", String(input.space_type));
      if (input.min_price != null) params.set("min_price", String(input.min_price));
      if (input.max_price != null) params.set("max_price", String(input.max_price));
      if (input.start_date) params.set("start_date", String(input.start_date));
      if (input.end_date) params.set("end_date", String(input.end_date));
      const limit = Math.min(Number(input.limit) || 6, 12);
      params.set("limit", String(limit));

      const json = await getJson(`/api/v1/public/spaces?${params.toString()}`);
      const spaces = Array.isArray(json?.data) ? json.data.map(compactSpace) : [];
      return {
        result: { count: json?.meta?.total ?? spaces.length, returned: spaces.length, spaces },
        ui: spaces.length ? { kind: "spaces", data: spaces } : undefined,
      };
    }

    case "get_space_details": {
      const id = Number(input.space_id);
      if (!id) return { result: { error: "space_id is required" } };
      const json = await getJson(`/api/v1/public/spaces/${id}`);
      const d = json?.data ?? {};
      const details = {
        space_id: d.id,
        name: d.name,
        space_type: d.space_type,
        max_occupancy: d.max_occupancy,
        weekly_price: d.base_weekly_price,
        daily_price: d.base_daily_price,
        currency: d.base_currency,
        description: d.description,
        city: d.property_city,
        property_name: d.property_name,
        amenities: Array.isArray(d.space_options) ? d.space_options.map((o: any) => o.display_name ?? o.name).filter(Boolean) : [],
        products: d.products ?? [],
        image: Array.isArray(d.images) && d.images[0] ? d.images[0].file_url : null,
        booking_link: bookingLink(id),
      };
      return { result: details, ui: { kind: "spaces", data: [{ ...details, image: details.image }] } };
    }

    case "get_space_availability": {
      const id = Number(input.space_id);
      if (!id || !input.start_date || !input.end_date) {
        return { result: { error: "space_id, start_date and end_date are required" } };
      }
      const json = await getJson(
        `/api/v1/public/spaces/${id}/availability?start_date=${encodeURIComponent(input.start_date)}&end_date=${encodeURIComponent(input.end_date)}`,
      );
      return { result: { ...(json?.data ?? {}), booking_link: bookingLink(id) } };
    }

    case "create_inquiry": {
      const fullName = String(input.name ?? "").trim();
      const email = String(input.email ?? "").trim();
      if (!fullName) return { result: { error: "name is required" } };
      if (!email || !/^\S+@\S+\.\S+$/.test(email)) return { result: { error: "a valid email is required" } };

      const parts = fullName.split(/\s+/);
      const first_name = parts[0];
      const last_name = parts.slice(1).join(" ") || "—";
      const phone = input.phone ? String(input.phone).trim() : null;
      const message = input.message ? String(input.message).trim() : null;

      const descLines = [
        `Source: AI chat assistant (conversation ${ctx.conversationId})`,
        input.space_id ? `Interested in space #${input.space_id} (${bookingLink(input.space_id)})` : null,
      ].filter(Boolean);

      const row = await insertLeadWithGeneratedRef({
        first_name,
        last_name,
        email,
        phone,
        lead_source: "AI Chat",
        inquiry_type: "AIChat",
        lead_status: "New",
        message,
        description: descLines.join("\n"),
        preferred_check_in_date: input.preferred_check_in || null,
        preferred_duration_weeks: input.preferred_duration_weeks != null ? Number(input.preferred_duration_weeks) : null,
        manual_input: false,
        status: "Active",
      });

      // Link the lead to this conversation and record the contact email.
      await db
        .update(chatConversationsTable)
        .set({ lead_id: row.id, contact_email: email })
        .where(eq(chatConversationsTable.id, ctx.conversationId));

      // Fire-and-forget ops notification (never blocks / throws to the visitor).
      void sendLeadNotificationEmail({
        leadRef: row.lead_ref,
        inquiryType: "AI Chat Enquiry",
        firstName: first_name,
        lastName: last_name,
        email,
        phone,
        message,
        description: descLines.join("\n"),
      }).catch((err) => console.error("[chat] lead notification failed:", err));

      return { result: { ok: true, lead_ref: row.lead_ref } };
    }

    default:
      return { result: { error: `Unknown tool: ${name}` } };
  }
}
