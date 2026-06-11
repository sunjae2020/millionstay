// Local type augmentations for the generated API client.
//
// The generated `ContractProduct` schema in `@workspace/api-client-react` is
// stale relative to the live API: the `/v1/contract-products` routes return the
// full `contract_products` DB row (see lib/db/src/schema/products.ts and
// artifacts/api-server/src/routes/products.ts) plus enriched fields. These
// declaration-merge additions reflect the actual runtime shape without editing
// the generated package.
import "@workspace/api-client-react";

declare module "@workspace/api-client-react" {
  interface ContractProduct {
    /** @nullable */
    promotion_id?: number | null;
    /** @nullable */
    term_type?: string | null;
    /** @nullable */
    effective_weekly_rate?: number | null;
    /** @nullable */
    billing_frequency?: string | null;
    /** Enriched by the API from the linked promotion. @nullable */
    promotion_name?: string | null;
  }

  // `base_daily_price` is a real column on the `spaces` table (see
  // lib/db/src/schema/spaces.ts) and is part of the create/update space bodies,
  // but the generated `Space`/GetSpaceResponse omits it. The SpaceDetail form
  // reads and writes it; it is tolerant of an absent value at runtime.
  interface Space {
    /** @nullable */
    base_daily_price?: number | null;
  }

  // `/v1/bookings` spreads the full `bookings` DB row (see
  // lib/db/src/schema/bookings.ts and buildBookingResponse in
  // artifacts/api-server/src/routes/bookings.ts); the generated list item omits
  // these columns.
  interface BookingListItem {
    /** @nullable */
    contact_id?: number | null;
    /** @nullable */
    currency?: string | null;
  }
}
