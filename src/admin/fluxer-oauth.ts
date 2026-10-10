import {
  ADMIN_FLUXER_ALLOWED_IDS,
  FLUXER_AUTHORIZE_URL,
  FLUXER_CLIENT_ID,
  FLUXER_CLIENT_SECRET,
  FLUXER_REDIRECT_URI,
  FLUXER_SCOPES,
  FLUXER_STUB_MODE,
  FLUXER_TOKEN_URL,
  FLUXER_USER_URL,
  LOGGER,
} from "../constants";

export interface FluxerUser {
  id: string;
  username: string;
  email?: string | null;
  avatar?: string | null;
}

const STUB_FLUXER_USER: FluxerUser = {
  id: "stub-admin-1",
  username: "stub-admin",
  email: "stub-admin@example.com",
  avatar: null,
};

export function buildAuthorizeUrl(state: string): string {
  if (FLUXER_STUB_MODE) {
    return `/admin/auth/fluxer/callback?code=stub&state=${encodeURIComponent(state)}`;
  }

  const url = new URL(FLUXER_AUTHORIZE_URL);
  url.searchParams.set("client_id", FLUXER_CLIENT_ID);
  url.searchParams.set("redirect_uri", FLUXER_REDIRECT_URI);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", FLUXER_SCOPES);
  url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangeCodeForToken(code: string): Promise<string | null> {
  if (FLUXER_STUB_MODE) {
    return "stub-access-token";
  }

  try {
    const response = await fetch(FLUXER_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: FLUXER_REDIRECT_URI,
        client_id: FLUXER_CLIENT_ID,
        client_secret: FLUXER_CLIENT_SECRET,
      }),
    });

    if (!response.ok) {
      LOGGER.error(`Fluxer token exchange failed with status ${response.status}`);
      return null;
    }

    const body = await response.json();
    return typeof body?.access_token === "string" ? body.access_token : null;
  } catch (error) {
    LOGGER.error(`Fluxer token exchange errored\n${error}`);
    return null;
  }
}

export async function fetchFluxerUser(accessToken: string): Promise<FluxerUser | null> {
  if (FLUXER_STUB_MODE) {
    return STUB_FLUXER_USER;
  }

  try {
    const response = await fetch(FLUXER_USER_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      LOGGER.error(`Fluxer user fetch failed with status ${response.status}`);
      return null;
    }

    const body = await response.json();

    if (typeof body?.id !== "string" && typeof body?.id !== "number") {
      return null;
    }

    return {
      id: String(body.id),
      username: String(body.username ?? body.id),
      email: body.email ?? null,
      avatar: body.avatar ?? null,
    };
  } catch (error) {
    LOGGER.error(`Fluxer user fetch errored\n${error}`);
    return null;
  }
}

export function isAllowedFluxerId(id: string): boolean {
  return ADMIN_FLUXER_ALLOWED_IDS.includes(id);
}
