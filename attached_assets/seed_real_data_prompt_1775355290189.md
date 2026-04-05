# Million Stay — 실 운영 데이터 시딩 프롬프트
# 파일: Million_Stay_Fee_List_2025_Dec_by_Sunjae.xlsx 기반
# Replit AI 채팅창에 아래 프롬프트를 붙여넣기 하세요.

---

```
Seed the Million Stay database with real operational data.
Use the existing API endpoints to insert all records in the correct order.
Create a single script: scripts/seed-real-data.ts (or .js)
Run it with: pnpm tsx scripts/seed-real-data.ts

All inserts must use the existing DB schema (Drizzle).
If a record already exists (same name), skip it (upsert or check first).
Log each step: console.log('✅ Created: X') or console.log('⏭️ Skipped: X')

════════════════════════════════════════════════════════
STEP 1 — CONTRACT TYPES
════════════════════════════════════════════════════════
Insert into contract_types table:

Accommodation Contract Types:
1. name: "Casual Stay Contract"
   description: "Short-term, flexible stay with no long-term commitment"
   contract_security: "Public"
   require_passport: true
   require_visa: false
   require_enrollment: false

2. name: "Weekly Contract"
   description: "Rent is billed weekly with a weekly commitment"
   contract_security: "Public"
   require_passport: true
   require_visa: false
   require_enrollment: false

3. name: "Monthly Contract"
   description: "Standard monthly rental arrangement"
   contract_security: "Public"
   require_passport: true
   require_visa: true
   require_enrollment: false

4. name: "Annual Contract"
   description: "Long-term 12-month housing contract"
   contract_security: "Private"
   require_passport: true
   require_visa: true
   require_enrollment: true

Service Contract Types:
5. name: "Casual Service"
   description: "One-time or ad-hoc service engagement"
   contract_security: "Public"

6. name: "Contractor Agreement"
   description: "Service done by external providers or freelancers"
   contract_security: "Public"

7. name: "Part-Time Employment"
   description: "Staff hired with part-time work hours"
   contract_security: "Private"

8. name: "Full-Time Employment"
   description: "Permanent full-time staff"
   contract_security: "Private"

════════════════════════════════════════════════════════
STEP 2 — PRODUCT GROUPS
════════════════════════════════════════════════════════
Insert into product_groups table:

1. name: "Accommodation"  display_order: 1
2. name: "Service"        display_order: 2
3. name: "Good"           display_order: 3

════════════════════════════════════════════════════════
STEP 3 — PRODUCT TYPES
════════════════════════════════════════════════════════
Insert into product_types table:

Accommodation Types:
1. name: "Managed Accommodation"
   description: "Properties managed on behalf of landlords. Million Stay handles tenant management, rent collection, maintenance, and CS."

2. name: "Direct-Operated Accommodation"
   description: "Properties owned or leased by Million Stay with full operational control including pricing, service quality, and revenue."

3. name: "Investment-Type Accommodation"
   description: "Properties involving investor participation with revenue share agreements."

Service Types:
4. name: "Managed Service"
   description: "Services provided by third-party vendors; Million Stay coordinates but does not operate directly."

5. name: "Direct-Operated Service"
   description: "Services operated internally by Million Stay using in-house staff or systems."

6. name: "Investment-Type Service"
   description: "Services created through investor-funded or revenue-share structures."

Goods Types:
7. name: "Managed Goods"
   description: "Items supplied by third-party vendors; Million Stay acts as distributor or reseller."

8. name: "Direct-Operated Goods"
   description: "Million Stay purchases, owns, and sells goods directly."

9. name: "Investment-Type Goods"
   description: "Goods funded by investors with shared revenue structures."

════════════════════════════════════════════════════════
STEP 4 — SPACE OPTIONS
════════════════════════════════════════════════════════
Insert into space_options table.
Field: name, option_category, is_active: true

-- A. Property-Level Options (option_category: "Property Amenity") --
1.  "Carpark / On-site Parking"
2.  "Swimming Pool"
3.  "Gym / Fitness Centre"
4.  "Sauna / Steam Room"
5.  "Co-working Space / Study Lounge"
6.  "Meeting Room"
7.  "BBQ Area"
8.  "Garden / Rooftop Terrace"
9.  "Concierge / Building Security"
10. "Parcel Locker / Mailbox"
11. "Elevator (Lift)"
12. "Wheelchair Accessible"
13. "Bicycle Storage"
14. "Garbage Room / Recycling Facility"

-- B. Room-Level Options (option_category: "Room Feature") --
15. "Private Bathroom (Own Bath)"
16. "Shared Bathroom"
17. "Queen Bed"
18. "Double Bed"
19. "Twin Single Bed"
20. "Bunk Bed"
21. "Desk & Ergonomic Chair"
22. "Smart TV / TV in Room"
23. "Wardrobe / Built-in Closet"
24. "Window / City View"
25. "Air-conditioning / Heating"
26. "Key Lock / Digital Lock"
27. "Mini Fridge (Optional)"
28. "Balcony Access"
29. "Extra Storage Drawer"

-- C. Bed-Level Options (option_category: "Bed Feature") --
30. "Single Bed"
31. "King Single Bed"
32. "Bunk Bed (Upper)"
33. "Bunk Bed (Lower)"
34. "Privacy Curtain"
35. "Personal Reading Light"
36. "Personal Power Outlet / USB Port"
37. "Under-bed Storage"
38. "Assigned Shelf / Locker"
39. "Mattress Included"
40. "Bedding Set Included (Optional)"

-- D. General Amenities (option_category: "Amenity") --
41. "High-speed Wi-Fi"
42. "Washing Machine"
43. "Dryer"
44. "Refrigerator"
45. "Microwave"
46. "Stove / Cooktop"
47. "Electric Kettle"
48. "Rice Cooker"
49. "Smoke Detector"
50. "Fire Extinguisher"

════════════════════════════════════════════════════════
STEP 5 — SUBURBS
════════════════════════════════════════════════════════
Insert into suburbs table:

1. name: "Melbourne CBD"  state: "VIC"  postcode: "3000"  country: "AU"
2. name: "Southbank"      state: "VIC"  postcode: "3006"  country: "AU"
3. name: "West Melbourne" state: "VIC"  postcode: "3003"  country: "AU"

════════════════════════════════════════════════════════
STEP 6 — COMMISSIONS
════════════════════════════════════════════════════════
Insert into commissions table:

1. name: "10%_Standard_Commission"
   commission_type: "Percentage"
   commission_rate: 10.0000

2. name: "15%_Investment_Commission"
   commission_type: "Percentage"
   commission_rate: 15.0000

3. name: "7%_Agent_Commission"
   commission_type: "Percentage"
   commission_rate: 7.0000

════════════════════════════════════════════════════════
STEP 7 — CONTACTS (Space Owners / Agents)
════════════════════════════════════════════════════════
Insert into contacts table:

1. first_name: "HongYing"  last_name: "Zhu"
   email: "hongying.zhu@millionstay.com.au"
   nationality: "CN"

2. first_name: "Leona"  last_name: "Owner"
   email: "leona@millionstay.com.au"
   nationality: "AU"

3. first_name: "JieMei"  last_name: "Owner"
   email: "jiemei@millionstay.com.au"
   nationality: "CN"

4. first_name: "HAN"  last_name: "Owner"
   email: "han@millionstay.com.au"
   nationality: "AU"

5. first_name: "Dynamic"  last_name: "Residential"
   email: "contact@dynamicresidential.com.au"
   nationality: "AU"

6. first_name: "Melcrop"  last_name: "RealEstate"
   email: "contact@melcorp.com.au"
   nationality: "AU"

════════════════════════════════════════════════════════
STEP 8 — ACCOUNTS (Space Owners / Agents)
════════════════════════════════════════════════════════
Insert into accounts table.
Link primary_contact_id to contacts created in Step 7.

1. name: "HongYingZhu_Landlord"
   account_type: "SpaceOwner"
   primary_contact: "HongYing Zhu"

2. name: "Leona_Landlord"
   account_type: "SpaceOwner"
   primary_contact: "Leona Owner"

3. name: "JieMei_Landlord"
   account_type: "SpaceOwner"
   primary_contact: "JieMei Owner"

4. name: "HAN_Landlord"
   account_type: "SpaceOwner"
   primary_contact: "HAN Owner"

5. name: "Dynamic Residential_Agent"
   account_type: "Agent"
   primary_contact: "Dynamic Residential"

6. name: "Melcorp Real Estate_Agent"
   account_type: "Agent"
   primary_contact: "Melcrop RealEstate"

7. name: "Million Stay"
   account_type: "Partner"
   (This is the platform operator — may already exist)

════════════════════════════════════════════════════════
STEP 9 — PROPERTIES
════════════════════════════════════════════════════════
Insert into properties table.
Set approval_status: "Active" for all.

1. name: "285 La Trobe Street, Melbourne"
   building_name: "3901 2 Bedroom 1 Bathroom | 2 Queen Bed"
   address_line1: "285 La Trobe Street"
   suburb: "Melbourne CBD" (VIC 3000)
   owner_account: "HongYingZhu_Landlord"
   notes: "2BR 1BA, 2 Queen Beds"

2. name: "118 Kavanagh Street, Southbank"
   building_name: "1 Bedroom 1 Bathroom | 2 Single Bed / 1 King Bed"
   address_line1: "118 Kavanagh Street"
   suburb: "Southbank" (VIC 3006)
   owner_account: "Leona_Landlord"
   notes: "1BR 1BA, 2 Single Beds / 1 King Bed"

3. name: "139 Bourke Street, Melbourne"
   building_name: "2 Bedroom 1 Bathroom | 2 Queen Bed"
   address_line1: "139 Bourke Street"
   suburb: "Melbourne CBD" (VIC 3000)
   owner_account: "Dynamic Residential_Agent"
   notes: "2BR 1BA, 2 Queen Beds"

4. name: "336 Russell Street, Melbourne"
   building_name: "2 Bedroom 2 Bathroom | 2 Queen Bed"
   address_line1: "336 Russell Street"
   suburb: "Melbourne CBD" (VIC 3000)
   owner_account: "Melcorp Real Estate_Agent"
   notes: "2BR 2BA, 2 Queen Beds"

5. name: "250 City Road, Southbank"
   building_name: "2 Bedroom 1 Bathroom | 2 Queen Bed"
   address_line1: "250 City Road"
   suburb: "Southbank" (VIC 3006)
   owner_account: "JieMei_Landlord"
   notes: "Investment-Type: Landlord 85% / Million Stay 15%"

6. name: "53 Batman Street, West Melbourne"
   building_name: "2 Bedroom 1 Bathroom | 2 Queen Bed"
   address_line1: "53 Batman Street"
   suburb: "West Melbourne" (VIC 3003)
   owner_account: "HAN_Landlord"
   notes: "Entire apartment only. Bunk Bed + Queen Bed"

════════════════════════════════════════════════════════
STEP 10 — SPACE POLICIES
════════════════════════════════════════════════════════
Insert into space_policies table:

1. name: "Female or Mixed Gender"
   same_gender: false
   lady_only: false
   no_pet: true
   no_smoking: true
   minimum_age: 18

2. name: "Male or Female Only (Same Gender)"
   same_gender: true
   lady_only: false
   no_pet: true
   no_smoking: true
   minimum_age: 18

3. name: "Female Only"
   same_gender: true
   lady_only: true
   no_pet: true
   no_smoking: true
   minimum_age: 18

════════════════════════════════════════════════════════
STEP 11 — SPACES
════════════════════════════════════════════════════════
Insert into spaces table.
Each space needs: property_id, space_type, name,
                  base_weekly_price, booking_mode,
                  landlord_account_id, space_policy_id

Use base_weekly_price = the "Min. 4 Week" weekly fee from the fee list.
booking_mode: "Request" for all rooms (medium-long term stays).
min_stay_weeks: 4

────────────────────────────────────────
PROPERTY 1: 285 La Trobe Street, Melbourne
Owner: HongYingZhu_Landlord
────────────────────────────────────────
Space 1A (Parent — EntireSpace):
  name: "285 La Trobe St, Melbourne_Entire Apartment"
  space_type: "EntireSpace"
  parent_space: null
  base_weekly_price: 1100.00
  max_occupancy: 4
  policy: "Female or Mixed Gender"
  options: ["Queen Bed", "High-speed Wi-Fi",
            "Air-conditioning / Heating", "Washing Machine"]

Space 1B (Child of 1A):
  name: "285 La Trobe St_Room A — Single Room"
  space_type: "RoomSpace"
  parent_space: "285 La Trobe St, Melbourne_Entire Apartment"
  base_weekly_price: 530.00
  max_occupancy: 1
  policy: "Female or Mixed Gender"
  options: ["Queen Bed", "Private Bathroom (Own Bath)",
            "Desk & Ergonomic Chair", "Wardrobe / Built-in Closet",
            "High-speed Wi-Fi", "Air-conditioning / Heating"]

Space 1C (Child of 1A):
  name: "285 La Trobe St_Room A — Couple Room"
  space_type: "RoomSpace"
  parent_space: "285 La Trobe St, Melbourne_Entire Apartment"
  base_weekly_price: 550.00
  max_occupancy: 2
  policy: "Female or Mixed Gender"
  options: ["Queen Bed", "Private Bathroom (Own Bath)",
            "Desk & Ergonomic Chair", "Wardrobe / Built-in Closet",
            "High-speed Wi-Fi", "Air-conditioning / Heating"]

Space 1D (Child of 1A):
  name: "285 La Trobe St_Room B — Single Room"
  space_type: "RoomSpace"
  parent_space: "285 La Trobe St, Melbourne_Entire Apartment"
  base_weekly_price: 530.00
  max_occupancy: 1
  policy: "Female or Mixed Gender"
  options: ["Queen Bed", "Private Bathroom (Own Bath)",
            "Desk & Ergonomic Chair", "Wardrobe / Built-in Closet",
            "High-speed Wi-Fi", "Air-conditioning / Heating"]

Space 1E (Child of 1A):
  name: "285 La Trobe St_Room B — Couple Room"
  space_type: "RoomSpace"
  parent_space: "285 La Trobe St, Melbourne_Entire Apartment"
  base_weekly_price: 550.00
  max_occupancy: 2
  policy: "Female or Mixed Gender"
  options: ["Queen Bed", "High-speed Wi-Fi",
            "Air-conditioning / Heating"]

────────────────────────────────────────
PROPERTY 2: 118 Kavanagh Street, Southbank
Owner: Leona_Landlord
────────────────────────────────────────
Space 2A (Parent — EntireSpace):
  name: "118 Kavanagh St, Southbank_Entire Apartment"
  space_type: "EntireSpace"
  base_weekly_price: 850.00
  max_occupancy: 3
  policy: "Male or Female Only (Same Gender)"
  options: ["High-speed Wi-Fi", "Air-conditioning / Heating",
            "Washing Machine", "Refrigerator"]

Space 2B (Child of 2A):
  name: "118 Kavanagh St_Room A-1 — Shared Room"
  space_type: "RoomSpace"
  parent_space: "118 Kavanagh St, Southbank_Entire Apartment"
  base_weekly_price: 430.00
  max_occupancy: 1
  policy: "Male or Female Only (Same Gender)"
  options: ["Single Bed", "Shared Bathroom",
            "Desk & Ergonomic Chair", "Assigned Shelf / Locker",
            "High-speed Wi-Fi", "Air-conditioning / Heating"]

Space 2C (Child of 2A):
  name: "118 Kavanagh St_Room A-2 — Shared Room"
  space_type: "RoomSpace"
  parent_space: "118 Kavanagh St, Southbank_Entire Apartment"
  base_weekly_price: 430.00
  max_occupancy: 1
  policy: "Male or Female Only (Same Gender)"
  options: ["Single Bed", "Shared Bathroom",
            "Desk & Ergonomic Chair", "Assigned Shelf / Locker",
            "High-speed Wi-Fi", "Air-conditioning / Heating"]

────────────────────────────────────────
PROPERTY 3: 139 Bourke Street, Melbourne
Owner: Dynamic Residential_Agent
────────────────────────────────────────
Space 3A (Parent — EntireSpace):
  name: "139 Bourke St, Melbourne_Entire Apartment"
  space_type: "EntireSpace"
  base_weekly_price: 980.00
  max_occupancy: 4
  policy: "Female or Mixed Gender"
  options: ["High-speed Wi-Fi", "Air-conditioning / Heating",
            "Washing Machine", "Refrigerator", "Elevator (Lift)"]

Space 3B (Child of 3A):
  name: "139 Bourke St_Room A — Single Room"
  space_type: "RoomSpace"
  parent_space: "139 Bourke St, Melbourne_Entire Apartment"
  base_weekly_price: 490.00
  max_occupancy: 1
  policy: "Female or Mixed Gender"
  options: ["Queen Bed", "Desk & Ergonomic Chair",
            "Wardrobe / Built-in Closet", "High-speed Wi-Fi",
            "Air-conditioning / Heating"]

Space 3C (Child of 3A):
  name: "139 Bourke St_Room A — Couple Room"
  space_type: "RoomSpace"
  parent_space: "139 Bourke St, Melbourne_Entire Apartment"
  base_weekly_price: 510.00
  max_occupancy: 2
  policy: "Female or Mixed Gender"
  options: ["Queen Bed", "Desk & Ergonomic Chair",
            "High-speed Wi-Fi", "Air-conditioning / Heating"]

Space 3D (Child of 3A):
  name: "139 Bourke St_Room B — Single Room"
  space_type: "RoomSpace"
  parent_space: "139 Bourke St, Melbourne_Entire Apartment"
  base_weekly_price: 490.00
  max_occupancy: 1
  policy: "Female or Mixed Gender"
  options: ["Queen Bed", "Desk & Ergonomic Chair",
            "Wardrobe / Built-in Closet", "High-speed Wi-Fi"]

Space 3E (Child of 3A):
  name: "139 Bourke St_Room B — Couple Room"
  space_type: "RoomSpace"
  parent_space: "139 Bourke St, Melbourne_Entire Apartment"
  base_weekly_price: 510.00
  max_occupancy: 2
  policy: "Female or Mixed Gender"
  options: ["Queen Bed", "High-speed Wi-Fi",
            "Air-conditioning / Heating"]

────────────────────────────────────────
PROPERTY 4: 336 Russell Street, Melbourne
Owner: Melcorp Real Estate_Agent
────────────────────────────────────────
Space 4A (Parent — EntireSpace):
  name: "336 Russell St, Melbourne_Entire Apartment"
  space_type: "EntireSpace"
  base_weekly_price: 1040.00
  max_occupancy: 5
  policy: "Male or Female Only (Same Gender)"
  options: ["High-speed Wi-Fi", "Air-conditioning / Heating",
            "Washing Machine", "Gym / Fitness Centre",
            "Elevator (Lift)"]

Space 4B (Child of 4A):
  name: "336 Russell St_Room A — Single Room"
  space_type: "RoomSpace"
  parent_space: "336 Russell St, Melbourne_Entire Apartment"
  base_weekly_price: 430.00
  max_occupancy: 1
  policy: "Male or Female Only (Same Gender)"
  options: ["Queen Bed", "Private Bathroom (Own Bath)",
            "Desk & Ergonomic Chair", "Wardrobe / Built-in Closet",
            "High-speed Wi-Fi", "Air-conditioning / Heating"]

Space 4C (Child of 4A):
  name: "336 Russell St_Room A — Couple Room"
  space_type: "RoomSpace"
  parent_space: "336 Russell St, Melbourne_Entire Apartment"
  base_weekly_price: 450.00
  max_occupancy: 2
  policy: "Male or Female Only (Same Gender)"
  options: ["Queen Bed", "Desk & Ergonomic Chair",
            "High-speed Wi-Fi", "Air-conditioning / Heating"]

Space 4D (Child of 4A):
  name: "336 Russell St_Room B — Single Room"
  space_type: "RoomSpace"
  parent_space: "336 Russell St, Melbourne_Entire Apartment"
  base_weekly_price: 420.00
  max_occupancy: 1
  policy: "Male or Female Only (Same Gender)"
  options: ["Queen Bed", "Desk & Ergonomic Chair",
            "Wardrobe / Built-in Closet", "High-speed Wi-Fi"]

Space 4E (Child of 4A):
  name: "336 Russell St_Room B — Couple Room"
  space_type: "RoomSpace"
  parent_space: "336 Russell St, Melbourne_Entire Apartment"
  base_weekly_price: 450.00
  max_occupancy: 2
  policy: "Male or Female Only (Same Gender)"
  options: ["Queen Bed", "High-speed Wi-Fi",
            "Air-conditioning / Heating"]

Space 4F (Child of 4A):
  name: "336 Russell St_Living Room C — Queen Bed"
  space_type: "RoomSpace"
  parent_space: "336 Russell St, Melbourne_Entire Apartment"
  base_weekly_price: 420.00
  max_occupancy: 1
  policy: "Male or Female Only (Same Gender)"
  options: ["Queen Bed", "High-speed Wi-Fi", "Smart TV / TV in Room"]

────────────────────────────────────────
PROPERTY 5: 250 City Road, Southbank
Owner: JieMei_Landlord
────────────────────────────────────────
Space 5A (Parent — EntireSpace):
  name: "250 City Rd, Southbank_Entire Apartment"
  space_type: "EntireSpace"
  base_weekly_price: 1020.00
  max_occupancy: 4
  policy: "Female or Mixed Gender"
  options: ["High-speed Wi-Fi", "Air-conditioning / Heating",
            "Swimming Pool", "Gym / Fitness Centre", "Elevator (Lift)"]

Space 5B (Child of 5A):
  name: "250 City Rd_Room A — Single Room"
  space_type: "RoomSpace"
  parent_space: "250 City Rd, Southbank_Entire Apartment"
  base_weekly_price: 510.00
  max_occupancy: 1
  policy: "Female or Mixed Gender"
  options: ["Queen Bed", "Private Bathroom (Own Bath)",
            "Desk & Ergonomic Chair", "High-speed Wi-Fi",
            "Air-conditioning / Heating"]

Space 5C (Child of 5A):
  name: "250 City Rd_Room A — Couple Room"
  space_type: "RoomSpace"
  parent_space: "250 City Rd, Southbank_Entire Apartment"
  base_weekly_price: 530.00
  max_occupancy: 2
  policy: "Female or Mixed Gender"
  options: ["Queen Bed", "High-speed Wi-Fi",
            "Air-conditioning / Heating"]

Space 5D (Child of 5A):
  name: "250 City Rd_Room B — Single Room"
  space_type: "RoomSpace"
  parent_space: "250 City Rd, Southbank_Entire Apartment"
  base_weekly_price: 510.00
  max_occupancy: 1
  policy: "Female or Mixed Gender"
  options: ["Queen Bed", "Desk & Ergonomic Chair",
            "High-speed Wi-Fi", "Air-conditioning / Heating"]

Space 5E (Child of 5A):
  name: "250 City Rd_Room B — Couple Room"
  space_type: "RoomSpace"
  parent_space: "250 City Rd, Southbank_Entire Apartment"
  base_weekly_price: 530.00
  max_occupancy: 2
  policy: "Female or Mixed Gender"
  options: ["Queen Bed", "High-speed Wi-Fi"]

────────────────────────────────────────
PROPERTY 6: 53 Batman Street, West Melbourne
Owner: HAN_Landlord
────────────────────────────────────────
Space 6A (EntireSpace only — no rooms):
  name: "53 Batman St, West Melbourne_Entire Apartment"
  space_type: "EntireSpace"
  parent_space: null
  base_weekly_price: 790.00
  max_occupancy: 4
  policy: "Male or Female Only (Same Gender)"
  options: ["Queen Bed", "Bunk Bed", "High-speed Wi-Fi",
            "Air-conditioning / Heating", "Washing Machine",
            "Refrigerator"]

════════════════════════════════════════════════════════
STEP 12 — PRODUCTS
════════════════════════════════════════════════════════
For every RoomSpace and EntireSpace, create Products.
Each space gets 3 products (one per pricing tier).

Product naming: "{space_name}_{tier}"
  Tier 1: "Min 4 Weeks"   (base = space.base_weekly_price)
  Tier 2: "Min 12 Weeks"  (base = 4-week price - discount below)
  Tier 3: "Min 24 Weeks"  (base = 4-week price - larger discount)

Pricing tiers from the fee list:
  (4-week price is the base_weekly_price already set on space)
  12-week price = 4-week price - $20/week
  24-week price = 4-week price - $50/week
  (Note: some properties have different discounts — use $20/$50 as default)

Product configuration for ALL room products:
  product_group: "Accommodation"
  product_type: "Managed Accommodation"
     (exception: 250 City Road → "Investment-Type Accommodation")
  product_source: "Million Stay" account
  product_provider: the property's owner/agent account
  gst_included: false
     (Residential rent in Australia is GST-exempt)
  commission: "10%_Standard_Commission"
  min_contract_period: 28 (days)
  min_contract_period_unit: "Day"
  display_on_booking_page: true
  display_on_invoice: true

Create one product per room per tier.
Example for Space 1B (285 La Trobe_Room A Single):
  Product 1: 
    name: "285 La Trobe St_Room A — Single (4-Week Rate)"
    price: 530.00
    product_tag: "Min 4 weeks"
    min_contract_period: 28

  Product 2:
    name: "285 La Trobe St_Room A — Single (12-Week Rate)"
    price: 510.00
    product_tag: "Min 12 weeks"
    min_contract_period: 84

  Product 3:
    name: "285 La Trobe St_Room A — Single (24-Week Rate)"
    price: 500.00
    product_tag: "Min 24 weeks"
    min_contract_period: 168

Apply this same pattern to ALL room spaces using prices from Step 11.

Entire Apartment products (1 per tier, min period 28 days):
  285 La Trobe — Entire: $1100 / $1060 / $1030
  118 Kavanagh — Entire: $850  / $810  / $780
  139 Bourke   — Entire: $980  / $920  / $870
  336 Russell  — Entire: $1040 / $980  / $920
  250 City Rd  — Entire: $1020 / $960  / $910
  53 Batman St — Entire: $790  / $770  / $740

════════════════════════════════════════════════════════
STEP 13 — SERVICE / FEE PRODUCTS
════════════════════════════════════════════════════════
These are add-on fee products — not linked to a space.
product_group: "Service" or "Good" (as noted)
product_type: "Direct-Operated Service" or "Direct-Operated Goods"
product_source: "Million Stay"
gst_included: false (residential services exempt)
display_on_booking_page: true
display_on_invoice: true
min_contract_period: null

1. name: "Room Deposit"
   product_group: "Service"
   price: 1000.00
   item_description: "Refundable within 14 days after checkout, if no damage or excess cleaning"
   product_tag: "Refundable Deposit"

2. name: "Admission Fee"
   product_group: "Service"
   price: 200.00
   item_description: "Non-refundable. Covers admin & processing costs."
   product_tag: "Non-refundable"

3. name: "Cleaning Fee"
   product_group: "Service"
   price: 300.00
   item_description: "Non-negotiable. Covers steam cleaning, kitchen, and common areas."
   product_tag: "Mandatory"

4. name: "Airport Pickup — Melbourne"
   product_group: "Service"
   price: 220.00
   item_description: "Optional airport pickup service to property."
   product_tag: "Optional"

5. name: "Vodafone SIM Card ($35 Pack)"
   product_group: "Good"
   product_type: "Managed Goods"
   price: 35.00
   item_description: "Vodafone prepaid SIM card — $35 starter pack. Optional."
   product_tag: "Optional"

6. name: "Linen Pack"
   product_group: "Good"
   product_type: "Direct-Operated Goods"
   price: 120.00
   item_description: "Bed sheet, pillowcase, quilt cover. Not included in rent — can be purchased before agreement."
   product_tag: "Optional"

════════════════════════════════════════════════════════
STEP 14 — VERIFY ALL DATA
════════════════════════════════════════════════════════
After all inserts, run these counts and display results:

SELECT 'contract_types'  as table_name, COUNT(*) as count FROM contract_types
UNION ALL
SELECT 'product_groups',  COUNT(*) FROM product_groups
UNION ALL
SELECT 'product_types',   COUNT(*) FROM product_types
UNION ALL
SELECT 'space_options',   COUNT(*) FROM space_options
UNION ALL
SELECT 'suburbs',         COUNT(*) FROM suburbs
UNION ALL
SELECT 'commissions',     COUNT(*) FROM commissions
UNION ALL
SELECT 'contacts',        COUNT(*) FROM contacts
UNION ALL
SELECT 'accounts',        COUNT(*) FROM accounts
UNION ALL
SELECT 'properties',      COUNT(*) FROM properties
UNION ALL
SELECT 'space_policies',  COUNT(*) FROM space_policies
UNION ALL
SELECT 'spaces',          COUNT(*) FROM spaces
UNION ALL
SELECT 'products',        COUNT(*) FROM products
ORDER BY table_name;

Expected results:
  contract_types : 8
  product_groups : 3
  product_types  : 9
  space_options  : 50
  suburbs        : 3
  commissions    : 3
  contacts       : 6+ (existing + new)
  accounts       : 7+ (existing + new)
  properties     : 6
  space_policies : 3
  spaces         : 21 (6 entire + 15 rooms)
  products       : 63+ (21 spaces × 3 tiers + 6 fee products)

Display the final count table clearly.
If any count is 0 or lower than expected, show what failed.

════════════════════════════════════════════════════════
IMPORTANT NOTES FOR THE SCRIPT
════════════════════════════════════════════════════════
1. Run all inserts in the order above (FK dependencies)
2. Use upsert logic (insert if not exists by name)
   to avoid duplicate errors on re-run
3. For space_option_map (space ↔ option junction):
   after creating each space, look up option IDs by name
   and insert into the junction table
4. For product.space_id: look up space by name
5. For product.product_provider_account_id: 
   look up account by name
6. Wrap everything in a try/catch
   — log success/failure per entity, do NOT abort on single failure
7. At the end: print a summary table of created vs skipped counts
```
