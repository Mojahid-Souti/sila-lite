import { migrateLegacyTokens } from "@/lib/auth-storage";

/**
 * One-time localStorage hygiene, run on app load:
 *  - migrate stale `wekala_*` / `wekala-*` keys (the platform's old brand name) onto
 *    `sila_*` / `sila-*`, then drop the old ones;
 *  - move the legacy un-namespaced auth tokens onto the namespaced SILA keys and drop
 *    the generic `access_token` / `refresh_token` (collision-prone with the
 *    same-origin n8n editor + an easy target for token-scanning scripts).
 * Idempotent and failure-tolerant (private mode / disabled storage just no-ops).
 */
export function cleanupLocalStorage(): void {
  if (typeof window === "undefined") return;
  try {
    const ls = window.localStorage;
    for (const key of Object.keys(ls)) {
      if (!key.startsWith("wekala_") && !key.startsWith("wekala-")) continue;
      const target = `sila${key.slice("wekala".length)}`; // wekala_x -> sila_x
      const value = ls.getItem(key);
      if (value !== null && ls.getItem(target) === null) ls.setItem(target, value);
      ls.removeItem(key);
    }
    // The guided walkthrough was removed; drop its "seen" flag so the key
    // doesn't linger in every existing user's browser forever.
    ls.removeItem("sila_walkthrough_seen");
  } catch {
    /* storage unavailable */
  }
  migrateLegacyTokens();
}
