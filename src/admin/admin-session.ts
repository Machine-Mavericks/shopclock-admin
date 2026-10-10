import { randomBytes } from "node:crypto";
import jwt from "jsonwebtoken";
import type { Request, Response } from "express";
import { ADMIN_JWT_SECRET, ADMIN_SESSION_TTL_SECONDS } from "../constants";

export const SESSION_COOKIE_NAME = "shopclock_admin_session";
export const OAUTH_STATE_COOKIE_NAME = "shopclock_admin_oauth_state";

export type AdminProvider = "fluxer" | "local";

export interface AdminSessionPayload {
  sub: string;
  username: string;
  provider: AdminProvider;
  avatar?: string | null | undefined;
}

function cookieOptions(maxAgeMs: number) {
  return {
    httpOnly: true,
    // SameSite=None requires Secure regardless of environment - the admin
    // frontend and backend are always different origins/ports.
    secure: true,
    sameSite: "none" as const,
    maxAge: maxAgeMs,
    path: "/",
  };
}

function clearCookieOptions() {
  return {
    httpOnly: true,
    secure: true,
    sameSite: "none" as const,
    path: "/",
  };
}

export function signAdminSession(payload: AdminSessionPayload): string {
  return jwt.sign(payload, ADMIN_JWT_SECRET, { expiresIn: ADMIN_SESSION_TTL_SECONDS });
}

export function verifyAdminSession(token: string): AdminSessionPayload | null {
  try {
    return jwt.verify(token, ADMIN_JWT_SECRET) as AdminSessionPayload & jwt.JwtPayload;
  } catch {
    return null;
  }
}

export function issueAdminSessionCookie(res: Response, payload: AdminSessionPayload): void {
  const token = signAdminSession(payload);
  res.cookie(SESSION_COOKIE_NAME, token, cookieOptions(ADMIN_SESSION_TTL_SECONDS * 1000));
}

export function clearAdminSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE_NAME, clearCookieOptions());
}

export function readAdminSession(req: Request): AdminSessionPayload | null {
  const token = req.cookies?.[SESSION_COOKIE_NAME];
  return typeof token === "string" ? verifyAdminSession(token) : null;
}

const OAUTH_STATE_TTL_MS = 5 * 60 * 1000;

export function issueOauthStateCookie(res: Response): string {
  const state = randomBytes(24).toString("base64url");
  res.cookie(OAUTH_STATE_COOKIE_NAME, state, cookieOptions(OAUTH_STATE_TTL_MS));
  return state;
}

export function consumeOauthStateCookie(req: Request, res: Response): string | null {
  const state = req.cookies?.[OAUTH_STATE_COOKIE_NAME];
  res.clearCookie(OAUTH_STATE_COOKIE_NAME, clearCookieOptions());
  return typeof state === "string" ? state : null;
}
