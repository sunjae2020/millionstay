INSERT INTO public.accommodation_catalog VALUES (88, '53 Batman St — Entire (Daily Rate)', 'Standard daily rate — 10% off base daily price. Standalone booking, no package required.', 1, 1, 28, 355, 'AUD', NULL, false, NULL, NULL, NULL, 1, 'Day', true, true, 'Active', '2026-04-09 03:19:22.118417+00', '2026-04-09 03:19:22.118417+00', NULL, NULL, NULL, 4);


ALTER TABLE public.accommodation_catalog ENABLE TRIGGER ALL;
INSERT INTO public.accommodation_service_catalog VALUES (33, 17, 3, true, NULL, 3, '2026-04-09 03:35:25.034062+00', '2026-04-09 03:44:40.19+00');


ALTER TABLE public.accommodation_service_catalog ENABLE TRIGGER ALL;
INSERT INTO public.accounts VALUES (17, 'Gildong HONG', 'Guest', NULL, NULL, 'teswt@timest.co.kr', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'AUD', NULL, NULL, false, 'Active', '2026-04-09 05:11:01.06402+00', '2026-04-09 05:11:01.06402+00');


ALTER TABLE public.accounts ENABLE TRIGGER ALL;
INSERT INTO public.admin_users VALUES (1, 'admin@millionstay.com', '$2b$10$FX2diLhEDwiXWzaGJtZoXeOS1x/pizNnsMOqPkpnwaR3DxlC.OBU.', 'Super Admin', 'Million', 'Stay', true, false, '2026-04-10 09:52:45.987+00', '2026-04-05 08:29:14.152582+00', '2026-04-10 09:52:45.987+00');


ALTER TABLE public.admin_users ENABLE TRIGGER ALL;
INSERT INTO public.beneficiaries VALUES (1, 'HongYingZhu - Owner Commission', 31, 8, 1, 'Percentage', 12, NULL, 1, 'Updated: 12% for long-term owner', 'Active', '2026-04-06 05:39:42.881372+00', '2026-04-06 05:41:27.846+00');


ALTER TABLE public.beneficiaries ENABLE TRIGGER ALL;
INSERT INTO public.bookings VALUES (6, 'GBK-MNR9F8AC-BQ3', NULL, 17, NULL, 'Pending', 'Guest Portal', NULL, 9, '2026-04-12', '2026-04-22', NULL, 1.00, NULL, NULL, 'AUD', 1, NULL, NULL, NULL, 'Active', '2026-04-09 09:13:37.71774+00', '2026-04-09 09:13:37.71774+00');


ALTER TABLE public.bookings ENABLE TRIGGER ALL;
INSERT INTO public.commissions VALUES (5, '7%_Agent_Commission', 'Percentage', 7, NULL, NULL, 'Active', '2026-04-05 02:20:39.2056+00', '2026-04-05 02:20:39.2056+00');


ALTER TABLE public.commissions ENABLE TRIGGER ALL;
INSERT INTO public.contacts VALUES (9, 'Melcrop', 'RealEstate', NULL, NULL, 'contact@melcorp.com.au', NULL, NULL, NULL, 'AU', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, NULL, NULL, NULL, false, 'Active', '2026-04-05 02:20:39.228633+00', '2026-04-05 02:20:39.228633+00');


ALTER TABLE public.contacts ENABLE TRIGGER ALL;
INSERT INTO public.contract_products VALUES (88, '53 Batman St, West Melbourne_Entire Apartment — Long-term', NULL, 'Apartment', 'Active', 28, 780, NULL, 'AUD', 4, 2, 26, NULL, false, false, false, false, false, false, NULL, NULL, '2026-04-06 00:46:06.965019+00', '2026-04-06 00:46:06.965019+00', 3, 'LongTerm', 721.5, 'Monthly', NULL, NULL, NULL);


ALTER TABLE public.contract_products ENABLE TRIGGER ALL;
INSERT INTO public.contract_types VALUES (8, 'Full-Time Employment', 'Permanent full-time staff', 'Private', false, false, false, true, '2026-04-05 02:20:38.957844+00', '2026-04-05 02:20:38.957844+00');


