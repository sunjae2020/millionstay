# Million Stay — Replit Build Prompts (Prompt 2 ~ 10)
# Prompt 1 (Project Setup + Auth + Layout) is already complete.
# Use each prompt sequentially. Wait for completion before next.

---

# ████████████████████████████████████████
# PROMPT 2 — PROPERTY MODULE
# ████████████████████████████████████████

```
The project scaffold from Prompt 1 is complete (Auth + AdminLayout working).
Now build the PROPERTY module completely.

EXISTING PATTERNS TO FOLLOW:
- Same AdminLayout, sidebar, DataTable components
- API envelope: { success, data, meta, message }
- Soft delete: set is_active = false, never hard DELETE
- StatusBadge component for all status fields
- Section cards with blue section header labels
- Related tabs at top of detail pages

══════════════════════════════════════════
1. SUBURB  (sidebar: PROPERTY > Suburb)
Route: /property/suburbs
══════════════════════════════════════════
Server /api/v1/suburbs:
  GET    /           list, filter: country_code, state
                     search: name, area_name
  POST   /           create
  GET    /:id        detail
  PUT    /:id        update
  DELETE /:id        soft delete

List columns:
  Name | Area Name | State | Postcode | Country | Status | CreatedOn

Detail sections:
  General: name* (manual input checkbox)
  Main: area_name, state, postcode, country_code (dropdown),
        latitude, longitude
  Admin: Status, CreatedOn, ModifiedOn

Seed (3 records):
  Surry Hills — NSW 2010 — AU
  Southbank   — VIC 3006 — AU
  Fitzroy     — VIC 3065 — AU

══════════════════════════════════════════
2. PROPERTY  (sidebar: PROPERTY > Property)
Route: /property/properties
══════════════════════════════════════════
Server /api/v1/properties:
  GET    /                  list
                            filter: approval_status, suburb_id
                            search: name, address_line1
                            include: owner account name, suburb name,
                                     space count
  POST   /                  create
  GET    /:id               detail
  PUT    /:id               update
  DELETE /:id               soft delete
  PATCH  /:id/approve       set approval_status = Active
  PATCH  /:id/suspend       set approval_status = Suspended

List columns:
  Name | Address | Owner Account | Suburb | Approval Status | CreatedOn

Approval Status badge colors:
  Pending     = amber
  UnderReview = blue
  Active      = green
  Suspended   = red
  Rejected    = gray

Detail sections:
  General: name* (manual input checkbox)
  Main:
    Address Line 1*, Address Line 2, Address Line 3
    Flat/Unit Number, Street Number, Street Name
    Suburb* (LookupField → suburb)
    Building/Property Name
    State, Postcode, Country
  Accounts:
    Owner Account* (LookupField → account, type: SpaceOwner)
  Admin: approval_status (read-only badge), Status, CreatedOn, ModifiedOn

  Action buttons (top right):
    [Update] [Approve] (amber, show only if Pending/UnderReview)
    [Suspend] (red, show only if Active) [Deactivate] [Field Rule]

  Related tabs: Account (PrimaryAddress) | Account (SecondaryAddress)
                Contact | Space

Seed (2 records):
  "336 Russell Street, Melbourne" — owner: TBD — suburb: Southbank
  "285 La Trobe Street, Melbourne" — owner: TBD — suburb: Southbank

══════════════════════════════════════════
3. SPACE OPTIONS  (sidebar: PROPERTY > SpaceOptions)
Route: /property/space-options
══════════════════════════════════════════
Server /api/v1/space-options: full CRUD

List columns: Name | Display Name | Category | Status | CreatedOn

Detail sections:
  General: name*
  Main:
    Option Display Name (textarea — shown on booking page)
    Option Category (dropdown: Furniture | Facility | Rule | Amenity)
    Icon Code (text — for UI icon mapping)
  Admin: Status, CreatedOn, ModifiedOn

Seed (8 records):
  WiFi (Facility), Air Conditioning (Facility), Heating (Facility),
  Desk Chair (Furniture), Wardrobe (Furniture), Private Bathroom (Facility),
  No Smoking (Rule), Weekly Cleaning (Amenity)

══════════════════════════════════════════
4. SPACE POLICY  (sidebar: PROPERTY > SpacePolicy)
Route: /property/space-policies
══════════════════════════════════════════
Server /api/v1/space-policies: full CRUD

List columns: Name | Same Gender | Lady Only | No Pet | Min Age | Status

Detail sections:
  General: name*
  Main (all Yes/No radio buttons):
    Same Gender, Lady Only, No Pet, No Smoking, Meal Option
  Age Restriction:
    Minimum Age (number input, optional)
    Maximum Age (number input, optional)
  Description: textarea
  Admin: Status, CreatedOn, ModifiedOn
  Related tab: Space

Seed (3 records):
  "Standard Room Policy" — no restrictions, min age 18
  "Female Only Room"     — lady_only: true, same_gender: true
  "Senior Living"        — min age 60, no_pet: true

══════════════════════════════════════════
5. SPACE  (sidebar: PROPERTY > Space)
Route: /property/spaces
══════════════════════════════════════════
Server /api/v1/spaces:
  GET    /                      list
                                filter: space_type, status,
                                        property_id, booking_mode
                                search: name
                                include: property name,
                                         parent space name,
                                         policy name,
                                         option tags (array)
  POST   /                      create (also inserts space_option_map rows)
  GET    /:id                   detail (include options, policy, images)
  PUT    /:id                   update (sync space_option_map)
  DELETE /:id                   soft delete
  PATCH  /:id/status            activate/deactivate
  GET    /:id/availability      30-day calendar from today
  POST   /:id/availability/block   body: { dates: [], reason }
  POST   /:id/availability/unblock body: { dates: [] }

List columns:
  Name | Type | Property | Parent Space | Booking Mode
  | Weekly Rate | Status | CreatedOn

Space Type badge:
  EntireSpace = indigo | RoomSpace = blue | BedSpace = teal

Detail sections:
  General:
    Manual Input checkbox
    Name*

  Property:
    Property* (LookupField → property, shows address)

  Space (Parent):
    Parent Space (LookupField → space, filtered by same property)
    NOTE: BedSpace must have RoomSpace or EntireSpace as parent
          RoomSpace must have EntireSpace as parent (validate)

  Main:
    Space Type* (dropdown: EntireSpace | RoomSpace | BedSpace | Other)
    Other Space Type Name (text, show only if type = Other)
    Space Options (MultiLookupField → space_option, shows tags)
      -- This writes to space_option_map junction table
    Max Number of Guests (number, default 1)
    Booking Mode* (dropdown: Instant | Request)

  Policy:
    Space Policy (LookupField → space_policy)

  Pricing:
    Base Weekly Price (decimal)
    Base Currency (dropdown, default AUD)
    Minimum Stay Weeks (number, default 4)

  Floor & Size:
    Floor Number (number, optional)
    Floor Area sqm (decimal, optional)

  Accounts:
    Landlord Account (LookupField → account, type: SpaceOwner)

  OTA Sync:
    iCal Import URL (text — paste AirBnB/Booking.com iCal URL)
    iCal Last Synced (read-only datetime)

  Others:
    Description (textarea)

  Owner / Admin:
    Owner (lookup → user_account)
    Status, CreatedOn, ModifiedOn

  Related Tabs:
    Contract | Product | Space (children — parent_space_id = this id)
    | SpaceImage | Availability (30-day calendar view)

  AVAILABILITY CALENDAR TAB:
    - Show current month (30 days) as grid
    - Green = available, Red = blocked
    - Click dates to multi-select
    - "Block Selected" button (orange) with reason dropdown:
      Manual | Maintenance | Owner Request
    - "Unblock Selected" button
    - Show booking_ref on blocked dates that have a booking

Seed (3 spaces under "336 Russell Street"):
  1. "336 Russell St_Entire Apartment" — EntireSpace — Instant
     base_weekly_price: 1200, max_occupancy: 4
  2. "Room A — Single" — RoomSpace — parent: above — Request
     base_weekly_price: 430, max_occupancy: 1
     options: WiFi, Air Conditioning, Desk Chair
     policy: Standard Room Policy
  3. "Room B — Single" — RoomSpace — parent: entire — Request
     base_weekly_price: 430, max_occupancy: 1
     options: WiFi, Heating, Wardrobe
     policy: Female Only Room

══════════════════════════════════════════
SHARED COMPONENTS (if not already built)
══════════════════════════════════════════
<LookupField>
  Props: label, value, displayText, onSearch, onClear, required, disabled
  - Search icon opens dialog modal
  - Modal has search input + scrollable results list
  - Selected value shown in orange text + X clear button
  - Required shows red border if empty on submit

<MultiLookupField>
  Props: label, values (array), onSearch, onRemove, required
  - Shows selected items as orange pill tags
  - "+ Add" button opens search dialog
  - Click X on tag to remove

<StatusBadge status="...">
  - Pill shape: rounded-full px-2 py-0.5 text-xs font-medium
  - Colors defined centrally in statusColors.js

Write all server routes, controllers, and React pages completely.
No partial code. No TODOs.
```

