import type { Request, Response } from "express";
import * as db from "../database";
import * as errors from "../errors";
import {
  formatCredentialResponse,
  generateCredentialSecret,
  parseRotatingPunchCode,
  STATIC_QR_PREFIX,
  verifyTotp,
} from "./credential.service";

const INVALID_PUNCH_CODE = {
  error: "invalid_punch_code",
  error_description: "the punch code is invalid or expired",
};

async function getStudentFromPunchCode(code: string): Promise<db.Student | null> {
  const rotatingCode = parseRotatingPunchCode(code);

  if (!rotatingCode) {
    if (!code.startsWith(STATIC_QR_PREFIX)) {
      return null;
    }

    const secret = code.slice(STATIC_QR_PREFIX.length);

    if (!secret) {
      return null;
    }

    return db.getStudent(secret);
  }

  const credential = await db.getPunchCredential(rotatingCode.credentialId);

  if (!credential || credential.type !== "rotating") {
    return null;
  }

  if (!verifyTotp(credential.secret, rotatingCode.totp)) {
    return null;
  }

  return db.getStudent(credential.studentId);
}

export async function punch(req: Request, res: Response) {
  const code = req.body?.code;

  if (typeof code !== "string" || code.length === 0) {
    return res.status(400).json(errors.MALFORMED_PUNCH_REQUEST);
  }

  const student = await getStudentFromPunchCode(code);

  if (!student) {
    return res.status(401).json(INVALID_PUNCH_CODE);
  }

  const result = await db.handlePunch(student);

  if (!result) {
    return res.status(500).json({
      error: "punch_failed",
      error_description: "failed to record punch",
    });
  }

  return res.json({
    ...result,
    student,
  });
}

export async function createStudent(req: Request, res: Response) {
  const { fullName, credentialType = "static" } = req.body;

  if (
    typeof fullName !== "string"
    || fullName.trim().length === 0
    || (credentialType !== "static" && credentialType !== "rotating")
  ) {
    return res.status(400).json(errors.MALFORMED_CREATE_STUDENT_REQUEST);
  }

  const secret = generateCredentialSecret(credentialType);
  const created = await db.createStudent(fullName.trim(), credentialType, secret);

  if (!created) {
    return res.status(500).json(errors.CREATE_STUDENT_FAILED);
  }

  return res.status(201).json({
    student: created.student,
    credential: formatCredentialResponse(created.student, created.credential, secret),
  });
}

export async function newCredential(req: Request, res: Response) {
  const id = Number(req.body?.id);
  const { credentialType } = req.body;

  if (!Number.isSafeInteger(id) || id <= 0) {
    return res.status(400).json(errors.MALFORMED_NEW_CREDENTIAL_REQUEST);
  }

  if (credentialType !== "static" && credentialType !== "rotating") {
    return res.status(400).json(errors.MALFORMED_NEW_CREDENTIAL_REQUEST);
  }

  const student = await db.getStudent(id);

  if (!student) {
    return res.status(404).json(errors.STUDENT_NOT_FOUND);
  }

  const secret = generateCredentialSecret(credentialType);
  const credential = await db.regeneratePunchCredential(student.id, credentialType, secret);

  if (!credential) {
    return res.status(500).json(errors.NEW_CREDENTIAL_FAILED);
  }

  return res.status(201).json({
    student,
    credential: formatCredentialResponse(student, credential, secret),
  });
}

// export async function getStudentBySecret(req: Request, res: Response) {
//   const secret = String(req.params.secret);

//   if (!secret) {
//     return res.status(400).json(errors.MALFORMED_GET_STUDENT_REQUEST);
//   }

//   const student = await db.getStudent(secret);

//   if (!student) {
//     return res.status(404).json(errors.STUDENT_NOT_FOUND);
//   }

//   return res.status(200).json(student);
// }

export async function getStudentById(req: Request, res: Response) {
  const id = Number(req.params.id);

  if (!Number.isSafeInteger(id) || id <= 0) {
    return res.status(400).json(errors.MALFORMED_GET_STUDENT_REQUEST);
  }

  const student = await db.getStudent(id);

  if (!student) {
    return res.status(404).json(errors.STUDENT_NOT_FOUND);
  }

  return res.status(200).json(student);
}

export async function getSessions(req: Request, res: Response) {
  const id = Number(req.params.id);

  if(!Number.isSafeInteger(id) || id <= 0) {
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
