import type { Request, Response } from "express";
import * as db from "../database";
import * as errors from "../errors";
import { formatCredentialResponse, generateCredentialSecret } from "../punch/credential.service";

export async function listStudents(req: Request, res: Response) {
  const students = await db.listStudents();
  return res.status(200).json(students);
}

export async function createStudent(req: Request, res: Response) {
  const { fullName, credentialType = "static", secret: requestedSecret } = req.body ?? {};

  if (
    typeof fullName !== "string"
    || fullName.trim().length === 0
    || (credentialType !== "static" && credentialType !== "rotating")
  ) {
    return res.status(400).json(errors.MALFORMED_CREATE_STUDENT_REQUEST);
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

  const created = await db.createStudent(fullName.trim(), credentialType, secret);

  if (!created) {
    return res.status(500).json(errors.CREATE_STUDENT_FAILED);
  }

  return res.status(201).json({
    student: created.student,
    credential: formatCredentialResponse(created.student, created.credential, secret),
  });
}

export async function getStudent(req: Request, res: Response) {
  const id = Number(req.params.id);

  if (!Number.isSafeInteger(id) || id <= 0) {
    return res.status(400).json(errors.MALFORMED_GET_STUDENT_REQUEST);
  }

  const student = await db.getStudent(id);

  if (!student) {
    return res.status(404).json(errors.STUDENT_NOT_FOUND);
  }

  const punchedIn = await db.isPunchedIn(student);

  return res.status(200).json({ student, punchedIn });
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

  const student = await db.getStudent(id);

  if (!student) {
    return res.status(404).json(errors.STUDENT_NOT_FOUND);
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

  const credential = await db.regeneratePunchCredential(student.id, credentialType, secret);

  if (!credential) {
    return res.status(500).json(errors.NEW_CREDENTIAL_FAILED);
  }

  return res.status(201).json({
    student,
    credential: formatCredentialResponse(student, credential, secret),
  });
}

export async function getSessions(req: Request, res: Response) {
  const id = Number(req.params.id);

  if (!Number.isSafeInteger(id) || id <= 0) {
    return res.status(400).json(errors.MALFORMED_GET_SESSIONS_REQUEST);
  }

  const student = await db.getStudent(id);

  if (!student) {
    return res.status(404).json(errors.STUDENT_NOT_FOUND);
  }

  const sessions = await db.getSessions(student);

  if (!sessions) {
    return res.status(404).json(errors.SESSIONS_NOT_FOUND);
  }

  return res.status(200).json(sessions);
}
