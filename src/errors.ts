export const MALFORMED_PUNCH_REQUEST = { error: "malformed_punch_request", error_description: "missing code body parameter"};
export const STUDENT_NOT_FOUND = { error: "student_not_found", error_description: "student not found"};
export const MALFORMED_CREATE_STUDENT_REQUEST = { error: "malformed_create_student_request", error_description: "fullName is required and credentialType must be static or rotating"};
export const CREATE_STUDENT_FAILED = { error: "create_student_failed", error_description: "failed to create the student"};
export const MALFORMED_GET_STUDENT_REQUEST = { error: "malformed_get_student_request", error_description: "missing id parameters"};
export const STUDENT_EXISTS = { error: "student_exists", error_description: "a student with that secret exists"};
export const MALFORMED_GET_SESSIONS_REQUEST = { error: "malformed_get_sessions_request", error_description: "missing id parameters"}
export const SESSIONS_NOT_FOUND = { error: "sessions_not_found", error_description: "sessions not found"};
export const MALFORMED_NEW_CREDENTIAL_REQUEST = { error: "malformed_new_credential_request", error_description: "id parameter and credentialType (static or rotating) are required"};
export const NEW_CREDENTIAL_FAILED = { error: "new_credential_failed", error_description: "failed to generate a new credential"};
export const MALFORMED_SECRET = { error: "malformed_secret", error_description: "secret must be a non-empty string of at most 128 characters, and may only be provided for static credentials"};
export const SECRET_ALREADY_IN_USE = { error: "secret_already_in_use", error_description: "a credential with that secret already exists"};
export const UNAUTHORIZED = { error: "unauthorized", error_description: "missing or invalid bearer token"};

// Admin-facing equivalents of the student_* errors above (kept separate so the
// kiosk's wire format above stays unchanged).
export const USER_NOT_FOUND = { error: "user_not_found", error_description: "user not found"};
export const MALFORMED_CREATE_USER_REQUEST = { error: "malformed_create_user_request", error_description: "fullName is required, credentialType must be static or rotating, and role (if provided) must be student or mentor"};
export const CREATE_USER_FAILED = { error: "create_user_failed", error_description: "failed to create the user"};
export const MALFORMED_GET_USER_REQUEST = { error: "malformed_get_user_request", error_description: "missing id parameters"};
export const MALFORMED_SET_ROLE_REQUEST = { error: "malformed_set_role_request", error_description: "id parameter and role (student or mentor) are required"};
export const SET_ROLE_FAILED = { error: "set_role_failed", error_description: "failed to update the user's role"};
export const MALFORMED_PUNCH_TOGGLE_REQUEST = { error: "malformed_punch_toggle_request", error_description: "missing id parameter"};
export const PUNCH_TOGGLE_FAILED = { error: "punch_toggle_failed", error_description: "failed to record punch"};