---

# ████████████████████████████████████████
# PROMPT 3 — CRM MODULE (Contact / Account)
# ████████████████████████████████████████

```
Property module is complete. Now build the CRM module.
Account and Contact are referenced by every other module.
Also build Commission and PaymentInfo now as they are 
referenced by Account.

══════════════════════════════════════════
1. COMMISSION  (sidebar: FINANCE > Commission)
Route: /finance/commission
══════════════════════════════════════════
Server /api/v1/commissions:
  GET    /     list, search: name
  POST   /     create
  GET    /:id  detail
  PUT    /:id  update
  DELETE /:id  soft delete
  Validation:
    Percentage type → commission_rate required (0.01–100)
    Fixed type      → commission_amount required (> 0)

List columns: Name | Type | Rate/Amount | Status | CreatedOn

Detail sections:
  General:
    Manual Input checkbox
    Name (auto-generate: "10%_Commission" or "Fixed_200")
  Main:
    Commission Type* (radio buttons: Fixed | Percentage)
  Details:
    Commission Percentage % (number, show if Percentage)
    Commission Amount AUD   (number, show if Fixed)
  Description: textarea
  Related tabs: Product | Beneficiary
  Admin: Status, CreatedOn, ModifiedOn

Seed:
  "10%_Commission" — Percentage — 10.0000%
  "Fixed_200"      — Fixed — AUD 200.00
  "7%_Agent"       — Percentage — 7.0000%

══════════════════════════════════════════
2. PAYMENT INFO  (sidebar: FINANCE > PaymentInfo)
Route: /finance/payment-info
══════════════════════════════════════════
Server /api/v1/payment-info: full CRUD

List columns: Name | Payment Type | Bank Name | Account Name | Status

Detail sections:
  General: Name*
  Type:
    Payment Type (dropdown: BankTransfer | PayID | International | Stripe)
  Bank Information: (show if BankTransfer or International)
    Bank Name
    Swift Code (show if International only)
  Account Information:
    BSB Number (show if BankTransfer — format XXX-XXX, validate 6 digits)
    Bank Account Number
    Account Name
  Stripe: (show if Stripe)
    Stripe Account ID (read-only)
  Others:
    Description (reference notes)
  Admin: Status, CreatedOn, ModifiedOn

══════════════════════════════════════════
3. CONTACT  (sidebar: ACCOUNT > Contact)
Route: /account/contacts
══════════════════════════════════════════
Server /api/v1/contacts:
  GET    /     list
               filter: nationality, gender, portal_enabled
               search: first_name, last_name, email, mobile_number
               include: linked account name
  POST   /     create
  GET    /:id  detail
  PUT    /:id  update
  DELETE /:id  soft delete (block if has active portal access)
  PATCH  /:id/status

List columns:
  Full Name | Email | Mobile | Nationality | Portal Enabled | Status | CreatedOn

Portal Enabled badge: Yes = green pill | No = gray pill

Detail sections:
  General:
    Manual Input checkbox
    Name (auto: FirstName + " " + LastName)

  Main:
    First Name*, Last Name*, Title (dropdown: Mr|Ms|Dr|Prof|Mx)
    Other Name
    Email Address* (unique — show error if duplicate)
    Mobile Number, Office Number
    Date of Birth (date picker — must be > 18 years ago, warn if not)
    Nationality (country dropdown, searchable, show flag emoji)
    Gender (dropdown: Male|Female|Other|Prefer not to say)
    SNS ID

  KYC Information: (collapsible — orange header when warnings exist)
    Passport Number
    Passport Expiry (date picker)
      → amber warning badge if expiry < 6 months from today
      → red warning badge if already expired
    Visa Type (text)
    Visa Expiry (date picker)
      → red warning badge if already expired

  Address:
    Address Line 1
    Suburb (text), State, Postcode
    Country (dropdown)

  Portal Access: (admin-only section, gray background)
    Portal Enabled (toggle switch — Yes/No)
    Portal User ID (read-only UUID, show only if portal_enabled = true)
    NOTE: "Enabling portal will send welcome email to guest"

  Profile:
    Profile Photo URL (text input)
    Preview: if URL valid, show 80x80px rounded avatar

  Description: textarea

  Owner / Admin:
    Owner (lookup → user_account)
    Status, CreatedOn, ModifiedOn

  Related Tabs:
    Invoice | Account (PrimaryContact) | Account (SecondaryContact)
    | Task (Primary) | Task (Secondary) | Transaction

Seed (3 contacts):
  Sunjae Kim — sunjae@millionstay.com.au — KR — portal_enabled: true
  Hong Ying Zhu — hongying@gmail.com — CN — portal_enabled: false
  Max Paik — max@millionstay.com.au — AU — portal_enabled: false

══════════════════════════════════════════
4. ACCOUNT  (sidebar: ACCOUNT > Account)
Route: /account/accounts
══════════════════════════════════════════
Server /api/v1/accounts:
  GET    /          list
                    filter: account_type, is_active
                    search: name, account_email
                    include: primary_contact name,
                             space count (SpaceOwner),
                             active booking count (Guest)
  POST   /          create
  GET    /:id       detail + related counts
  PUT    /:id       update
  DELETE /:id       soft delete
                    BLOCK if has active bookings or contracts
  PATCH  /:id/status
  GET    /:id/summary  → { booking_count, invoice_total,
                            contract_count, outstanding_amount }

List columns:
  Name | Account Type | Primary Contact | Email | Phone | Status | CreatedOn

Account Type badge colors:
  Guest       = blue (#3B82F6)
  SpaceOwner  = purple (#8B5CF6)
  Agent       = teal (#14B8A6)
  ServiceHost = orange (#F97316)
  Staff       = gray (#6B7280)
  Partner     = indigo (#6366F1)

Detail sections:
  General:
    Manual Input checkbox
    Name*

  Basic Information:
    Account Type* (dropdown — from ACCOUNT_TYPE lookup values)

  Contact:
    Primary Contact (LookupField → /api/v1/lookup/contacts)
    Account Email (email input)
    Website URL
    Phone Number 1, Phone Number 2
    Primary Address:
      Address Line 1, Suburb, State, Postcode, Country (inline fields)

  Additional Contact:
    Secondary Contact (LookupField → contact)
    Secondary Address (inline fields)

  Finance: (show only if type ≠ Guest AND type ≠ Staff)
    Payment Info (LookupField → /api/v1/lookup/payment-info)
    Default Commission (LookupField → /api/v1/lookup/commissions)
    Default Currency (dropdown, default AUD)

  Hierarchy:
    Parent Account (LookupField → account)

  Others:
    Description (textarea)

  Owner / Admin:
    Owner (lookup → user_account)
    Status, CreatedOn, ModifiedOn

  Related Tabs (ALL types):
    Invoice | Contract | Task | Booking | Transaction

  Additional tabs by type:
    SpaceOwner  → + Space (Landlord)
    Agent       → + Beneficiary
    ServiceHost → + ServiceHost records
    Partner     → + Promotion (Provider)

  ACCOUNT SUMMARY CARD (show below tabs for existing records):
    Mini dashboard: Active Bookings | Total Invoiced | Outstanding
    Shown as 3 small stat boxes with colored numbers

Seed (4 accounts):
  "Sunjae KIM_Customer"   — Guest     — contact: Sunjae Kim
  "Hong Ying ZHU_Landlord" — SpaceOwner — contact: Hong Ying Zhu
                             payment_info: (create NAB BankTransfer)
                             default_commission: 10%_Commission
  "Million Stay"           — Partner   — (platform operator)
  "Time Study Education"   — Agent     — default_commission: 7%_Agent

══════════════════════════════════════════
5. LOOKUP ENDPOINTS (generic — used by LookupField dialogs)
══════════════════════════════════════════
GET /api/v1/lookup/contacts?q=john
  → [{ id, display: "John Smith — john@email.com" }]

GET /api/v1/lookup/accounts?q=kim&type=SpaceOwner
  → [{ id, display: "Kim Properties (SpaceOwner)" }]

GET /api/v1/lookup/accounts?q=&type=Guest
  → all guests

GET /api/v1/lookup/spaces?q=room&property_id=xxx
  → [{ id, display: "Room A-1 (BedSpace) — 336 Russell St" }]

GET /api/v1/lookup/products?q=single
  → [{ id, display: "Single Room Queen Bed — $430/wk" }]

GET /api/v1/lookup/commissions
  → [{ id, display: "10%_Commission (Percentage)" }]

GET /api/v1/lookup/payment-info
  → [{ id, display: "NAB — BSB 083-170 (BankTransfer)" }]

GET /api/v1/lookup/contract-types
  → [{ id, display: "Monthly Contract (Public)" }]

GET /api/v1/lookup/promotions
  → [{ id, display: "Summer Special — 10% off (until 31 Mar)" }]

Rules: max 20 results, no pagination, search by name only.

══════════════════════════════════════════
6. UPDATE DASHBOARD
══════════════════════════════════════════
Add KPI cards:
  Total Contacts | Total Accounts | Guests | Space Owners
(fetch from /api/v1/contacts/count and /api/v1/accounts/count?type=X)

Write all server routes, controllers, and React pages completely.
No partial code. No TODOs.
```

