import { pgTable, serial, integer, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Membership rows for `list_type='static'` marketing lists. Dynamic lists do not
// use this table — their membership is computed from filter_criteria at read time.
export const prospectListMembersTable = pgTable(
  "prospect_list_members",
  {
    id: serial("id").primaryKey(),
    list_id: integer("list_id").notNull(),
    prospect_id: integer("prospect_id").notNull(),
    added_by_user_id: integer("added_by_user_id"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => [
    uniqueIndex("uq_prospect_list_members").on(t.list_id, t.prospect_id),
    index("idx_prospect_list_members_prospect").on(t.prospect_id),
  ],
);

export const insertProspectListMemberSchema = createInsertSchema(prospectListMembersTable).omit({
  id: true,
  created_at: true,
});
export type InsertProspectListMember = z.infer<typeof insertProspectListMemberSchema>;
export type ProspectListMember = typeof prospectListMembersTable.$inferSelect;
