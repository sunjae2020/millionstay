-- =============================================================================
-- tenants/metheim/owner-sample-properties.seed.sql
--
-- Seeds 3 SAMPLE properties (with spaces, bookings, contracts, invoices and a
-- few document records) for the MetHeim demo owner so the redesigned owner
-- portal dashboard has real data to render (revenue trend, occupancy, contracts,
-- invoice status) and the Documents (문서 관리함) list is populated.
--
-- Target: MetHeim Supabase (Seoul). Owner = account_id 3 (demo.owner@metheim.com).
-- Idempotent: guarded by properties.description = 'SAMPLE-OWNER-SEED'.
--
-- Run:
--   psql "$METHEIM_DATABASE_URL" -f tenants/metheim/owner-sample-properties.seed.sql
--
-- Rollback: see the block at the bottom (commented out).
-- =============================================================================

DO $$
DECLARE
  owner_id       int := 3;               -- 신영부동산신탁112 (demo.owner@metheim.com)
  marker         text := 'SAMPLE-OWNER-SEED';
  props          jsonb;
  prop           jsonb;
  unit           jsonb;
  prop_id        int;
  space_id       int;
  booking_id     int;
  contract_id    int;
  ref_seq        int := 0;
  first_paid_inv int;
  g              int;
  month_first    date;
  rent           numeric;
  deposit        numeric;
  weekly         numeric;
  ci             date := date_trunc('month', CURRENT_DATE)::date - INTERVAL '6 months';
  co             date := date_trunc('month', CURRENT_DATE)::date + INTERVAL '12 months';
