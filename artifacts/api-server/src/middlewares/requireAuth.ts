import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env["JWT_SECRET"] ?? process.env["SESSION_SECRET"] ?? "millionstay-dev-secret-change-in-production";

export interface AuthPayload {
  id: number;
  email: string;
  role: string;
}

export function verifyJWT(token: string): AuthPayload {
  return jwt.verify(token, JWT_SECRET) as AuthPayload;
}

export function signJWT(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "8h" });
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice(7);
    try {
      const payload = verifyJWT(token);
      (req as any).user = payload;
      next();
      return;
    } catch {
      // fall through
    }
  }

  const sessionToken = (req as any).session?.token;
  if (sessionToken) {
    try {
      const payload = verifyJWT(sessionToken);
      (req as any).user = payload;
      next();
      return;
    } catch {
      // fall through
    }
  }

  res.status(401).json({
    success: false,
    error: { code: "UNAUTHORIZED", message: "Authentication required" },
  });
}
