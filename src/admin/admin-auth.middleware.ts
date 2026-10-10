import type { NextFunction, Request, Response } from "express";
import { readAdminSession, type AdminSessionPayload } from "./admin-session";
import * as errors from "./admin.errors";

declare global {
  namespace Express {
    interface Request {
      admin?: AdminSessionPayload;
    }
  }
}

export function requireAdminSession(req: Request, res: Response, next: NextFunction) {
  const session = readAdminSession(req);

  if (!session) {
    return res.status(401).json(errors.ADMIN_UNAUTHORIZED);
  }

  req.admin = session;
  next();
}
