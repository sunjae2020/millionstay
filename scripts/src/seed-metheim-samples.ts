/**
 * Seed sample rental listings for the MetHeim (Yeosu) single-building instance.
 *
 * Creates one property (the MetHeim building) + a Yeosu suburb + a set of
 * furnished units (spaces) with KRW pricing, photos, amenities and price tiers,
 * so the guest /search list and each /spaces/:id detail page render with real
 * content. All prices are in Korean won (base_currency / currency = "KRW").
 *
 * Idempotent: re-running skips anything already created (matched by name).
 *
 * Run against the MetHeim DB (DATABASE_URL injected by Railway):
 *   railway run -- pnpm --filter @workspace/scripts seed-metheim
 */
import {
  db,
  pool,
  suburbsTable,
  propertiesTable,
  spacesTable,
  spaceImagesTable,
  spaceOptionsTable,
  spaceOptionMapsTable,
  accommodationCatalogTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";

const stats = { created: 0, skipped: 0, failed: 0 };
const ok = (m: string) => { console.log(`✅ ${m}`); stats.created++; };
const skip = (m: string) => { console.log(`⏭️  ${m}`); stats.skipped++; };
const fail = (m: string, e: unknown) => { console.error(`❌ ${m}`, e); stats.failed++; };

const PROPERTY_NAME = "메트하임 여수 (MetHeim Yeosu)";

// A small pool of interior photos (Unsplash). Assigned 3 per unit, round-robin.
const PHOTOS = [
  "1502672260266-1c1ef2d93688", "1522708323590-d24dbb6b0267",
  "1493809842364-78817add7ffb", "1560448204-e02f11c3d0e2",
  "1560185007-cde436f6a4d0",    "1522771739844-6a9f6d5f14af",
  "1505691938895-1758d7feb511", "1586023492125-27b2c045efd7",
  "1567767292278-a4f21aa2d36e", "1502005097973-6a7082348e28",
  "1512918728675-ed5a9ecdebfd", "1484154218962-a197022b5858",
];
const photoUrl = (id: string, w: number) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=80`;

// Amenity catalog (name = stable key, display = Korean label shown on cards).
const OPTIONS: { name: string; display: string; category: string }[] = [
  { name: "Air conditioning", display: "에어컨", category: "Amenity" },
  { name: "Wi-Fi", display: "무선 인터넷", category: "Amenity" },
  { name: "Washer", display: "세탁기", category: "Amenity" },
  { name: "Refrigerator", display: "냉장고", category: "Amenity" },
  { name: "Induction cooktop", display: "인덕션", category: "Amenity" },
  { name: "Elevator", display: "엘리베이터", category: "Building" },
  { name: "Parking", display: "주차 가능", category: "Building" },
  { name: "Ocean view", display: "오션뷰", category: "Feature" },
  { name: "Bedding provided", display: "침구 제공", category: "Amenity" },
  { name: "On-site management", display: "상주 관리", category: "Service" },
  { name: "CCTV security", display: "CCTV 보안", category: "Building" },
  { name: "Heating", display: "난방", category: "Amenity" },
];

interface UnitDef {
  name: string;
  space_type: string;
  max_occupancy: number;
  booking_mode: string;
  weekly: number;          // base weekly price in KRW
  floor_number: number;
  floor_area_sqm: number;
  description: string;
  amenities: string[];     // option names
  photoOffset: number;     // where in PHOTOS this unit starts
}

const UNITS: UnitDef[] = [
  {
    name: "스탠다드 스튜디오 (3층)",
    space_type: "EntireSpace", max_occupancy: 1, booking_mode: "Instant",
    weekly: 175000, floor_number: 3, floor_area_sqm: 24,
    description: "혼자 지내기 좋은 풀옵션 스튜디오입니다. 가구와 가전, 침구까지 갖춰져 있어 가방 하나면 바로 입주할 수 있습니다.",
    amenities: ["Air conditioning", "Wi-Fi", "Washer", "Refrigerator", "Induction cooktop", "Elevator", "Bedding provided", "On-site management", "Heating"],
    photoOffset: 0,
  },
  {
    name: "디럭스 스튜디오 · 오션뷰 (7층)",
    space_type: "EntireSpace", max_occupancy: 2, booking_mode: "Instant",
    weekly: 225000, floor_number: 7, floor_area_sqm: 30,
    description: "여수 바다가 보이는 고층 스튜디오입니다. 넓은 창과 아늑한 인테리어로 짧은 여행부터 한 달 살기까지 두루 편안합니다.",
    amenities: ["Air conditioning", "Wi-Fi", "Washer", "Refrigerator", "Induction cooktop", "Elevator", "Ocean view", "Bedding provided", "On-site management", "CCTV security", "Heating"],
    photoOffset: 3,
  },
  {
    name: "원베드룸 (5층)",
    space_type: "EntireSpace", max_occupancy: 2, booking_mode: "Request",
    weekly: 290000, floor_number: 5, floor_area_sqm: 40,
    description: "침실과 거실이 분리된 원베드룸으로, 커플이나 장기 체류에 알맞습니다. 주방과 세탁 시설이 모두 갖춰져 있습니다.",
    amenities: ["Air conditioning", "Wi-Fi", "Washer", "Refrigerator", "Induction cooktop", "Elevator", "Parking", "Bedding provided", "On-site management", "CCTV security", "Heating"],
    photoOffset: 5,
  },
  {
    name: "원베드룸 프리미엄 · 오션뷰 (9층)",
    space_type: "EntireSpace", max_occupancy: 2, booking_mode: "Instant",
    weekly: 350000, floor_number: 9, floor_area_sqm: 45,
    description: "탁 트인 바다 전망을 갖춘 프리미엄 원베드룸입니다. 고층의 채광과 세련된 마감으로 편안하면서도 특별한 머무름을 제공합니다.",
    amenities: ["Air conditioning", "Wi-Fi", "Washer", "Refrigerator", "Induction cooktop", "Elevator", "Parking", "Ocean view", "Bedding provided", "On-site management", "CCTV security", "Heating"],
    photoOffset: 8,
  },
  {
    name: "투베드룸 패밀리 (6층)",
    space_type: "EntireSpace", max_occupancy: 4, booking_mode: "Request",
    weekly: 460000, floor_number: 6, floor_area_sqm: 60,
    description: "방 두 개를 갖춘 넓은 세대로, 가족 단위나 여럿이 함께 지내기에 좋습니다. 넉넉한 거실과 주방으로 생활이 편리합니다.",
    amenities: ["Air conditioning", "Wi-Fi", "Washer", "Refrigerator", "Induction cooktop", "Elevator", "Parking", "Bedding provided", "On-site management", "CCTV security", "Heating"],
    photoOffset: 1,
  },
  {
    name: "펜트하우스 · 오션뷰 (12층)",
    space_type: "EntireSpace", max_occupancy: 4, booking_mode: "Request",
    weekly: 750000, floor_number: 12, floor_area_sqm: 85,
    description: "건물 최상층의 펜트하우스로, 여수 앞바다를 한눈에 담습니다. 넓은 공간과 프라이빗한 분위기로 특별한 장기 거주에 어울립니다.",
    amenities: ["Air conditioning", "Wi-Fi", "Washer", "Refrigerator", "Induction cooktop", "Elevator", "Parking", "Ocean view", "Bedding provided", "On-site management", "CCTV security", "Heating"],
    photoOffset: 6,
  },
];

async function upsertByName(table: any, name: string, insert: Record<string, unknown>): Promise<number> {
  const existing = await db.select({ id: table.id }).from(table).where(eq(table.name, name)).limit(1);
  if (existing.length > 0) return existing[0].id;
  const [row] = await db.insert(table).values(insert as any).returning({ id: table.id });
  return row.id;
}

async function main() {
  console.log("=== Seeding MetHeim Yeosu sample listings (KRW) ===\n");

  // 1. Suburb
  const suburbId = await upsertByName(suburbsTable, "여수 (Yeosu)", {
    name: "여수 (Yeosu)", state: "전라남도", postcode: "59723",
    country_code: "KR", area_name: "여수시", lat: 34.7604, lng: 127.6622, status: "Active",
  });
  console.log(`Suburb: 여수 (Yeosu) → #${suburbId}`);

  // 2. Property (the building)
  const existingProp = await db.select({ id: propertiesTable.id }).from(propertiesTable)
    .where(eq(propertiesTable.name, PROPERTY_NAME)).limit(1);
  let propertyId: number;
  if (existingProp.length > 0) {
    propertyId = existingProp[0].id;
    skip(`Property already exists → #${propertyId}`);
  } else {
    const [p] = await db.insert(propertiesTable).values({
      name: PROPERTY_NAME,
      address: "전라남도 여수시 웅천동", city: "여수", state: "전라남도",
      postcode: "59723", country_code: "KR", lat: 34.7604, lng: 127.6622,
      suburb_id: suburbId, approval_status: "Approved",
      description: "여수 바다를 곁에 둔 메트하임 단일 건물. 풀옵션 세대를 단기·월·장기로 임대하며, 청소·유지·관리를 상주팀이 직접 운영합니다.",
    } as any).returning({ id: propertiesTable.id });
    propertyId = p.id;
    ok(`Property: ${PROPERTY_NAME} → #${propertyId}`);
  }

  // 3. Amenity options
  const optionId = new Map<string, number>();
  for (const o of OPTIONS) {
    const id = await upsertByName(spaceOptionsTable, o.name, {
      name: o.name, display_name: o.display, category: o.category, status: "Active",
    });
    optionId.set(o.name, id);
  }
  console.log(`Amenities: ${optionId.size} options ready`);

  // 4. Units
  for (const u of UNITS) {
    try {
      const existing = await db.select({ id: spacesTable.id }).from(spacesTable)
        .where(and(eq(spacesTable.name, u.name), eq(spacesTable.property_id, propertyId))).limit(1);
      let spaceId: number;
      if (existing.length > 0) {
        spaceId = existing[0].id;
        skip(`Space exists: ${u.name} → #${spaceId}`);
      } else {
        const [s] = await db.insert(spacesTable).values({
          name: u.name, space_type: u.space_type, max_occupancy: u.max_occupancy,
          booking_mode: u.booking_mode, base_weekly_price: u.weekly, base_currency: "KRW",
          floor_number: u.floor_number, floor_area_sqm: u.floor_area_sqm,
          description: u.description, property_id: propertyId, status: "Active",
          // Sample data — no address masking so the map/location shows.
          privacy_hide_unit_no: false, privacy_hide_street_no: false, privacy_map_blur: false,
        } as any).returning({ id: spacesTable.id });
        spaceId = s.id;
        ok(`Space: ${u.name} → #${spaceId}  (₩${u.weekly.toLocaleString()}/주)`);
      }

      // Images (only if none yet)
      const imgs = await db.select({ id: spaceImagesTable.id }).from(spaceImagesTable)
        .where(eq(spaceImagesTable.space_id, spaceId)).limit(1);
      if (imgs.length === 0) {
        for (let i = 0; i < 3; i++) {
          const pid = PHOTOS[(u.photoOffset + i) % PHOTOS.length];
          await db.insert(spaceImagesTable).values({
            space_id: spaceId, file_url: photoUrl(pid, 1200), thumbnail_url: photoUrl(pid, 500),
            is_primary: i === 0, display_order: i, caption: u.name,
          } as any);
        }
        console.log(`   • 3 photos`);
      }

      // Price tiers (only if none yet)
      const prods = await db.select({ id: accommodationCatalogTable.id }).from(accommodationCatalogTable)
        .where(eq(accommodationCatalogTable.space_id, spaceId)).limit(1);
      if (prods.length === 0) {
        const round = (n: number) => Math.round(n / 1000) * 1000;
        const tiers = [
          { name: "1주 이상", price: u.weekly, period: 1, tag: "주 단위" },
          { name: "4주 이상", price: round(u.weekly * 0.95), period: 4, tag: "인기" },
          { name: "12주 이상 (장기)", price: round(u.weekly * 0.88), period: 12, tag: "best_value" },
        ];
        for (const t of tiers) {
          await db.insert(accommodationCatalogTable).values({
            name: t.name, space_id: spaceId, price: t.price, weekly_rate: t.price, currency: "KRW",
            product_tag: t.tag, min_contract_period: t.period, min_contract_period_unit: "weeks",
            billing_frequency: "Weekly", status: "Active", display_on_booking_page: true,
          } as any);
        }
        console.log(`   • 3 price tiers (KRW)`);
      }

      // Amenity maps (only if none yet)
      const maps = await db.select({ id: spaceOptionMapsTable.id }).from(spaceOptionMapsTable)
        .where(eq(spaceOptionMapsTable.space_id, spaceId)).limit(1);
      if (maps.length === 0) {
        for (const a of u.amenities) {
          const oid = optionId.get(a);
          if (oid) await db.insert(spaceOptionMapsTable).values({ space_id: spaceId, space_option_id: oid } as any);
        }
        console.log(`   • ${u.amenities.length} amenities`);
      }
    } catch (e) {
      fail(`Unit ${u.name}`, e);
    }
  }

  console.log(`\n=== Done: created=${stats.created} skipped=${stats.skipped} failed=${stats.failed} ===`);
  await pool.end();
  process.exit(stats.failed > 0 ? 1 : 0);
}

main().catch(async (e) => { console.error("FATAL", e); try { await pool.end(); } catch {} process.exit(1); });
