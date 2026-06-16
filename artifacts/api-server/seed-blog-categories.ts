/**
 * One-off: create the blog_categories table on the (prod) DB and seed it with
 * the categories that were previously hardcoded. Idempotent.
 *
 *   cd artifacts/api-server && node --env-file=.env <path-to-tsx-cli.mjs> seed-blog-categories.ts
 */
import { pool, db, blogCategoriesTable } from "@workspace/db";

const CATEGORIES = ["Tips & Guides", "Student Life", "Melbourne", "Housing", "News", "Lifestyle", "Homestay"];

async function main() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS blog_categories (
      id serial PRIMARY KEY,
      name text NOT NULL,
      sort_order integer NOT NULL DEFAULT 0,
      is_active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT blog_categories_name_unique UNIQUE (name)
    );
  `);
  console.log("✓ blog_categories table ensured");

  let i = 0;
  for (const name of CATEGORIES) {
    i += 1;
    await db
      .insert(blogCategoriesTable)
      .values({ name, sort_order: i, is_active: true })
      .onConflictDoNothing({ target: blogCategoriesTable.name });
  }
  const rows = await db.select().from(blogCategoriesTable);
  console.log(`✓ seeded; ${rows.length} categories total`);
  await pool.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
