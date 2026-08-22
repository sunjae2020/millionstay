import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import multer from "multer";
import { db, usersTable, systemLogsTable } from "@workspace/db";
import { eq, or, desc, isNull, inArray } from "drizzle-orm";
import {
  isCloudinaryConfigured,
  uploadToCloudinary,
  uploadPrivateToCloudinary,
  generateSignedUrl,
  cldFolder,
} from "../utils/cloudinary";
import { requireAuth, invalidateUserCache } from "../middlewares/requireAuth";
import { validatePassword } from "../utils/passwordPolicy";
import { logAction } from "../utils/auditLog";
import { revokeAllForUser } from "../lib/refreshTokens";
import { deletedFilter } from "../lib/softDelete";
import { knownRoleNames } from "../lib/rbac";

const router: IRouter = Router();

router.use(requireAuth);

const SUPER_ADMIN = "SuperAdmin";
const WRITE_ROLES = [SUPER_ADMIN, "Admin"];

/* A role string that is not exactly one of the canonical names fails every gate
   below while still looking like a normal role in the UI (a hand-seeded
   "Super Admin" with a space did exactly that on one tenant). Name the role in
   the 403 so the cause is visible from the toast instead of guessed. */
function denied(currentUser: { role?: string } | undefined, action: string): string {
  const role = currentUser?.role;
  return role
    ? `You do not have permission to ${action} (role: "${role}")`
    : `You do not have permission to ${action}`;
}

/* Optional profile / HR / emergency-contact fields. They are ordinary personal
   data (not privilege), so any write-capable admin may set them — role, email,
   activation, status and password stay SuperAdmin-only further down. */
const PROFILE_FIELDS = [
  "phone",
  "date_of_birth",
  "postcode",
  "address_line1",
  "address_detail",
  "profile_photo_url",
  "business_card_front_id",
  "business_card_back_id",
  "notes",
  "department",
  "job_title",
  "employee_no",
  "joined_on",
  "emergency_contact_name",
  "emergency_contact_relation",
  "emergency_contact_phone",
  "locale",
] as const;

const LOCALES = ["en", "ko", "ja", "zh", "th", "vi"];

/** Trim + strip control chars; "" becomes null so clearing a field works. */
function cleanText(value: unknown, max = 255): string | null {
  if (value === null || value === undefined) return null;
  const out = String(value).replace(/[\x00-\x1f\x7f]/g, "").trim().slice(0, max);
  return out === "" ? null : out;
}

/** Pick the profile fields present in a request body, normalized. */
function profileUpdates(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of PROFILE_FIELDS) {
    if (!(field in body)) continue;
    const max = field === "notes" ? 4000 : field === "profile_photo_url" ? 1000 : 255;
    let value = cleanText(body[field], max);
    if (field === "locale" && value && !LOCALES.includes(value)) value = null;
    out[field] = value;
  }
  return out;
}

/** Columns returned by the detail endpoint (everything except the password). */
const userColumns = {
  id: usersTable.id,
  email: usersTable.email,
  first_name: usersTable.first_name,
  last_name: usersTable.last_name,
  role: usersTable.role,
  is_active: usersTable.is_active,
  status: usersTable.status,
  deleted_at: usersTable.deleted_at,
  last_login_at: usersTable.last_login_at,
  created_at: usersTable.created_at,
  updated_at: usersTable.updated_at,
  phone: usersTable.phone,
  date_of_birth: usersTable.date_of_birth,
  postcode: usersTable.postcode,
  address_line1: usersTable.address_line1,
  address_detail: usersTable.address_detail,
  profile_photo_url: usersTable.profile_photo_url,
  business_card_front_id: usersTable.business_card_front_id,
  business_card_back_id: usersTable.business_card_back_id,
  notes: usersTable.notes,
  department: usersTable.department,
  job_title: usersTable.job_title,
  employee_no: usersTable.employee_no,
  joined_on: usersTable.joined_on,
  emergency_contact_name: usersTable.emergency_contact_name,
  emergency_contact_relation: usersTable.emergency_contact_relation,
  emergency_contact_phone: usersTable.emergency_contact_phone,
  locale: usersTable.locale,
};

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
interface UploadedFile { buffer: Buffer; originalname: string; size: number; mimetype: string }

