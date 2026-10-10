import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import * as db from "../database";

export const TOTP_PERIOD_SECONDS = 30;
export const TOTP_DIGITS = 8;
const TOTP_WINDOW = 1;
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export const ENROLLMENT_QR_PREFIX = "shopclock-enroll:";
const ENROLLMENT_PAYLOAD_VERSION = 1;
export const STATIC_QR_PREFIX = "shopclock-static:";

export interface RotatingPunchCode {
  credentialId: string;
  totp: string;
}

function encodeBase32(value: Buffer): string {
  let bits = "";

  for (const byte of value) {
    bits += byte.toString(2).padStart(8, "0");
  }

  let encoded = "";

  for (let offset = 0; offset < bits.length; offset += 5) {
    const chunk = bits.slice(offset, offset + 5).padEnd(5, "0");
    encoded += BASE32_ALPHABET[Number.parseInt(chunk, 2)];
  }

  return encoded;
}

function decodeBase32(value: string): Buffer {
  const normalized = value
    .trim()
    .toUpperCase()
    .replaceAll("=", "")
    .replaceAll(" ", "");

  if (normalized.length === 0) {
    throw new Error("TOTP secret cannot be empty");
  }

  let bits = "";

  for (const character of normalized) {
    const index = BASE32_ALPHABET.indexOf(character);

    if (index === -1) {
      throw new Error("TOTP secret is not valid Base32");
    }

    bits += index.toString(2).padStart(5, "0");
  }

  const bytes: number[] = [];

  for (let offset = 0; offset + 8 <= bits.length; offset += 8) {
    bytes.push(Number.parseInt(bits.slice(offset, offset + 8), 2));
  }

  return Buffer.from(bytes);
}

export function generateEnrollmentCode(fullName: string, credentialId: string, secret: string): string {
  const payload = {
    v: ENROLLMENT_PAYLOAD_VERSION,
    name: fullName,
    uuid: credentialId,
    secret,
  };

  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");

  return `${ENROLLMENT_QR_PREFIX}${encodedPayload}`;
}

export function generateCredentialSecret(type: db.PunchCredentialType): string {
  const randomValue = randomBytes(32);

  return type === "rotating"
    ? encodeBase32(randomValue)
    : randomValue.toString("base64url");
}

export function generateTotp(secret: string, counter: number): string {
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));

  const digest = createHmac("sha256", decodeBase32(secret))
    .update(counterBuffer)
    .digest();

  const offset = digest[digest.length - 1]! & 0x0f;
  const binaryCode = digest.readUInt32BE(offset) & 0x7fffffff;

  return (binaryCode % (10 ** TOTP_DIGITS))
    .toString()
    .padStart(TOTP_DIGITS, "0");
}

export function verifyTotp(secret: string, submittedCode: string): boolean {
  if (!new RegExp(`^\\d{${TOTP_DIGITS}}$`).test(submittedCode)) {
    return false;
  }

  const submittedBuffer = Buffer.from(submittedCode);
  const currentCounter = Math.floor(Date.now() / 1000 / TOTP_PERIOD_SECONDS);

  try {
    for (let offset = -TOTP_WINDOW; offset <= TOTP_WINDOW; offset += 1) {
      const expectedBuffer = Buffer.from(
        generateTotp(secret, currentCounter + offset),
      );

      if (timingSafeEqual(submittedBuffer, expectedBuffer)) {
        return true;
      }
    }
  } catch {
    return false;
  }

  return false;
}

export function parseRotatingPunchCode(value: string): RotatingPunchCode | null {
  const parts = value.split(":");

  if (parts.length !== 3 || parts[0] !== "shopclock") {
    return null;
  }

  const credentialId = parts[1];
  const totp = parts[2];

  if (!credentialId || !totp) {
    return null;
  }

  return { credentialId, totp };
}

export function formatCredentialResponse(student: db.Student, credential: db.PunchCredential, secret: string) {
  return credential.type === "rotating"
    ? {
        id: credential.id,
        type: credential.type,
        secret,
        qrPrefix: `shopclock:${credential.id}:`,
        algorithm: "SHA256",
        digits: TOTP_DIGITS,
        period: TOTP_PERIOD_SECONDS,
        enrollmentCode: generateEnrollmentCode(student.fullName, credential.id, secret),
      }
    : {
        id: credential.id,
        type: credential.type,
        secret,
        qrCode: `${STATIC_QR_PREFIX}${secret}`,
      };
}
