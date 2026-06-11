import {
  db,
  contractTypesTable,
  productGroupsTable,
  productTypesTable,
  accommodationCatalogTable,
  spaceOptionsTable,
  spaceOptionMapsTable,
  suburbsTable,
  commissionsTable,
  contactsTable,
  accountsTable,
  propertiesTable,
  spacePoliciesTable,
  spacesTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";

const stats = { created: 0, skipped: 0, failed: 0 };

function ok(msg: string) { console.log(`✅ Created: ${msg}`); stats.created++; }
function skip(msg: string) { console.log(`⏭️  Skipped: ${msg}`); stats.skipped++; }
function fail(msg: string, err: unknown) { console.error(`❌ Failed: ${msg}`, err); stats.failed++; }

async function upsertByName<T extends { id: number; name: string }>(
  label: string,
  table: Parameters<typeof db.select>[0] extends never ? never : any,
  nameVal: string,
  insertData: Record<string, unknown>,
): Promise<number> {
  const existing = await db.select().from(table).where(eq(table.name, nameVal)).limit(1);
  if (existing.length > 0) { skip(label); return existing[0].id; }
  try {
    const [row] = await db.insert(table).values(insertData as any).returning({ id: table.id });
    ok(label);
    return row.id;
  } catch (e) { fail(label, e); return -1; }
}

// ════════════════════════════════════════════════════════
// STEP 1 — CONTRACT TYPES
// ════════════════════════════════════════════════════════
async function seedContractTypes() {
  console.log("\n── STEP 1: Contract Types ──");
  const types = [
    { name: "Casual Stay Contract", description: "Short-term, flexible stay with no long-term commitment", contract_security: "Public", require_passport: true, require_visa: false, require_enrollment: false },
    { name: "Weekly Contract", description: "Rent is billed weekly with a weekly commitment", contract_security: "Public", require_passport: true, require_visa: false, require_enrollment: false },
    { name: "Monthly Contract", description: "Standard monthly rental arrangement", contract_security: "Public", require_passport: true, require_visa: true, require_enrollment: false },
    { name: "Annual Contract", description: "Long-term 12-month housing contract", contract_security: "Private", require_passport: true, require_visa: true, require_enrollment: true },
    { name: "Casual Service", description: "One-time or ad-hoc service engagement", contract_security: "Public", require_passport: false, require_visa: false, require_enrollment: false },
    { name: "Contractor Agreement", description: "Service done by external providers or freelancers", contract_security: "Public", require_passport: false, require_visa: false, require_enrollment: false },
    { name: "Part-Time Employment", description: "Staff hired with part-time work hours", contract_security: "Private", require_passport: false, require_visa: false, require_enrollment: false },
    { name: "Full-Time Employment", description: "Permanent full-time staff", contract_security: "Private", require_passport: false, require_visa: false, require_enrollment: false },
  ];
  for (const t of types) await upsertByName(`ContractType: ${t.name}`, contractTypesTable, t.name, t);
}

// ════════════════════════════════════════════════════════
// STEP 2 — PRODUCT GROUPS
// ════════════════════════════════════════════════════════
async function seedProductGroups(): Promise<Map<string, number>> {
  console.log("\n── STEP 2: Product Groups ──");
  const groups = [
    { name: "Accommodation", display_order: 1 },
    { name: "Service", display_order: 2 },
    { name: "Good", display_order: 3 },
  ];
  const map = new Map<string, number>();
  for (const g of groups) {
    const id = await upsertByName(`ProductGroup: ${g.name}`, productGroupsTable, g.name, g);
    map.set(g.name, id);
  }
  return map;
}

// ════════════════════════════════════════════════════════
// STEP 3 — PRODUCT TYPES
// ════════════════════════════════════════════════════════
async function seedProductTypes(): Promise<Map<string, number>> {
  console.log("\n── STEP 3: Product Types ──");
  const types = [
    { name: "Managed Accommodation", description: "Properties managed on behalf of landlords. Million Stay handles tenant management, rent collection, maintenance, and CS." },
    { name: "Direct-Operated Accommodation", description: "Properties owned or leased by Million Stay with full operational control including pricing, service quality, and revenue." },
    { name: "Investment-Type Accommodation", description: "Properties involving investor participation with revenue share agreements." },
    { name: "Managed Service", description: "Services provided by third-party vendors; Million Stay coordinates but does not operate directly." },
    { name: "Direct-Operated Service", description: "Services operated internally by Million Stay using in-house staff or systems." },
    { name: "Investment-Type Service", description: "Services created through investor-funded or revenue-share structures." },
    { name: "Managed Goods", description: "Items supplied by third-party vendors; Million Stay acts as distributor or reseller." },
    { name: "Direct-Operated Goods", description: "Million Stay purchases, owns, and sells goods directly." },
    { name: "Investment-Type Goods", description: "Goods funded by investors with shared revenue structures." },
  ];
  const map = new Map<string, number>();
  for (const t of types) {
    const id = await upsertByName(`ProductType: ${t.name}`, productTypesTable, t.name, t);
    map.set(t.name, id);
  }
  return map;
}

// ════════════════════════════════════════════════════════
// STEP 4 — SPACE OPTIONS
// ════════════════════════════════════════════════════════
async function seedSpaceOptions(): Promise<Map<string, number>> {
  console.log("\n── STEP 4: Space Options ──");
  const options = [
    // Property Amenity
    { name: "Carpark / On-site Parking", category: "Property Amenity" },
    { name: "Swimming Pool", category: "Property Amenity" },
    { name: "Gym / Fitness Centre", category: "Property Amenity" },
    { name: "Sauna / Steam Room", category: "Property Amenity" },
    { name: "Co-working Space / Study Lounge", category: "Property Amenity" },
    { name: "Meeting Room", category: "Property Amenity" },
    { name: "BBQ Area", category: "Property Amenity" },
    { name: "Garden / Rooftop Terrace", category: "Property Amenity" },
    { name: "Concierge / Building Security", category: "Property Amenity" },
    { name: "Parcel Locker / Mailbox", category: "Property Amenity" },
    { name: "Elevator (Lift)", category: "Property Amenity" },
    { name: "Wheelchair Accessible", category: "Property Amenity" },
    { name: "Bicycle Storage", category: "Property Amenity" },
    { name: "Garbage Room / Recycling Facility", category: "Property Amenity" },
    // Room Feature
    { name: "Private Bathroom (Own Bath)", category: "Room Feature" },
    { name: "Shared Bathroom", category: "Room Feature" },
    { name: "Queen Bed", category: "Room Feature" },
    { name: "Double Bed", category: "Room Feature" },
    { name: "Twin Single Bed", category: "Room Feature" },
    { name: "Bunk Bed", category: "Room Feature" },
    { name: "Desk & Ergonomic Chair", category: "Room Feature" },
    { name: "Smart TV / TV in Room", category: "Room Feature" },
    { name: "Wardrobe / Built-in Closet", category: "Room Feature" },
    { name: "Window / City View", category: "Room Feature" },
    { name: "Air-conditioning / Heating", category: "Room Feature" },
    { name: "Key Lock / Digital Lock", category: "Room Feature" },
    { name: "Mini Fridge (Optional)", category: "Room Feature" },
    { name: "Balcony Access", category: "Room Feature" },
    { name: "Extra Storage Drawer", category: "Room Feature" },
    // Bed Feature
    { name: "Single Bed", category: "Bed Feature" },
    { name: "King Single Bed", category: "Bed Feature" },
    { name: "Bunk Bed (Upper)", category: "Bed Feature" },
    { name: "Bunk Bed (Lower)", category: "Bed Feature" },
    { name: "Privacy Curtain", category: "Bed Feature" },
    { name: "Personal Reading Light", category: "Bed Feature" },
    { name: "Personal Power Outlet / USB Port", category: "Bed Feature" },
    { name: "Under-bed Storage", category: "Bed Feature" },
    { name: "Assigned Shelf / Locker", category: "Bed Feature" },
    { name: "Mattress Included", category: "Bed Feature" },
    { name: "Bedding Set Included (Optional)", category: "Bed Feature" },
    // Amenity
    { name: "High-speed Wi-Fi", category: "Amenity" },
    { name: "Washing Machine", category: "Amenity" },
    { name: "Dryer", category: "Amenity" },
    { name: "Refrigerator", category: "Amenity" },
    { name: "Microwave", category: "Amenity" },
    { name: "Stove / Cooktop", category: "Amenity" },
    { name: "Electric Kettle", category: "Amenity" },
    { name: "Rice Cooker", category: "Amenity" },
    { name: "Smoke Detector", category: "Amenity" },
    { name: "Fire Extinguisher", category: "Amenity" },
  ];
  const map = new Map<string, number>();
  for (const o of options) {
    const existing = await db.select().from(spaceOptionsTable).where(eq(spaceOptionsTable.name, o.name)).limit(1);
    if (existing.length > 0) { skip(`SpaceOption: ${o.name}`); map.set(o.name, existing[0].id); continue; }
    try {
      const [row] = await db.insert(spaceOptionsTable).values({ name: o.name, category: o.category, status: "Active" }).returning({ id: spaceOptionsTable.id });
      ok(`SpaceOption: ${o.name}`);
      map.set(o.name, row.id);
    } catch (e) { fail(`SpaceOption: ${o.name}`, e); }
  }
  return map;
}

// ════════════════════════════════════════════════════════
// STEP 5 — SUBURBS
// ════════════════════════════════════════════════════════
async function seedSuburbs(): Promise<Map<string, number>> {
  console.log("\n── STEP 5: Suburbs ──");
  const suburbs = [
    { name: "Melbourne CBD", state: "VIC", postcode: "3000", country_code: "AU" },
    { name: "Southbank", state: "VIC", postcode: "3006", country_code: "AU" },
    { name: "West Melbourne", state: "VIC", postcode: "3003", country_code: "AU" },
  ];
  const map = new Map<string, number>();
  for (const s of suburbs) {
    const id = await upsertByName(`Suburb: ${s.name}`, suburbsTable, s.name, s);
    map.set(s.name, id);
  }
  return map;
}

// ════════════════════════════════════════════════════════
// STEP 6 — COMMISSIONS
// ════════════════════════════════════════════════════════
async function seedCommissions(): Promise<Map<string, number>> {
  console.log("\n── STEP 6: Commissions ──");
  const comms = [
    { name: "10%_Standard_Commission", commission_type: "Percentage", commission_rate: 10.0 },
    { name: "15%_Investment_Commission", commission_type: "Percentage", commission_rate: 15.0 },
    { name: "7%_Agent_Commission", commission_type: "Percentage", commission_rate: 7.0 },
  ];
  const map = new Map<string, number>();
  for (const c of comms) {
    const id = await upsertByName(`Commission: ${c.name}`, commissionsTable, c.name, c);
    map.set(c.name, id);
  }
  return map;
}

// ════════════════════════════════════════════════════════
// STEP 7 — CONTACTS
// ════════════════════════════════════════════════════════
async function seedContacts(): Promise<Map<string, number>> {
  console.log("\n── STEP 7: Contacts ──");
  const contacts = [
    { first_name: "HongYing", last_name: "Zhu", email: "hongying.zhu@millionstay.com.au", nationality: "CN" },
    { first_name: "Leona", last_name: "Owner", email: "leona@millionstay.com.au", nationality: "AU" },
    { first_name: "JieMei", last_name: "Owner", email: "jiemei@millionstay.com.au", nationality: "CN" },
    { first_name: "HAN", last_name: "Owner", email: "han@millionstay.com.au", nationality: "AU" },
    { first_name: "Dynamic", last_name: "Residential", email: "contact@dynamicresidential.com.au", nationality: "AU" },
    { first_name: "Melcrop", last_name: "RealEstate", email: "contact@melcorp.com.au", nationality: "AU" },
  ];
  const map = new Map<string, number>();
  for (const c of contacts) {
    const fullName = `${c.first_name} ${c.last_name}`;
    const existing = await db.select().from(contactsTable).where(eq(contactsTable.email, c.email)).limit(1);
    if (existing.length > 0) { skip(`Contact: ${fullName}`); map.set(fullName, existing[0].id); continue; }
    try {
      const [row] = await db.insert(contactsTable).values(c).returning({ id: contactsTable.id });
      ok(`Contact: ${fullName}`);
      map.set(fullName, row.id);
    } catch (e) { fail(`Contact: ${fullName}`, e); }
  }
  return map;
}

// ════════════════════════════════════════════════════════
// STEP 8 — ACCOUNTS
// ════════════════════════════════════════════════════════
async function seedAccounts(contactMap: Map<string, number>): Promise<Map<string, number>> {
  console.log("\n── STEP 8: Accounts ──");
  const accounts = [
    { name: "HongYingZhu_Landlord", account_type: "SpaceOwner", contact: "HongYing Zhu" },
    { name: "Leona_Landlord", account_type: "SpaceOwner", contact: "Leona Owner" },
    { name: "JieMei_Landlord", account_type: "SpaceOwner", contact: "JieMei Owner" },
    { name: "HAN_Landlord", account_type: "SpaceOwner", contact: "HAN Owner" },
    { name: "Dynamic Residential_Agent", account_type: "Agent", contact: "Dynamic Residential" },
    { name: "Melcorp Real Estate_Agent", account_type: "Agent", contact: "Melcrop RealEstate" },
    { name: "Million Stay", account_type: "Partner", contact: null },
  ];
  const map = new Map<string, number>();
  for (const a of accounts) {
    const primary_contact_id = a.contact ? contactMap.get(a.contact) : undefined;
    const id = await upsertByName(`Account: ${a.name}`, accountsTable, a.name, {
      name: a.name, account_type: a.account_type, primary_contact_id: primary_contact_id ?? null,
    });
    map.set(a.name, id);
  }
  return map;
}

// ════════════════════════════════════════════════════════
// STEP 9 — PROPERTIES
// ════════════════════════════════════════════════════════
async function seedProperties(suburbMap: Map<string, number>, accountMap: Map<string, number>): Promise<Map<string, number>> {
  console.log("\n── STEP 9: Properties ──");
  const props = [
    { name: "285 La Trobe Street, Melbourne", address: "285 La Trobe Street", suburb: "Melbourne CBD", owner: "HongYingZhu_Landlord", notes: "2BR 1BA, 2 Queen Beds" },
    { name: "118 Kavanagh Street, Southbank", address: "118 Kavanagh Street", suburb: "Southbank", owner: "Leona_Landlord", notes: "1BR 1BA, 2 Single Beds / 1 King Bed" },
    { name: "139 Bourke Street, Melbourne", address: "139 Bourke Street", suburb: "Melbourne CBD", owner: "Dynamic Residential_Agent", notes: "2BR 1BA, 2 Queen Beds" },
    { name: "336 Russell Street, Melbourne", address: "336 Russell Street", suburb: "Melbourne CBD", owner: "Melcorp Real Estate_Agent", notes: "2BR 2BA, 2 Queen Beds" },
    { name: "250 City Road, Southbank", address: "250 City Road", suburb: "Southbank", owner: "JieMei_Landlord", notes: "Investment-Type: Landlord 85% / Million Stay 15%" },
    { name: "53 Batman Street, West Melbourne", address: "53 Batman Street", suburb: "West Melbourne", owner: "HAN_Landlord", notes: "Entire apartment only. Bunk Bed + Queen Bed" },
  ];
  const map = new Map<string, number>();
  for (const p of props) {
    const id = await upsertByName(`Property: ${p.name}`, propertiesTable, p.name, {
      name: p.name,
      address: p.address,
      suburb_id: suburbMap.get(p.suburb),
      owner_account_id: accountMap.get(p.owner),
      approval_status: "Active",
      description: p.notes,
    });
    map.set(p.name, id);
  }
  return map;
}

// ════════════════════════════════════════════════════════
// STEP 10 — SPACE POLICIES
// ════════════════════════════════════════════════════════
async function seedSpacePolicies(): Promise<Map<string, number>> {
  console.log("\n── STEP 10: Space Policies ──");
  const policies = [
    { name: "Female or Mixed Gender", same_gender: false, lady_only: false, no_pet: true, no_smoking: true, minimum_age: 18 },
    { name: "Male or Female Only (Same Gender)", same_gender: true, lady_only: false, no_pet: true, no_smoking: true, minimum_age: 18 },
    { name: "Female Only", same_gender: true, lady_only: true, no_pet: true, no_smoking: true, minimum_age: 18 },
  ];
  const map = new Map<string, number>();
  for (const p of policies) {
    const id = await upsertByName(`SpacePolicy: ${p.name}`, spacePoliciesTable, p.name, p);
    map.set(p.name, id);
  }
  return map;
}

// ════════════════════════════════════════════════════════
// STEP 11 — SPACES
// ════════════════════════════════════════════════════════
async function createSpace(
  name: string,
  spaceType: string,
  propertyId: number,
  parentSpaceId: number | null,
  baseWeeklyPrice: number,
  maxOccupancy: number,
  policyId: number,
  landlordAccountId: number,
  optionNames: string[],
  optionMap: Map<string, number>,
): Promise<number> {
  const existing = await db.select().from(spacesTable).where(eq(spacesTable.name, name)).limit(1);
  let spaceId: number;
  if (existing.length > 0) {
    skip(`Space: ${name}`);
    spaceId = existing[0].id;
  } else {
    try {
      const [row] = await db.insert(spacesTable).values({
        name,
        space_type: spaceType,
        property_id: propertyId,
        parent_space_id: parentSpaceId,
        base_weekly_price: baseWeeklyPrice,
        max_occupancy: maxOccupancy,
        space_policy_id: policyId,
        landlord_account_id: landlordAccountId,
        booking_mode: "Request",
        status: "Active",
      }).returning({ id: spacesTable.id });
      ok(`Space: ${name}`);
      spaceId = row.id;
    } catch (e) {
      fail(`Space: ${name}`, e);
      return -1;
    }
  }
  // Insert space option maps (skip if already exist)
  for (const optName of optionNames) {
    const optId = optionMap.get(optName);
    if (!optId) { console.warn(`  ⚠️  Option not found: ${optName}`); continue; }
    const existingMap = await db.select().from(spaceOptionMapsTable)
      .where(and(eq(spaceOptionMapsTable.space_id, spaceId), eq(spaceOptionMapsTable.space_option_id, optId)))
      .limit(1);
    if (existingMap.length === 0) {
      await db.insert(spaceOptionMapsTable).values({ space_id: spaceId, space_option_id: optId });
    }
  }
  return spaceId;
}

async function seedSpaces(
  propertyMap: Map<string, number>,
  policyMap: Map<string, number>,
  accountMap: Map<string, number>,
  optionMap: Map<string, number>,
): Promise<Map<string, number>> {
  console.log("\n── STEP 11: Spaces ──");
  const spaceMap = new Map<string, number>();

  // PROPERTY 1: 285 La Trobe Street, Melbourne
  const p1 = propertyMap.get("285 La Trobe Street, Melbourne")!;
  const a1 = accountMap.get("HongYingZhu_Landlord")!;
  const pol_mixed = policyMap.get("Female or Mixed Gender")!;
  const id1A = await createSpace("285 La Trobe St, Melbourne_Entire Apartment", "EntireSpace", p1, null, 1100, 4, pol_mixed, a1, ["Queen Bed", "High-speed Wi-Fi", "Air-conditioning / Heating", "Washing Machine"], optionMap);
  spaceMap.set("285 La Trobe St, Melbourne_Entire Apartment", id1A);
  const id1B = await createSpace("285 La Trobe St_Room A — Single Room", "RoomSpace", p1, id1A, 530, 1, pol_mixed, a1, ["Queen Bed", "Private Bathroom (Own Bath)", "Desk & Ergonomic Chair", "Wardrobe / Built-in Closet", "High-speed Wi-Fi", "Air-conditioning / Heating"], optionMap);
  spaceMap.set("285 La Trobe St_Room A — Single Room", id1B);
  const id1C = await createSpace("285 La Trobe St_Room A — Couple Room", "RoomSpace", p1, id1A, 550, 2, pol_mixed, a1, ["Queen Bed", "Private Bathroom (Own Bath)", "Desk & Ergonomic Chair", "Wardrobe / Built-in Closet", "High-speed Wi-Fi", "Air-conditioning / Heating"], optionMap);
  spaceMap.set("285 La Trobe St_Room A — Couple Room", id1C);
  const id1D = await createSpace("285 La Trobe St_Room B — Single Room", "RoomSpace", p1, id1A, 530, 1, pol_mixed, a1, ["Queen Bed", "Private Bathroom (Own Bath)", "Desk & Ergonomic Chair", "Wardrobe / Built-in Closet", "High-speed Wi-Fi", "Air-conditioning / Heating"], optionMap);
  spaceMap.set("285 La Trobe St_Room B — Single Room", id1D);
  const id1E = await createSpace("285 La Trobe St_Room B — Couple Room", "RoomSpace", p1, id1A, 550, 2, pol_mixed, a1, ["Queen Bed", "High-speed Wi-Fi", "Air-conditioning / Heating"], optionMap);
  spaceMap.set("285 La Trobe St_Room B — Couple Room", id1E);

  // PROPERTY 2: 118 Kavanagh Street, Southbank
  const p2 = propertyMap.get("118 Kavanagh Street, Southbank")!;
  const a2 = accountMap.get("Leona_Landlord")!;
  const pol_same = policyMap.get("Male or Female Only (Same Gender)")!;
  const id2A = await createSpace("118 Kavanagh St, Southbank_Entire Apartment", "EntireSpace", p2, null, 850, 3, pol_same, a2, ["High-speed Wi-Fi", "Air-conditioning / Heating", "Washing Machine", "Refrigerator"], optionMap);
  spaceMap.set("118 Kavanagh St, Southbank_Entire Apartment", id2A);
  const id2B = await createSpace("118 Kavanagh St_Room A-1 — Shared Room", "RoomSpace", p2, id2A, 430, 1, pol_same, a2, ["Single Bed", "Shared Bathroom", "Desk & Ergonomic Chair", "Assigned Shelf / Locker", "High-speed Wi-Fi", "Air-conditioning / Heating"], optionMap);
  spaceMap.set("118 Kavanagh St_Room A-1 — Shared Room", id2B);
  const id2C = await createSpace("118 Kavanagh St_Room A-2 — Shared Room", "RoomSpace", p2, id2A, 430, 1, pol_same, a2, ["Single Bed", "Shared Bathroom", "Desk & Ergonomic Chair", "Assigned Shelf / Locker", "High-speed Wi-Fi", "Air-conditioning / Heating"], optionMap);
  spaceMap.set("118 Kavanagh St_Room A-2 — Shared Room", id2C);

  // PROPERTY 3: 139 Bourke Street, Melbourne
  const p3 = propertyMap.get("139 Bourke Street, Melbourne")!;
  const a3 = accountMap.get("Dynamic Residential_Agent")!;
  const id3A = await createSpace("139 Bourke St, Melbourne_Entire Apartment", "EntireSpace", p3, null, 980, 4, pol_mixed, a3, ["High-speed Wi-Fi", "Air-conditioning / Heating", "Washing Machine", "Refrigerator", "Elevator (Lift)"], optionMap);
  spaceMap.set("139 Bourke St, Melbourne_Entire Apartment", id3A);
  const id3B = await createSpace("139 Bourke St_Room A — Single Room", "RoomSpace", p3, id3A, 490, 1, pol_mixed, a3, ["Queen Bed", "Desk & Ergonomic Chair", "Wardrobe / Built-in Closet", "High-speed Wi-Fi", "Air-conditioning / Heating"], optionMap);
  spaceMap.set("139 Bourke St_Room A — Single Room", id3B);
  const id3C = await createSpace("139 Bourke St_Room A — Couple Room", "RoomSpace", p3, id3A, 510, 2, pol_mixed, a3, ["Queen Bed", "Desk & Ergonomic Chair", "High-speed Wi-Fi", "Air-conditioning / Heating"], optionMap);
  spaceMap.set("139 Bourke St_Room A — Couple Room", id3C);
  const id3D = await createSpace("139 Bourke St_Room B — Single Room", "RoomSpace", p3, id3A, 490, 1, pol_mixed, a3, ["Queen Bed", "Desk & Ergonomic Chair", "Wardrobe / Built-in Closet", "High-speed Wi-Fi"], optionMap);
  spaceMap.set("139 Bourke St_Room B — Single Room", id3D);
  const id3E = await createSpace("139 Bourke St_Room B — Couple Room", "RoomSpace", p3, id3A, 510, 2, pol_mixed, a3, ["Queen Bed", "High-speed Wi-Fi", "Air-conditioning / Heating"], optionMap);
  spaceMap.set("139 Bourke St_Room B — Couple Room", id3E);

  // PROPERTY 4: 336 Russell Street, Melbourne
  const p4 = propertyMap.get("336 Russell Street, Melbourne")!;
  const a4 = accountMap.get("Melcorp Real Estate_Agent")!;
  const id4A = await createSpace("336 Russell St, Melbourne_Entire Apartment", "EntireSpace", p4, null, 1040, 5, pol_same, a4, ["High-speed Wi-Fi", "Air-conditioning / Heating", "Washing Machine", "Gym / Fitness Centre", "Elevator (Lift)"], optionMap);
  spaceMap.set("336 Russell St, Melbourne_Entire Apartment", id4A);
  const id4B = await createSpace("336 Russell St_Room A — Single Room", "RoomSpace", p4, id4A, 430, 1, pol_same, a4, ["Queen Bed", "Private Bathroom (Own Bath)", "Desk & Ergonomic Chair", "Wardrobe / Built-in Closet", "High-speed Wi-Fi", "Air-conditioning / Heating"], optionMap);
  spaceMap.set("336 Russell St_Room A — Single Room", id4B);
  const id4C = await createSpace("336 Russell St_Room A — Couple Room", "RoomSpace", p4, id4A, 450, 2, pol_same, a4, ["Queen Bed", "Desk & Ergonomic Chair", "High-speed Wi-Fi", "Air-conditioning / Heating"], optionMap);
  spaceMap.set("336 Russell St_Room A — Couple Room", id4C);
  const id4D = await createSpace("336 Russell St_Room B — Single Room", "RoomSpace", p4, id4A, 420, 1, pol_same, a4, ["Queen Bed", "Desk & Ergonomic Chair", "Wardrobe / Built-in Closet", "High-speed Wi-Fi"], optionMap);
  spaceMap.set("336 Russell St_Room B — Single Room", id4D);
  const id4E = await createSpace("336 Russell St_Room B — Couple Room", "RoomSpace", p4, id4A, 450, 2, pol_same, a4, ["Queen Bed", "High-speed Wi-Fi", "Air-conditioning / Heating"], optionMap);
  spaceMap.set("336 Russell St_Room B — Couple Room", id4E);
  const id4F = await createSpace("336 Russell St_Living Room C — Queen Bed", "RoomSpace", p4, id4A, 420, 1, pol_same, a4, ["Queen Bed", "High-speed Wi-Fi", "Smart TV / TV in Room"], optionMap);
  spaceMap.set("336 Russell St_Living Room C — Queen Bed", id4F);

  // PROPERTY 5: 250 City Road, Southbank
  const p5 = propertyMap.get("250 City Road, Southbank")!;
  const a5 = accountMap.get("JieMei_Landlord")!;
  const id5A = await createSpace("250 City Rd, Southbank_Entire Apartment", "EntireSpace", p5, null, 1020, 4, pol_mixed, a5, ["High-speed Wi-Fi", "Air-conditioning / Heating", "Swimming Pool", "Gym / Fitness Centre", "Elevator (Lift)"], optionMap);
  spaceMap.set("250 City Rd, Southbank_Entire Apartment", id5A);
  const id5B = await createSpace("250 City Rd_Room A — Single Room", "RoomSpace", p5, id5A, 510, 1, pol_mixed, a5, ["Queen Bed", "Private Bathroom (Own Bath)", "Desk & Ergonomic Chair", "High-speed Wi-Fi", "Air-conditioning / Heating"], optionMap);
  spaceMap.set("250 City Rd_Room A — Single Room", id5B);
  const id5C = await createSpace("250 City Rd_Room A — Couple Room", "RoomSpace", p5, id5A, 530, 2, pol_mixed, a5, ["Queen Bed", "High-speed Wi-Fi", "Air-conditioning / Heating"], optionMap);
  spaceMap.set("250 City Rd_Room A — Couple Room", id5C);
  const id5D = await createSpace("250 City Rd_Room B — Single Room", "RoomSpace", p5, id5A, 510, 1, pol_mixed, a5, ["Queen Bed", "Desk & Ergonomic Chair", "High-speed Wi-Fi", "Air-conditioning / Heating"], optionMap);
  spaceMap.set("250 City Rd_Room B — Single Room", id5D);
  const id5E = await createSpace("250 City Rd_Room B — Couple Room", "RoomSpace", p5, id5A, 530, 2, pol_mixed, a5, ["Queen Bed", "High-speed Wi-Fi"], optionMap);
  spaceMap.set("250 City Rd_Room B — Couple Room", id5E);

  // PROPERTY 6: 53 Batman Street, West Melbourne
  const p6 = propertyMap.get("53 Batman Street, West Melbourne")!;
  const a6 = accountMap.get("HAN_Landlord")!;
  const id6A = await createSpace("53 Batman St, West Melbourne_Entire Apartment", "EntireSpace", p6, null, 790, 4, pol_same, a6, ["Queen Bed", "Bunk Bed", "High-speed Wi-Fi", "Air-conditioning / Heating", "Washing Machine", "Refrigerator"], optionMap);
  spaceMap.set("53 Batman St, West Melbourne_Entire Apartment", id6A);

  return spaceMap;
}

// ════════════════════════════════════════════════════════
// STEP 12 — PRODUCTS (Accommodation Tiers)
// ════════════════════════════════════════════════════════
async function seedAccommodationProducts(
  spaceMap: Map<string, number>,
  accountMap: Map<string, number>,
  productGroupMap: Map<string, number>,
  productTypeMap: Map<string, number>,
  commissionMap: Map<string, number>,
) {
  console.log("\n── STEP 12: Accommodation Products ──");
  const millionStayId = accountMap.get("Million Stay")!;
  const accGroupId = productGroupMap.get("Accommodation")!;
  const managedAccTypeId = productTypeMap.get("Managed Accommodation")!;
  const investAccTypeId = productTypeMap.get("Investment-Type Accommodation")!;
  const commId = commissionMap.get("10%_Standard_Commission")!;

  // Space entries: [spaceName, providerAccountName, isInvestment, 4wkPrice, 12wkPrice, 24wkPrice, shortLabel]
  const spaceProducts: Array<{
    spaceName: string;
    provider: string;
    isInvestment: boolean;
    p4: number; p12: number; p24: number;
    label: string;
  }> = [
    // 285 La Trobe
    { spaceName: "285 La Trobe St, Melbourne_Entire Apartment", provider: "HongYingZhu_Landlord", isInvestment: false, p4: 1100, p12: 1060, p24: 1030, label: "285 La Trobe St — Entire" },
    { spaceName: "285 La Trobe St_Room A — Single Room", provider: "HongYingZhu_Landlord", isInvestment: false, p4: 530, p12: 510, p24: 480, label: "285 La Trobe St_Room A — Single" },
    { spaceName: "285 La Trobe St_Room A — Couple Room", provider: "HongYingZhu_Landlord", isInvestment: false, p4: 550, p12: 530, p24: 500, label: "285 La Trobe St_Room A — Couple" },
    { spaceName: "285 La Trobe St_Room B — Single Room", provider: "HongYingZhu_Landlord", isInvestment: false, p4: 530, p12: 510, p24: 480, label: "285 La Trobe St_Room B — Single" },
    { spaceName: "285 La Trobe St_Room B — Couple Room", provider: "HongYingZhu_Landlord", isInvestment: false, p4: 550, p12: 530, p24: 500, label: "285 La Trobe St_Room B — Couple" },
    // 118 Kavanagh
    { spaceName: "118 Kavanagh St, Southbank_Entire Apartment", provider: "Leona_Landlord", isInvestment: false, p4: 850, p12: 810, p24: 780, label: "118 Kavanagh St — Entire" },
    { spaceName: "118 Kavanagh St_Room A-1 — Shared Room", provider: "Leona_Landlord", isInvestment: false, p4: 430, p12: 410, p24: 380, label: "118 Kavanagh St_Room A-1 — Shared" },
    { spaceName: "118 Kavanagh St_Room A-2 — Shared Room", provider: "Leona_Landlord", isInvestment: false, p4: 430, p12: 410, p24: 380, label: "118 Kavanagh St_Room A-2 — Shared" },
    // 139 Bourke
    { spaceName: "139 Bourke St, Melbourne_Entire Apartment", provider: "Dynamic Residential_Agent", isInvestment: false, p4: 980, p12: 920, p24: 870, label: "139 Bourke St — Entire" },
    { spaceName: "139 Bourke St_Room A — Single Room", provider: "Dynamic Residential_Agent", isInvestment: false, p4: 490, p12: 470, p24: 440, label: "139 Bourke St_Room A — Single" },
    { spaceName: "139 Bourke St_Room A — Couple Room", provider: "Dynamic Residential_Agent", isInvestment: false, p4: 510, p12: 490, p24: 460, label: "139 Bourke St_Room A — Couple" },
    { spaceName: "139 Bourke St_Room B — Single Room", provider: "Dynamic Residential_Agent", isInvestment: false, p4: 490, p12: 470, p24: 440, label: "139 Bourke St_Room B — Single" },
    { spaceName: "139 Bourke St_Room B — Couple Room", provider: "Dynamic Residential_Agent", isInvestment: false, p4: 510, p12: 490, p24: 460, label: "139 Bourke St_Room B — Couple" },
    // 336 Russell
    { spaceName: "336 Russell St, Melbourne_Entire Apartment", provider: "Melcorp Real Estate_Agent", isInvestment: false, p4: 1040, p12: 980, p24: 920, label: "336 Russell St — Entire" },
    { spaceName: "336 Russell St_Room A — Single Room", provider: "Melcorp Real Estate_Agent", isInvestment: false, p4: 430, p12: 410, p24: 380, label: "336 Russell St_Room A — Single" },
    { spaceName: "336 Russell St_Room A — Couple Room", provider: "Melcorp Real Estate_Agent", isInvestment: false, p4: 450, p12: 430, p24: 400, label: "336 Russell St_Room A — Couple" },
    { spaceName: "336 Russell St_Room B — Single Room", provider: "Melcorp Real Estate_Agent", isInvestment: false, p4: 420, p12: 400, p24: 370, label: "336 Russell St_Room B — Single" },
    { spaceName: "336 Russell St_Room B — Couple Room", provider: "Melcorp Real Estate_Agent", isInvestment: false, p4: 450, p12: 430, p24: 400, label: "336 Russell St_Room B — Couple" },
    { spaceName: "336 Russell St_Living Room C — Queen Bed", provider: "Melcorp Real Estate_Agent", isInvestment: false, p4: 420, p12: 400, p24: 370, label: "336 Russell St_Living Room C — Queen" },
    // 250 City Rd (Investment)
    { spaceName: "250 City Rd, Southbank_Entire Apartment", provider: "JieMei_Landlord", isInvestment: true, p4: 1020, p12: 960, p24: 910, label: "250 City Rd — Entire" },
    { spaceName: "250 City Rd_Room A — Single Room", provider: "JieMei_Landlord", isInvestment: true, p4: 510, p12: 490, p24: 460, label: "250 City Rd_Room A — Single" },
    { spaceName: "250 City Rd_Room A — Couple Room", provider: "JieMei_Landlord", isInvestment: true, p4: 530, p12: 510, p24: 480, label: "250 City Rd_Room A — Couple" },
    { spaceName: "250 City Rd_Room B — Single Room", provider: "JieMei_Landlord", isInvestment: true, p4: 510, p12: 490, p24: 460, label: "250 City Rd_Room B — Single" },
    { spaceName: "250 City Rd_Room B — Couple Room", provider: "JieMei_Landlord", isInvestment: true, p4: 530, p12: 510, p24: 480, label: "250 City Rd_Room B — Couple" },
    // 53 Batman
    { spaceName: "53 Batman St, West Melbourne_Entire Apartment", provider: "HAN_Landlord", isInvestment: false, p4: 790, p12: 770, p24: 740, label: "53 Batman St — Entire" },
  ];

  const tiers = [
    { tag: "Min 4 weeks", suffix: "(4-Week Rate)", period: 28, priceKey: "p4" as const },
    { tag: "Min 12 weeks", suffix: "(12-Week Rate)", period: 84, priceKey: "p12" as const },
    { tag: "Min 24 weeks", suffix: "(24-Week Rate)", period: 168, priceKey: "p24" as const },
  ];

  for (const sp of spaceProducts) {
    const spaceId = spaceMap.get(sp.spaceName);
    if (!spaceId || spaceId < 0) { console.warn(`  ⚠️  Space not found: ${sp.spaceName}`); continue; }
    const providerId = accountMap.get(sp.provider);
    const typeId = sp.isInvestment ? investAccTypeId : managedAccTypeId;

    for (const tier of tiers) {
      const productName = `${sp.label} ${tier.suffix}`;
      const price = sp[tier.priceKey];
      const existing = await db.select().from(accommodationCatalogTable).where(eq(accommodationCatalogTable.name, productName)).limit(1);
      if (existing.length > 0) { skip(`Product: ${productName}`); continue; }
      try {
        await db.insert(accommodationCatalogTable).values({
          name: productName,
          product_group_id: accGroupId,
          product_type_id: typeId,
          space_id: spaceId,
          price,
          currency: "AUD",
          product_tag: tier.tag,
          gst_included: false,
          commission_id: commId,
          product_source_account_id: millionStayId,
          product_provider_account_id: providerId,
          min_contract_period: tier.period,
          min_contract_period_unit: "Day",
          display_on_booking_page: true,
          display_on_invoice: true,
          status: "Active",
        });
        ok(`Product: ${productName}`);
      } catch (e) { fail(`Product: ${productName}`, e); }
    }
  }
}

// ════════════════════════════════════════════════════════
// STEP 13 — SERVICE / FEE PRODUCTS
// ════════════════════════════════════════════════════════
async function seedFeeProducts(
  accountMap: Map<string, number>,
  productGroupMap: Map<string, number>,
  productTypeMap: Map<string, number>,
) {
  console.log("\n── STEP 13: Service / Fee Products ──");
  const millionStayId = accountMap.get("Million Stay")!;
  const serviceGroupId = productGroupMap.get("Service")!;
  const goodGroupId = productGroupMap.get("Good")!;
  const directServiceTypeId = productTypeMap.get("Direct-Operated Service")!;
  const managedGoodsTypeId = productTypeMap.get("Managed Goods")!;
  const directGoodsTypeId = productTypeMap.get("Direct-Operated Goods")!;

  const feeProducts = [
    { name: "Room Deposit", groupId: serviceGroupId, typeId: directServiceTypeId, price: 1000, desc: "Refundable within 14 days after checkout, if no damage or excess cleaning", tag: "Refundable Deposit" },
    { name: "Admission Fee", groupId: serviceGroupId, typeId: directServiceTypeId, price: 200, desc: "Non-refundable. Covers admin & processing costs.", tag: "Non-refundable" },
    { name: "Cleaning Fee", groupId: serviceGroupId, typeId: directServiceTypeId, price: 300, desc: "Non-negotiable. Covers steam cleaning, kitchen, and common areas.", tag: "Mandatory" },
    { name: "Airport Pickup — Melbourne", groupId: serviceGroupId, typeId: directServiceTypeId, price: 220, desc: "Optional airport pickup service to property.", tag: "Optional" },
    { name: "Vodafone SIM Card ($35 Pack)", groupId: goodGroupId, typeId: managedGoodsTypeId, price: 35, desc: "Vodafone prepaid SIM card — $35 starter pack. Optional.", tag: "Optional" },
    { name: "Linen Pack", groupId: goodGroupId, typeId: directGoodsTypeId, price: 120, desc: "Bed sheet, pillowcase, quilt cover. Not included in rent — can be purchased before agreement.", tag: "Optional" },
  ];

  for (const p of feeProducts) {
    const existing = await db.select().from(accommodationCatalogTable).where(eq(accommodationCatalogTable.name, p.name)).limit(1);
    if (existing.length > 0) { skip(`FeeProduct: ${p.name}`); continue; }
    try {
      await db.insert(accommodationCatalogTable).values({
        name: p.name,
        item_description: p.desc,
        product_group_id: p.groupId,
        product_type_id: p.typeId,
        space_id: null,
        price: p.price,
        currency: "AUD",
        product_tag: p.tag,
        gst_included: false,
        product_source_account_id: millionStayId,
        display_on_booking_page: true,
        display_on_invoice: true,
        status: "Active",
      });
      ok(`FeeProduct: ${p.name}`);
    } catch (e) { fail(`FeeProduct: ${p.name}`, e); }
  }
}

// ════════════════════════════════════════════════════════
// STEP 14 — VERIFY
// ════════════════════════════════════════════════════════
async function verifyData() {
  console.log("\n── STEP 14: Verification ──");
  const counts = await db.execute<{ table_name: string; count: string }>(`
    SELECT 'contract_types'  AS table_name, COUNT(*)::text AS count FROM contract_types
    UNION ALL SELECT 'product_groups',  COUNT(*)::text FROM product_groups
    UNION ALL SELECT 'product_types',   COUNT(*)::text FROM product_types
    UNION ALL SELECT 'accommodation_catalog', COUNT(*)::text FROM accommodation_catalog
    UNION ALL SELECT 'space_options',   COUNT(*)::text FROM space_options
    UNION ALL SELECT 'suburbs',         COUNT(*)::text FROM suburbs
    UNION ALL SELECT 'commissions',     COUNT(*)::text FROM commissions
    UNION ALL SELECT 'contacts',        COUNT(*)::text FROM contacts
    UNION ALL SELECT 'accounts',        COUNT(*)::text FROM accounts
    UNION ALL SELECT 'properties',      COUNT(*)::text FROM properties
    UNION ALL SELECT 'space_policies',  COUNT(*)::text FROM space_policies
    UNION ALL SELECT 'spaces',          COUNT(*)::text FROM spaces
    ORDER BY table_name
  `);
  console.log("\n┌─────────────────────────┬────────┐");
  console.log("│ Table                   │  Count │");
  console.log("├─────────────────────────┼────────┤");
  for (const row of (counts as any).rows ?? counts) {
    const name = (row.table_name as string).padEnd(23);
    const cnt = String(row.count).padStart(6);
    console.log(`│ ${name} │ ${cnt} │`);
  }
  console.log("└─────────────────────────┴────────┘");
}

// ════════════════════════════════════════════════════════
// MAIN
// ════════════════════════════════════════════════════════
async function main() {
  console.log("🚀 Starting Million Stay real data seed...\n");
  try {
    await seedContractTypes();
    const productGroupMap = await seedProductGroups();
    const productTypeMap = await seedProductTypes();
    const optionMap = await seedSpaceOptions();
    const suburbMap = await seedSuburbs();
    const commissionMap = await seedCommissions();
    const contactMap = await seedContacts();
    const accountMap = await seedAccounts(contactMap);
    const propertyMap = await seedProperties(suburbMap, accountMap);
    const policyMap = await seedSpacePolicies();
    const spaceMap = await seedSpaces(propertyMap, policyMap, accountMap, optionMap);
    await seedAccommodationProducts(spaceMap, accountMap, productGroupMap, productTypeMap, commissionMap);
    await seedFeeProducts(accountMap, productGroupMap, productTypeMap);
    await verifyData();
  } catch (err) {
    console.error("Fatal error:", err);
    process.exit(1);
  }

  console.log(`\n══════════════════════════════════════`);
  console.log(`  Created : ${stats.created}`);
  console.log(`  Skipped : ${stats.skipped}`);
  console.log(`  Failed  : ${stats.failed}`);
  console.log(`══════════════════════════════════════`);
  process.exit(stats.failed > 0 ? 1 : 0);
}

main();
