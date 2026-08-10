import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout, PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { APP_NAME } from "@/lib/appName";
import {
  ArrowLeft, Save, Globe, Search, Eye, EyeOff,
  Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight,
  List, ListOrdered, Heading2, Heading3, Link as LinkIcon, Image,
  Undo, Redo, Loader2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/apiFetch";
import { MediaPickerDialog } from "@/components/MediaLibrary";
import { Images } from "lucide-react";
import { WEBSITE_PAGES, getSiteForPage, SITES } from "./WebsiteContentList";

// ─── Page Section Definitions ───────────────────────────────────────────────

type FieldType = "text" | "textarea" | "richtext" | "image";

interface SectionField {
  key: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  hint?: string;
}

const PAGE_FIELDS: Record<string, SectionField[]> = {
  home: [
    { key: "hero_title", label: "Hero Title", type: "text", placeholder: "Find Your Home Away From Home" },
    { key: "hero_subtitle", label: "Hero Subtitle", type: "textarea", placeholder: "Tagline below the hero title" },
    { key: "hero_cta_primary", label: "Primary CTA Button Text", type: "text", placeholder: "Browse Rooms" },
    { key: "hero_cta_secondary", label: "Secondary CTA Button Text", type: "text", placeholder: "Learn More" },
    { key: "why_title", label: `"Why ${APP_NAME}" Section Title`, type: "text" },
    { key: "why_body", label: `"Why ${APP_NAME}" Body`, type: "richtext" },
    { key: "feature_1_title", label: "Feature 1 — Title", type: "text" },
    { key: "feature_1_body", label: "Feature 1 — Description", type: "textarea" },
    { key: "feature_2_title", label: "Feature 2 — Title", type: "text" },
    { key: "feature_2_body", label: "Feature 2 — Description", type: "textarea" },
    { key: "feature_3_title", label: "Feature 3 — Title", type: "text" },
    { key: "feature_3_body", label: "Feature 3 — Description", type: "textarea" },
    { key: "stat_rooms", label: "Stat — Rooms", type: "text", placeholder: "500+" },
    { key: "stat_universities", label: "Stat — Universities", type: "text", placeholder: "40+" },
    { key: "stat_support", label: "Stat — Support", type: "text", placeholder: "24/7" },
    { key: "cta_title", label: "CTA Section Title", type: "text" },
    { key: "cta_subtitle", label: "CTA Section Subtitle", type: "textarea" },
    { key: "cta_button", label: "CTA Button Text", type: "text" },
  ],
  "for-student": [
    { key: "hero_title", label: "Hero Title", type: "text" },
    { key: "hero_subtitle", label: "Hero Subtitle", type: "text" },
    { key: "intro_title", label: "Intro Heading", type: "text" },
    { key: "intro_body", label: "Intro Body Text", type: "richtext" },
    { key: "feature_1_title", label: "Feature 1 — Title", type: "text" },
    { key: "feature_1_body", label: "Feature 1 — Description", type: "textarea" },
    { key: "feature_2_title", label: "Feature 2 — Title", type: "text" },
    { key: "feature_2_body", label: "Feature 2 — Description", type: "textarea" },
    { key: "feature_3_title", label: "Feature 3 — Title", type: "text" },
    { key: "feature_3_body", label: "Feature 3 — Description", type: "textarea" },
    { key: "feature_4_title", label: "Feature 4 — Title", type: "text" },
    { key: "feature_4_body", label: "Feature 4 — Description", type: "textarea" },
    { key: "cta_primary", label: "Primary CTA Text", type: "text" },
    { key: "cta_secondary", label: "Secondary CTA Text", type: "text" },
    { key: "hero_image_url", label: "Hero Image URL", type: "image" },
  ],
  "for-agent": [
    { key: "hero_title", label: "Hero Title", type: "text" },
    { key: "hero_subtitle", label: "Hero Subtitle", type: "text" },
    { key: "intro_title", label: "Intro Heading", type: "text" },
    { key: "intro_body", label: "Intro Body", type: "richtext" },
    { key: "benefit_1_title", label: "Benefit 1 — Title", type: "text" },
    { key: "benefit_1_body", label: "Benefit 1 — Description", type: "textarea" },
    { key: "benefit_2_title", label: "Benefit 2 — Title", type: "text" },
    { key: "benefit_2_body", label: "Benefit 2 — Description", type: "textarea" },
    { key: "benefit_3_title", label: "Benefit 3 — Title", type: "text" },
    { key: "benefit_3_body", label: "Benefit 3 — Description", type: "textarea" },
    { key: "how_title", label: '"How It Works" Title', type: "text" },
    { key: "how_body", label: '"How It Works" Body', type: "richtext" },
    { key: "cta_title", label: "CTA Title", type: "text" },
    { key: "cta_button", label: "CTA Button Text", type: "text" },
  ],
  about: [
    { key: "hero_title", label: "Hero Title", type: "text" },
    { key: "hero_subtitle", label: "Hero Subtitle", type: "textarea" },
    { key: "mission_title", label: "Mission Section Title", type: "text" },
    { key: "mission_body", label: "Mission Body", type: "richtext" },
    { key: "values_title", label: "Values Section Title", type: "text" },
    { key: "value_1_title", label: "Value 1 — Title", type: "text" },
    { key: "value_1_body", label: "Value 1 — Description", type: "textarea" },
    { key: "value_2_title", label: "Value 2 — Title", type: "text" },
    { key: "value_2_body", label: "Value 2 — Description", type: "textarea" },
    { key: "value_3_title", label: "Value 3 — Title", type: "text" },
    { key: "value_3_body", label: "Value 3 — Description", type: "textarea" },
    { key: "team_title", label: "Team Section Title", type: "text" },
    { key: "team_body", label: "Team Section Body", type: "richtext" },
  ],
  faq: [
    { key: "hero_title", label: "Hero Title", type: "text" },
    { key: "hero_subtitle", label: "Hero Subtitle", type: "text" },
    { key: "section_1_title", label: "Category 1 Title", type: "text" },
    { key: "section_1_body", label: "Category 1 — Q&A Content", type: "richtext", hint: "Use H3 for questions, paragraph for answers" },
    { key: "section_2_title", label: "Category 2 Title", type: "text" },
    { key: "section_2_body", label: "Category 2 — Q&A Content", type: "richtext", hint: "Use H3 for questions, paragraph for answers" },
    { key: "section_3_title", label: "Category 3 Title", type: "text" },
    { key: "section_3_body", label: "Category 3 — Q&A Content", type: "richtext", hint: "Use H3 for questions, paragraph for answers" },
    { key: "cta_title", label: "CTA Title", type: "text" },
    { key: "cta_body", label: "CTA Body", type: "textarea" },
    { key: "cta_button", label: "CTA Button Text", type: "text" },
  ],
  contact: [
    { key: "hero_title", label: "Hero Title", type: "text" },
    { key: "hero_subtitle", label: "Hero Subtitle", type: "textarea" },
    { key: "address_title", label: "Office Address Label", type: "text" },
    { key: "address", label: "Office Address", type: "textarea" },
    { key: "phone_label", label: "Phone Label", type: "text" },
    { key: "phone", label: "Phone Number", type: "text" },
    { key: "email_label", label: "Email Label", type: "text" },
    { key: "email", label: "Email Address", type: "text" },
    { key: "hours_label", label: "Hours Label", type: "text" },
    { key: "hours", label: "Business Hours", type: "textarea" },
    { key: "form_title", label: "Form Section Title", type: "text" },
    { key: "form_subtitle", label: "Form Section Subtitle", type: "textarea" },
  ],

  // ── Homestay site (homestay.millionstay.com) — fields here map to the
  //    overlay points wired into the homestay page components. An empty field
  //    falls back to the built-in i18n copy on the live site.
  "homestay-home": [
    { key: "hero_title", label: "Hero Title", type: "text" },
    { key: "hero_lead", label: "Hero Lead", type: "textarea" },
    { key: "hero_cta_find", label: "Primary CTA — Find a Homestay", type: "text" },
    { key: "hero_cta_host", label: "Secondary CTA — Become a Host", type: "text" },
    { key: "why_heading", label: '"Why Million Homestay" Heading', type: "text" },
    { key: "how_heading", label: '"How It Works" Heading', type: "text" },
    { key: "how_body", label: '"How It Works" Body', type: "textarea" },
    { key: "how_cta", label: '"How It Works" CTA Text', type: "text" },
  ],
  "homestay-about": [
    { key: "hero_eyebrow", label: "Hero Eyebrow", type: "text" },
    { key: "hero_title", label: "Hero Title", type: "text" },
    { key: "hero_lead_p1", label: "Hero Lead — Paragraph 1", type: "textarea" },
    { key: "hero_lead_p2", label: "Hero Lead — Paragraph 2", type: "textarea" },
    { key: "bridging_heading", label: "Bridging Section Heading", type: "text" },
    { key: "bridging_body", label: "Bridging Section Body", type: "richtext" },
    { key: "mission_heading", label: "Mission Heading", type: "text" },
    { key: "mission_body", label: "Mission Body", type: "richtext" },
    { key: "vision_heading", label: "Vision Heading", type: "text" },
    { key: "vision_body", label: "Vision Body", type: "richtext" },
  ],
  "homestay-students": [
    { key: "hero_eyebrow", label: "Hero Eyebrow", type: "text" },
    { key: "hero_title", label: "Hero Title", type: "text" },
    { key: "hero_lead", label: "Hero Lead", type: "textarea" },
  ],
  "homestay-hosts": [
    { key: "hero_eyebrow", label: "Hero Eyebrow", type: "text" },
    { key: "hero_title", label: "Hero Title", type: "text" },
    { key: "hero_lead", label: "Hero Lead", type: "textarea" },
  ],
  "homestay-partners": [
    { key: "hero_eyebrow", label: "Hero Eyebrow", type: "text" },
    { key: "hero_title", label: "Hero Title", type: "text" },
    { key: "hero_lead", label: "Hero Lead", type: "textarea" },
  ],
  "homestay-contact": [
    { key: "heading", label: "Contact Heading", type: "text" },
    { key: "subheading", label: "Contact Subheading", type: "textarea" },
    { key: "location_value", label: "Location Value", type: "text" },
  ],

  // ── Development site (single-building instances, e.g. Metheim) — "dev-"
  //    prefixed. Fields overlay the built-in i18n copy; an empty field falls
  //    back to the default. Floor-plan/hero images use image URL fields.
  "dev-home": [
    { key: "hero_eyebrow", label: "Hero Eyebrow (shown on every slide)", type: "text" },
    // Hero background slideshow — 3–5 slides, each with its own image + title +
    // subtitle. A slide appears when it has an image or a title. Slides 1–4 ship
    // with default free stock images; clear/replace them here. Slide 5 is opt-in.
    { key: "hero_slide_1_image", label: "Slide 1 — Image URL", type: "image" },
    { key: "hero_slide_1_title", label: "Slide 1 — Title", type: "text" },
    { key: "hero_slide_1_subtitle", label: "Slide 1 — Subtitle", type: "textarea" },
    { key: "hero_slide_2_image", label: "Slide 2 — Image URL", type: "image" },
    { key: "hero_slide_2_title", label: "Slide 2 — Title", type: "text" },
    { key: "hero_slide_2_subtitle", label: "Slide 2 — Subtitle", type: "textarea" },
    { key: "hero_slide_3_image", label: "Slide 3 — Image URL", type: "image" },
    { key: "hero_slide_3_title", label: "Slide 3 — Title", type: "text" },
    { key: "hero_slide_3_subtitle", label: "Slide 3 — Subtitle", type: "textarea" },
    { key: "hero_slide_4_image", label: "Slide 4 — Image URL", type: "image" },
    { key: "hero_slide_4_title", label: "Slide 4 — Title", type: "text" },
    { key: "hero_slide_4_subtitle", label: "Slide 4 — Subtitle", type: "textarea" },
    { key: "hero_slide_5_image", label: "Slide 5 — Image URL (optional)", type: "image" },
    { key: "hero_slide_5_title", label: "Slide 5 — Title (optional)", type: "text" },
    { key: "hero_slide_5_subtitle", label: "Slide 5 — Subtitle (optional)", type: "textarea" },
    { key: "pillar_buy_title", label: "Pillar — Buy Title", type: "text" },
    { key: "pillar_buy_body", label: "Pillar — Buy Body", type: "textarea" },
    { key: "pillar_rent_title", label: "Pillar — Rent Title", type: "text" },
    { key: "pillar_rent_body", label: "Pillar — Rent Body", type: "textarea" },
    { key: "pillar_mgmt_title", label: "Pillar — Management Title", type: "text" },
    { key: "pillar_mgmt_body", label: "Pillar — Management Body", type: "textarea" },
    { key: "why_heading", label: "Why Section Heading", type: "text" },
    { key: "why_1_title", label: "Why 1 — Title", type: "text" },
    { key: "why_1_body", label: "Why 1 — Body", type: "textarea" },
    { key: "why_2_title", label: "Why 2 — Title", type: "text" },
    { key: "why_2_body", label: "Why 2 — Body", type: "textarea" },
    { key: "why_3_title", label: "Why 3 — Title", type: "text" },
    { key: "why_3_body", label: "Why 3 — Body", type: "textarea" },
    { key: "cta_title", label: "CTA Title", type: "text" },
    { key: "cta_subtitle", label: "CTA Subtitle", type: "textarea" },
    // Building intro band
    { key: "intro_image", label: "Intro — Image URL", type: "image" },
    { key: "intro_eyebrow", label: "Intro — Eyebrow", type: "text" },
    { key: "intro_title", label: "Intro — Title", type: "text" },
    { key: "intro_body", label: "Intro — Body", type: "textarea" },
    { key: "intro_stat_1_value", label: "Intro Stat 1 — Value", type: "text" },
    { key: "intro_stat_1_label", label: "Intro Stat 1 — Label", type: "text" },
    { key: "intro_stat_2_value", label: "Intro Stat 2 — Value", type: "text" },
    { key: "intro_stat_2_label", label: "Intro Stat 2 — Label", type: "text" },
    { key: "intro_stat_3_value", label: "Intro Stat 3 — Value", type: "text" },
    { key: "intro_stat_3_label", label: "Intro Stat 3 — Label", type: "text" },
    // Resident reviews (3 slots)
    { key: "reviews_eyebrow", label: "Reviews — Eyebrow", type: "text" },
    { key: "reviews_heading", label: "Reviews — Heading", type: "text" },
    { key: "reviews_subtitle", label: "Reviews — Subtitle", type: "textarea" },
    { key: "review_1_quote", label: "Review 1 — Quote", type: "textarea" },
    { key: "review_1_name", label: "Review 1 — Name", type: "text" },
    { key: "review_1_role", label: "Review 1 — Role", type: "text" },
    { key: "review_1_avatar", label: "Review 1 — Avatar URL", type: "image" },
    { key: "review_2_quote", label: "Review 2 — Quote", type: "textarea" },
    { key: "review_2_name", label: "Review 2 — Name", type: "text" },
    { key: "review_2_role", label: "Review 2 — Role", type: "text" },
    { key: "review_2_avatar", label: "Review 2 — Avatar URL", type: "image" },
    { key: "review_3_quote", label: "Review 3 — Quote", type: "textarea" },
    { key: "review_3_name", label: "Review 3 — Name", type: "text" },
    { key: "review_3_role", label: "Review 3 — Role", type: "text" },
    { key: "review_3_avatar", label: "Review 3 — Avatar URL", type: "image" },
    // News (3 slots)
    { key: "news_eyebrow", label: "News — Eyebrow", type: "text" },
    { key: "news_heading", label: "News — Heading", type: "text" },
    { key: "news_subtitle", label: "News — Subtitle", type: "textarea" },
    { key: "news_1_title", label: "News 1 — Title", type: "text" },
    { key: "news_1_date", label: "News 1 — Date", type: "text" },
    { key: "news_1_summary", label: "News 1 — Summary", type: "textarea" },
    { key: "news_1_image", label: "News 1 — Image URL", type: "image" },
    { key: "news_1_link", label: "News 1 — Link URL (optional)", type: "text" },
    { key: "news_2_title", label: "News 2 — Title", type: "text" },
    { key: "news_2_date", label: "News 2 — Date", type: "text" },
    { key: "news_2_summary", label: "News 2 — Summary", type: "textarea" },
    { key: "news_2_image", label: "News 2 — Image URL", type: "image" },
    { key: "news_2_link", label: "News 2 — Link URL (optional)", type: "text" },
    { key: "news_3_title", label: "News 3 — Title", type: "text" },
    { key: "news_3_date", label: "News 3 — Date", type: "text" },
    { key: "news_3_summary", label: "News 3 — Summary", type: "textarea" },
    { key: "news_3_image", label: "News 3 — Image URL", type: "image" },
    { key: "news_3_link", label: "News 3 — Link URL (optional)", type: "text" },
  ],
  // The search screen is functional UI (filters, results, map) built in code —
  // only its hero is content-managed, so these are the only fields it has.
  "dev-search": [
    { key: "hero_title", label: "Hero Title", type: "text", hint: "Leave empty to keep the built-in wording." },
    { key: "hero_tagline", label: "Hero Tagline", type: "text" },
    { key: "hero_image_url", label: "Hero Background Image", type: "image" },
  ],
  "dev-about": [
    { key: "hero_image_url", label: "Hero Background Image URL", type: "image" },
    { key: "eyebrow", label: "Hero Eyebrow", type: "text" },
    { key: "hero_title", label: "Hero Title", type: "text" },
    { key: "hero_subtitle", label: "Hero Subtitle", type: "textarea" },
    { key: "story_title", label: "Story Section Title", type: "text" },
    { key: "story_p1", label: "Story Paragraph 1", type: "textarea" },
    { key: "story_p2", label: "Story Paragraph 2", type: "textarea" },
    { key: "vision_title", label: "Vision Title", type: "text" },
    { key: "vision_body", label: "Vision Body", type: "textarea" },
    { key: "value_1_title", label: "Value 1 — Title", type: "text" },
    { key: "value_1_body", label: "Value 1 — Body", type: "textarea" },
    { key: "value_2_title", label: "Value 2 — Title", type: "text" },
    { key: "value_2_body", label: "Value 2 — Body", type: "textarea" },
    { key: "value_3_title", label: "Value 3 — Title", type: "text" },
    { key: "value_3_body", label: "Value 3 — Body", type: "textarea" },
    // Logo meaning band
    { key: "logo_image", label: "Logo — Image URL (defaults to brand logo)", type: "image" },
    { key: "logo_eyebrow", label: "Logo — Eyebrow", type: "text" },
    { key: "logo_title", label: "Logo — Title", type: "text" },
    { key: "logo_body_1", label: "Logo — Paragraph 1", type: "textarea" },
    { key: "logo_body_2", label: "Logo — Paragraph 2", type: "textarea" },
    // Image gallery (4 boxes)
    { key: "gallery_eyebrow", label: "Gallery — Eyebrow", type: "text" },
    { key: "gallery_heading", label: "Gallery — Heading", type: "text" },
    { key: "gallery_subtitle", label: "Gallery — Subtitle", type: "textarea" },
    { key: "gallery_1_image", label: "Gallery 1 — Image URL", type: "image" },
    { key: "gallery_1_caption", label: "Gallery 1 — Caption", type: "text" },
    { key: "gallery_2_image", label: "Gallery 2 — Image URL", type: "image" },
    { key: "gallery_2_caption", label: "Gallery 2 — Caption", type: "text" },
    { key: "gallery_3_image", label: "Gallery 3 — Image URL", type: "image" },
    { key: "gallery_3_caption", label: "Gallery 3 — Caption", type: "text" },
    { key: "gallery_4_image", label: "Gallery 4 — Image URL", type: "image" },
    { key: "gallery_4_caption", label: "Gallery 4 — Caption", type: "text" },
    // Numbers band (4 stats)
    { key: "stat_1_value", label: "Stat 1 — Value", type: "text" },
    { key: "stat_1_label", label: "Stat 1 — Label", type: "text" },
    { key: "stat_2_value", label: "Stat 2 — Value", type: "text" },
    { key: "stat_2_label", label: "Stat 2 — Label", type: "text" },
    { key: "stat_3_value", label: "Stat 3 — Value", type: "text" },
    { key: "stat_3_label", label: "Stat 3 — Label", type: "text" },
    { key: "stat_4_value", label: "Stat 4 — Value", type: "text" },
    { key: "stat_4_label", label: "Stat 4 — Label", type: "text" },
    { key: "cta_title", label: "CTA Title", type: "text" },
    { key: "cta_subtitle", label: "CTA Subtitle", type: "textarea" },
  ],
  "dev-buy": [
    { key: "hero_title", label: "Hero Title", type: "text" },
    { key: "hero_subtitle", label: "Hero Subtitle", type: "textarea" },
    { key: "overview_title", label: "Overview Title", type: "text" },
    { key: "overview_p1", label: "Overview Paragraph 1", type: "textarea" },
    { key: "overview_p2", label: "Overview Paragraph 2", type: "textarea" },
    { key: "remaining_units", label: "Remaining Units (headline)", type: "text" },
    { key: "remaining_note", label: "Remaining Units Note", type: "textarea" },
    { key: "plans_title", label: "Floor Plans Section Title", type: "text" },
    { key: "plan_1_image", label: "Plan 1 — Image URL", type: "image" },
    { key: "plan_1_name", label: "Plan 1 — Name", type: "text" },
    { key: "plan_1_area", label: "Plan 1 — Area", type: "text" },
    { key: "plan_1_price", label: "Plan 1 — Price", type: "text" },
    { key: "plan_1_status", label: "Plan 1 — Status (e.g. Available)", type: "text" },
    { key: "plan_2_image", label: "Plan 2 — Image URL", type: "image" },
    { key: "plan_2_name", label: "Plan 2 — Name", type: "text" },
    { key: "plan_2_area", label: "Plan 2 — Area", type: "text" },
    { key: "plan_2_price", label: "Plan 2 — Price", type: "text" },
    { key: "plan_2_status", label: "Plan 2 — Status", type: "text" },
    { key: "plan_3_image", label: "Plan 3 — Image URL", type: "image" },
    { key: "plan_3_name", label: "Plan 3 — Name", type: "text" },
    { key: "plan_3_area", label: "Plan 3 — Area", type: "text" },
    { key: "plan_3_price", label: "Plan 3 — Price", type: "text" },
    { key: "plan_3_status", label: "Plan 3 — Status", type: "text" },
    { key: "plan_4_image", label: "Plan 4 — Image URL", type: "image" },
    { key: "plan_4_name", label: "Plan 4 — Name", type: "text" },
    { key: "plan_4_area", label: "Plan 4 — Area", type: "text" },
    { key: "plan_4_price", label: "Plan 4 — Price", type: "text" },
    { key: "plan_4_status", label: "Plan 4 — Status", type: "text" },
    // Why Metheim (3 reasons)
    { key: "why_eyebrow", label: "Why — Eyebrow", type: "text" },
    { key: "why_heading", label: "Why — Heading", type: "text" },
    { key: "why_subtitle", label: "Why — Subtitle", type: "textarea" },
    { key: "why_1_title", label: "Why 1 — Title", type: "text" },
    { key: "why_1_body", label: "Why 1 — Body", type: "textarea" },
    { key: "why_2_title", label: "Why 2 — Title", type: "text" },
    { key: "why_2_body", label: "Why 2 — Body", type: "textarea" },
    { key: "why_3_title", label: "Why 3 — Title", type: "text" },
    { key: "why_3_body", label: "Why 3 — Body", type: "textarea" },
    // Process (4 steps)
    { key: "process_eyebrow", label: "Process — Eyebrow", type: "text" },
    { key: "process_heading", label: "Process — Heading", type: "text" },
    { key: "process_subtitle", label: "Process — Subtitle", type: "textarea" },
    { key: "step_1_title", label: "Step 1 — Title", type: "text" },
    { key: "step_1_body", label: "Step 1 — Body", type: "textarea" },
    { key: "step_2_title", label: "Step 2 — Title", type: "text" },
    { key: "step_2_body", label: "Step 2 — Body", type: "textarea" },
    { key: "step_3_title", label: "Step 3 — Title", type: "text" },
    { key: "step_3_body", label: "Step 3 — Body", type: "textarea" },
    { key: "step_4_title", label: "Step 4 — Title", type: "text" },
    { key: "step_4_body", label: "Step 4 — Body", type: "textarea" },
    { key: "inquiry_title", label: "Inquiry Section Title", type: "text" },
    { key: "inquiry_subtitle", label: "Inquiry Section Subtitle", type: "textarea" },
  ],
  "dev-rent": [
    { key: "hero_title", label: "Hero Title", type: "text" },
    { key: "hero_subtitle", label: "Hero Subtitle", type: "textarea" },
    // Why Metheim (3 reasons)
    { key: "why_eyebrow", label: "Why — Eyebrow", type: "text" },
    { key: "why_heading", label: "Why — Heading", type: "text" },
    { key: "why_subtitle", label: "Why — Subtitle", type: "textarea" },
    { key: "why_1_title", label: "Why 1 — Title", type: "text" },
    { key: "why_1_body", label: "Why 1 — Body", type: "textarea" },
    { key: "why_2_title", label: "Why 2 — Title", type: "text" },
    { key: "why_2_body", label: "Why 2 — Body", type: "textarea" },
    { key: "why_3_title", label: "Why 3 — Title", type: "text" },
    { key: "why_3_body", label: "Why 3 — Body", type: "textarea" },
    // Process (4 steps)
    { key: "process_eyebrow", label: "Process — Eyebrow", type: "text" },
    { key: "process_heading", label: "Process — Heading", type: "text" },
    { key: "process_subtitle", label: "Process — Subtitle", type: "textarea" },
    { key: "step_1_title", label: "Step 1 — Title", type: "text" },
    { key: "step_1_body", label: "Step 1 — Body", type: "textarea" },
    { key: "step_2_title", label: "Step 2 — Title", type: "text" },
    { key: "step_2_body", label: "Step 2 — Body", type: "textarea" },
    { key: "step_3_title", label: "Step 3 — Title", type: "text" },
    { key: "step_3_body", label: "Step 3 — Body", type: "textarea" },
    { key: "step_4_title", label: "Step 4 — Title", type: "text" },
    { key: "step_4_body", label: "Step 4 — Body", type: "textarea" },
    { key: "short_title", label: "Short-term — Heading", type: "text" },
    { key: "short_body", label: "Short-term — Body", type: "textarea" },
    { key: "long_title", label: "Long-term — Heading", type: "text" },
    { key: "long_body", label: "Long-term — Body", type: "textarea" },
    { key: "long_point_1", label: "Long-term — Point 1", type: "text" },
    { key: "long_point_2", label: "Long-term — Point 2", type: "text" },
    { key: "long_point_3", label: "Long-term — Point 3", type: "text" },
  ],
  "dev-manage": [
    { key: "hero_title", label: "Hero Title", type: "text" },
    { key: "hero_subtitle", label: "Hero Subtitle", type: "textarea" },
    { key: "benefits_heading", label: "Benefits Heading", type: "text" },
    { key: "benefit_1_title", label: "Benefit 1 — Title", type: "text" },
    { key: "benefit_1_body", label: "Benefit 1 — Body", type: "textarea" },
    { key: "benefit_2_title", label: "Benefit 2 — Title", type: "text" },
    { key: "benefit_2_body", label: "Benefit 2 — Body", type: "textarea" },
    { key: "benefit_3_title", label: "Benefit 3 — Title", type: "text" },
    { key: "benefit_3_body", label: "Benefit 3 — Body", type: "textarea" },
    // Why Metheim (3 reasons)
    { key: "why_eyebrow", label: "Why — Eyebrow", type: "text" },
    { key: "why_heading", label: "Why — Heading", type: "text" },
    { key: "why_subtitle", label: "Why — Subtitle", type: "textarea" },
    { key: "why_1_title", label: "Why 1 — Title", type: "text" },
    { key: "why_1_body", label: "Why 1 — Body", type: "textarea" },
    { key: "why_2_title", label: "Why 2 — Title", type: "text" },
    { key: "why_2_body", label: "Why 2 — Body", type: "textarea" },
    { key: "why_3_title", label: "Why 3 — Title", type: "text" },
    { key: "why_3_body", label: "Why 3 — Body", type: "textarea" },
    // Process (4 steps)
    { key: "process_eyebrow", label: "Process — Eyebrow", type: "text" },
    { key: "process_heading", label: "Process — Heading", type: "text" },
    { key: "process_subtitle", label: "Process — Subtitle", type: "textarea" },
    { key: "step_1_title", label: "Step 1 — Title", type: "text" },
    { key: "step_1_body", label: "Step 1 — Body", type: "textarea" },
    { key: "step_2_title", label: "Step 2 — Title", type: "text" },
    { key: "step_2_body", label: "Step 2 — Body", type: "textarea" },
    { key: "step_3_title", label: "Step 3 — Title", type: "text" },
    { key: "step_3_body", label: "Step 3 — Body", type: "textarea" },
    { key: "step_4_title", label: "Step 4 — Title", type: "text" },
    { key: "step_4_body", label: "Step 4 — Body", type: "textarea" },
    { key: "sim_title", label: "Yield Simulator — Title", type: "text" },
    { key: "sim_subtitle", label: "Yield Simulator — Subtitle", type: "textarea" },
    { key: "apply_title", label: "Application — Title", type: "text" },
    { key: "apply_subtitle", label: "Application — Subtitle", type: "textarea" },
  ],
  "dev-directions": [
    { key: "eyebrow", label: "Hero Eyebrow", type: "text" },
    { key: "hero_title", label: "Hero Title", type: "text" },
    { key: "hero_subtitle", label: "Hero Subtitle", type: "textarea" },
    { key: "address_label", label: "Address Label", type: "text" },
    { key: "address", label: "Address", type: "textarea" },
    { key: "map_embed_url", label: "Map Embed URL (optional — auto-built from address if empty)", type: "text" },
    { key: "phone_label", label: "Phone Label", type: "text" },
    { key: "phone", label: "Phone", type: "text" },
    { key: "email_label", label: "Email Label", type: "text" },
    { key: "email", label: "Email", type: "text" },
    { key: "hours_label", label: "Hours Label", type: "text" },
    { key: "hours", label: "Business Hours", type: "textarea" },
    { key: "transit_title", label: "Transit — Title", type: "text" },
    { key: "transit_body", label: "Transit — Body", type: "textarea" },
    { key: "parking_title", label: "Parking — Title", type: "text" },
    { key: "parking_body", label: "Parking — Body", type: "textarea" },
  ],
  // Per-audience landing pages — 세입자 / 세대주 / 에이전트·파트너.
  "dev-resident": [
    { key: "hero_title", label: "Hero Title", type: "text" },
    { key: "hero_subtitle", label: "Hero Subtitle", type: "textarea" },
    { key: "why_title", label: `"Why live here" Section Title`, type: "text" },
    { key: "steps_title", label: "Move-in Steps — Section Title", type: "text" },
    { key: "inquiry_title", label: "Inquiry — Title", type: "text" },
    { key: "inquiry_subtitle", label: "Inquiry — Subtitle", type: "textarea" },
  ],
  "dev-owner": [
    { key: "hero_title", label: "Hero Title", type: "text" },
    { key: "hero_subtitle", label: "Hero Subtitle", type: "textarea" },
    { key: "benefits_title", label: "Benefits — Section Title", type: "text" },
    { key: "benefits_body", label: "Benefits — Body", type: "richtext" },
    { key: "how_title", label: "How It Works — Section Title", type: "text" },
    { key: "inquiry_title", label: "Inquiry — Title", type: "text" },
    { key: "inquiry_subtitle", label: "Inquiry — Subtitle", type: "textarea" },
  ],
  "dev-partner": [
    { key: "hero_title", label: "Hero Title", type: "text" },
    { key: "hero_subtitle", label: "Hero Subtitle", type: "textarea" },
    { key: "why_title", label: "Why Partner — Section Title", type: "text" },
    { key: "inquiry_title", label: "Inquiry — Title", type: "text" },
    { key: "inquiry_subtitle", label: "Inquiry — Subtitle", type: "textarea" },
  ],
  // Footer / operator info (Metheim Korea) — also shown on the legal pages.
  "dev-footer": [
    { key: "company_name", label: "Company Name (상호)", type: "text" },
    { key: "ceo", label: "CEO (대표)", type: "text" },
    { key: "biz_no", label: "Business Reg. No. (사업자등록번호)", type: "text" },
    { key: "address", label: "Address (주소)", type: "text" },
    { key: "phone", label: "Phone (대표전화)", type: "text" },
    { key: "email", label: "Email (이메일)", type: "text" },
    { key: "privacy_officer", label: "Privacy Officer (개인정보 보호책임자)", type: "text" },
  ],
  // 개인정보처리방침 — up to 8 sections (blank a title to hide a section).
  "dev-privacy": [
    { key: "title", label: "Page Title", type: "text" },
    { key: "updated", label: "Effective Date", type: "text" },
    { key: "intro", label: "Intro", type: "textarea" },
    { key: "s1_title", label: "Section 1 — Title", type: "text" },
    { key: "s1_body", label: "Section 1 — Body", type: "textarea" },
    { key: "s2_title", label: "Section 2 — Title", type: "text" },
    { key: "s2_body", label: "Section 2 — Body", type: "textarea" },
    { key: "s3_title", label: "Section 3 — Title", type: "text" },
    { key: "s3_body", label: "Section 3 — Body", type: "textarea" },
    { key: "s4_title", label: "Section 4 — Title", type: "text" },
    { key: "s4_body", label: "Section 4 — Body", type: "textarea" },
    { key: "s5_title", label: "Section 5 — Title", type: "text" },
    { key: "s5_body", label: "Section 5 — Body", type: "textarea" },
    { key: "s6_title", label: "Section 6 — Title", type: "text" },
    { key: "s6_body", label: "Section 6 — Body", type: "textarea" },
    { key: "s7_title", label: "Section 7 — Title", type: "text" },
    { key: "s7_body", label: "Section 7 — Body", type: "textarea" },
    { key: "s8_title", label: "Section 8 — Title", type: "text" },
    { key: "s8_body", label: "Section 8 — Body", type: "textarea" },
  ],
  // 이용약관 — up to 8 sections (blank a title to hide a section).
  "dev-terms": [
    { key: "title", label: "Page Title", type: "text" },
    { key: "updated", label: "Effective Date", type: "text" },
    { key: "intro", label: "Intro", type: "textarea" },
    { key: "s1_title", label: "Article 1 — Title", type: "text" },
    { key: "s1_body", label: "Article 1 — Body", type: "textarea" },
    { key: "s2_title", label: "Article 2 — Title", type: "text" },
    { key: "s2_body", label: "Article 2 — Body", type: "textarea" },
    { key: "s3_title", label: "Article 3 — Title", type: "text" },
    { key: "s3_body", label: "Article 3 — Body", type: "textarea" },
    { key: "s4_title", label: "Article 4 — Title", type: "text" },
    { key: "s4_body", label: "Article 4 — Body", type: "textarea" },
    { key: "s5_title", label: "Article 5 — Title", type: "text" },
    { key: "s5_body", label: "Article 5 — Body", type: "textarea" },
    { key: "s6_title", label: "Article 6 — Title", type: "text" },
    { key: "s6_body", label: "Article 6 — Body", type: "textarea" },
    { key: "s7_title", label: "Article 7 — Title", type: "text" },
    { key: "s7_body", label: "Article 7 — Body", type: "textarea" },
    { key: "s8_title", label: "Article 8 — Title", type: "text" },
    { key: "s8_body", label: "Article 8 — Body", type: "textarea" },
  ],
};

// ─── Rich Text Editor ────────────────────────────────────────────────────────

function RichTextEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = useTranslation();
  const editorRef = useRef<HTMLDivElement>(null);
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || "";
    }
  }, []);

  const exec = (command: string, arg?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, arg);
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  };

  const insertLink = () => {
    const url = window.prompt(t("website_content.enter_url"));
    if (url) exec("createLink", url);
  };

  const insertImg = () => {
    const url = window.prompt(t("website_content.enter_image_url"));
    if (url) exec("insertImage", url);
  };

  return (
    <div className="border rounded-lg overflow-hidden bg-white">
      <div className="flex flex-wrap items-center gap-0.5 p-2 border-b bg-muted/30">
        <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => exec("bold")} title={t("website_content.tool_bold")}><Bold className="h-3.5 w-3.5" /></Button>
        <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => exec("italic")} title={t("website_content.tool_italic")}><Italic className="h-3.5 w-3.5" /></Button>
        <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => exec("underline")} title={t("website_content.tool_underline")}><Underline className="h-3.5 w-3.5" /></Button>
        <Separator orientation="vertical" className="h-5 mx-1" />
        <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => exec("formatBlock", "h2")} title={t("website_content.tool_h2")}><Heading2 className="h-3.5 w-3.5" /></Button>
        <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => exec("formatBlock", "h3")} title={t("website_content.tool_h3")}><Heading3 className="h-3.5 w-3.5" /></Button>
        <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => exec("formatBlock", "p")} title={t("website_content.tool_paragraph")}><AlignLeft className="h-3.5 w-3.5" /></Button>
        <Separator orientation="vertical" className="h-5 mx-1" />
        <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => exec("justifyLeft")} title={t("website_content.tool_align_left")}><AlignLeft className="h-3.5 w-3.5" /></Button>
        <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => exec("justifyCenter")} title={t("website_content.tool_align_center")}><AlignCenter className="h-3.5 w-3.5" /></Button>
        <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => exec("justifyRight")} title={t("website_content.tool_align_right")}><AlignRight className="h-3.5 w-3.5" /></Button>
        <Separator orientation="vertical" className="h-5 mx-1" />
        <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => exec("insertUnorderedList")} title={t("website_content.tool_bullet_list")}><List className="h-3.5 w-3.5" /></Button>
        <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => exec("insertOrderedList")} title={t("website_content.tool_numbered_list")}><ListOrdered className="h-3.5 w-3.5" /></Button>
        <Separator orientation="vertical" className="h-5 mx-1" />
        <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={insertLink} title={t("website_content.tool_link")}><LinkIcon className="h-3.5 w-3.5" /></Button>
        <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={insertImg} title={t("website_content.tool_image")}><Image className="h-3.5 w-3.5" /></Button>
        <Separator orientation="vertical" className="h-5 mx-1" />
        <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => exec("undo")} title={t("website_content.tool_undo")}><Undo className="h-3.5 w-3.5" /></Button>
        <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => exec("redo")} title={t("website_content.tool_redo")}><Redo className="h-3.5 w-3.5" /></Button>
        <div className="ml-auto">
          <Button type="button" size="sm" variant="ghost" className="h-7 gap-1.5 text-xs" onClick={() => setPreview(!preview)}>
            {preview ? <><EyeOff className="h-3.5 w-3.5" />{t("common.edit")}</> : <><Eye className="h-3.5 w-3.5" />{t("website_content.preview")}</>}
          </Button>
        </div>
      </div>
      {preview ? (
        <div className="min-h-[200px] p-4 prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: value || `<p class='text-muted-foreground italic'>${t("website_content.no_content_yet")}</p>` }} />
      ) : (
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          className="min-h-[200px] p-4 text-sm focus:outline-none [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mb-2 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mb-2 [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-primary [&_a]:underline [&_img]:max-w-full [&_img]:rounded"
          onInput={() => { if (editorRef.current) onChange(editorRef.current.innerHTML); }}
        />
      )}
    </div>
  );
}