/* ─── List all admin users ─────────────────────────────── */
router.get("/v1/admin/users", async (req, res): Promise<void> => {
  try {
    const users = await db
      .select({
        id: usersTable.id,
        email: usersTable.email,
        first_name: usersTable.first_name,
        last_name: usersTable.last_name,
        role: usersTable.role,
        is_active: usersTable.is_active,
        status: usersTable.status,
        deleted_at: usersTable.deleted_at,
        last_login_at: usersTable.last_login_at,
        created_at: usersTable.created_at,
        profile_photo_url: usersTable.profile_photo_url,
        phone: usersTable.phone,
        department: usersTable.department,
        job_title: usersTable.job_title,
      })
      .from(usersTable)
      .where(deletedFilter(usersTable.deleted_at, req))
      .orderBy(usersTable.created_at);

    res.json({ success: true, users });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to load users" });
  }
});

/* ─── Create a new admin user (SuperAdmin only) ────────────
   Admin-initiated creation: the account is created active (no
   self-registration / approval step). The recipient is forced to
   change the temporary password on first login.
─────────────────────────────────────────────────────────────── */
router.post("/v1/admin/users", async (req, res): Promise<void> => {
  try {
    const currentUser = (req as any).user;
    // Admins may create Admin/Viewer accounts; only a SuperAdmin can mint
    // another SuperAdmin (no self-promotion path through this endpoint).
    if (!WRITE_ROLES.includes(currentUser?.role)) {
      res.status(403).json({ success: false, error: denied(currentUser, "create users") });
      return;
    }

    const { email, password, first_name, last_name, role } = req.body as {
      email?: string; password?: string; first_name?: string; last_name?: string; role?: string;
    };

    if (!email || !password || !first_name || !last_name) {
      res.status(400).json({ success: false, error: "Email, password, first name and last name are required." });
      return;
    }

    const cleanEmail = String(email).toLowerCase().trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      res.status(400).json({ success: false, error: "Invalid email address." });
      return;
    }

    // Strip control characters and cap length on user-supplied names.
    const cleanFirst = String(first_name).replace(/[\x00-\x1f\x7f]/g, "").trim().slice(0, 80);
    const cleanLast = String(last_name).replace(/[\x00-\x1f\x7f]/g, "").trim().slice(0, 80);
    if (!cleanFirst || !cleanLast) {
      res.status(400).json({ success: false, error: "Invalid name." });
      return;
    }

    const newRole = role ?? "Admin";
    if (!(await knownRoleNames()).includes(newRole)) {
      res.status(400).json({ success: false, error: "Invalid role." });
      return;
    }
    if (newRole === SUPER_ADMIN && currentUser?.role !== SUPER_ADMIN) {
      res.status(403).json({ success: false, error: "Only SuperAdmin can grant the SuperAdmin role" });
      return;
    }

    const policy = validatePassword(password);
    if (!policy.ok) {
      res.status(400).json({ success: false, error: policy.error });
      return;
    }

    const existing = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, cleanEmail))
      .limit(1);
    if (existing.length > 0) {
      res.status(409).json({ success: false, error: "A user with this email already exists." });
      return;
    }

    const password_hash = await bcrypt.hash(password, 12);

    const [created] = await db.insert(usersTable).values({
      email: cleanEmail,
      password_hash,
      first_name: cleanFirst,
      last_name: cleanLast,
      role: newRole,
      status: "active",
      is_active: true,
      force_password_change: true,
      ...profileUpdates(req.body as Record<string, unknown>),
    }).returning({
      id: usersTable.id,
      email: usersTable.email,
      first_name: usersTable.first_name,
      last_name: usersTable.last_name,
      role: usersTable.role,
      is_active: usersTable.is_active,
      status: usersTable.status,
      created_at: usersTable.created_at,
    });

    try {
      await logAction({
        entityType: "admin_user",
        entityId: created.id,
        action: "CREATE",
        actorId: currentUser?.id ?? null,
        actorEmail: currentUser?.email ?? null,
        newValue: { email: cleanEmail, role: newRole },
      });
    } catch {}

    res.status(201).json({ success: true, user: created });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to create user" });
  }
});

/* ─── Profile photo upload (public CDN URL) ────────────────
   Not tied to a user id so the "add user" form can upload before the row
   exists; the returned URL is persisted by the normal create/update. Mirrors
   POST /v1/contacts/photo. */
