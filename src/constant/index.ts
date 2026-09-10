export const PERMISSIONS = {
  DASHBOARD_VIEW: "dashboard.view",

  ENQUIRY_VIEW: "enquiry.view",
  ENQUIRY_CREATE: "enquiry.create",
  ENQUIRY_EDIT: "enquiry.edit",
  ENQUIRY_DELETE: "enquiry.delete",

  APPOINTMENT_VIEW: "appointment.view",
  APPOINTMENT_CREATE: "appointment.create",
  APPOINTMENT_EDIT: "appointment.edit",
  APPOINTMENT_DELETE: "appointment.delete",

  THERAPIST_VIEW: "therapist.view",
  THERAPIST_CREATE: "therapist.create",
  THERAPIST_EDIT: "therapist.edit",
  THERAPIST_DELETE: "therapist.delete",

  ADMIN_VIEW: "admin.view",
  ADMIN_CREATE: "admin.create",
  ADMIN_EDIT: "admin.edit",

  EXPORT_DATA: "export.data",
  USER_FORCE_LOGOUT: "user.force_logout",
  MODULE_LOCK: "module.lock",
} as const;

export const ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "THERAPIST",
  "STAFF",
  "CUSTOMER_CARE",
] as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
export type Role =
  | "SUPER_ADMIN"
  | "ADMIN"
  | "THERAPIST"
  | "STAFF"
  | "CUSTOMER_CARE";

export const ROLE_PERMISSIONS: Record<Role, Permission[] | ["*"]> = {
  SUPER_ADMIN: ["*"],
  ADMIN: ["*"],
  THERAPIST: ["*"],
  STAFF: ["*"],
  CUSTOMER_CARE: ["*"],
};

export const hasPermission = (role: Role, permission: Permission): boolean => {
  const perms = ROLE_PERMISSIONS[role];
  if (!perms) return false;
  if (perms[0] === "*") return true;
  return (perms as Permission[]).includes(permission);
};

/**
 * Backend API origin (no trailing slash).
 * - Production: set BACKEND_BASE_URL
 * - Local dev: BACKEND_BASE_URL or BACKEND_BASE_URL_LOCAL, else http://localhost:10000
 */
function resolveBackendBaseUrl(): string {
  const fromEnv =
    process.env.BACKEND_BASE_URL?.trim() ||
    process.env.BACKEND_BASE_URL_LOCAL?.trim() ||
    (process.env.NODE_ENV === "development" ? "http://localhost:10000" : "");

  return fromEnv.replace(/\/$/, "");
}

export const base_url = resolveBackendBaseUrl();

// ── Refresh-token timeout constants ──────────────────────────────────────────
// Both middleware and fetchWithAuth call /api/users/refresh-token when the
// access token expires. Each has its own timeout tuned to its context.
//
// Why two values?  The middleware runs on EVERY navigation and blocks the
// entire page load — it must fail fast (3 s) so the user isn't stuck waiting.
// If the backend is cold, the middleware lets the request through with stale
// cookies; the data layer (fetchWithAuth) recovers once the backend is warm.
//
// fetchWithAuth runs inside server actions AFTER the page has loaded.  The
// page is already visible, so we can afford to wait a bit longer (5 s) for
// the backend to respond.  Still short enough to finish well within Next.js
// server-action time budgets.
//
// Render free-tier cold starts take 10-30 s.  Neither timeout can survive a
// full cold start — that's intentional.  The first request (middleware or
// server action) pings the Render instance and wakes it up; subsequent
// requests within the same ~60 s window succeed.  The hard-refresh flow
// (user sees session expired dialog → clicks Refresh) completes the warm-up.
export const MIDDLEWARE_REFRESH_TIMEOUT_MS = 3_000;
export const SERVER_ACTION_REFRESH_TIMEOUT_MS = 5_000;
