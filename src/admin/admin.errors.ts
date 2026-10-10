export const ADMIN_UNAUTHORIZED = { error: "admin_unauthorized", error_description: "missing or invalid admin session" };
export const ADMIN_NOT_ALLOWED = { error: "admin_not_allowed", error_description: "this account is not authorized for admin access" };
export const INVALID_CREDENTIALS = { error: "invalid_credentials", error_description: "invalid username or password" };
export const MALFORMED_LOGIN_REQUEST = { error: "malformed_login_request", error_description: "username and password are required" };
export const OAUTH_STATE_MISMATCH = { error: "oauth_state_mismatch", error_description: "oauth state is missing or did not match" };
export const OAUTH_EXCHANGE_FAILED = { error: "oauth_exchange_failed", error_description: "failed to complete the oauth exchange with fluxer" };
