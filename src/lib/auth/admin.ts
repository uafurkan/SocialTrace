import { normalizeEmail } from "@/lib/auth/users";

/**
 * A hardcoded allowlist rather than a stored `role`/`plan` value: this is a
 * single-operator feature for the site owner's own account, not general
 * RBAC. Adding a real "admin" tier to `users.plan` (src/lib/billing/plans.ts)
 * would need a migration and a manual DB edit before it took effect for this
 * exact account — unnecessary ceremony for one email. This account still has
 * to sign up/sign in through the real auth flow; this only removes plan
 * limits and unlocks /admin once that email is authenticated.
 */
const ADMIN_EMAILS = ["furkanhulakojob@gmail.com"];

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(normalizeEmail(email));
}
