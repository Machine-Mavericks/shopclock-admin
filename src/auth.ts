import { timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { API_BEARER_TOKEN } from "./constants";
import * as errors from "./errors";

const BEARER_PREFIX = "Bearer ";

function tokensMatch(submitted: string, expected: string): boolean {
  const submittedBuffer = Buffer.from(submitted);
  const expectedBuffer = Buffer.from(expected);

  return submittedBuffer.length === expectedBuffer.length
    && timingSafeEqual(submittedBuffer, expectedBuffer);
}

export function requireBearerToken(req: Request, res: Response, next: NextFunction) {
  const header = req.header("authorization");
  const token = header?.startsWith(BEARER_PREFIX) ? header.slice(BEARER_PREFIX.length) : null;

  if (!token || !API_BEARER_TOKEN || !tokensMatch(token, API_BEARER_TOKEN)) {
    return res.status(401).json(errors.UNAUTHORIZED);
  }

  next();
}
