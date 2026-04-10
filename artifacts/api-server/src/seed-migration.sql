INSERT INTO public.accommodation_catalog (id, name, item_description, product_group_id, product_type_id, space_id, price, currency, product_tag, gst_included, commission_id, product_source_account_id, product_provider_account_id, min_contract_period, min_contract_period_unit, display_on_booking_page, display_on_invoice, status, created_at, updated_at, bond_amount, admin_fee, cleaning_fee, promotion_id) VALUES
INSERT INTO public.accommodation_service_catalog (id, accommodation_id, service_id, is_mandatory, custom_price, sort_order, created_at, updated_at) VALUES
INSERT INTO public.accommodation_service_catalog (id, accommodation_id, service_id, is_mandatory, custom_price, sort_order, created_at, updated_at) VALUES
INSERT INTO public.accommodation_service_catalog (id, accommodation_id, service_id, is_mandatory, custom_price, sort_order, created_at, updated_at) VALUES
INSERT INTO public.accommodation_service_catalog (id, accommodation_id, service_id, is_mandatory, custom_price, sort_order, created_at, updated_at) VALUES
INSERT INTO public.accommodation_service_catalog (id, accommodation_id, service_id, is_mandatory, custom_price, sort_order, created_at, updated_at) VALUES
INSERT INTO public.accounts (id, name, account_type, primary_contact_id, secondary_contact_id, account_email, website_url, phone1, phone2, address_line1, address_suburb, address_state, address_postcode, address_country, secondary_address_line1, secondary_address_suburb, secondary_address_state, secondary_address_postcode, secondary_address_country, payment_info_id, default_commission_id, default_currency, parent_account_id, description, manual_input, status, created_at, updated_at) VALUES
INSERT INTO public.admin_users (id, email, password_hash, role, first_name, last_name, is_active, force_password_change, last_login_at, created_at, updated_at) VALUES
INSERT INTO public.beneficiaries (id, name, contract_product_id, account_id, commission_id, commission_type, split_percentage, fixed_amount, priority, notes, status, created_at, updated_at) VALUES
INSERT INTO public.bookings (id, booking_ref, name, account_id, contact_id, booking_status, booking_source, customer_notes, space_id, check_in_date, check_out_date, stay_nights, stay_weeks, agreed_weekly_rate, total_rent, currency, num_guests, contract_product_id, cancellation_reason, cancelled_at, status, created_at, updated_at) VALUES
INSERT INTO public.commissions (id, name, commission_type, commission_rate, commission_amount, description, status, created_at, updated_at) VALUES
INSERT INTO public.contacts (id, first_name, last_name, title, other_name, email, mobile_number, office_number, date_of_birth, nationality, gender, sns_id, passport_number, passport_expiry, visa_type, visa_expiry, address_line1, suburb, state, postcode, country, portal_enabled, portal_user_id, profile_photo_url, description, manual_input, status, created_at, updated_at) VALUES
INSERT INTO public.contract_products (id, name, description, product_type, status, space_id, weekly_rate, monthly_rate, currency, bond_weeks, advance_weeks, min_stay_weeks, max_stay_weeks, includes_wifi, includes_parking, includes_utilities, includes_meals, includes_laundry, includes_cleaning, extra_inclusions, notes, created_at, updated_at, promotion_id, term_type, effective_weekly_rate, billing_frequency, bond_amount, admin_fee, cleaning_fee) VALUES
INSERT INTO public.contract_types (id, name, description, contract_security, require_passport, require_visa, require_enrollment, is_active, created_at, updated_at) VALUES
INSERT INTO public.contracts (id, contract_ref, booking_id, contract_product_id, tenant_account_id, landlord_account_id, space_id, start_date, end_date, weekly_rate, total_rent, bond_amount, advance_amount, currency, status, sent_at, signed_at, effective_date, expiry_date, termination_reason, document_url, terms_text, notes, created_at, updated_at) VALUES
INSERT INTO public.cs_messages (id, ticket_id, sender_type, sender_id, message, image_urls, is_internal, created_at) VALUES
INSERT INTO public.cs_tickets (id, ticket_ref, guest_user_id, booking_id, category, subject, description, status, priority, assigned_admin_id, closed_at, created_at, updated_at) VALUES
INSERT INTO public.email_template (id, template_code, subject, body_html, body_text, available_vars, is_active, created_at, updated_at) VALUES
INSERT INTO public.guest_users (id, account_id, email, password_hash, first_name, last_name, phone, is_active, email_verified, created_at, updated_at) VALUES
INSERT INTO public.integration_settings (key, value, updated_at) VALUES
INSERT INTO public.invoices (id, invoice_ref, booking_id, contract_id, account_id, amount, currency, status, due_date, paid_at, payment_method, stripe_payment_intent_id, stripe_checkout_url, description, notes, created_at, updated_at) VALUES
INSERT INTO public.leads (id, lead_ref, first_name, last_name, email, phone, nationality, lead_source, lead_status, inquiry_type, message, preferred_space_type, preferred_check_in_date, preferred_duration_weeks, preferred_suburb_id, budget_min, budget_max, budget_currency, converted_booking_id, converted_at, assigned_to, description, manual_input, status, created_at, updated_at) VALUES
INSERT INTO public.payment_info (id, name, payment_type, bank_name, swift_code, bsb_number, account_number, account_name, stripe_account_id, description, status, created_at, updated_at) VALUES
INSERT INTO public.product_groups (id, name, display_order, created_at, updated_at) VALUES
INSERT INTO public.product_types (id, name, description, created_at, updated_at) VALUES
INSERT INTO public.promotions (id, name, code, promotion_type, discount_percentage, discount_amount, free_nights, valid_from, valid_to, min_stay_nights, max_uses, max_uses_per_account, applicable_to, description, terms, status, created_at, updated_at, term_type, min_stay_weeks, max_stay_weeks, billing_frequency) VALUES
INSERT INTO public.properties (id, name, address, address2, city, state, postcode, country_code, lat, lng, approval_status, owner_account_id, suburb_id, description, created_at, updated_at) VALUES
INSERT INTO public.service_catalog (id, name, description, service_type, base_price, currency, is_optional, is_refundable, billing_trigger, gst_included, requires_scheduling, scheduling_notes, stock_tracked, stock_qty, has_variants, variant_options, display_on_booking_page, sort_order, status, created_at, updated_at, promotion_id) VALUES
INSERT INTO public.space_blocked_dates (id, space_id, date, created_at) VALUES
INSERT INTO public.space_images (id, space_id, file_url, thumbnail_url, cloudinary_id, caption, is_primary, display_order, file_size_bytes, mime_type, created_at) VALUES
INSERT INTO public.space_option_maps (id, space_id, space_option_id, created_at) VALUES
INSERT INTO public.space_option_maps (id, space_id, space_option_id, created_at) VALUES
INSERT INTO public.space_options (id, name, display_name, category, status, created_at, updated_at) VALUES
INSERT INTO public.space_policies (id, name, same_gender, lady_only, no_pet, no_smoking, meal_option, minimum_age, status, created_at, updated_at) VALUES
INSERT INTO public.spaces (id, name, manual_input, space_type, custom_type_name, max_occupancy, booking_mode, base_weekly_price, base_currency, floor_number, floor_area_sqm, description, ical_import_url, status, property_id, parent_space_id, space_policy_id, landlord_account_id, created_at, updated_at, base_daily_price) VALUES
INSERT INTO public.suburbs (id, name, state, postcode, country_code, area_name, lat, lng, status, created_at, updated_at) VALUES
INSERT INTO public.system_log (id, entity_type, entity_id, action, actor_type, actor_id, actor_email, old_value, new_value, ip_address, user_agent, notes, created_at) VALUES
INSERT INTO public.tasks (id, name, subject, task_status, priority, task_category, primary_contact_id, secondary_contact_id, account_id, booking_id, start_date, due_date, completed_at, description, manual_input, status, created_at, updated_at) VALUES
INSERT INTO public.work_orders (id, order_ref, property_id, space_id, title, description, status, priority, category, assigned_contact_id, reported_at, scheduled_at, completed_at, cost, currency, notes, created_at, updated_at) VALUES
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
