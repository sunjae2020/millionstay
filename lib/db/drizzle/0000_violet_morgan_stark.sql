CREATE TABLE "suburbs" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"state" text,
	"postcode" text,
	"country_code" text NOT NULL,
	"area_name" text,
	"lat" real,
	"lng" real,
	"status" text DEFAULT 'Active' NOT NULL,
	"deleted_at" timestamp,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integration_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text DEFAULT '' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "properties" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"address2" text,
	"city" text,
	"state" text,
	"postcode" text,
	"country_code" text,
	"lat" real,
	"lng" real,
	"approval_status" text DEFAULT 'Pending' NOT NULL,
	"owner_account_id" integer,
	"suburb_id" integer,
	"description" text,
	"deleted_at" timestamp,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "space_options" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"display_name" text,
	"category" text,
	"status" text DEFAULT 'Active' NOT NULL,
	"deleted_at" timestamp,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "space_policies" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"same_gender" boolean DEFAULT false NOT NULL,
	"lady_only" boolean DEFAULT false NOT NULL,
	"no_pet" boolean DEFAULT false NOT NULL,
	"no_smoking" boolean DEFAULT false NOT NULL,
	"meal_option" boolean DEFAULT false NOT NULL,
	"minimum_age" integer,
	"status" text DEFAULT 'Active' NOT NULL,
	"deleted_at" timestamp,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "space_blocked_dates" (
	"id" serial PRIMARY KEY NOT NULL,
	"space_id" integer NOT NULL,
	"date" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "space_option_maps" (
	"id" serial PRIMARY KEY NOT NULL,
	"space_id" integer NOT NULL,
	"space_option_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "spaces" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"manual_input" boolean DEFAULT false NOT NULL,
	"space_type" text,
	"custom_type_name" text,
	"max_occupancy" integer,
	"booking_mode" text,
	"base_weekly_price" real,
	"base_daily_price" real,
	"base_currency" text,
	"floor_number" integer,
	"floor_area_sqm" real,
	"description" text,
	"ical_import_url" text,
	"status" text DEFAULT 'Active' NOT NULL,
	"property_id" integer,
	"parent_space_id" integer,
	"space_policy_id" integer,
	"landlord_account_id" integer,
	"privacy_hide_unit_no" boolean DEFAULT true NOT NULL,
	"privacy_hide_street_no" boolean DEFAULT true NOT NULL,
	"privacy_map_blur" boolean DEFAULT true NOT NULL,
	"deleted_at" timestamp,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"commission_type" text DEFAULT 'Percentage' NOT NULL,
	"commission_rate" real,
	"commission_amount" real,
	"description" text,
	"status" text DEFAULT 'Active' NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_info" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"payment_type" text DEFAULT 'BankTransfer' NOT NULL,
	"bank_name" text,
	"swift_code" text,
	"bsb_number" text,
	"account_number" text,
	"account_name" text,
	"stripe_account_id" text,
	"description" text,
	"status" text DEFAULT 'Active' NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" serial PRIMARY KEY NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"title" text,
	"other_name" text,
	"email" text NOT NULL,
	"mobile_number" text,
	"office_number" text,
	"date_of_birth" text,
	"nationality" text,
	"gender" text,
	"sns_id" text,
	"passport_number" text,
	"passport_expiry" text,
	"visa_type" text,
	"visa_expiry" text,
	"address_line1" text,
	"suburb" text,
	"state" text,
	"postcode" text,
	"country" text,
	"portal_enabled" boolean DEFAULT false NOT NULL,
	"portal_user_id" text,
	"profile_photo_url" text,
	"description" text,
	"manual_input" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'Active' NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"account_type" text NOT NULL,
	"primary_contact_id" integer,
	"secondary_contact_id" integer,
	"account_email" text,
	"website_url" text,
	"phone1" text,
	"phone2" text,
	"address_line1" text,
	"address_suburb" text,
	"address_state" text,
	"address_postcode" text,
	"address_country" text,
	"secondary_address_line1" text,
	"secondary_address_suburb" text,
	"secondary_address_state" text,
	"secondary_address_postcode" text,
	"secondary_address_country" text,
	"payment_info_id" integer,
	"default_commission_id" integer,
	"default_currency" text DEFAULT 'AUD',
	"parent_account_id" integer,
	"description" text,
	"manual_input" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'Active' NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"subject" text,
	"task_status" text DEFAULT 'Todo' NOT NULL,
	"priority" text DEFAULT 'Medium' NOT NULL,
	"task_category" text,
	"primary_contact_id" integer,
	"secondary_contact_id" integer,
	"account_id" integer,
	"booking_id" integer,
	"start_date" date,
	"due_date" date,
	"completed_at" timestamp with time zone,
	"description" text,
	"manual_input" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'Active' NOT NULL,
	"deleted_at" timestamp,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" serial PRIMARY KEY NOT NULL,
	"lead_ref" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"nationality" text,
	"lead_source" text,
	"lead_status" text DEFAULT 'New' NOT NULL,
	"inquiry_type" text,
	"message" text,
	"preferred_space_type" text,
	"preferred_check_in_date" date,
	"preferred_duration_weeks" integer,
	"preferred_suburb_id" integer,
	"budget_min" numeric(12, 2),
	"budget_max" numeric(12, 2),
	"budget_currency" text DEFAULT 'AUD',
	"converted_booking_id" integer,
	"converted_at" timestamp with time zone,
	"assigned_to" text,
	"description" text,
	"manual_input" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'Active' NOT NULL,
	"deleted_at" timestamp,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "leads_lead_ref_unique" UNIQUE("lead_ref")
);
--> statement-breakpoint
CREATE TABLE "service_hosts" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"account_id" integer,
	"contract_product_id" integer,
	"from_date" date,
	"to_date" date,
	"in_call" boolean DEFAULT false,
	"out_call" boolean DEFAULT false,
	"business_start_hour" integer,
	"business_end_hour" integer,
	"description" text,
	"status" text DEFAULT 'Active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"booking_id" integer NOT NULL,
	"doc_type" text,
	"file_name" text,
	"file_url" text,
	"verified_status" text DEFAULT 'Pending' NOT NULL,
	"rejection_reason" text,
	"expiry_date" date,
	"status" text DEFAULT 'Active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking_services" (
	"id" serial PRIMARY KEY NOT NULL,
	"booking_id" integer NOT NULL,
	"service_id" integer,
	"name" text NOT NULL,
	"service_type" text DEFAULT 'one_time',
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_price" numeric(10, 2) NOT NULL,
	"total_price" numeric(10, 2) NOT NULL,
	"currency" text DEFAULT 'AUD' NOT NULL,
	"billing_trigger" text DEFAULT 'at_booking',
	"frequency" text,
	"notes" text,
	"status" text DEFAULT 'Active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" serial PRIMARY KEY NOT NULL,
	"booking_ref" text NOT NULL,
	"name" text,
	"account_id" integer,
	"contact_id" integer,
	"booking_status" text DEFAULT 'Draft' NOT NULL,
	"booking_source" text,
	"customer_notes" text,
	"space_id" integer,
	"check_in_date" date,
	"check_out_date" date,
	"stay_nights" integer,
	"stay_weeks" numeric(6, 2),
	"agreed_weekly_rate" numeric(12, 2),
	"total_rent" numeric(12, 2),
	"currency" text DEFAULT 'AUD',
	"num_guests" integer DEFAULT 1,
	"product_id" integer,
	"contract_product_id" integer,
	"agent_account_id" integer,
	"cancellation_reason" text,
	"cancelled_at" timestamp with time zone,
	"status" text DEFAULT 'Active' NOT NULL,
	"deleted_at" timestamp,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bookings_booking_ref_unique" UNIQUE("booking_ref")
);
--> statement-breakpoint
CREATE TABLE "contract_products" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"product_type" text DEFAULT 'Room' NOT NULL,
	"status" text DEFAULT 'Draft' NOT NULL,
	"space_id" integer,
	"promotion_id" integer,
	"term_type" text,
	"weekly_rate" real,
	"monthly_rate" real,
	"effective_weekly_rate" real,
	"currency" text DEFAULT 'AUD' NOT NULL,
	"billing_frequency" text DEFAULT 'Biweekly',
	"bond_weeks" real DEFAULT 4,
	"bond_amount" real,
	"admin_fee" real,
	"cleaning_fee" real,
	"advance_weeks" real DEFAULT 2,
	"min_stay_weeks" integer DEFAULT 1,
	"max_stay_weeks" integer,
	"includes_wifi" boolean DEFAULT false NOT NULL,
	"includes_parking" boolean DEFAULT false NOT NULL,
	"includes_utilities" boolean DEFAULT false NOT NULL,
	"includes_meals" boolean DEFAULT false NOT NULL,
	"includes_laundry" boolean DEFAULT false NOT NULL,
	"includes_cleaning" boolean DEFAULT false NOT NULL,
	"extra_inclusions" text,
	"notes" text,
	"deleted_at" timestamp,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contracts" (
	"id" serial PRIMARY KEY NOT NULL,
	"contract_ref" text NOT NULL,
	"booking_id" integer,
	"product_id" integer,
	"contract_product_id" integer,
	"tenant_account_id" integer,
	"landlord_account_id" integer,
	"space_id" integer,
	"start_date" text,
	"end_date" text,
	"weekly_rate" real,
	"total_rent" real,
	"bond_amount" real,
	"advance_amount" real,
	"currency" text DEFAULT 'AUD' NOT NULL,
	"status" text DEFAULT 'Draft' NOT NULL,
	"deleted_at" timestamp,
	"sent_at" timestamp with time zone,
	"signed_at" timestamp with time zone,
	"effective_date" text,
	"expiry_date" text,
	"termination_reason" text,
	"document_url" text,
	"terms_text" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contracts_contract_ref_unique" UNIQUE("contract_ref")
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" serial PRIMARY KEY NOT NULL,
	"invoice_ref" text NOT NULL,
	"booking_id" integer,
	"contract_id" integer,
	"account_id" integer,
	"amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"currency" text DEFAULT 'AUD' NOT NULL,
	"status" text DEFAULT 'Draft' NOT NULL,
	"due_date" text,
	"paid_at" timestamp with time zone,
	"payment_method" text,
	"stripe_payment_intent_id" text,
	"stripe_checkout_url" text,
	"description" text,
	"notes" text,
	"deleted_at" timestamp,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_invoice_ref_unique" UNIQUE("invoice_ref")
);
--> statement-breakpoint
CREATE TABLE "work_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_ref" text NOT NULL,
	"property_id" integer,
	"space_id" integer,
	"title" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'Open' NOT NULL,
	"priority" text DEFAULT 'Normal' NOT NULL,
	"category" text,
	"assigned_contact_id" integer,
	"reported_at" text,
	"scheduled_at" text,
	"completed_at" timestamp with time zone,
	"cost" real,
	"currency" text DEFAULT 'AUD' NOT NULL,
	"notes" text,
	"deleted_at" timestamp,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "work_orders_order_ref_unique" UNIQUE("order_ref")
);
--> statement-breakpoint
CREATE TABLE "space_availability" (
	"id" serial PRIMARY KEY NOT NULL,
	"space_id" integer NOT NULL,
	"date" date NOT NULL,
	"is_available" boolean DEFAULT true NOT NULL,
	"block_reason" text,
	"booking_id" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "space_availability_space_id_date_unique" UNIQUE("space_id","date")
);
--> statement-breakpoint
CREATE TABLE "recurring_schedule" (
	"id" serial PRIMARY KEY NOT NULL,
	"booking_id" integer NOT NULL,
	"contract_id" integer,
	"account_id" integer NOT NULL,
	"schedule_type" text DEFAULT 'Rent' NOT NULL,
	"frequency" text DEFAULT 'Biweekly' NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"currency" text DEFAULT 'AUD' NOT NULL,
	"gst_included" boolean DEFAULT true NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"next_due_date" date NOT NULL,
	"last_generated_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"deleted_at" timestamp,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" integer NOT NULL,
	"action" text NOT NULL,
	"actor_type" text DEFAULT 'User' NOT NULL,
	"actor_id" integer,
	"actor_email" text,
	"old_value" jsonb,
	"new_value" jsonb,
	"ip_address" text,
	"user_agent" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_template" (
	"id" serial PRIMARY KEY NOT NULL,
	"template_code" text NOT NULL,
	"subject" text NOT NULL,
	"body_html" text NOT NULL,
	"body_text" text,
	"available_vars" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"deleted_at" timestamp,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_template_template_code_unique" UNIQUE("template_code")
);
--> statement-breakpoint
CREATE TABLE "email_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"template_code" text,
	"to_email" text NOT NULL,
	"to_name" text,
	"subject" text NOT NULL,
	"resend_message_id" text,
	"status" text DEFAULT 'Sent' NOT NULL,
	"entity_type" text,
	"entity_id" integer,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"delivered_at" timestamp with time zone,
	"error_message" text
);
--> statement-breakpoint
CREATE TABLE "contract_types" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"contract_security" text DEFAULT 'Public' NOT NULL,
	"require_passport" boolean DEFAULT false NOT NULL,
	"require_visa" boolean DEFAULT false NOT NULL,
	"require_enrollment" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"deleted_at" timestamp,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contract_types_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "product_groups" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"deleted_at" timestamp,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_groups_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "product_types" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"deleted_at" timestamp,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_types_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "accommodation_catalog" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"item_description" text,
	"product_group_id" integer,
	"product_type_id" integer,
	"space_id" integer,
	"price" real,
	"weekly_rate" real,
	"currency" text DEFAULT 'AUD' NOT NULL,
	"product_tag" text,
	"gst_included" boolean DEFAULT false NOT NULL,
	"promotion_id" integer,
	"commission_id" integer,
	"product_source_account_id" integer,
	"product_provider_account_id" integer,
	"min_contract_period" integer,
	"min_contract_period_unit" text,
	"max_stay_weeks" integer,
	"billing_frequency" text DEFAULT 'Biweekly',
	"term_type" text,
	"bond_amount" real,
	"bond_weeks" real DEFAULT 4,
	"advance_weeks" real DEFAULT 2,
	"admin_fee" real,
	"cleaning_fee" real,
	"includes_wifi" boolean DEFAULT false NOT NULL,
	"includes_parking" boolean DEFAULT false NOT NULL,
	"includes_utilities" boolean DEFAULT false NOT NULL,
	"includes_meals" boolean DEFAULT false NOT NULL,
	"includes_laundry" boolean DEFAULT false NOT NULL,
	"includes_cleaning" boolean DEFAULT false NOT NULL,
	"extra_inclusions" text,
	"display_on_booking_page" boolean DEFAULT true NOT NULL,
	"display_on_invoice" boolean DEFAULT true NOT NULL,
	"status" text DEFAULT 'Active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "space_images" (
	"id" serial PRIMARY KEY NOT NULL,
	"space_id" integer NOT NULL,
	"file_url" varchar(500) NOT NULL,
	"thumbnail_url" varchar(500),
	"cloudinary_id" varchar(200),
	"caption" varchar(300),
	"is_primary" boolean DEFAULT false NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"file_size_bytes" integer,
	"mime_type" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'Admin' NOT NULL,
	"first_name" text DEFAULT '' NOT NULL,
	"last_name" text DEFAULT '' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"force_password_change" boolean DEFAULT false NOT NULL,
	"reset_token" text,
	"reset_token_expires_at" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "promotions" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"code" text,
	"term_type" text DEFAULT 'ShortTerm' NOT NULL,
	"promotion_type" text DEFAULT 'Percentage' NOT NULL,
	"discount_percentage" real,
	"discount_amount" numeric(10, 2),
	"free_nights" integer,
	"min_stay_weeks" integer,
	"max_stay_weeks" integer,
	"min_stay_nights" integer,
	"max_uses" integer,
	"max_uses_per_account" integer,
	"applicable_to" text DEFAULT 'AllSpaces',
	"billing_frequency" text DEFAULT 'Biweekly',
	"valid_from" text,
	"valid_to" text,
	"description" text,
	"terms" text,
	"status" text DEFAULT 'Draft' NOT NULL,
	"deleted_at" timestamp,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "guest_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_id" integer,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"first_name" text,
	"last_name" text,
	"phone" text,
	"nationality" text,
	"date_of_birth" text,
	"gender" text,
	"university" text,
	"department" text,
	"student_id" text,
	"study_year" text,
	"bank_name" text,
	"bank_account_name" text,
	"bank_bsb" text,
	"bank_account_number" text,
	"preferred_payment_method" text,
	"avatar_url" text,
	"avatar_public_id" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "guest_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "guest_emergency_contacts" (
	"id" serial PRIMARY KEY NOT NULL,
	"guest_user_id" integer NOT NULL,
	"name" text NOT NULL,
	"relationship" text,
	"phone" text,
	"email" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "partner_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_id" integer NOT NULL,
	"portal_type" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"first_name" text,
	"last_name" text,
	"phone" text,
	"avatar_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partner_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "beneficiaries" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"contract_product_id" integer,
	"account_id" integer NOT NULL,
	"commission_id" integer,
	"commission_type" text DEFAULT 'Percentage' NOT NULL,
	"split_percentage" real,
	"fixed_amount" real,
	"priority" integer DEFAULT 1,
	"notes" text,
	"status" text DEFAULT 'Active' NOT NULL,
	"deleted_at" timestamp,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_catalog" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"service_type" text DEFAULT 'one_time' NOT NULL,
	"base_price" real,
	"currency" text DEFAULT 'AUD' NOT NULL,
	"is_optional" boolean DEFAULT true NOT NULL,
	"is_refundable" boolean DEFAULT false NOT NULL,
	"billing_trigger" text DEFAULT 'at_booking' NOT NULL,
	"gst_included" boolean DEFAULT false NOT NULL,
	"requires_scheduling" boolean DEFAULT false NOT NULL,
	"scheduling_notes" text,
	"stock_tracked" boolean DEFAULT false NOT NULL,
	"stock_qty" integer,
	"has_variants" boolean DEFAULT false NOT NULL,
	"variant_options" text,
	"promotion_id" integer,
	"display_on_booking_page" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'Active' NOT NULL,
	"deleted_at" timestamp,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "space_service_catalog" (
	"id" serial PRIMARY KEY NOT NULL,
	"space_id" integer NOT NULL,
	"service_id" integer NOT NULL,
	"is_mandatory" boolean DEFAULT false NOT NULL,
	"custom_price" real,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "accommodation_service_catalog" (
	"id" serial PRIMARY KEY NOT NULL,
	"accommodation_id" integer NOT NULL,
	"service_id" integer NOT NULL,
	"is_mandatory" boolean DEFAULT false NOT NULL,
	"custom_price" real,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking_service_photos" (
	"id" serial PRIMARY KEY NOT NULL,
	"booking_service_id" integer NOT NULL,
	"file_url" text NOT NULL,
	"thumbnail_url" text,
	"cloudinary_id" text,
	"caption" text,
	"uploaded_by_type" text DEFAULT 'partner' NOT NULL,
	"uploaded_by_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cs_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticket_id" integer NOT NULL,
	"sender_type" text NOT NULL,
	"sender_id" integer NOT NULL,
	"message" text NOT NULL,
	"image_urls" text,
	"is_internal" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cs_tickets" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticket_ref" text NOT NULL,
	"guest_user_id" integer NOT NULL,
	"booking_id" integer,
	"category" text DEFAULT 'General' NOT NULL,
	"subject" text NOT NULL,
	"description" text NOT NULL,
	"status" text DEFAULT 'Open' NOT NULL,
	"priority" text DEFAULT 'Normal' NOT NULL,
	"assigned_admin_id" integer,
	"closed_at" timestamp with time zone,
	"deleted_at" timestamp,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cs_tickets_ticket_ref_unique" UNIQUE("ticket_ref")
);
--> statement-breakpoint
CREATE TABLE "announcements" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"category" text DEFAULT 'General' NOT NULL,
	"priority" text DEFAULT 'Normal' NOT NULL,
	"is_published" integer DEFAULT 0 NOT NULL,
	"published_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "guest_direct_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"guest_user_id" integer NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"sender_name" text DEFAULT 'MillionStay Team' NOT NULL,
	"is_read" integer DEFAULT 0 NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contract_line_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"contract_id" integer NOT NULL,
	"item_type" text DEFAULT 'Rent' NOT NULL,
	"name" text NOT NULL,
	"billing_trigger" text DEFAULT 'recurring' NOT NULL,
	"billing_frequency" text,
	"unit_price" numeric(10, 2) DEFAULT '0' NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"total_price" numeric(10, 2) DEFAULT '0' NOT NULL,
	"currency" text DEFAULT 'AUD' NOT NULL,
	"gst_included" boolean DEFAULT true NOT NULL,
	"service_id" integer,
	"notes" text,
	"status" text DEFAULT 'Active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blog_posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"excerpt" text,
	"content" text,
	"cover_image_url" text,
	"category" text,
	"author" text,
	"status" text DEFAULT 'Draft' NOT NULL,
	"published_at" timestamp with time zone,
	"seo_title" text,
	"seo_description" text,
	"seo_keywords" text,
	"translations" jsonb DEFAULT '{}'::jsonb,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "page_contents" (
	"id" serial PRIMARY KEY NOT NULL,
	"page_key" text NOT NULL,
	"language" text DEFAULT 'en' NOT NULL,
	"content" jsonb DEFAULT '{}'::jsonb,
	"seo_title" text,
	"seo_description" text,
	"seo_keywords" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "page_contents_page_key_language_unique" UNIQUE("page_key","language")
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" integer NOT NULL,
	"user_type" varchar(16) NOT NULL,
	"token_hash" varchar(128) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"ip_address" varchar(45),
	"user_agent" varchar(512),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "refresh_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE INDEX "idx_space_avail_space_date" ON "space_availability" USING btree ("space_id","date");--> statement-breakpoint
CREATE INDEX "idx_recurring_next_due" ON "recurring_schedule" USING btree ("next_due_date");--> statement-breakpoint
CREATE INDEX "idx_syslog_entity" ON "system_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "idx_syslog_actor" ON "system_log" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "idx_syslog_created" ON "system_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_email_log_entity" ON "email_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "idx_refresh_tokens_user" ON "refresh_tokens" USING btree ("user_id","user_type");--> statement-breakpoint
CREATE INDEX "idx_refresh_tokens_expires" ON "refresh_tokens" USING btree ("expires_at");