---

# ████████████████████████████████████████
# PROMPT 4 — SALES MODULE (Lead / Task)
# ████████████████████████████████████████

```
CRM module complete. Now build the SALES module: Lead and Task.

══════════════════════════════════════════
1. TASK  (sidebar: SALES > Task)
Route: /sales/tasks
══════════════════════════════════════════
Server /api/v1/tasks:
  GET    /     list
               filter: task_status, priority, task_category,
                       assigned_to, due_date_from, due_date_to
               search: name, subject
               include: primary_contact name, account name
  POST   /     create
  GET    /:id  detail
  PUT    /:id  update
  DELETE /:id  soft delete
  PATCH  /:id/complete  → set task_status = Done, completed_at = now

List columns:
  Name | Subject | Status | Priority | Category
  | Primary Contact | Account | Due Date | Owner

Status badge colors:
  Todo        = gray
  InProgress  = blue
  Done        = green
  Cancelled   = red

Priority badge:
  High   = red | Medium = amber | Low = green

Detail sections:
  General:
    Manual Input checkbox, Name*

  Main:
    Subject
    Task Status (dropdown: Todo|InProgress|Done|Cancelled)
    Priority    (dropdown: High|Medium|Low)
    Task Category (dropdown: CS|Maintenance|Follow-up|Admin|Other)
    Primary Contact   (LookupField → contact)
    Secondary Contact (LookupField → contact)
    Start Date (date picker)
    Due Date   (date picker — red if overdue + today's date)
    Account    (LookupField → account)
    Booking    (LookupField → booking — optional)

  Description: textarea

  Owner / Admin:
    Owner (lookup → user_account)
    Status, CreatedOn, ModifiedOn

  Action button: [Mark Complete] (green, show if status ≠ Done)

══════════════════════════════════════════
2. LEAD  (sidebar: SALES > Lead)
Route: /sales/leads
══════════════════════════════════════════
Server /api/v1/leads:
  GET    /            list
                      filter: lead_status, lead_source, assigned_to,
                              nationality, preferred_space_type
                      search: first_name, last_name, email, phone
  POST   /            create (auto-generate lead_ref: LEAD-YYYY-NNNNN)
  GET    /:id         detail
  PUT    /:id         update
  DELETE /:id         soft delete
  PATCH  /:id/convert  → convert to booking
                         body: { space_id, check_in_date, check_out_date }
                         creates: contact (if new), account (if new),
                                  booking (Draft status)
                         updates: lead.lead_status = ConvertedToBooking
                                  lead.converted_booking_id = new booking id
                                  lead.converted_at = now()
                         returns: { booking_id, booking_ref }

List columns:
  Lead Ref | Full Name | Email | Source | Status
  | Preferred Check-In | Budget | Assigned To | CreatedOn

Lead Status badge:
  New                 = gray
  Contacted           = blue
  Qualified           = amber
  ConvertedToBooking  = green
  Lost                = red

Detail sections:
  General:
    Lead Ref (auto, read-only)
    First Name*, Last Name*
    Email*, Phone
    Nationality (country dropdown)

  Inquiry:
    Lead Source (dropdown: Website|Agent|Referral|WalkIn|OTA|Social|Other)
    Lead Status (dropdown)
    Inquiry Type (text)
    Message (textarea — the enquiry message)

  Preferences:
    Preferred Space Type (dropdown: EntireSpace|RoomSpace|BedSpace)
    Preferred Check-In Date (date picker)
    Preferred Duration (weeks — number)
    Preferred Suburb (LookupField → suburb)
    Budget Min / Budget Max (decimal inputs, side by side)
    Budget Currency (dropdown, default AUD)

  Conversion: (read-only section, show only if converted)
    Converted Booking (link to booking_ref)
    Converted At (datetime)

  Assignment:
    Assigned To (dropdown → user_account list)

  Owner / Admin:
    Owner (lookup → user_account)
    Status, CreatedOn, ModifiedOn

  Action buttons:
    [Convert to Booking] (green, show only if status ≠ Converted/Lost)
    [Mark as Lost] (red, show only if status ≠ Lost/Converted)

  CONVERT TO BOOKING DIALOG:
    Opens modal when [Convert to Booking] clicked
    Fields:
      Space (LookupField → available spaces)
      Check-In Date (date picker)
      Check-Out Date (date picker)
      Agreed Weekly Rate (auto-filled from space.base_weekly_price, editable)
    [Confirm Conversion] button
    On success: redirect to new booking detail page

══════════════════════════════════════════
3. UPDATE DASHBOARD
══════════════════════════════════════════
Add:
  Active Tasks (status: Todo + InProgress)
  New Leads this week
  Overdue Tasks (due_date < today AND status ≠ Done)

Write all server routes, controllers, and React pages completely.
No partial code. No TODOs.
```

---

# ████████████████████████████████████████
# PROMPT 5 — BOOKING MODULE
# ████████████████████████████████████████

