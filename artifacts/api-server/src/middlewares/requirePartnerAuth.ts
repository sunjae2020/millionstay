import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const BASE_SECRET = process.env["JWT_SECRET"] ?? process.env["SESSION_SECRET"];
if (!BASE_SECRET) {
  throw new Error(
    "[FATAL] JWT_SECRET (or SESSION_SECRET) environment variable must be set. " +
    "Refusing to start with a hardcoded development secret.",
  );
}
const PARTNER_JWT_SECRET = process.env["PARTNER_JWT_SECRET"] ?? BASE_SECRET + "_partner";

export interface PartnerAuthPayload {
  id: number;
  email: string;
  account_id: number;
  portal_type: "agent" | "owner";
  role: "partner";
}

export function signPartnerJWT(payload: Omit<PartnerAuthPayload, "role">): string {
  return jwt.sign({ ...payload, role: "partner" }, PARTNER_JWT_SECRET, { expiresIn: "7d" });
}

export function verifyPartnerJWT(token: string): PartnerAuthPayload {
  return jwt.verify(token, PARTNER_JWT_SECRET) as PartnerAuthPayload;
}

export function requirePartnerAuth(req: Request, res: Response, next: NextFunction): void {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice(7);
    try {
      const payload = verifyPartnerJWT(token);
      if (payload.role !== "partner") throw new Error("Not a partner token");
      (req as any).partner = payload;
      next();
      return;
    } catch {
      // fall through
    }
  }
  res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "Partner authentication required" } });
}

export function requireAgentAuth(req: Request, res: Response, next: NextFunction): void {
  requirePartnerAuth(req, res, () => {
    const partner = (req as any).partner as PartnerAuthPayload;
    if (partner.portal_type !== "agent") {
      res.status(403).json({ success: false, error: { code: "FORBIDDEN", message: "Agent access only" } });
      return;
    }
    next();
  });
}

export function requireOwnerAuth(req: Request, res: Response, next: NextFunction): void {
  requirePartnerAuth(req, res, () => {
    const partner = (req as any).partner as PartnerAuthPayload;
    if (partner.portal_type !== "owner") {
      res.status(403).json({ success: false, error: { code: "FORBIDDEN", message: "Owner access only" } });
      return;
    }
    next();
  });
}