ALTER TABLE public.contract_types ENABLE TRIGGER ALL;
INSERT INTO public.contracts VALUES (4, 'MS-C-2026-00004', NULL, 4, NULL, NULL, NULL, '2026-01-01', '2026-02-28', 750, 6000, 1500, NULL, 'AUD', 'Terminated', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Terminated early by tenant', '2026-04-05 00:39:51.167848+00', '2026-04-05 00:39:51.167848+00');


ALTER TABLE public.contracts ENABLE TRIGGER ALL;
INSERT INTO public.cs_messages VALUES (8, 4, 'admin', 1, 'test', '["https://res.cloudinary.com/dthc3gmdr/image/upload/v1775734611/millionstay/cs/atbqhprymsgocagpqmip.png"]', 0, '2026-04-09 11:37:01.201929+00');


ALTER TABLE public.cs_messages ENABLE TRIGGER ALL;
INSERT INTO public.cs_tickets VALUES (4, 'CS-2026-0004', 4, 6, 'Maintenance', 'Broken Toilet', 'gtest', 'InProgress', 'Normal', NULL, NULL, '2026-04-09 09:57:48.891907+00', '2026-04-09 11:36:32.575+00');


ALTER TABLE public.cs_tickets ENABLE TRIGGER ALL;
INSERT INTO public.email_template VALUES (1, 'BOOKING_CONFIRMED', 'Your booking is confirmed — {{booking_ref}}', '<h1>Booking Confirmed</h1>
  <p>Dear {{guest_name}},</p>
  <p>Your booking <strong>{{booking_ref}}</strong> has been confirmed.</p>
  <p>Check-in: {{check_in_date}}<br>Check-out: {{check_out_date}}</p>
  <p>Property: {{property_address}}</p>
  <p>Thank you for choosing Million Stay.</p>', NULL, '["guest_name", "booking_ref", "check_in_date", "check_out_date", "property_address"]', true, '2026-04-05 01:24:07.022866+00', '2026-04-05 01:24:07.022866+00');
INSERT INTO public.email_template VALUES (2, 'PAYMENT_RECEIVED', 'Payment received — {{invoice_ref}}', '<h1>Payment Received</h1>
  <p>Dear {{guest_name}},</p>
  <p>We have received your payment of <strong>{{amount}} {{currency}}</strong> for invoice {{invoice_ref}}.</p>
  <p>Thank you.</p>', NULL, '["guest_name", "invoice_ref", "amount", "currency"]', true, '2026-04-05 01:24:07.022866+00', '2026-04-05 01:24:07.022866+00');
INSERT INTO public.email_template VALUES (3, 'BOOKING_CANCELLED', 'Booking cancellation notice — {{booking_ref}}', '<h1>Booking Cancelled</h1>
  <p>Dear {{guest_name}},</p>
  <p>Your booking {{booking_ref}} has been cancelled.</p>
  <p>Reason: {{cancellation_reason}}</p>', NULL, '["guest_name", "booking_ref", "cancellation_reason"]', true, '2026-04-05 01:24:07.022866+00', '2026-04-05 01:24:07.022866+00');
INSERT INTO public.email_template VALUES (4, 'CHECK_IN_REMINDER', 'Check-in reminder — tomorrow at {{property_address}}', '<h1>Check-in Reminder</h1>
  <p>Dear {{guest_name}},</p>
  <p>This is a reminder that your check-in is tomorrow.</p>
  <p>Date: {{check_in_date}}<br>Address: {{property_address}}</p>', NULL, '["guest_name", "check_in_date", "property_address"]', true, '2026-04-05 01:24:07.022866+00', '2026-04-05 01:24:07.022866+00');
INSERT INTO public.email_template VALUES (5, 'DOCUMENT_VERIFIED', 'Your documents have been verified', '<h1>Documents Verified</h1>
  <p>Dear {{guest_name}},</p>
  <p>Your submitted documents for booking {{booking_ref}} have been verified successfully.</p>', NULL, '["guest_name", "booking_ref"]', true, '2026-04-05 01:24:07.022866+00', '2026-04-05 01:24:07.022866+00');
INSERT INTO public.email_template VALUES (6, 'DOCUMENT_REJECTED', 'Action required: document rejected — {{booking_ref}}', '<h1>Document Rejected</h1>
  <p>Dear {{guest_name}},</p>
  <p>Your document <strong>{{doc_type}}</strong> was rejected.</p>
  <p>Reason: {{rejection_reason}}</p>
  <p>Please resubmit via your guest portal.</p>', NULL, '["guest_name", "doc_type", "rejection_reason", "booking_ref"]', true, '2026-04-05 01:24:07.022866+00', '2026-04-05 01:24:07.022866+00');
INSERT INTO public.email_template VALUES (7, 'INVOICE_DUE', 'Invoice due in 3 days — {{invoice_ref}}', '<h1>Payment Reminder</h1>
  <p>Dear {{guest_name}},</p>
  <p>Invoice {{invoice_ref}} for {{amount}} {{currency}} is due on {{due_date}}.</p>', NULL, '["guest_name", "invoice_ref", "amount", "currency", "due_date"]', true, '2026-04-05 01:24:07.022866+00', '2026-04-05 01:24:07.022866+00');
INSERT INTO public.email_template VALUES (8, 'INVOICE_OVERDUE', 'Overdue invoice — {{invoice_ref}} — action required', '<h1>Overdue Invoice</h1>
  <p>Dear {{guest_name}},</p>
  <p>Invoice {{invoice_ref}} for {{amount}} {{currency}} was due on {{due_date}} and remains unpaid.</p>
  <p>Please make payment immediately to avoid service disruption.</p>', NULL, '["guest_name", "invoice_ref", "amount", "currency", "due_date"]', true, '2026-04-05 01:24:07.022866+00', '2026-04-05 01:24:07.022866+00');
INSERT INTO public.email_template VALUES (9, 'LEAD_RECEIVED', 'New enquiry received — {{lead_ref}}', '<h1>New Enquiry</h1>
  <p>A new lead has been received.</p>
  <p>Ref: {{lead_ref}}<br>Name: {{lead_name}}<br>Email: {{lead_email}}<br>Message: {{message}}</p>', NULL, '["lead_ref", "lead_name", "lead_email", "message"]', true, '2026-04-05 01:24:07.022866+00', '2026-04-05 01:24:07.022866+00');
INSERT INTO public.email_template VALUES (10, 'PASSWORD_RESET', 'Reset your Million Stay password', '<h1>Password Reset</h1>
  <p>Dear {{user_name}},</p>
  <p>Click the link below to reset your password:</p>
  <p><a href="{{reset_link}}">Reset Password</a></p>
  <p>This link expires in 1 hour.</p>', NULL, '["user_name", "reset_link"]', true, '2026-04-05 01:24:07.022866+00', '2026-04-05 01:24:07.022866+00');
INSERT INTO public.guest_users VALUES (4, 17, 'teswt@timest.co.kr', '$2b$10$eVyV.erreliM73FLem0x4e5RYdA0T2tXVqZEGSIN1J4we84YG5jDK', 'Gildong', 'HONG', NULL, true, false, '2026-04-09 05:11:01.100757+00', '2026-04-09 05:11:01.100757+00');


ALTER TABLE public.guest_users ENABLE TRIGGER ALL;
INSERT INTO public.integration_settings VALUES ('EMAIL_FROM', 'noreply@contact.millionstay.com', '2026-04-08 01:05:18.657');


ALTER TABLE public.integration_settings ENABLE TRIGGER ALL;
INSERT INTO public.invoices VALUES (6, 'MS-INV-2026-00006', 2, NULL, 12, 1000, 'AUD', 'Draft', '2026-06-01', NULL, NULL, NULL, NULL, NULL, NULL, '2026-04-05 07:57:31.118882+00', '2026-04-05 07:57:31.118882+00');


ALTER TABLE public.invoices ENABLE TRIGGER ALL;
INSERT INTO public.leads VALUES (4, 'LEAD-2026-00004', 'Deploy', 'Test', 'deploytest@millionstay.com.au', NULL, NULL, 'Direct', 'ConvertedToBooking', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'AUD', NULL, '2026-04-05 07:56:09.428+00', NULL, NULL, false, 'Active', '2026-04-05 07:53:39.118015+00', '2026-04-05 07:56:09.428+00');


ALTER TABLE public.leads ENABLE TRIGGER ALL;
INSERT INTO public.payment_info VALUES (1, 'NAB BankTransfer', 'BankTransfer', 'NAB', NULL, '083-004', '123456789', 'Million Stay Pty Ltd', NULL, NULL, 'Active', '2026-04-04 23:54:23.665514+00', '2026-04-04 23:54:23.665514+00');


ALTER TABLE public.payment_info ENABLE TRIGGER ALL;
INSERT INTO public.product_groups VALUES (3, 'Good', 3, '2026-04-05 02:20:38.970986+00', '2026-04-05 02:20:38.970986+00');


ALTER TABLE public.product_groups ENABLE TRIGGER ALL;
INSERT INTO public.product_types VALUES (11, 'Career Program', 'Internship, Demi-pair and Au-pair placement programs', '2026-04-10 10:03:08.447849+00', '2026-04-10 10:03:08.447849+00');


ALTER TABLE public.product_types ENABLE TRIGGER ALL;
INSERT INTO public.promotions VALUES (4, 'Standard Daily', NULL, 'None', NULL, NULL, NULL, '2026-04-01', '2026-06-30', 1, NULL, NULL, 'AllSpaces', NULL, NULL, 'Active', '2026-04-09 02:47:33.185886+00', '2026-04-09 03:00:30.153+00', 'ShortTerm', 0, NULL, 'Upfront');


ALTER TABLE public.promotions ENABLE TRIGGER ALL;
INSERT INTO public.properties VALUES (9, '53 Batman Street, West Melbourne', '53 Batman Street', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Active', 11, 6, 'Entire apartment only. Bunk Bed + Queen Bed', '2026-04-05 02:20:39.272387+00', '2026-04-05 02:20:39.272387+00');


ALTER TABLE public.properties ENABLE TRIGGER ALL;
INSERT INTO public.service_catalog VALUES (36, 'Career – Au-pair Program', 'Au-pair placement program. Full-time childcare role with an Australian family, including accommodation and meals.', 'one_time', 800, 'AUD', true, false, 'at_booking', false, false, NULL, false, NULL, false, NULL, true, 93, 'Active', '2026-04-10 10:04:20.016691+00', '2026-04-10 10:04:20.016691+00', NULL);


ALTER TABLE public.service_catalog ENABLE TRIGGER ALL;
INSERT INTO public.space_blocked_dates VALUES (55, 2, '2026-06-27', '2026-04-05 07:57:06.189375+00');


ALTER TABLE public.space_blocked_dates ENABLE TRIGGER ALL;
INSERT INTO public.space_images VALUES (53, 17, 'https://res.cloudinary.com/dthc3gmdr/image/upload/v1775460132/millionstay/spaces/g4uoltfjqx21h2idi0oj.jpg', 'https://res.cloudinary.com/dthc3gmdr/image/upload/c_fill,g_auto,h_360,w_480/f_auto,q_auto:eco/v1775460132/millionstay/spaces/g4uoltfjqx21h2idi0oj?_a=BAMAAAUs0', 'millionstay/spaces/g4uoltfjqx21h2idi0oj', NULL, false, 17, 8738375, 'image/jpeg', '2026-04-06 07:22:13.325531+00');


ALTER TABLE public.space_images ENABLE TRIGGER ALL;
INSERT INTO public.space_option_maps VALUES (126, 9, 47, '2026-04-06 00:30:46.410651+00');


ALTER TABLE public.space_option_maps ENABLE TRIGGER ALL;
INSERT INTO public.space_options VALUES (53, 'Fire Extinguisher', NULL, 'Amenity', 'Active', '2026-04-05 02:20:39.183034+00', '2026-04-05 02:20:39.183034+00');


ALTER TABLE public.space_options ENABLE TRIGGER ALL;
INSERT INTO public.space_policies VALUES (5, 'Female Only', true, true, true, true, false, 18, 'Active', '2026-04-05 02:20:39.282453+00', '2026-04-05 02:20:39.282453+00');


ALTER TABLE public.space_policies ENABLE TRIGGER ALL;
INSERT INTO public.spaces VALUES (27, '250 City Rd_Room B — Couple Room', false, 'Private Room', NULL, 2, 'Request', 530, NULL, NULL, NULL, NULL, NULL, 'Active', 8, 23, 3, 10, '2026-04-05 02:20:39.675009+00', '2026-04-05 02:20:39.675009+00', 265);


ALTER TABLE public.spaces ENABLE TRIGGER ALL;
INSERT INTO public.suburbs VALUES (6, 'West Melbourne', 'VIC', '3003', 'AU', NULL, NULL, NULL, 'Active', '2026-04-05 02:20:39.194195+00', '2026-04-05 02:20:39.194195+00');


ALTER TABLE public.suburbs ENABLE TRIGGER ALL;
INSERT INTO public.system_log VALUES (2, 'booking', 2, 'STATUS_CHANGE', 'System', NULL, NULL, '{"status": "PendingApproval"}', '{"status": "Confirmed"}', NULL, NULL, NULL, '2026-04-05 07:57:06.200941+00');


ALTER TABLE public.system_log ENABLE TRIGGER ALL;
INSERT INTO public.tasks VALUES (3, 'Onboard Time Study Education', 'Agent commission agreement', 'Todo', 'Low', 'Admin', NULL, NULL, NULL, NULL, NULL, '2026-04-19', NULL, 'Send commission agreement to Time Study Education.', false, 'Active', '2026-04-05 00:10:18.090992+00', '2026-04-05 00:10:18.090992+00');


ALTER TABLE public.tasks ENABLE TRIGGER ALL;
INSERT INTO public.work_orders VALUES (4, 'MS-WO-2026-00004', 3, NULL, 'Repaint lobby walls', 'Lobby walls need repainting after water damage repair', 'Completed', 'Low', 'Painting', NULL, '2026-02-10', NULL, '2026-03-01 00:00:00+00', 3500, 'AUD', 'Completed with premium finish paint', '2026-04-05 00:54:01.532182+00', '2026-04-05 00:54:01.532182+00');


ALTER TABLE public.work_orders ENABLE TRIGGER ALL;
SELECT pg_catalog.setval('public.accommodation_service_catalog_id_seq', 471, true);
SELECT pg_catalog.setval('public.accounts_id_seq', 17, true);
SELECT pg_catalog.setval('public.admin_users_id_seq', 1, true);
SELECT pg_catalog.setval('public.beneficiaries_id_seq', 4, true);
SELECT pg_catalog.setval('public.booking_documents_id_seq', 1, false);
SELECT pg_catalog.setval('public.bookings_id_seq', 6, true);
SELECT pg_catalog.setval('public.commissions_id_seq', 5, true);
SELECT pg_catalog.setval('public.contacts_id_seq', 9, true);
SELECT pg_catalog.setval('public.contract_products_id_seq', 88, true);
SELECT pg_catalog.setval('public.contract_types_id_seq', 8, true);
SELECT pg_catalog.setval('public.contracts_id_seq', 4, true);
SELECT pg_catalog.setval('public.cs_messages_id_seq', 8, true);
SELECT pg_catalog.setval('public.cs_tickets_id_seq', 5, true);
SELECT pg_catalog.setval('public.email_log_id_seq', 1, false);
SELECT pg_catalog.setval('public.email_template_id_seq', 10, true);
SELECT pg_catalog.setval('public.guest_users_id_seq', 4, true);
SELECT pg_catalog.setval('public.invoices_id_seq', 6, true);
SELECT pg_catalog.setval('public.leads_id_seq', 4, true);
SELECT pg_catalog.setval('public.payment_info_id_seq', 1, true);
SELECT pg_catalog.setval('public.product_catalog_id_seq', 88, true);
SELECT pg_catalog.setval('public.product_groups_id_seq', 3, true);
SELECT pg_catalog.setval('public.product_types_id_seq', 11, true);
SELECT pg_catalog.setval('public.promotions_id_seq', 5, true);
SELECT pg_catalog.setval('public.properties_id_seq', 9, true);
SELECT pg_catalog.setval('public.recurring_schedule_id_seq', 1, false);
SELECT pg_catalog.setval('public.service_catalog_id_seq', 36, true);
SELECT pg_catalog.setval('public.service_hosts_id_seq', 1, false);
SELECT pg_catalog.setval('public.space_availability_id_seq', 1, false);
SELECT pg_catalog.setval('public.space_blocked_dates_id_seq', 55, true);
SELECT pg_catalog.setval('public.space_images_id_seq', 53, true);
SELECT pg_catalog.setval('public.space_option_maps_id_seq', 126, true);
SELECT pg_catalog.setval('public.space_options_id_seq', 53, true);
SELECT pg_catalog.setval('public.space_policies_id_seq', 5, true);
SELECT pg_catalog.setval('public.space_service_catalog_id_seq', 1, false);
SELECT pg_catalog.setval('public.spaces_id_seq', 28, true);
SELECT pg_catalog.setval('public.suburbs_id_seq', 6, true);
SELECT pg_catalog.setval('public.system_log_id_seq', 2, true);
SELECT pg_catalog.setval('public.tasks_id_seq', 3, true);
SELECT pg_catalog.setval('public.work_orders_id_seq', 4, true);
