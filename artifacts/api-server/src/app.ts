import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import session from "express-session";
import path from "node:path";
import { fileURLToPath } from "node:url";
import router from "./routes";
import authRouter from "./routes/auth";
import healthRouter from "./routes/health";
import publicRouter from "./routes/public";
import spaceImagesRouter from "./routes/space-images";
import guestAuthRouter from "./routes/guest-auth";
import guestPortalRouter from "./routes/guest-portal";
import guestCsRouter from "./routes/guest-cs";
import devMigrationRouter from "./routes/dev-migration";
import { logger } from "./lib/logger";
import { requireAuth } from "./middlewares/requireAuth";

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
app.use("/api/v1/admin", devMigrationRouter);

app.use("/api/v1", requireAuth);

app.use("/api", spaceImagesRouter);
app.use("/api", router);

// In production, serve the built SPAs so a single Cloud Run process handles everything
if (process.env["NODE_ENV"] === "production") {
  const staticBase = path.resolve(__thisDir, "static");

  // Admin SPA — served at /admin
  const adminDir = path.join(staticBase, "admin");
  app.use("/admin", express.static(adminDir, { index: false }));
  app.use("/admin", (_req, res) => {
    res.sendFile(path.join(adminDir, "index.html"));
  });

  // Guest / public web portal — catch-all (must be last)
  const webDir = path.join(staticBase, "web");
  app.use(express.static(webDir, { index: false }));
  app.use((_req, res) => {
    res.sendFile(path.join(webDir, "index.html"));
  });
}

export default app;
