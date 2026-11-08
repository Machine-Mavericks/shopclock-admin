import type { Request, Response } from "express";
import * as db from "../database";
import * as errors from "../errors";
import { formatCredentialResponse, generateCredentialSecret } from "../punch/credential.service";

function isUserRole(value: unknown): value is db.UserRole {
  return value === "student" || value === "mentor";
}

export async function listUsers(req: Request, res: Response) {
  const users = await db.listUsers();
  return res.status(200).json(users);
}

export async function createUser(req: Request, res: Response) {
  const { fullName, role = "student", credentialType = "static", secret: requestedSecret } = req.body ?? {};

  if (
    typeof fullName !== "string"
    || fullName.trim().length === 0
    || !isUserRole(role)
    || (credentialType !== "static" && credentialType !== "rotating")
  ) {
    return res.status(400).json(errors.MALFORMED_CREATE_USER_REQUEST);
  }

  if (requestedSecret !== undefined && (
    credentialType !== "static"
    || typeof requestedSecret !== "string"
    || requestedSecret.trim().length === 0
    || requestedSecret.length > 128
  )) {
    return res.status(400).json(errors.MALFORMED_SECRET);
  }

  let secret: string;

  if (typeof requestedSecret === "string") {
    secret = requestedSecret.trim();

    if (await db.isSecretInUse(secret)) {
      return res.status(409).json(errors.SECRET_ALREADY_IN_USE);
    }
  } else {
    secret = generateCredentialSecret(credentialType);
  }

  const created = await db.createUser(fullName.trim(), role, credentialType, secret);

  if (!created) {
    return res.status(500).json(errors.CREATE_USER_FAILED);
  }

  return res.status(201).json({
    user: created.user,
    credential: formatCredentialResponse(created.user, created.credential, secret),
  });
}

export async function getUser(req: Request, res: Response) {
  const id = Number(req.params.id);

  if (!Number.isSafeInteger(id) || id <= 0) {
    return res.status(400).json(errors.MALFORMED_GET_USER_REQUEST);
  }

  const user = await db.getUser(id);

  if (!user) {
    return res.status(404).json(errors.USER_NOT_FOUND);
  }

  const punchedIn = await db.isPunchedIn(user);

  return res.status(200).json({ user, punchedIn });
}

export async function setRole(req: Request, res: Response) {
  const id = Number(req.params.id);
  const { role } = req.body ?? {};

  if (!Number.isSafeInteger(id) || id <= 0 || !isUserRole(role)) {
    return res.status(400).json(errors.MALFORMED_SET_ROLE_REQUEST);
  }

  const updated = await db.setUserRole(id, role);

  if (!updated) {
    return res.status(500).json(errors.SET_ROLE_FAILED);
  }

  return res.status(200).json(updated);
}

export async function togglePunch(req: Request, res: Response) {
  const id = Number(req.params.id);

  if (!Number.isSafeInteger(id) || id <= 0) {
    return res.status(400).json(errors.MALFORMED_PUNCH_TOGGLE_REQUEST);
  }

  const user = await db.getUser(id);

  if (!user) {
    return res.status(404).json(errors.USER_NOT_FOUND);
  }

  const session = await db.handlePunch(user);

  if (!session) {
    return res.status(500).json(errors.PUNCH_TOGGLE_FAILED);
  }

  return res.status(200).json({ session, punchedIn: session.timeOut === null });
}

export async function regenerateCredential(req: Request, res: Response) {
  const id = Number(req.params.id);
  const { credentialType, secret: requestedSecret } = req.body ?? {};

  if (!Number.isSafeInteger(id) || id <= 0) {
    return res.status(400).json(errors.MALFORMED_NEW_CREDENTIAL_REQUEST);
  }

  if (credentialType !== "static" && credentialType !== "rotating") {
    return res.status(400).json(errors.MALFORMED_NEW_CREDENTIAL_REQUEST);
  }

  if (requestedSecret !== undefined && (
    credentialType !== "static"
    || typeof requestedSecret !== "string"
    || requestedSecret.trim().length === 0
    || requestedSecret.length > 128
  )) {
    return res.status(400).json(errors.MALFORMED_SECRET);
  }

  const user = await db.getUser(id);

  if (!user) {
    return res.status(404).json(errors.USER_NOT_FOUND);
  }

  let secret: string;

  if (typeof requestedSecret === "string") {
    secret = requestedSecret.trim();

    if (await db.isSecretInUse(secret)) {
      return res.status(409).json(errors.SECRET_ALREADY_IN_USE);
    }
  } else {
    secret = generateCredentialSecret(credentialType);
  }

  const credential = await db.regeneratePunchCredential(user.id, credentialType, secret);

  if (!credential) {
    return res.status(500).json(errors.NEW_CREDENTIAL_FAILED);
  }

  return res.status(201).json({
    user,
    credential: formatCredentialResponse(user, credential, secret),
  });
}

export async function getSessions(req: Request, res: Response) {
  const id = Number(req.params.id);

  if (!Number.isSafeInteger(id) || id <= 0) {
    return res.status(400).json(errors.MALFORMED_GET_SESSIONS_REQUEST);
  }

  const user = await db.getUser(id);

  if (!user) {
    return res.status(404).json(errors.USER_NOT_FOUND);
  }

  const sessions = await db.getSessions(user);

  if (!sessions) {
    return res.status(404).json(errors.SESSIONS_NOT_FOUND);
  }

  return res.status(200).json(sessions);
}
