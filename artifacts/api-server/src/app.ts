import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import session from "express-session";
import router from "./routes";
import authRouter from "./routes/auth";
import healthRouter from "./routes/health";
import publicRouter from "./routes/public";
import spaceImagesRouter from "./routes/space-images";
import { logger } from "./lib/logger";
import { requireAuth } from "./middlewares/requireAuth";

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

app.use("/api/v1", requireAuth);

app.use("/api", spaceImagesRouter);
app.use("/api", router);

export default app;