// ─── SEO Preview ─────────────────────────────────────────────────────────────

function SeoPreview({ title, description, url }: { title: string; description: string; url: string }) {
  const { t } = useTranslation();
  return (
    <div className="border rounded-lg p-4 bg-white">
      <p className="text-xs text-muted-foreground mb-2">{t("website_content.search_engine_preview")}</p>
      <div className="text-green-700 text-xs mb-0.5">{url}</div>
      <div className="text-[#1a0dab] text-base hover:underline cursor-pointer line-clamp-1">{title || t("website_content.page_title_placeholder")}</div>
      <div className="text-sm text-muted-foreground line-clamp-2">{description || t("website_content.page_description_placeholder")}</div>
    </div>
  );
}

// ─── Language Content Tab ─────────────────────────────────────────────────────

interface LangContent {
  content: Record<string, string>;
  seo_title: string;
  seo_description: string;
  seo_keywords: string;
}

const EMPTY_LANG: LangContent = { content: {}, seo_title: "", seo_description: "", seo_keywords: "" };

function LanguageTab({
  pageKey,
  lang,
  fields,
  initial,
  onSave,
  isSaving,
  pagePublicPath,
  previewHost,
}: {
  pageKey: string;
  lang: { code: string; label: string; flag: string };
  fields: SectionField[];
  initial: LangContent;
  onSave: (lang: string, data: LangContent) => void;
  isSaving: boolean;
  pagePublicPath: string;
  previewHost: string;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [form, setForm] = useState<LangContent>(initial);
  const [activeTab, setActiveTab] = useState<"content" | "seo">("content");
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [pickerKey, setPickerKey] = useState<string | null>(null);
  const fieldKeyPrefix = pageKey.replace(/-/g, "_");

  useEffect(() => {
    setForm(initial);
  }, [initial]);

  const setField = (key: string, val: string) => {
    setForm((f) => ({ ...f, content: { ...f.content, [key]: val } }));
  };

  // Upload an image file for an image-type field; stores the returned URL in the
  // field. apiFetch attaches auth and skips the JSON content-type for FormData.
  const handleImageUpload = async (key: string, file: File) => {
    setUploadingKey(key);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const res = await apiFetch("/api/v1/page-contents/upload-image", { method: "POST", body: fd });
      if (!res.ok) throw new Error("upload failed");
      const data = (await res.json()) as { url?: string };
      if (!data.url) throw new Error("no url returned");
      setField(key, data.url);
    } catch {
      toast({
        variant: "destructive",
        title: t("website_content.toast_upload_failed_title"),
        description: t("website_content.toast_upload_failed_desc"),
      });
    } finally {
      setUploadingKey(null);
    }
  };

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList>
          <TabsTrigger value="content" className="gap-1.5">
            <Globe className="h-3.5 w-3.5" />
            {t("website_content.tab_content")}
          </TabsTrigger>
          <TabsTrigger value="seo" className="gap-1.5">
            <Search className="h-3.5 w-3.5" />
            {t("website_content.tab_seo")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="content" className="space-y-5 mt-4">
          {fields.map((field) => {
            const fieldLabel = t(`website_content.field_${fieldKeyPrefix}_${field.key}`, { defaultValue: field.label });
            return (
            <div key={field.key} className="space-y-1.5">
              <Label className="text-sm font-medium">{fieldLabel}</Label>
              {field.hint && <p className="text-xs text-muted-foreground">{t(`website_content.hint_${fieldKeyPrefix}_${field.key}`, { defaultValue: field.hint })}</p>}
              {field.type === "text" ? (
                <Input
                  value={form.content[field.key] ?? ""}
                  onChange={(e) => setField(field.key, e.target.value)}
                  placeholder={field.placeholder ? t(`website_content.ph_${fieldKeyPrefix}_${field.key}`, { defaultValue: field.placeholder }) : undefined}
                />
              ) : field.type === "textarea" ? (
                <Textarea
                  value={form.content[field.key] ?? ""}
                  onChange={(e) => setField(field.key, e.target.value)}
                  placeholder={field.placeholder ? t(`website_content.ph_${fieldKeyPrefix}_${field.key}`, { defaultValue: field.placeholder }) : undefined}
                  rows={3}
                />
              ) : field.type === "image" ? (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      value={form.content[field.key] ?? ""}
                      onChange={(e) => setField(field.key, e.target.value)}
                      placeholder={t("website_content.url_placeholder")}
                    />
                    <label
                      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border px-3 text-sm font-medium ${
                        uploadingKey === field.key
                          ? "pointer-events-none opacity-60"
                          : "cursor-pointer hover:bg-accent"
                      }`}
                    >
                      {uploadingKey === field.key ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Image className="h-4 w-4" />
                      )}
                      {t("website_content.upload_button")}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={uploadingKey === field.key}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          e.target.value = "";
                          if (f) handleImageUpload(field.key, f);
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => setPickerKey(field.key)}
                      className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border px-3 text-sm font-medium cursor-pointer hover:bg-accent"
                    >
                      <Images className="h-4 w-4" />
                      {t("media.select_from_library")}
                    </button>
                  </div>
                  {form.content[field.key] && (
                    <img
                      src={form.content[field.key]}
                      alt={fieldLabel}
                      className="h-32 w-full object-cover rounded-lg border"
                    />
                  )}
                </div>
              ) : (
                <RichTextEditor
                  key={`rte-${lang.code}-${field.key}`}
                  value={form.content[field.key] ?? ""}
                  onChange={(v) => setField(field.key, v)}
                />
              )}
            </div>
            );
          })}
          {pickerKey && (
            <MediaPickerDialog
              open
              onOpenChange={(o) => { if (!o) setPickerKey(null); }}
              onPick={(url) => { setField(pickerKey, url); setPickerKey(null); }}
            />
          )}
        </TabsContent>

        <TabsContent value="seo" className="space-y-5 mt-4">
          <div className="space-y-1.5">
            <Label>{t("website_content.seo_title")}</Label>
            <Input
              value={form.seo_title}
              onChange={(e) => setForm((f) => ({ ...f, seo_title: e.target.value }))}
              placeholder={t("website_content.seo_title_placeholder")}
              maxLength={120}
            />
            <p className="text-xs text-muted-foreground">{t("website_content.char_count_60", { count: form.seo_title.length })}</p>
          </div>
          <div className="space-y-1.5">
            <Label>{t("website_content.seo_description")}</Label>
            <Textarea
              value={form.seo_description}
              onChange={(e) => setForm((f) => ({ ...f, seo_description: e.target.value }))}
              placeholder={t("website_content.seo_description_placeholder")}
              rows={3}
              maxLength={320}
            />
            <p className="text-xs text-muted-foreground">{t("website_content.char_count_160", { count: form.seo_description.length })}</p>
          </div>
          <div className="space-y-1.5">
            <Label>{t("website_content.seo_keywords")}</Label>
            <Input
              value={form.seo_keywords}
              onChange={(e) => setForm((f) => ({ ...f, seo_keywords: e.target.value }))}
              placeholder={t("website_content.seo_keywords_placeholder")}
            />
          </div>
          <SeoPreview
            title={form.seo_title}
            description={form.seo_description}
            url={`${previewHost}${pagePublicPath}`}
          />
        </TabsContent>
      </Tabs>

      <div className="flex justify-end pt-2">
        <Button
          onClick={() => onSave(lang.code, form)}
          disabled={isSaving}
          className="bg-primary hover:bg-primary/90 text-white gap-2"
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {t("website_content.save_language", { language: t(`website_content.lang_${lang.code}`, { defaultValue: lang.label }) })}
        </Button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function WebsiteContentDetail() {
  const { t } = useTranslation();
  const params = useParams<{ pageKey: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [savingLang, setSavingLang] = useState<string | null>(null);

  const pageKey = params.pageKey ?? "";
  const pageDef = WEBSITE_PAGES.find((p) => p.key === pageKey);
  const site = getSiteForPage(pageKey);
  const languages = site?.languages ?? SITES[0].languages;
  const previewBase = pageDef?.previewBase ?? "https://millionstay.com.au";
  const previewHost = previewBase.replace(/^https?:\/\//, "");
  const fields = PAGE_FIELDS[pageKey] ?? [];
  const pageLabel = pageDef ? t(`website_content.page_label_${pageDef.key.replace(/-/g, "_")}`, { defaultValue: pageDef.label }) : pageKey;

  const { data: allRows = [], isLoading } = useQuery<any[]>({
    queryKey: ["page-contents", pageKey],
    queryFn: async () => {
      const res = await apiFetch(`/api/v1/page-contents/${pageKey}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!pageKey,
  });

  const getLangData = useCallback(
    (code: string): LangContent => {
      const row = allRows.find((r: any) => r.language === code);
      if (!row) return EMPTY_LANG;
      return {
        content: (row.content as Record<string, string>) ?? {},
        seo_title: row.seo_title ?? "",
        seo_description: row.seo_description ?? "",
        seo_keywords: row.seo_keywords ?? "",
      };
    },
    [allRows],
  );

  const handleSave = async (langCode: string, data: LangContent) => {
    setSavingLang(langCode);
    try {
      const res = await apiFetch(`/api/v1/page-contents/${pageKey}/${langCode}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Save failed");
      await qc.invalidateQueries({ queryKey: ["page-contents", pageKey] });
      toast({
        title: t("website_content.toast_saved_title"),
        description: t("website_content.toast_saved_description", { page: pageLabel, language: langCode.toUpperCase() }),
      });
    } catch {
      toast({
        title: t("website_content.toast_error_title"),
        description: t("website_content.toast_save_failed_description"),
        variant: "destructive",
      });
    } finally {
      setSavingLang(null);
    }
  };

  if (!pageDef) {
    return (
      <Layout>
        <div className="p-6">
          <p className="text-muted-foreground">{t("website_content.page_not_found")}: <code>{pageKey}</code></p>
          <Button variant="link" onClick={() => navigate("/content/pages")}>{t("website_content.back_to_pages")}</Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <PageHeader
        title={pageLabel}
        subtitle={t(`website_content.page_desc_${pageDef.key.replace(/-/g, "_")}`, { defaultValue: pageDef.description })}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">{site?.host ?? pageDef.path}</Badge>
            <Badge variant="outline" className="text-xs">{pageDef.path}</Badge>
            <Button variant="outline" size="sm" asChild>
              <a href={`${previewBase}${pageDef.path}`} target="_blank" rel="noopener noreferrer" className="gap-1.5">
                <Eye className="h-3.5 w-3.5" />
                {t("website_content.preview")}
              </a>
            </Button>
          </div>
        }
      />

      <div className="p-6">
        <Button
          variant="ghost"
          size="sm"
          className="mb-4 gap-1.5 text-muted-foreground hover:text-foreground"
          onClick={() => navigate("/content/pages")}
        >
          <ArrowLeft className="h-4 w-4" />
          {t("website_content.back_to_pages")}
        </Button>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs defaultValue="en">
            <div className="mb-4">
              <p className="text-sm text-muted-foreground mb-2">{t("website_content.select_language")}</p>
              <TabsList className="flex flex-wrap gap-1 h-auto">
                {languages.map((lang) => {
                  const hasContent = allRows.some((r: any) => r.language === lang.code);
                  return (
                    <TabsTrigger key={lang.code} value={lang.code} className="gap-1.5 relative">
                      <span>{lang.flag}</span>
                      <span>{t(`website_content.lang_${lang.code}`, { defaultValue: lang.label })}</span>
                      {hasContent && (
                        <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-green-500" title={t("website_content.has_content")} />
                      )}
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </div>

            {languages.map((lang) => (
              <TabsContent key={lang.code} value={lang.code}>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <span className="text-xl">{lang.flag}</span>
                      {t("website_content.language_content", { language: t(`website_content.lang_${lang.code}`, { defaultValue: lang.label }) })}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <LanguageTab
                      pageKey={pageKey}
                      lang={lang}
                      fields={fields}
                      initial={getLangData(lang.code)}
                      onSave={handleSave}
                      isSaving={savingLang === lang.code}
                      pagePublicPath={pageDef.path}
                      previewHost={previewHost}
                    />
                  </CardContent>
                </Card>
              </TabsContent>
            ))}
          </Tabs>
        )}
      </div>
    </Layout>
  );
}