```
Sales module complete. Now build the BOOKING module.
This is the most critical module — implement FSM strictly.

══════════════════════════════════════════
BOOKING FSM (Finite State Machine)
══════════════════════════════════════════
States and allowed transitions:

  Draft           → PendingPayment (submit booking request)
  PendingPayment  → PendingApproval (if booking_mode = Request)
  PendingPayment  → Confirmed       (if booking_mode = Instant,
                                     after payment success)
  PendingApproval → Confirmed       (staff approves)
  PendingApproval → Cancelled       (staff rejects)
  Confirmed       → Active          (check_in_date reached — auto or manual)
  Active          → CheckedOut      (check_out_date reached — auto or manual)
  Any state       → Cancelled       (with cancellation_reason required)
  Confirmed/Active→ (extend)        new check_out_date via PATCH /extend

Status badge colors:
  Draft           = gray
  PendingPayment  = yellow
  PendingApproval = amber
  Confirmed       = blue
  Active          = green
  CheckedOut      = indigo
  Cancelled       = red
  NoShow          = pink

══════════════════════════════════════════
1. SERVICE HOST  (sidebar: BOOKING > ServiceHost)
Route: /booking/service-hosts
══════════════════════════════════════════
Server /api/v1/service-hosts: full CRUD

List columns: Name | Account | Service Type | Period | Status

Detail sections:
  General: name*
  Main:
    Account (LookupField → account, type: ServiceHost)
  Contract:
    Contract Product (LookupField → contract_product)
  Period:
    From Date, To Date (date pickers)
  Options:
    In Call (Yes/No radio), Out Call (Yes/No radio)
    Business Start Hour (0-23), Business End Hour (0-23)
  Description: textarea
  Admin: Status, CreatedOn, ModifiedOn

══════════════════════════════════════════
2. BOOKING  (sidebar: BOOKING > Booking)
Route: /booking/bookings
══════════════════════════════════════════
Server /api/v1/bookings:
  GET    /              list
                        filter: booking_status, booking_source,
                                space_id, account_id,
                                check_in_from, check_in_to
                        search: booking_ref, guest name, email
                        include: guest name, space name,
                                 property address, total_rent
  POST   /              create (auto: booking_ref, status=Draft)
                        OVERBOOKING CHECK:
                          Query space_availability for requested dates
                          If ANY date is_available=FALSE → return 409 error
                          "Space not available for selected dates"
  GET    /:id           detail (include documents, availability check)
  PUT    /:id           update (only if status = Draft or Confirmed)
  DELETE /:id           soft delete (only if status = Draft)

  Status transitions (PATCH endpoints):
  PATCH /:id/submit      Draft → PendingPayment
  PATCH /:id/confirm     PendingApproval → Confirmed (staff only)
  PATCH /:id/reject      PendingApproval → Cancelled (body: reason)
  PATCH /:id/check-in    Confirmed → Active (manual override)
  PATCH /:id/check-out   Active → CheckedOut (manual override)
  PATCH /:id/cancel      Any → Cancelled (body: { reason } required)
  PATCH /:id/extend      body: { new_check_out_date }
                         Updates booking + space_availability + recurring_schedule

  GET /:id/documents     list KYC documents
  POST /:id/documents    upload document (multipart or URL)
  PATCH /:id/documents/:doc_id/verify   → verified_status = Verified
  PATCH /:id/documents/:doc_id/reject   → body: { rejection_reason }

List page:
  Columns: Booking Ref | Guest | Space | Check-In | Check-Out
           | Nights | Rate | Status | Source | CreatedOn
  
  Filters (top bar):
    Status dropdown | Date range picker | Space Type | Source
  
  Quick action buttons per row:
    Confirm (if PendingApproval) | Check-In (if Confirmed, date = today)

  BOOKING CALENDAR VIEW (tab toggle: List | Calendar):
    Show bookings as colored bars on a room × date grid (like a Gantt)
    X axis: dates (next 30 days)
    Y axis: spaces (grouped by property)
    Colors: match booking_status badge colors
    Click bar → open booking detail side panel

Detail sections:
  General:
    Name (auto: "GuestBook_{contact_name}_{created_at}")
    Booking Ref (read-only, auto-generated)

  Main:
    Account* (LookupField → account, type: Guest)
    Contact* (LookupField → contact — auto-filled from account.primary_contact)
    Request Status (read-only badge with FSM state)
    Booking Source (dropdown)
    Customer Notes (textarea)

  Space:
    Space* (LookupField → space — shows name + type + weekly rate)
    NOTE: After space selected, show:
      - Space type badge
      - Current availability indicator
      - Booking mode (Instant/Request) as info badge

  Period:
    Check-In Date* (date picker)
    Check-Out Date* (date picker)
    → Auto-calculate: Stay Nights, Stay Weeks, Total Rent
    → Show summary: "4 weeks × $430/week = $1,720 AUD"

  Pricing:
    Agreed Weekly Rate* (auto from space, editable)
    Currency (dropdown, default AUD)
    Num Guests (number, 1 to space.max_occupancy)

  FSM Action Bar: (prominent colored bar below pricing)
    Shows current status + available next actions as buttons
    Draft:           [Submit Request →]
    PendingPayment:  [Process Payment →] [Cancel ✕]
    PendingApproval: [✓ Confirm] [✕ Reject] (staff only)
    Confirmed:       [✓ Check In] [Extend Stay] [Cancel ✕]
    Active:          [✓ Check Out] [Extend Stay]
    CheckedOut:      [Read Only — Completed]
    Cancelled:       [Read Only — Cancelled on {date}: {reason}]

  Contract:
    Contract Product (LookupField → contract_product)

  Admin: Status, CreatedOn, ModifiedOn

  Related Tabs:
    Documents (KYC) | Notes | Activities

  DOCUMENTS TAB:
    List of uploaded documents:
      Columns: Doc Type | File Name | Status | Expiry | Uploaded | Actions
      Status badge: Pending=yellow | Verified=green | Rejected=red
    [+ Upload Document] button:
      Opens dialog: Doc Type dropdown + File URL input (Supabase Storage)
      + Document Expiry date
    Row actions: [Verify ✓] [Reject ✕] (staff only)
    Rejection dialog: requires rejection_reason text

Seed (2 bookings):
  1. booking_ref: MS-2026-00001
     account: Sunjae KIM_Customer
     space: Room A — Single
     check_in: 2026-05-03, check_out: 2026-05-31
     agreed_weekly_rate: 430, status: Confirmed
     source: Direct

  2. booking_ref: MS-2026-00002
     account: (create another guest)
     space: Room B — Single
     check_in: 2026-06-01, check_out: 2026-06-28
     agreed_weekly_rate: 430, status: PendingApproval
     source: Agent

══════════════════════════════════════════
3. OVERBOOKING PREVENTION (critical logic)
══════════════════════════════════════════
On booking creation AND date update:
  1. Query space_availability WHERE space_id = X
     AND date BETWEEN check_in AND check_out - 1
     AND is_available = FALSE
  2. If results exist → reject with 409:
     { error: "SPACE_NOT_AVAILABLE",
       message: "Space is unavailable on: [dates]",
       blocked_dates: ["2026-05-10", "2026-05-11"] }
  3. On booking Confirmed:
     INSERT into space_availability for all dates in range:
       is_available = FALSE, block_reason = "Booking",
       booking_id = this booking id
  4. On booking Cancelled:
     UPDATE space_availability SET is_available = TRUE,
       block_reason = NULL, booking_id = NULL
     WHERE booking_id = this booking id

══════════════════════════════════════════
4. UPDATE DASHBOARD
══════════════════════════════════════════
Add/update KPI cards:
  Today's Check-Ins | Today's Check-Outs
  Pending Approvals | Active Bookings

Add "Booking Calendar" mini widget (7-day view) on dashboard.

Write all server routes, controllers, and React pages completely.
No partial code. No TODOs.
```

---

# ████████████████████████████████████████
# PROMPT 6 — PRODUCTS MODULE
# ████████████████████████████████████████

