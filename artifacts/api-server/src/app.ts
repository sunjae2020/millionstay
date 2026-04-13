import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import session from "express-session";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import router from "./routes";
import authRouter from "./routes/auth";
import healthRouter from "./routes/health";
import publicRouter from "./routes/public";
import spaceImagesRouter from "./routes/space-images";
import guestAuthRouter from "./routes/guest-auth";
import guestPortalRouter from "./routes/guest-portal";
import guestCsRouter from "./routes/guest-cs";
import devMigrationRouter from "./routes/dev-migration";
import stripeRouter from "./routes/stripe";
import adminUsersRouter from "./routes/admin-users";
import partnerAuthRouter from "./routes/partner-auth";
import agentPortalRouter from "./routes/agent-portal";
import ownerPortalRouter from "./routes/owner-portal";
import { logger } from "./lib/logger";
import { requireAuth } from "./middlewares/requireAuth";

// Resolve the directory of this file — works both in source and in the esbuild bundle.
// In the bundle (artifacts/api-server/dist/index.mjs), import.meta.url correctly
// points to the bundle file, so __thisDir = .../artifacts/api-server/dist/
const __thisDir = path.dirname(fileURLToPath(import.meta.url));

const SESSION_SECRET = process.env["SESSION_SECRET"] ?? "millionstay-dev-session-secret";

const app: Express = express();

app.set("trust proxy", 1);
app.disable("x-powered-by");

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }),
);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(cors({
  origin: true,
  credentials: true,
}));

app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env["NODE_ENV"] === "production",
      httpOnly: true,
      maxAge: 8 * 60 * 60 * 1000,
    },
  }),
);

app.use(
  "/api/v1/stripe/webhook",
  express.raw({ type: "application/json" }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", authRouter);
app.use("/api", healthRouter);
app.use("/api", publicRouter);
app.use("/api", guestAuthRouter);
app.use("/api", guestPortalRouter);
app.use("/api", guestCsRouter);
app.use("/api", stripeRouter);
app.use("/api/v1/admin", devMigrationRouter);

// Partner auth + portals — must be registered BEFORE adminUsersRouter which applies requireAuth
// to every request passing through it via router.use(requireAuth)
app.use("/api", partnerAuthRouter);
app.use("/api", agentPortalRouter);
app.use("/api", ownerPortalRouter);

app.use("/api", adminUsersRouter);
app.use("/api/v1", requireAuth);

app.use("/api", spaceImagesRouter);
app.use("/api", router);

// In production, serve the built SPAs so a single Cloud Run process handles everything.
// The build step copies both SPAs into dist/static/{admin,web} alongside this bundle.
if (process.env["NODE_ENV"] === "production") {
  // Primary: sibling "static/" folder next to the running bundle file
  // Fallback: repo-root based path (for when CWD is the workspace root)
  const staticFromBundle = path.resolve(__thisDir, "static");
  const staticFromCwd = path.resolve(process.cwd(), "artifacts/api-server/dist/static");
  // Pick whichever resolves to an existing directory
  const staticBase = existsSync(staticFromBundle) ? staticFromBundle : staticFromCwd;

  logger.info({ staticBase, __thisDir, cwd: process.cwd() }, "Static file serving initialized");

  // Admin SPA — served at /admin
  const adminDir = path.join(staticBase, "admin");
  const adminIndex = path.join(adminDir, "index.html");
  app.use("/admin", express.static(adminDir, { index: false }));
  app.use("/admin", (_req, res) => {
    res.sendFile(adminIndex, (err) => {
      if (err) {
        logger.error({ err, adminIndex }, "Failed to serve admin SPA index");
        res.status(503).send("Admin portal unavailable");
      }
    });
  });

  // Guest / public web portal — catch-all (must be last)
  const webDir = path.join(staticBase, "web");
  const webIndex = path.join(webDir, "index.html");
  app.use(express.static(webDir, { index: false }));
  app.use((_req, res) => {
    res.sendFile(webIndex, (err) => {
      if (err) {
        logger.error({ err, webIndex }, "Failed to serve web SPA index");
        res.status(503).send("Web portal unavailable");
      }
    });
  });
}

export default app;