router.post("/v1/admin/users/photo", upload.single("image"), async (req, res): Promise<void> => {
  const currentUser = (req as any).user;
  if (!WRITE_ROLES.includes(currentUser?.role)) {
    res.status(403).json({ success: false, error: denied(currentUser, "upload") }); return;
  }
  const file = (req as unknown as { file?: UploadedFile }).file;
  if (!file) { res.status(400).json({ success: false, error: "No file provided" }); return; }
  if (!file.mimetype.startsWith("image/")) {
    res.status(400).json({ success: false, error: "Only image files are accepted" }); return;
  }
  if (!isCloudinaryConfigured()) {
    res.status(503).json({ success: false, error: "Image storage is not configured" }); return;
  }
  try {
    const result = await uploadToCloudinary(file.buffer, {
      folder: cldFolder("avatars"),
      transformation: [
        { quality: "auto:good", fetch_format: "auto" },
        { width: 800, height: 800, crop: "limit" },
      ],
    });
    res.json({ success: true, url: result.secure_url, public_id: result.public_id });
  } catch (err) {
    console.error("[admin-users] profile photo upload failed:", err instanceof Error ? err.message : err);
    res.status(500).json({ success: false, error: "Image upload failed" });
  }
});

/* ─── Business card upload (PRIVATE) ───────────────────────
   Cards carry personal contact data, so they go to Cloudinary "authenticated"
   storage exactly like contact cards: the bytes never get a public URL and the
   row keeps only the public_id. Reads hand out a 15-minute signed URL. */
router.post("/v1/admin/users/business-card", upload.single("image"), async (req, res): Promise<void> => {
  const currentUser = (req as any).user;
  if (!WRITE_ROLES.includes(currentUser?.role)) {
    res.status(403).json({ success: false, error: denied(currentUser, "upload") }); return;
  }
  const file = (req as unknown as { file?: UploadedFile }).file;
  if (!file) { res.status(400).json({ success: false, error: "No file provided" }); return; }
  if (!file.mimetype.startsWith("image/")) {
    res.status(400).json({ success: false, error: "Only image files are accepted" }); return;
  }
  if (!isCloudinaryConfigured()) {
    res.status(503).json({ success: false, error: "Image storage is not configured" }); return;
  }
  try {
    const up = await uploadPrivateToCloudinary(file.buffer, { folder: cldFolder("private/admin-users") });
    res.json({ success: true, public_id: up.public_id, preview_url: generateSignedUrl(up.public_id, 900) });
  } catch (err) {
    console.error("[admin-users] business card upload failed:", err instanceof Error ? err.message : err);
    res.status(500).json({ success: false, error: "Card upload failed" });
  }
});

/* ─── One user (full profile + recent activity) ────────────
   The emergency-contact block and date of birth are the most sensitive fields
   on the row, so they are only returned to a SuperAdmin or to the user
   themselves; everyone else gets the record without them. */
router.get("/v1/admin/users/:id", async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ success: false, error: "Invalid user ID" }); return; }
    const currentUser = (req as any).user;

    const [user] = await db.select(userColumns).from(usersTable).where(eq(usersTable.id, id)).limit(1);
    if (!user) { res.status(404).json({ success: false, error: "User not found" }); return; }

    const activity = await db
      .select({
        id: systemLogsTable.id,
        action: systemLogsTable.action,
        entity_type: systemLogsTable.entity_type,
        actor_email: systemLogsTable.actor_email,
        new_value: systemLogsTable.new_value,
        ip_address: systemLogsTable.ip_address,
        created_at: systemLogsTable.created_at,
      })
      .from(systemLogsTable)
      .where(
        or(
          eq(systemLogsTable.actor_id, id),
          // changes made TO this account
          eq(systemLogsTable.entity_id, id),
        ),
      )
      .orderBy(desc(systemLogsTable.created_at))
      .limit(20);

    const maySeeSensitive = currentUser?.role === SUPER_ADMIN || currentUser?.id === id;
    const payload: Record<string, unknown> = { ...user };
    if (!maySeeSensitive) {
      payload["date_of_birth"] = null;
      payload["emergency_contact_name"] = null;
      payload["emergency_contact_relation"] = null;
      payload["emergency_contact_phone"] = null;
    }
    // Private card images: signed, short-lived, never a public URL.
    payload["business_card_front_url"] = user.business_card_front_id
      ? generateSignedUrl(user.business_card_front_id, 900) : null;
    payload["business_card_back_url"] = user.business_card_back_id
      ? generateSignedUrl(user.business_card_back_id, 900) : null;

    res.json({
      success: true,
      user: payload,
      activity: activity.filter((row) => row.entity_type === "admin_user" || row.action === "LOGIN"),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to load user" });
  }
});

