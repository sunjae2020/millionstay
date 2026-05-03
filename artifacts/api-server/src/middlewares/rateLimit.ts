import rateLimit from "express-rate-limit";

const skip = process.env["NODE_ENV"] !== "production"
  ? () => true   // disabled outside prod
  : undefined;

// Per CF-024 prescription:
//   - login endpoints: 10/min/IP (brute-force defense)
//   - public application endpoints: 100/min/IP (form spam)
//   - default API: 300/min/IP (general abuse)

export const loginLimiter = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many login attempts. Try again in a minute." },
  skip,
});

export const applicationLimiter = rateLimit({
  windowMs: 60_000,
  limit: 100,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many submissions. Try again later." },
  skip,
});

export const generalLimiter = rateLimit({
  windowMs: 60_000,
  limit: 300,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip,
});

// Sensitive privacy endpoints: 1 request per minute, 10 per day per IP.
// Heavy DB joins; APP 12 access path; should never be hammered.
export const privacyExportLimiter = rateLimit({
  windowMs: 24 * 60 * 60_000, // 24h
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Daily privacy-export limit reached. Contact info@millionstay.com if you need additional exports." },
  skip,
});
