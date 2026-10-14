import { ConsoleLogger, FileLogger, Logger } from "./logger";

export const VERSION: string = "1.0.0"

// change to true in prod
export const IS_PRODUCTION = undefined;

export const LOGGER: Logger = IS_PRODUCTION ? new FileLogger(process.env.LOG_FILE ?? "./backend.log") : new ConsoleLogger();

export const PORT: number = Number(process.env.PORT) || 3000;

// Bearer token required on every route except /clock/punch.
export const API_BEARER_TOKEN: string = process.env.API_BEARER_TOKEN || "";

// DB stuffs
export const DB_USER: string = process.env.DB_USER || "shopclock";
export const DB_PASSWORD: string = process.env.DB_PASSWORD || "";
export const DB_HOST: string = process.env.DB_HOST || "localhost"
export const DB_PORT: number = Number(process.env.DB_PORT) || 5432;
export const DB_NAME: string = process.env.DB_NAME || "shopclock"

export const NODE_ENV: string = process.env.NODE_ENV || "development";
export const IS_PROD_ENV: boolean = NODE_ENV === "production";

// Admin panel session signing. Required - fail fast if unset.
export const ADMIN_JWT_SECRET: string = (() => {
  const secret = process.env.ADMIN_JWT_SECRET;

  if (!secret) {
    throw new Error("ADMIN_JWT_SECRET environment variable is required");
  }

  return secret;
})();

export const ADMIN_SESSION_TTL_SECONDS: number = Number(process.env.ADMIN_SESSION_TTL_SECONDS) || 28800;

// Origin of the admin panel frontend. Used for CORS and as the OAuth redirect target.
export const ADMIN_FRONTEND_URL: string = process.env.ADMIN_FRONTEND_URL || "http://localhost:5173";

// Path the admin frontend is hosted under on that origin (e.g. "/sc/" when it can't
// have its own subdomain, such as behind an mDNS .local hostname). Normalized to
// always have both a leading and trailing slash.
export const ADMIN_FRONTEND_BASE_PATH: string = (() => {
  const raw = process.env.ADMIN_FRONTEND_BASE_PATH || "/";
  const withLeadingSlash = raw.startsWith("/") ? raw : `/${raw}`;
  return withLeadingSlash.endsWith("/") ? withLeadingSlash : `${withLeadingSlash}/`;
})();

// Fluxer OAuth2 (Discord-style authorize/token/user flow).
export const FLUXER_CLIENT_ID: string = process.env.FLUXER_CLIENT_ID || "";
export const FLUXER_CLIENT_SECRET: string = process.env.FLUXER_CLIENT_SECRET || "";
export const FLUXER_AUTHORIZE_URL: string = process.env.FLUXER_AUTHORIZE_URL || "";
export const FLUXER_TOKEN_URL: string = process.env.FLUXER_TOKEN_URL || "";
export const FLUXER_USER_URL: string = process.env.FLUXER_USER_URL || "";
export const FLUXER_REDIRECT_URI: string = process.env.FLUXER_REDIRECT_URI || "http://localhost:3000/admin/auth/fluxer/callback";
export const FLUXER_SCOPES: string = process.env.FLUXER_SCOPES || "identify";

export const ADMIN_FLUXER_ALLOWED_IDS: string[] = (process.env.ADMIN_FLUXER_ALLOWED_IDS || "")
  .split(",")
  .map((id) => id.trim())
  .filter((id) => id.length > 0);

// Fakes the Fluxer OAuth round trip for local testing. Never usable in production.
export const FLUXER_STUB_MODE: boolean = !IS_PROD_ENV && process.env.FLUXER_STUB_MODE === "true";