/* ─── Update user (status, role, is_active, password) ───────
   SECURITY: Privileged fields (role, is_active, status, password) are
   gated to SuperAdmin only. Regular Admins cannot self-promote, cannot
   reactivate other accounts, and cannot reset another user's password.
─────────────────────────────────────────────────────────────── */
router.patch("/v1/admin/users/:id", async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    const currentUser = (req as any).user;

    if (isNaN(id)) {
      res.status(400).json({ success: false, error: "Invalid user ID" });
      return;
    }

    const isSuperAdmin = currentUser?.role === SUPER_ADMIN;

    const { status, role, is_active, password, first_name, last_name, email } = req.body as {
      status?: string;
      role?: string;
      is_active?: boolean;
      password?: string;
      first_name?: string;
      last_name?: string;
      email?: string;
    };

    // Determine which fields require SuperAdmin. Names are ordinary profile
    // data (any write-capable admin may fix a typo); email is a login identity,
    // so it stays SuperAdmin-only alongside role/status/activation/password.
    const wantsPrivileged =
      role !== undefined ||
      is_active !== undefined ||
      status !== undefined ||
      password !== undefined ||
      email !== undefined;

    if (wantsPrivileged && !isSuperAdmin) {
      res.status(403).json({
        success: false,
        error: `Only SuperAdmin can change role, status, activation, or password (role: "${currentUser?.role ?? "unknown"}")`,
      });
      return;
    }

    // SuperAdmin-only: prevent demoting the last active SuperAdmin / self-lockout
    if (isSuperAdmin && id === currentUser.id) {
      if (role !== undefined && role !== SUPER_ADMIN) {
        res.status(400).json({ success: false, error: "Cannot demote yourself" });
        return;
      }
      if (is_active === false || status === "rejected") {
        res.status(400).json({ success: false, error: "Cannot deactivate yourself" });
        return;
      }
    }

    const updates: Record<string, unknown> = {};
    if (status !== undefined) {
      if (!["active", "pending", "rejected"].includes(status)) {
        res.status(400).json({ success: false, error: "Invalid status value" });
        return;
      }
      updates.status = status;
      if (status === "active") updates.is_active = true;
      if (status === "rejected") updates.is_active = false;
    }
    if (first_name !== undefined) updates.first_name = String(first_name).replace(/[\x00-\x1f\x7f]/g, "").trim().slice(0, 80);
    if (last_name !== undefined) updates.last_name = String(last_name).replace(/[\x00-\x1f\x7f]/g, "").trim().slice(0, 80);
    Object.assign(updates, profileUpdates(req.body as Record<string, unknown>));
    if (email !== undefined) {
      const normalized = String(email).trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalized)) {
        res.status(400).json({ success: false, error: "Invalid email address" });
        return;
      }
      const [clash] = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(eq(usersTable.email, normalized))
        .limit(1);
      if (clash && clash.id !== id) {
        res.status(409).json({ success: false, error: "That email is already in use" });
        return;
      }
      updates.email = normalized;
    }
    if (role !== undefined) {
      // Must be a real row in `roles` — an off-by-a-space name would strip the
      // target of every privilege gate without any visible error.
      if (!(await knownRoleNames()).includes(role)) {
        res.status(400).json({ success: false, error: "Invalid role." });
        return;
      }
      updates.role = role;
    }
    if (is_active !== undefined) updates.is_active = is_active;
    if (password) {
      const policy = validatePassword(password);
      if (!policy.ok) {
        res.status(400).json({ success: false, error: policy.error });
        return;
      }
      updates.password_hash = await bcrypt.hash(password, 12);
      updates.force_password_change = true; // force the recipient to change on next login
    }

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ success: false, error: "No valid fields to update" });
      return;
    }

    await db.update(usersTable).set(updates).where(eq(usersTable.id, id));

    // Audit + token revocation when sensitive fields change
    try {
      await logAction({
        entityType: "admin_user",
        entityId: id,
        action: "UPDATE",
        actorId: currentUser?.id ?? null,
        actorEmail: currentUser?.email ?? null,
        newValue: {
          fields: Object.keys(updates),
          role_changed: role !== undefined,
          email_changed: email !== undefined,
          password_reset: !!password,
          status_changed: status !== undefined || is_active !== undefined,
        },
      });
    } catch {}

    if (password || email !== undefined || is_active === false || status === "rejected") {
      try { await revokeAllForUser(id, "admin"); } catch {}
      invalidateUserCache(id);
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to update user" });
  }
});