```
Booking module complete. Now build the PRODUCTS module.
Products link spaces/services to contracts and invoices.

══════════════════════════════════════════
1. PRODUCT GROUP  (sidebar: PRODUCTS > ProductGroup)
Route: /products/product-groups
══════════════════════════════════════════
Server /api/v1/product-groups: full CRUD
List columns: Name | Description | Display Order | Status
Detail: name*, description, display_order
Seed: "Accommodation" (order:1), "Service" (order:2), "Package" (order:3)

══════════════════════════════════════════
2. PRODUCT TYPE  (sidebar: PRODUCTS > ProductType)
Route: /products/product-types
══════════════════════════════════════════
Server /api/v1/product-types: full CRUD
List columns: Name | Description | Status
Detail: name*, description
Seed:
  "Direct-Operated Accommodation"
  "Managed Accommodation"
  "Homestay"
  "Co-living"
  "Add-on Service"

══════════════════════════════════════════
3. PROMOTION  (sidebar: PRODUCTS > Promotion)
Route: /products/promotions
══════════════════════════════════════════
Server /api/v1/promotions:
  GET    /     list, filter: promotion_type, is_active
               search: name, promo_code
               include: provider account name
  POST   /     create
  GET    /:id  detail
  PUT    /:id  update
  DELETE /:id  soft delete
  POST   /validate  body: { promo_code, product_id, amount }
                    → returns { valid, discount_amount, final_amount }

List columns:
  Name | Type | Discount | Promo Code | Period | Provider | Status

Promotion Type badge:
  FixedAmount = green | Percentage = blue | PromoCode = purple

Detail sections:
  General: name*
  Main:
    Product (LookupField → product)
    Provider (LookupField → account)
    Promotion Type* (radio: FixedAmount | Percentage | PromoCode)
  
  Discount Details: (show fields based on type)
    FixedAmount:  Discount Amount (decimal, AUD)
    Percentage:   Discount Rate % (decimal, 0.01–100)
    PromoCode:    Promo Code (text, UPPERCASE, unique)
                  Discount Rate % OR Discount Amount
                  Max Uses (number — blank = unlimited)
                  Used Count (read-only)
                  Minimum Spend (decimal — optional)
  
  Season:
    Season Label (text: High Season | Low Season | Mid Season | Custom)
  
  Period:
    From Date* (datetime picker)
    To Date*   (datetime picker)
  
  Provider:
    Provider Account (LookupField → account)
  
  Description: textarea
  Admin: Status, CreatedOn, ModifiedOn
  Related tab: Product (linked products)

Seed:
  "Summer Discount" — Percentage — 10% — 
    from: 2026-12-01, to: 2027-02-28 — Season: High Season
  "WELCOME2026" — PromoCode — code: WELCOME2026 — 
    $100 off — min spend $500 — max uses: 50

══════════════════════════════════════════
4. PRODUCT  (sidebar: PRODUCTS > Product)
Route: /products/products
══════════════════════════════════════════
Server /api/v1/products:
  GET    /     list
               filter: product_group_id, product_type_id, is_active
               search: name, item_description
               include: space name, provider name, group name
  POST   /     create
  GET    /:id  detail
  PUT    /:id  update
  DELETE /:id  soft delete (block if used in active contracts)

List columns:
  Name | Group | Type | Space | Price | GST | Min Period | Status

Detail sections:
  General: name*

  Configuration:
    Product Source  (LookupField → account — platform operator)
    Product Provider (LookupField → account — actual provider/owner)
    Product Type    (LookupField → product_type)
    Product Group   (LookupField → product_group)

  Space: (show if group = Accommodation)
    Space (LookupField → space — shows type + address)

  Service: (show if group = Service)
    Service Host (LookupField → service_host)

  Lifecycle:
    From Date (datetime), To Date (datetime)

  Item Description:
    Item Description (text — shown on invoice line item)

  Main / Pricing:
    Price* (decimal)
    Currency (dropdown, default AUD)
    GST Included (Yes/No radio)
    GST Percentage (decimal, 0–100, show if GST Included = Yes,
                    default 10, auto-calculate GST Amount display)
    Commission (LookupField → commission)
    Service Time in Minutes (number — for service products)
    Business Start/End Hour (0-23, for service products)

  Contract Rules:
    Product Tag (text — shown on booking: "Min 4 weeks")
    Minimum Contract Period (number)
    Minimum Contract Period Unit (dropdown: Day|Week|Month)

  Promotion:
    Promotion (LookupField → promotion)

  Information Display:
    Display on Booking Page (Yes/No radio)
    Display on Quote (Yes/No radio)
    Display on Invoice (Yes/No radio)
    Is Package (Yes/No radio)

  Others: Description (textarea)
  Admin: Status, CreatedOn, ModifiedOn

  Related Tabs:
    Promotion | ContractProduct | InvoiceProduct

  GST CALCULATOR (inline, below pricing section):
    If price = 430, GST Included = Yes, GST% = 10:
    Show: "Price incl. GST: $430.00 | GST amount: $39.09 | 
           Ex-GST: $390.91"

Seed (3 products):
  1. "336 Russell St, Melbourne Room A"
     source: Million Stay, provider: Hong Ying ZHU_Landlord
     type: Managed Accommodation, group: Accommodation
     space: Room A — Single, price: 430 AUD/week
     GST: included, 10% — commission: 10%_Commission
     min period: 28 days — tag: "Min 4 weeks"
     display_on_booking: true

  2. "336 Russell St, Melbourne Room B"
     same as above but space: Room B — Single

  3. "Airport Pickup — Melbourne"
     source: Million Stay, provider: (create service host)
     group: Service, type: Add-on Service
     price: 80 AUD — no min period
     service_time: 120 minutes

══════════════════════════════════════════
5. LOOKUP ENDPOINTS (add to existing)
══════════════════════════════════════════
GET /api/v1/lookup/product-groups → [{ id, display }]
GET /api/v1/lookup/product-types  → [{ id, display }]
GET /api/v1/lookup/promotions     → [{ id, display: "Name (code) — ends DD/MM" }]

Write all server routes, controllers, and React pages completely.
No partial code. No TODOs.
```

---

# ████████████████████████████████████████
# PROMPT 7 — CONTRACTS MODULE
# ████████████████████████████████████████

```
Products module complete. Now build the CONTRACTS module.
A Contract is generated from a confirmed Booking.

══════════════════════════════════════════
1. CONTRACT TYPE  (sidebar: CONTRACTS > ContractType)
Route: /contracts/contract-types
══════════════════════════════════════════
Server /api/v1/contract-types: full CRUD

List columns: Name | Security | Require Passport | Require Visa | Status

Detail sections:
  General: name*
  Main:
    Contract Security (dropdown: Public|Private)
    Description (textarea)
  Required Documents: (checkboxes)
    Require Passport (Yes/No)
    Require Student Visa (Yes/No)
    Require Enrollment Letter (Yes/No)
  Owner / Admin: owned_by, Status, CreatedOn, ModifiedOn
  Related tab: Contract

Seed:
  "Short-term Contract" — Public — passport only
  "Monthly Contract"    — Public — passport + visa
  "Annual Contract"     — Private — passport + visa + enrollment

══════════════════════════════════════════
2. CONTRACT  (sidebar: CONTRACTS > Contract)
Route: /contracts/contracts
══════════════════════════════════════════
Server /api/v1/contracts:
  GET    /            list
                      filter: contract_status, contract_type_id,
                              customer_account_id
                      search: contract_ref, name
                      include: account name, space name,
                               booking_ref, product count,
                               total contract value
  POST   /            create (auto: contract_ref = CTR-YYYY-NNNNN)
  GET    /:id         detail (include products, beneficiaries)
  PUT    /:id         update (if status = Draft or Active)
  DELETE /:id         soft delete (only if Draft)
  PATCH  /:id/activate    → contract_status = Active
  PATCH  /:id/terminate   → contract_status = Terminated
                            body: { reason }
  PATCH  /:id/renew       → creates new contract with parent_contract_id
                            body: { new_from_date, new_to_date }
                            returns: { new_contract_id, new_contract_ref }

  GET /:id/generate-pdf   → generates PDF (placeholder for now)
                            returns: { pdf_url }

Contract Status badge:
  Draft      = gray | Active = green | Expired = indigo
  Terminated = red  | Renewed = blue

List columns:
  Contract Ref | Name | Type | Account | Space | Period
  | Status | Products | Total | CreatedOn

Detail sections:
  General:
    Contract Ref (auto, read-only)
    Name* (auto: "{space_address}" or manual)
    Contract Type (LookupField → contract_type)

  Contract Period:
    From Date*, To Date* (datetime pickers)
    Duration display: "X weeks / X months"

  Customer Account:
    Account* (LookupField → account, type: Guest)

  Main:
    Space (LookupField → space)
    Contract Status (dropdown — FSM constrained)

  Booking Link:
    Booking (LookupField → booking — optional, link existing booking)
    Booking Ref (read-only, shows after linked)

  Description: textarea

  Owner / Admin:
    Status, CreatedOn, ModifiedOn, Owner

  Action buttons:
    [Update] [Activate] (if Draft) [Terminate] (if Active)
    [Renew] (if Active/Expired) [Generate PDF] [Deactivate]

  Related Tabs:
    Invoice | ContractProduct

  CONTRACT PRODUCT TAB:
    Shows embedded table of contract_product rows:
    Columns: # | Product | Description | Qty | Unit Price
             | GST | Total | Initial Payment | Due Date
    [+ Add Product] button (opens dialog below)
    Subtotal / GST Total / Grand Total shown at bottom
    Editable inline OR via dialog

  ADD PRODUCT DIALOG:
    Product* (LookupField → product)
    Item Description (auto from product, editable)
    Quantity (default 1)
    Unit Price (auto from product.price, editable)
    GST Included (Yes/No — auto from product)
    GST Amount (auto-calculated, read-only)
    Total Amount (auto-calculated, read-only)
    Initial Payment (Yes/No)
    Due Date (date picker — required if Initial Payment = Yes)
    Display Index (number — sort order)

══════════════════════════════════════════
3. CONTRACT PRODUCT  (sidebar: CONTRACTS > ContractProduct)
Route: /contracts/contract-products
══════════════════════════════════════════
Server /api/v1/contract-products:
  GET    /     list, filter: contract_id
               include: contract ref, product name, booking info
  POST   /     create (also creates beneficiary if product has commission)
  GET    /:id  detail
  PUT    /:id  update
  DELETE /:id  soft delete (only if contract is Draft)

List columns:
  Name | Contract | Product | Qty | Unit Price | Total | Status

Detail sections: (same as Add Product dialog above, expanded)
  Contract section: Contract (LookupField — read-only if from contract tab)
  Products section: Product (LookupField)
  Finance: Quantity, Price, GST Included, GST Amount (calc), Total
  Payment Requirement: Initial Payment toggle, Due Date
  Main: Item Description, Display Index
  Related tab: Booking

══════════════════════════════════════════
4. BENEFICIARY  (sidebar: CONTRACTS > Beneficiary)
Route: /contracts/beneficiaries
══════════════════════════════════════════
Server /api/v1/beneficiaries:
  GET    /     list, filter: settlement_status, account_id
               search: name
               include: account name, contract product name,
                        commission amount
  POST   /     create
  GET    /:id  detail
  PUT    /:id  update
  DELETE /:id  soft delete
  PATCH  /:id/approve  → settlement_status = Approved
  PATCH  /:id/settle   → settlement_status = Paid, settled_at = now

Settlement Status badge:
  Pending = amber | Approved = blue | Paid = green

List columns:
  Name | Account | Contract Product | Commission | Amount
  | Settlement Status | CreatedOn

Detail sections:
  General: name*
  Main:
    Account* (LookupField → account)
  Contract:
    Contract Product (LookupField → contract_product)
  Finance:
    Commission (LookupField → commission)
    Commission Amount (decimal — auto-calculated, editable)
    Settlement Status (dropdown — FSM constrained)
    Settled At (read-only datetime)
  Admin: Status, CreatedOn, ModifiedOn

  Action buttons:
    [Approve] (if Pending) | [Mark as Paid] (if Approved)

══════════════════════════════════════════
5. AUTO-CREATE BENEFICIARY ON CONTRACT PRODUCT
══════════════════════════════════════════
When a ContractProduct is created and product has a commission:
  Automatically create a Beneficiary record:
    name: "{account.name} — {contract_product.name}"
    account_id: product.product_provider_account_id
    contract_product_id: new contract_product.id
    commission_id: product.commission_id
    commission_amount: calculated based on commission type
    settlement_status: Pending

(This can be triggered or done manually — show a toast:
 "Beneficiary record created automatically for provider")

Write all server routes, controllers, and React pages completely.
No partial code. No TODOs.
```

