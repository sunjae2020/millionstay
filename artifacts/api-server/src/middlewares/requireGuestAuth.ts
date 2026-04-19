import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const BASE_SECRET = process.env["JWT_SECRET"] ?? process.env["SESSION_SECRET"];
if (!BASE_SECRET) {
  throw new Error(
    "[FATAL] JWT_SECRET (or SESSION_SECRET) environment variable must be set. " +
    "Refusing to start with a hardcoded development secret.",
  );
}
const GUEST_JWT_SECRET = process.env["GUEST_JWT_SECRET"] ?? BASE_SECRET + "_guest";

export interface GuestAuthPayload {
  id: number;
  email: string;
  account_id: number | null;
  role: "guest";
}

export function signGuestJWT(payload: Omit<GuestAuthPayload, "role">): string {
  return jwt.sign({ ...payload, role: "guest" }, GUEST_JWT_SECRET, { expiresIn: "7d" });
}

export function verifyGuestJWT(token: string): GuestAuthPayload {
  return jwt.verify(token, GUEST_JWT_SECRET) as GuestAuthPayload;
}

export function requireGuestAuth(req: Request, res: Response, next: NextFunction): void {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice(7);
    try {
      const payload = verifyGuestJWT(token);
      if (payload.role !== "guest") throw new Error("Not a guest token");
      (req as any).guest = payload;
      next();
      return;
    } catch {
      // fall through
    }
  }

  res.status(401).json({
    success: false,
    error: { code: "UNAUTHORIZED", message: "Guest authentication required" },
  });
}