BEGIN
  -- Idempotency guard.
  IF EXISTS (SELECT 1 FROM properties WHERE owner_account_id = owner_id AND description = marker) THEN
    RAISE NOTICE 'Sample owner properties already seeded — skipping.';
    RETURN;
  END IF;

  props := $json$
  [
    {"name":"여수 웰카운티 아파트","addr":"전라남도 여수시 좌수영로 101","postcode":"59631","units":[
       {"no":"101동 1203호","type":"Apartment","status":"임대","rent":1800000,"deposit":20000000,"area":84.9,"floor":12,"rented":true},
       {"no":"101동 1204호","type":"Apartment","status":"임대","rent":1750000,"deposit":18000000,"area":84.9,"floor":12,"rented":true},
       {"no":"101동 1401호","type":"Apartment","status":"공실","rent":1950000,"deposit":22000000,"area":101.2,"floor":14,"rented":false},
       {"no":"101동 PH01호","type":"Apartment","status":"분양","rent":0,"deposit":0,"area":134.5,"floor":20,"rented":false}
    ]},
    {"name":"여수 디오션 오피스텔","addr":"전라남도 여수시 소호로 47","postcode":"59723","units":[
       {"no":"A동 908호","type":"Studio","status":"임대","rent":950000,"deposit":10000000,"area":33.1,"floor":9,"rented":true},
       {"no":"A동 1005호","type":"Studio","status":"임대","rent":980000,"deposit":10000000,"area":36.4,"floor":10,"rented":true},
       {"no":"A동 1210호","type":"Studio","status":"임대","rent":1050000,"deposit":12000000,"area":42.8,"floor":12,"rented":true},
       {"no":"A동 1503호","type":"Studio","status":"공실","rent":1100000,"deposit":12000000,"area":42.8,"floor":15,"rented":false}
    ]},
    {"name":"여수 엑스포 레지던스","addr":"전라남도 여수시 오동도로 61","postcode":"59689","units":[
       {"no":"201호","type":"Other","status":"임대","rent":2200000,"deposit":30000000,"area":118.0,"floor":2,"rented":true},
       {"no":"305호","type":"Other","status":"임대","rent":2350000,"deposit":30000000,"area":118.0,"floor":3,"rented":true},
       {"no":"402호","type":"Other","status":"공실","rent":2500000,"deposit":35000000,"area":132.5,"floor":4,"rented":false}
    ]}
  ]
  $json$::jsonb;

  FOR prop IN SELECT * FROM jsonb_array_elements(props) LOOP
    INSERT INTO properties (name, address, city, state, postcode, country_code, approval_status, owner_account_id, description)
    VALUES (prop->>'name', prop->>'addr', '여수시', '전라남도', prop->>'postcode', 'KR', 'Approved', owner_id, marker)
    RETURNING id INTO prop_id;

    -- Property-level document (management ledger).
    INSERT INTO documents (entity_type, entity_id, doc_type, doc_ref, file_name, file_size, mime_type, cloudinary_public_id, uploaded_by_type, retention_until)
    VALUES ('property', prop_id, 'other', 'DOC-P'||prop_id, '건물관리대장_'||(prop->>'name')||'.pdf', 284120, 'application/pdf',
            'metheim/sample/property-'||prop_id, 'admin', now() + INTERVAL '7 years');

    FOR unit IN SELECT * FROM jsonb_array_elements(prop->'units') LOOP
      rent    := (unit->>'rent')::numeric;
      deposit := (unit->>'deposit')::numeric;
      weekly  := round(rent * 12 / 52.0, 2);

      INSERT INTO spaces (name, space_type, status, property_id, base_currency, base_weekly_price,
                          monthly_rent, deposit_amount, max_occupancy, floor_number, exclusive_area_m2, landlord_account_id)
      VALUES (unit->>'no', unit->>'type', unit->>'status', prop_id, 'KRW', weekly,
              NULLIF(rent,0), NULLIF(deposit,0), 4, (unit->>'floor')::int, (unit->>'area')::numeric, owner_id)
      RETURNING id INTO space_id;

      -- Rented units get a live booking + contract + a run of invoices.
      IF (unit->>'rented')::boolean THEN
        ref_seq := ref_seq + 1;
        first_paid_inv := NULL;

        INSERT INTO bookings (booking_ref, name, booking_status, status, space_id, check_in_date, check_out_date,
                              agreed_weekly_rate, total_rent, currency, num_guests, booking_source)
        VALUES ('SMP-BK-'||ref_seq, '임차인 '||ref_seq, 'Active', 'Active', space_id, ci, co,
                weekly, rent * 18, 'KRW', 1, 'Owner')
        RETURNING id INTO booking_id;

        INSERT INTO contracts (contract_ref, booking_id, space_id, landlord_account_id, start_date, end_date,
                               weekly_rate, total_rent, bond_amount, currency, status, signed_at, effective_date)
        VALUES ('SMP-CT-'||ref_seq, booking_id, space_id, owner_id, to_char(ci,'YYYY-MM-DD'), to_char(co,'YYYY-MM-DD'),
                weekly, rent * 18, deposit, 'KRW', 'Signed', ci::timestamptz, to_char(ci,'YYYY-MM-DD'))
        RETURNING id INTO contract_id;

        -- Monthly invoices: last 6 months paid, current month pending.
        FOR g IN -6..0 LOOP
          month_first := (date_trunc('month', CURRENT_DATE) + (g||' months')::interval)::date;
          IF g < 0 THEN
            INSERT INTO invoices (invoice_ref, booking_id, contract_id, account_id, amount, currency, status, due_date, paid_at, payment_method, description)
            VALUES ('SMP-INV-'||ref_seq||'-'||(g+6), booking_id, contract_id, owner_id, rent, 'KRW', 'Paid',
                    to_char(month_first,'YYYY-MM-DD'), (month_first + INTERVAL '2 days')::timestamptz, 'Transfer', '월 임대료')
            RETURNING id INTO first_paid_inv;
          ELSE
            INSERT INTO invoices (invoice_ref, booking_id, contract_id, account_id, amount, currency, status, due_date, description)
            VALUES ('SMP-INV-'||ref_seq||'-6', booking_id, contract_id, owner_id, rent, 'KRW', 'Pending',
                    to_char(CURRENT_DATE + 10, 'YYYY-MM-DD'), '월 임대료');
          END IF;
        END LOOP;

        -- Every 2nd rented unit carries one overdue invoice.
        IF ref_seq % 2 = 0 THEN
          INSERT INTO invoices (invoice_ref, booking_id, contract_id, account_id, amount, currency, status, due_date, description)
          VALUES ('SMP-INV-'||ref_seq||'-OD', booking_id, contract_id, owner_id, round(rent/4,0), 'KRW', 'Sent',
                  to_char(CURRENT_DATE - 20, 'YYYY-MM-DD'), '관리비');
        END IF;

        -- Contract + receipt documents for this unit.
        INSERT INTO documents (entity_type, entity_id, doc_type, doc_ref, version, file_name, file_size, mime_type, cloudinary_public_id, uploaded_by_type, retention_until)
        VALUES ('contract', contract_id, 'tenancy', 'SMP-CT-'||ref_seq, 1, '임대차계약서_'||(unit->>'no')||'.pdf', 198340, 'application/pdf',
                'metheim/sample/contract-'||contract_id, 'admin', now() + INTERVAL '7 years');

        IF first_paid_inv IS NOT NULL THEN
          INSERT INTO documents (entity_type, entity_id, doc_type, doc_ref, file_name, file_size, mime_type, cloudinary_public_id, uploaded_by_type, retention_until)
          VALUES ('invoice', first_paid_inv, 'receipt', 'SMP-RC-'||ref_seq, '납부영수증_'||(unit->>'no')||'.pdf', 84210, 'application/pdf',
                  'metheim/sample/receipt-'||first_paid_inv, 'admin', now() + INTERVAL '7 years');
        END IF;
      END IF;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Sample owner properties seeded for account_id %.', owner_id;
END $$;

-- ── Rollback (uncomment to remove all sample data) ───────────────────────────
-- DELETE FROM documents d USING contracts c WHERE d.entity_type='contract' AND d.entity_id=c.id AND c.contract_ref LIKE 'SMP-CT-%';
-- DELETE FROM documents d USING invoices  i WHERE d.entity_type='invoice'  AND d.entity_id=i.id AND i.invoice_ref  LIKE 'SMP-INV-%';
-- DELETE FROM documents d USING properties p WHERE d.entity_type='property' AND d.entity_id=p.id AND p.description='SAMPLE-OWNER-SEED';
-- DELETE FROM invoices  WHERE invoice_ref  LIKE 'SMP-INV-%';
-- DELETE FROM contracts WHERE contract_ref LIKE 'SMP-CT-%';
-- DELETE FROM bookings  WHERE booking_ref  LIKE 'SMP-BK-%';
-- DELETE FROM spaces    WHERE property_id IN (SELECT id FROM properties WHERE owner_account_id=3 AND description='SAMPLE-OWNER-SEED');
-- DELETE FROM properties WHERE owner_account_id=3 AND description='SAMPLE-OWNER-SEED';