---

# ████████████████████████████████████████
# PROMPT 8 — FINANCE MODULE
# ████████████████████████████████████████

```
Contracts module complete. Now build the FINANCE module.
This covers Invoice, Transaction, Receipt, and Stripe integration.

══════════════════════════════════════════
1. COST CENTER  (sidebar: FINANCE > CostCenter)
Route: /finance/cost-centers
══════════════════════════════════════════
Full CRUD. List: Code | Name | Status.
Seed: "OPS-001 Operations", "ACC-001 Accommodation", "SVC-001 Services"

══════════════════════════════════════════
2. INVOICE  (sidebar: FINANCE > Invoice)
Route: /finance/invoices
══════════════════════════════════════════
Server /api/v1/invoices:
  GET    /           list
                     filter: invoice_status, invoice_type,
                             account_id, due_date_from, due_date_to
                     search: invoice_ref, account name
                     include: account name, booking_ref,
                              outstanding_amount (total - paid)
  POST   /           create (auto: invoice_ref = INV-YYYY-NNNNN)
                     auto-calculate: gst_amount, total_amount
  GET    /:id        detail (include line items)
  PUT    /:id        update (only if Unpaid or PartialPaid)
  DELETE /:id        soft delete (only if Unpaid, no transactions)
  PATCH  /:id/void   → invoice_status = Void

  POST /generate-from-booking
    body: { booking_id, invoice_type }
    Auto-creates invoice + invoice_product lines from
    booking → contract → contract_products
    Returns: { invoice_id, invoice_ref }

  GET /:id/pdf
    Generate PDF invoice (use html-pdf or puppeteer)
    Returns: { pdf_url } (stored in Supabase Storage)

Invoice Status badge:
  Unpaid = red | PartialPaid = amber | Paid = green
  Overdue = dark red | Void = gray

List columns:
  Invoice Ref | Type | Account | Booking | Subtotal | GST
  | Total | Paid | Outstanding | Due Date | Status

Detail sections:
  General:
    Invoice Ref (auto, read-only)
    Name (auto: "Invoice for {booking_ref}")

  Main:
    Invoice Type* (dropdown: Deposit|Rent|ServiceFee|AdminFee|Adjustment|Refund)
    Invoice Status (read-only badge — changes via payment)
    Booking (LookupField → booking)
    Contract (LookupField → contract — auto from booking)
    Account* (LookupField → account — auto from booking)
    Contact (LookupField → contact — auto from booking)
    Owner (lookup → user_account)

  Dates:
    Issue Date* (date, default today)
    Due Date*   (date)
    Paid Date   (date — read-only, set on payment)

  Amounts (read-only, auto-calculated from line items):
    Subtotal | GST Amount | Total Amount
    Paid Amount | Outstanding Amount
    Currency

  Cost Center (LookupField → cost_center)
  Notes (textarea)

  Admin: Status, CreatedOn, ModifiedOn

  Action buttons:
    [+ Add Line Item] | [Generate PDF] | [Record Payment →]
    [Void Invoice] (red, only if Unpaid)

  INVOICE LINE ITEMS (embedded table):
    Columns: # | Description | Qty | Unit Price | GST | Line Total | Actions
    Editable inline
    Totals row at bottom: Subtotal | GST | Total
    [+ Add Row] button

  RECORD PAYMENT button:
    Opens modal:
      Amount (decimal, default = outstanding_amount)
      Payment Method (dropdown: Card|BankTransfer|Manual)
      Payment Date (date, default today)
      Reference (text)
    Creates Transaction record
    Updates invoice.paid_amount
    If paid_amount >= total_amount → invoice_status = Paid
    If paid_amount > 0 and < total_amount → PartialPaid

══════════════════════════════════════════
3. TRANSACTION  (sidebar: FINANCE > Transaction)
Route: /finance/transactions
══════════════════════════════════════════
Server /api/v1/transactions:
  GET    /     list
               filter: payment_status, payment_method, account_id
               search: transaction_ref, stripe_payment_intent_id
               include: account name, invoice_ref
  POST   /     create (auto: transaction_ref = TRN-YYYY-NNNNN)
  GET    /:id  detail
  PUT    /:id  update (only if Pending)
  PATCH  /:id/refund   body: { amount, reason }
                       creates Stripe refund (if stripe transaction)
                       updates payment_status = Refunded/PartialRefunded

Transaction Status badge:
  Pending = gray | Succeeded = green | Failed = red
  Refunded = indigo | PartialRefunded = amber | Disputed = orange

List columns:
  Transaction Ref | Invoice | Account | Amount | Method
  | Stripe ID | Status | Processed At

Detail sections:
  General: transaction_ref (read-only)
  Main:
    Invoice Reference (LookupField → invoice)
    Contact (LookupField → contact)
    Account (LookupField → account)
    Receipt (LookupField → receipt — filled after receipt generated)
    Bank Information (LookupField → payment_info)
    Payment Information (textarea — manual notes)
    Cost Center (LookupField → cost_center)
    Owner (lookup → user_account)
  Stripe Info: (read-only section, show if stripe_payment_intent_id exists)
    Stripe Payment Intent ID
    Stripe Charge ID
    Stripe Customer ID
  Amount: amount, currency, payment_method
  Status: payment_status (read-only badge), processed_at, refunded_at
  Failure: failure_reason (show if Failed)
  Admin: Status, CreatedOn, ModifiedOn

══════════════════════════════════════════
4. RECEIPT  (sidebar: FINANCE > Receipt)
Route: /finance/receipts
══════════════════════════════════════════
Server /api/v1/receipts:
  GET    /     list, filter: account_id
               search: receipt_ref
               include: transaction_ref, account name
  POST   /     create from transaction (auto: RCP-YYYY-NNNNN)
  GET    /:id  detail
  GET    /:id/pdf  → generate receipt PDF

List columns: Receipt Ref | Account | Amount | Transaction | Issued Date | PDF

Detail: receipt_ref, transaction (lookup), invoice (lookup),
        account (lookup), amount, currency, issued_date,
        pdf_url (link), notes

══════════════════════════════════════════
5. STRIPE INTEGRATION
Route: /api/v1/stripe/*
══════════════════════════════════════════
Server endpoints:

POST /api/v1/stripe/create-payment-intent
  body: { invoice_id, amount, currency, customer_email }
  Creates Stripe PaymentIntent
  Returns: { client_secret, payment_intent_id }

POST /api/v1/stripe/webhook
  Handles Stripe webhook events:
    payment_intent.succeeded →
      Update transaction.payment_status = Succeeded
      Update transaction.stripe_charge_id
      Update invoice.paid_amount
      Update invoice.status (Paid or PartialPaid)
      Generate receipt (auto-create receipt record)
      Send confirmation email (Resend)
      Release space_availability block? (NO — keep blocked, booking is confirmed)

    payment_intent.payment_failed →
      Update transaction.payment_status = Failed
      Update transaction.failure_reason
      Send failure notification email

  IMPORTANT:
    Verify Stripe-Signature header on every webhook
    Use idempotency: check if transaction already processed before updating
    Return 200 immediately to Stripe (process async if needed)

Client (admin side only — for manual payment):
  Add [Pay with Stripe] button on Invoice detail page
  Opens Stripe Payment Element (embedded)
  On success: refresh invoice status

══════════════════════════════════════════
6. RECURRING SCHEDULE  (sidebar: FINANCE > Recurring)
Route: /finance/recurring
══════════════════════════════════════════
Server /api/v1/recurring-schedules:
  GET    /     list, filter: is_active, booking_id, next_due_date
  POST   /     create
  GET    /:id  detail
  PUT    /:id  update
  DELETE /:id  soft delete (deactivate)
  POST   /generate  (admin trigger — generates overdue invoices)
                    Finds all active schedules where next_due_date <= today
                    Creates invoice + invoice_product for each
                    Updates next_due_date (add frequency period)
                    Returns: { generated_count, invoices: [] }

List columns:
  Booking Ref | Account | Type | Amount | Frequency
  | Next Due Date | Active

Detail: booking (lookup), contract (lookup), account (lookup),
        schedule_type, frequency, amount, currency, gst_included,
        start_date, end_date, next_due_date, last_generated_at, is_active

══════════════════════════════════════════
7. UPDATE DASHBOARD (Finance KPIs)
══════════════════════════════════════════
Add to dashboard:
  Total Outstanding (sum of all Unpaid+Overdue invoices)
  Received This Month (sum of Paid invoices this month)
  Overdue Invoices (count where due_date < today AND status = Unpaid)
  Upcoming Due (count where due_date within 7 days)

Add: "Outstanding Invoices" table widget (top 5 by amount)

Write all server routes, controllers, and React pages completely.
No partial code. No TODOs.
```

