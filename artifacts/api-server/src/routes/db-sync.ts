import { Router, type Request, type Response, type NextFunction } from "express";
import { logger } from "../lib/logger";
import { exportSeed, getSeedInfo, importSeed, SeedImportFailure } from "../lib/seedSync";

/**
 * Confirmation phrase the client must echo via `x-confirm-import` (or
 * `confirm` body field) when calling POST /db-sync/import. This is a
 * defence-in-depth measure on top of the Super Admin role check, to make
 * accidental destructive calls (curl, replayed request, leaked token used
 * idly) much less likely to wipe the DB.
 */
const IMPORT_CONFIRM_PHRASE = "I-UNDERSTAND-DATA-WILL-BE-DELETED";

const router = Router();

const SUPER_ADMIN_ROLES = new Set(["Super Admin", "SuperAdmin", "superadmin", "super_admin"]);

function requireSuperAdmin(req: Request, res: Response, next: NextFunction): void {
  const user = (req as any).user as { role?: string } | undefined;
  if (!user || !user.role || !SUPER_ADMIN_ROLES.has(user.role)) {
    res.status(403).json({
      success: false,
      error: { code: "FORBIDDEN", message: "Super Admin role required" },
    });
    return;
  }
  next();
}

router.use(requireSuperAdmin);

router.get("/db-sync/info", (_req, res) => {
  try {
    res.json({ success: true, info: getSeedInfo() });
  } catch (err: any) {
    logger.error({ err }, "db-sync info failed");
    res.status(500).json({ success: false, error: { message: err?.message ?? "Failed" } });
  }
});

router.post("/db-sync/export", (_req, res) => {
  try {
    const info = exportSeed();
    logger.info({ size: info.sizeBytes, inserts: info.insertCount }, "db-sync export ok");
    res.json({ success: true, info });
  } catch (err: any) {
    logger.error({ err: err?.message }, "db-sync export failed");
    res.status(500).json({
      success: false,
      error: { message: err?.message ?? "Export failed" },
    });
  }
});

router.post("/db-sync/import", async (req, res) => {
  const headerConfirm = req.headers["x-confirm-import"];
  const bodyConfirm = (req.body as any)?.confirm;
  if (headerConfirm !== IMPORT_CONFIRM_PHRASE && bodyConfirm !== IMPORT_CONFIRM_PHRASE) {
    res.status(400).json({
      success: false,
      error: {
        code: "CONFIRMATION_REQUIRED",
        message: `Send 'x-confirm-import: ${IMPORT_CONFIRM_PHRASE}' header to confirm.`,
      },
    });
    return;
  }
  try {
    const result = await importSeed();
    const info = getSeedInfo();
    logger.info(result, "db-sync import ok");
    res.json({ success: true, result, info });
  } catch (err: any) {
    if (err instanceof SeedImportFailure) {
      logger.error(
        { executed: err.executed, errors: err.errors, total: err.total },
        "db-sync import rolled back",
      );
      res.status(500).json({
        success: false,
        error: {
          code: "IMPORT_ROLLED_BACK",
          message: err.message,
          executed: err.executed,
          errors: err.errors,
          total: err.total,
          errorSamples: err.errorSamples,
        },
      });
      return;
    }
    logger.error({ err: err?.message }, "db-sync import failed");
    res.status(500).json({
      success: false,
      error: { message: err?.message ?? "Import failed" },
    });
  }
});

export default router;