/* ─── Bulk delete users (SuperAdmin only) ─────────────────── */
router.post("/v1/admin/users/bulk-delete", async (req, res): Promise<void> => {
  try {
    const currentUser = (req as any).user;
    if (currentUser?.role !== "SuperAdmin") {
      res.status(403).json({ success: false, error: "Only SuperAdmin can perform bulk delete" }); return;
    }
    const { ids, permanent } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ success: false, error: "ids must be a non-empty array" }); return;
    }
    const numIds = ids.map(Number).filter(id => !isNaN(id) && id !== currentUser.id);
    if (numIds.length === 0) {
      res.status(400).json({ success: false, error: "No valid IDs (cannot delete yourself)" }); return;
    }

    // Prevent mass deletion of other SuperAdmins via this endpoint
    const targets = await db
      .select({ id: usersTable.id, role: usersTable.role })
      .from(usersTable)
      .where(inArray(usersTable.id, numIds));
    const superTargets = targets.filter((u) => u.role === SUPER_ADMIN).map((u) => u.id);
    if (superTargets.length > 0) {
      res.status(403).json({
        success: false,
        error: `Cannot delete other SuperAdmin accounts via bulk endpoint (ids: ${superTargets.join(", ")})`,
      });
      return;
    }

    if (permanent) {
      await db.delete(usersTable).where(inArray(usersTable.id, numIds));
    } else {
      await db.update(usersTable).set({ deleted_at: new Date(), is_active: false, status: "archived" }).where(inArray(usersTable.id, numIds));
    }
    // Revoke any active refresh tokens for affected users
    for (const uid of numIds) {
      try { await revokeAllForUser(uid, "admin"); } catch {}
    }
    res.json({ success: true, affected: numIds.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to bulk delete users" });
  }
});

/* ─── Bulk restore users (SuperAdmin only) ────────────────── */
router.post("/v1/admin/users/bulk-restore", async (req, res): Promise<void> => {
  try {
    const currentUser = (req as any).user;
    if (currentUser?.role !== SUPER_ADMIN) {
      res.status(403).json({ success: false, error: "Only SuperAdmin can restore" }); return;
    }
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ success: false, error: "ids must be a non-empty array" }); return;
    }
    const numIds = ids.map(Number).filter((id: number) => !isNaN(id));
    if (numIds.length === 0) {
      res.status(400).json({ success: false, error: "No valid IDs" }); return;
    }
    await db.update(usersTable).set({ deleted_at: null, is_active: true, status: "active" }).where(inArray(usersTable.id, numIds));
    res.json({ success: true, affected: numIds.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to bulk restore users" });
  }
});

/* ─── Delete user ────────────────────────────────────────── */
router.delete("/v1/admin/users/:id", async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    const currentUser = (req as any).user;

    if (isNaN(id)) {
      res.status(400).json({ success: false, error: "Invalid user ID" });
      return;
    }
    if (id === currentUser.id) {
      res.status(400).json({ success: false, error: "You cannot delete your own account" });
      return;
    }

    // SuperAdmin required for any deletion (soft or hard)
    if (currentUser?.role !== SUPER_ADMIN) {
      res.status(403).json({ success: false, error: "Only SuperAdmin can delete users" });
      return;
    }

    // Prevent removal of another SuperAdmin via this endpoint
    const [target] = await db
      .select({ id: usersTable.id, role: usersTable.role })
      .from(usersTable)
      .where(eq(usersTable.id, id));
    if (target?.role === SUPER_ADMIN) {
      res.status(403).json({ success: false, error: "Cannot delete another SuperAdmin via this endpoint" });
      return;
    }

    const permanent = req.query.permanent === "true";

    if (permanent) {
      await db.delete(usersTable).where(eq(usersTable.id, id));
    } else {
      await db.update(usersTable)
        .set({ deleted_at: new Date(), is_active: false, status: "archived" })
        .where(eq(usersTable.id, id));
    }

    try { await revokeAllForUser(id, "admin"); } catch {}

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to delete user" });
  }
});

export default router;