---

# ████████████████████████████████████████
# PROMPT 9 — DASHBOARD + SETTINGS + REPORTS
# ████████████████████████████████████████

```
Finance module complete. Now build the final admin modules:
full Dashboard, Settings, and basic Reports.

══════════════════════════════════════════
1. FULL DASHBOARD  (/dashboard)
══════════════════════════════════════════
Rebuild dashboard with all real data from API.

Layout (3 rows):

ROW 1 — KPI Cards (8 cards, 4 per row on desktop):
  Left group (Property):
    Total Properties (Active) | Total Spaces (Active)
    Occupancy Rate % (Active bookings / Total spaces × 100)
    Pending Approvals (properties with status = Pending)

  Right group (Bookings & Finance):
    Active Bookings | Today's Check-Ins | Today's Check-Outs
    Outstanding Amount (AUD) — formatted as $XX,XXX

ROW 2 — Charts (2 columns):
  Left: "Monthly Revenue" — Bar chart (last 6 months)
        X: month | Y: AUD amount from paid invoices
        Use recharts BarChart

  Right: "Booking Sources" — Donut/Pie chart
         Segments: Direct | Agent | AirBnB | Other
         Use recharts PieChart

ROW 3 — Tables (2 columns):
  Left: "Recent Bookings" table
        Columns: Ref | Guest | Space | Check-In | Status
        Last 5 bookings, click → booking detail
        "View All →" link

  Right: "Pending Actions" list
        - Pending Property Approvals (amber badge + "Approve" button)
        - Pending KYC Documents (red badge + "Review" button)
        - Overdue Invoices (red badge + "View" button)
        Each item clickable to relevant page

API needed:
  GET /api/v1/dashboard/stats
    Returns: {
      total_properties, total_spaces, occupancy_rate,
      pending_approvals, active_bookings,
      todays_checkins, todays_checkouts,
      outstanding_amount, monthly_revenue (last 6 months array),
      booking_sources (array with count per source),
      recent_bookings (last 5),
      pending_actions: {
        property_approvals, kyc_reviews, overdue_invoices
      }
    }

══════════════════════════════════════════
2. SETTINGS MODULE
══════════════════════════════════════════

── 2a. ORGANISATION  (MAINTENANCE > Organisation)
Route: /maintenance/organisation
Single record edit page (no list):
  Platform Info:
    Platform Name, Legal Name, ABN
    Default Currency (dropdown), Default Country
    Timezone (dropdown), Date Format (dropdown)
  Contact:
    Email, Phone, Website URL
    Address Line 1, Suburb, State, Postcode, Country
  Finance:
    GST Registered (Yes/No toggle)
    GST Rate % (number, default 10)
  Branding:
    Logo URL (input + preview)
  [Save Changes] button (orange, full width)

── 2b. USER MANAGEMENT  (MAINTENANCE > UserManagement)
Route: /maintenance/users
  List: columns: Name | Email | Role | Last Login | Status
  Create/Edit user:
    First Name*, Last Name*, Email* (unique)
    Role (dropdown: SuperAdmin|Admin|Staff|Coordinator|ReadOnly)
    Is Active toggle
    [Reset Password] button (sends reset email via Resend)
  Cannot delete: SuperAdmin role
  Cannot deactivate own account

── 2c. LOOKUP VALUES  (SETTINGS > LookupValues)
Route: /settings/lookup-values
  Show lookup_category as left sidebar list
  Click category → show lookup_value rows on right
  Inline add/edit/reorder (drag handle for display_order)
  Cannot delete values that are in use

── 2d. EMAIL TEMPLATES  (SETTINGS > EmailTemplates)
Route: /settings/email-templates
  List: Template Code | Subject | Status
  Edit: subject (text), body_html (textarea with monospace font)
  Available variables shown below editor: {{guest_name}}, etc.
  [Send Test Email] button → sends to logged-in user's email

Templates to seed:
  BOOKING_CONFIRMED    — "Your booking is confirmed — {{booking_ref}}"
  PAYMENT_RECEIVED     — "Payment received — {{invoice_ref}}"
  BOOKING_CANCELLED    — "Booking cancellation — {{booking_ref}}"
  CHECK_IN_REMINDER    — "Check-in reminder — {{check_in_date}}"
  DOCUMENT_VERIFIED    — "Your documents have been verified"
  DOCUMENT_REJECTED    — "Action required: document rejected"
  INVOICE_DUE          — "Invoice due — {{invoice_ref}}"
  INVOICE_OVERDUE      — "Overdue invoice — {{invoice_ref}}"
  LEAD_RECEIVED        — "New enquiry received — {{lead_ref}}"
  PASSWORD_RESET       — "Reset your password"

══════════════════════════════════════════
3. REPORTS MODULE  (sidebar: REPORTS)
══════════════════════════════════════════
Three report pages with filter + table + export:

── 3a. Booking Report  (/reports/bookings)
Filters: Date Range | Status | Space | Source | Account
Table: Booking Ref | Guest | Space | Check-In | Check-Out
       | Nights | Rate | Total Rent | Status | Source
Summary row: Total nights | Total revenue
[Export CSV] button

── 3b. Revenue Report  (/reports/revenue)
Filters: Date Range | Invoice Type | Account
Table: Invoice Ref | Type | Account | Booking | Subtotal
       | GST | Total | Paid | Outstanding | Status | Due Date
Summary: Total Invoiced | Total Paid | Total Outstanding
[Export CSV] button

── 3c. Occupancy Report  (/reports/occupancy)
Filters: Date Range | Property | Space Type
Table: Space Name | Property | Type | Total Days
       | Booked Days | Available Days | Occupancy % | Revenue
Summary: Average Occupancy %
[Export CSV] button

API:
  GET /api/v1/reports/bookings?from=&to=&status=&space_id=...
  GET /api/v1/reports/revenue?from=&to=&type=&account_id=...
  GET /api/v1/reports/occupancy?from=&to=&property_id=...

CSV Export: use json2csv npm package
Return as downloadable .csv file

══════════════════════════════════════════
4. MAINTENANCE MODULE
══════════════════════════════════════════

── SPACE IMAGE  (MAINTENANCE > SpaceImage)
Route: /maintenance/space-images
  List: Space | Caption | Primary | Order | Preview thumbnail
  Create: space (lookup), file_url (text), caption,
          is_primary (toggle), display_order
  Preview: show image thumbnail if URL valid
  Note: "In production, use Supabase Storage uploader"

── SYSTEM LOG  (MAINTENANCE > SystemLog)
Route: /maintenance/system-log
  Read-only table (no create/edit/delete)
  Columns: Timestamp | Entity | Entity ID | Action | Actor | IP
  Filters: entity_type, action, date range, actor
  Click row → expand to show old_value vs new_value JSON diff
  Auto-refresh every 30 seconds

══════════════════════════════════════════
5. FINAL NAVIGATION CLEANUP
══════════════════════════════════════════
Ensure sidebar menu matches exactly:
  DASHBOARD

  ACCOUNT
    Contact
    Account

  SALES
    Task
    Lead

  PROPERTY
    Suburb
    Property
    Space
    SpaceOptions
    SpacePolicy

  BOOKING
    Booking
    ServiceHost

  CONTRACTS
    ContractType
    Contract
    ContractProduct
    Beneficiary

  PRODUCTS
    ProductGroup
    ProductType
    Product
    Promotion

  FINANCE
    Invoice
    Transaction
    Receipt
    Recurring
    Commission
    PaymentInfo
    CostCenter

  REPORTS
    Bookings
    Revenue
    Occupancy

  MAINTENANCE
    SpaceImage
    Organisation
    UserManagement
    SystemLog

  SETTINGS
    LookupValues
    EmailTemplates
    UserSecurity

Write all server routes, controllers, and React pages completely.
No partial code. No TODOs.
```

