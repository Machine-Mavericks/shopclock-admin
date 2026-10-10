import argon2 from "argon2";
import type { Request, Response } from "express";
import * as db from "../database";
import * as errors from "./admin.errors";

export async function listAdmins(req: Request, res: Response) {
  const [localAdmins, fluxerAdminIds] = await Promise.all([
    db.listAdminUsers(),
    db.listFluxerAdminIds(),
  ]);

  return res.status(200).json({
    local: localAdmins.map(({ passwordHash, ...rest }) => rest),
    fluxer: fluxerAdminIds,
  });
}

export async function createLocalAdmin(req: Request, res: Response) {
  const { username, password } = req.body ?? {};

  if (typeof username !== "string" || !username.trim() || typeof password !== "string" || password.length < 8) {
    return res.status(400).json(errors.MALFORMED_CREATE_ADMIN_REQUEST);
  }

  const existing = await db.getAdminUserByUsername(username.trim());

  if (existing) {
    return res.status(409).json(errors.ADMIN_USERNAME_TAKEN);
  }

  const passwordHash = await argon2.hash(password);
  const created = await db.createAdminUser(username.trim(), passwordHash);

  if (!created) {
    return res.status(500).json(errors.CREATE_ADMIN_FAILED);
  }

  const { passwordHash: _omit, ...safe } = created;
  return res.status(201).json(safe);
}

export async function setLocalAdminDisabled(req: Request, res: Response) {
  const id = Number(req.params.id);
  const { disabled } = req.body ?? {};

  if (!Number.isSafeInteger(id) || id <= 0 || typeof disabled !== "boolean") {
    return res.status(400).json(errors.MALFORMED_SET_ADMIN_DISABLED_REQUEST);
  }

  const updated = await db.setAdminUserDisabled(id, disabled);

  if (!updated) {
    return res.status(404).json(errors.ADMIN_NOT_FOUND);
  }

  const { passwordHash: _omit, ...safe } = updated;
  return res.status(200).json(safe);
}

export async function addFluxerAdminIdHandler(req: Request, res: Response) {
  const { fluxerId, label } = req.body ?? {};

  if (typeof fluxerId !== "string" || !fluxerId.trim()) {
    return res.status(400).json(errors.MALFORMED_ADD_FLUXER_ID_REQUEST);
  }

  const addedBy = req.admin?.username ?? null;
  const created = await db.addFluxerAdminId(
    fluxerId.trim(),
    typeof label === "string" && label.trim() ? label.trim() : null,
    addedBy,
  );

  if (!created) {
    return res.status(409).json(errors.FLUXER_ID_ALREADY_ALLOWED);
  }

  return res.status(201).json(created);
}

export async function removeFluxerAdminIdHandler(req: Request, res: Response) {
  const id = Number(req.params.id);

  if (!Number.isSafeInteger(id) || id <= 0) {
    return res.status(400).json(errors.MALFORMED_REMOVE_FLUXER_ID_REQUEST);
  }

  const removed = await db.removeFluxerAdminId(id);

  if (!removed) {
    return res.status(404).json(errors.FLUXER_ID_NOT_FOUND);
  }

  return res.status(204).send();
}
