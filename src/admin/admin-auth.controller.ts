import argon2 from "argon2";
import type { Request, Response } from "express";
import * as db from "../database";
import { ADMIN_FRONTEND_URL } from "../constants";
import * as errors from "./admin.errors";
import {
  clearAdminSessionCookie,
  consumeOauthStateCookie,
  issueAdminSessionCookie,
  issueOauthStateCookie,
} from "./admin-session";
import { buildAuthorizeUrl, exchangeCodeForToken, fetchFluxerUser, isAllowedFluxerId } from "./fluxer-oauth";

export function fluxerLogin(req: Request, res: Response) {
  const state = issueOauthStateCookie(res);
  return res.redirect(buildAuthorizeUrl(state));
}

export async function fluxerCallback(req: Request, res: Response) {
  const code = req.query.code;
  const state = req.query.state;
  const expectedState = consumeOauthStateCookie(req, res);

  if (
    typeof code !== "string"
    || typeof state !== "string"
    || !expectedState
    || state !== expectedState
  ) {
    return res.status(400).json(errors.OAUTH_STATE_MISMATCH);
  }

  const accessToken = await exchangeCodeForToken(code);

  if (!accessToken) {
    return res.status(502).json(errors.OAUTH_EXCHANGE_FAILED);
  }

  const fluxerUser = await fetchFluxerUser(accessToken);

  if (!fluxerUser) {
    return res.status(502).json(errors.OAUTH_EXCHANGE_FAILED);
  }

  if (!(await isAllowedFluxerId(fluxerUser.id))) {
    return res.redirect(`${ADMIN_FRONTEND_URL}/login?error=not_allowed`);
  }

  issueAdminSessionCookie(res, {
    sub: fluxerUser.id,
    username: fluxerUser.username,
    provider: "fluxer",
    avatar: fluxerUser.avatar,
  });

  return res.redirect(`${ADMIN_FRONTEND_URL}/`);
}

export async function localLogin(req: Request, res: Response) {
  const { username, password } = req.body ?? {};

  if (typeof username !== "string" || typeof password !== "string" || !username || !password) {
    return res.status(400).json(errors.MALFORMED_LOGIN_REQUEST);
  }

  const adminUser = await db.getAdminUserByUsername(username);

  if (!adminUser || adminUser.disabled) {
    return res.status(401).json(errors.INVALID_CREDENTIALS);
  }

  const passwordMatches = await argon2.verify(adminUser.passwordHash, password).catch(() => false);

  if (!passwordMatches) {
    return res.status(401).json(errors.INVALID_CREDENTIALS);
  }

  issueAdminSessionCookie(res, {
    sub: `local:${adminUser.id}`,
    username: adminUser.username,
    provider: "local",
  });

  return res.status(200).json({ username: adminUser.username });
}

export function logout(req: Request, res: Response) {
  clearAdminSessionCookie(res);
  return res.status(204).send();
}

export async function me(req: Request, res: Response) {
  if (req.admin?.provider === "fluxer" && !(await isAllowedFluxerId(req.admin.sub))) {
    return res.status(401).json(errors.ADMIN_UNAUTHORIZED);
  }

  return res.status(200).json({
    provider: req.admin!.provider,
    username: req.admin!.username,
    avatar: req.admin!.avatar ?? null,
  });
}