---

# ████████████████████████████████████████
# PROMPT 10 — RESEND EMAIL + FINAL POLISH
# ████████████████████████████████████████

```
All modules complete. Final integration pass:
Email notifications, UI polish, error handling.

══════════════════════════════════════════
1. RESEND EMAIL SERVICE
══════════════════════════════════════════
Create server/src/utils/emailService.js:

import { Resend } from 'resend';
const resend = new Resend(process.env.RESEND_API_KEY);

async function sendEmail({ templateCode, toEmail, toName, variables }) {
  // 1. Load template from DB: SELECT * FROM email_template WHERE template_code = X
  // 2. Replace variables: {{guest_name}} → variables.guest_name
  // 3. Send via Resend API
  // 4. Log to email_log table (status, resend_message_id)
}

// Template variable replacement:
function renderTemplate(html, variables) {
  return html.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] || '');
}

Trigger emails on these events:
  BOOKING_CONFIRMED    → when booking_status changes to Confirmed
  PAYMENT_RECEIVED     → when transaction.payment_status = Succeeded
  BOOKING_CANCELLED    → when booking_status changes to Cancelled
  CHECK_IN_REMINDER    → (cron: 1 day before check_in_date)
  DOCUMENT_VERIFIED    → when booking_document.verified_status = Verified
  DOCUMENT_REJECTED    → when booking_document.verified_status = Rejected
  INVOICE_DUE          → (cron: 3 days before due_date)
  INVOICE_OVERDUE      → (cron: day after due_date if still Unpaid)

══════════════════════════════════════════
2. CRON JOBS (server/src/utils/cronJobs.js)
══════════════════════════════════════════
Use node-cron package.

Schedule:
  Every day at 08:00 AEST:
    - Check-in reminder emails (check_in_date = tomorrow)
    - Invoice due reminder (due_date = 3 days from now)
    - Invoice overdue emails (due_date < today AND status = Unpaid)
    - Auto update booking status:
        Confirmed → Active if check_in_date = today
        Active → CheckedOut if check_out_date = today

  Every day at 00:01 AEST:
    - Generate recurring invoices (next_due_date = today)
    - Update invoice status to Overdue
      (due_date < today AND status = Unpaid AND paid_amount = 0)

══════════════════════════════════════════
3. SYSTEM LOG MIDDLEWARE
══════════════════════════════════════════
Create server/src/middleware/auditLog.js:

Automatically log to system_log after every:
  POST   → action: CREATE
  PUT    → action: UPDATE (capture old + new values)
  DELETE → action: DELETE
  PATCH  /:id/status → action: STATUS_CHANGE

Log entry:
  entity_type: route entity name (booking, invoice, etc.)
  entity_id: req.params.id
  action: derived from method + path
  actor_type: User
  actor_id: req.user.id (from JWT)
  actor_email: req.user.email
  old_value: (fetch before update, store as JSONB)
  new_value: req.body (sanitised — remove passwords)
  ip_address: req.ip

══════════════════════════════════════════
4. UI POLISH
══════════════════════════════════════════
Apply these improvements across all pages:

Loading states:
  All data tables show skeleton loader (gray animated bars)
  while fetching. Use a <TableSkeleton rows={5} cols={6} />
  component.

Empty states:
  All empty tables show centered illustration + message:
  "No {entity} found. Click '+ New' to create one."
  Use lucide-react icon relevant to entity.

Error handling:
  All API errors show toast notification:
    Success: green toast (3 seconds)
    Error:   red toast (5 seconds, with error message)
    Warning: amber toast (4 seconds)
  Network errors: "Connection error. Please check your internet."

Confirmation dialogs:
  All delete/deactivate actions show confirm dialog:
  "Are you sure you want to deactivate {name}?
   This action cannot be undone."
  [Cancel] [Confirm] buttons.

Form validation feedback:
  Required fields show red border + helper text on submit
  Email fields validate format on blur
  Date fields: To Date must be after From Date (cross-field validation)

Breadcrumbs:
  Show on all pages: Dashboard > Module > Page > Record Name
  Clickable path back to parent

Page titles:
  Each page has: <title>PageName | Million Stay</title>
  Use React Helmet or document.title

Mobile sidebar:
  On < 768px: sidebar hidden by default
  Hamburger icon in header opens sidebar as overlay
  Click outside to close

══════════════════════════════════════════
5. ENVIRONMENT & DEPLOYMENT PREP
══════════════════════════════════════════
Add to server:
  - Rate limiting: express-rate-limit (100 req/15min per IP)
  - Request size limit: express.json({ limit: '10mb' })
  - Compression: compression middleware
  - Security headers: helmet() with sensible defaults

Add to client:
  - vite.config.js: set base URL from VITE_API_URL
  - Add /health page showing API connection status
  - Add 404 page with link back to dashboard

Final check — verify these all work end-to-end:
  □ Login → Dashboard loads with real data
  □ Create Property → Approve → Create Space → Block dates
  □ Create Contact → Create Account (Guest)
  □ Create Lead → Convert to Booking
  □ Booking → Confirm → Generate Invoice → Record Payment
  □ Invoice → Generate PDF → Download
  □ Email sent on booking confirmation (check Resend dashboard)
  □ System log shows all actions

Write all code completely. No TODOs. No partial implementations.
```

---

# PROMPT 진행 현황 체크리스트

```
✅ Prompt 1  — Project Setup + Auth + AdminLayout
✅ Prompt 2  — Property Module
              (Suburb / Property / SpaceOptions / SpacePolicy / Space)
⬜ Prompt 3  — CRM Module
              (Commission / PaymentInfo / Contact / Account / Lookup API)
⬜ Prompt 4  — Sales Module (Task / Lead)
⬜ Prompt 5  — Booking Module (FSM + KYC Documents + Calendar)
⬜ Prompt 6  — Products Module (ProductGroup/Type/Promotion/Product)
⬜ Prompt 7  — Contracts Module (ContractType/Contract/ContractProduct/Beneficiary)
⬜ Prompt 8  — Finance Module (Invoice/Transaction/Receipt/Stripe/Recurring)
⬜ Prompt 9  — Dashboard + Settings + Reports
⬜ Prompt 10 — Email + Cron Jobs + UI Polish + Deploy Prep
```
