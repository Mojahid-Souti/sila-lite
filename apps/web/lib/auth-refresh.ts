// Silent JWT refresh. The access token is short-lived (1h, a security control
// we keep), but a real session should last as long as the user is active — so
// the client refreshes the access token a couple of minutes before it expires,
// exactly what the refresh token is for. This is how a session survives for
// hours without ever holding a long-lived access token.
//
// One-way dependencies (no cycle): this module talks to storage + the refresh
// endpoint directly via fetch; api.ts imports refreshTokens() for its 401 path.
import { getRefreshToken, getToken, rememberMePreferred, setTokens } from "./auth-storage";
import { API_URL } from "./constants";

const REFRESH_LEAD_MS = 120_000; // refresh this long before expiry
const MIN_DELAY_MS = 5_000; // never schedule a tighter loop than this
export const TOKEN_REFRESHED_EVENT = "sila:token-refreshed";

let timer: ReturnType<typeof setTimeout> | null = null;
let inFlight: Promise<string | null> | null = null;

/** Milliseconds until the token's `exp`, or null if it can't be read. */
export function msUntilExpiry(token: string): number | null {
  const payload = token.split(".")[1];
  if (!payload) return null;
  try {
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const exp = JSON.parse(json).exp;
    if (typeof exp !== "number") return null;
    return exp * 1000 - Date.now();
  } catch {
    return null; // opaque/garbled token — the 401 path will handle it
  }
}

/**
 * Exchange the refresh token for a fresh pair. Concurrent callers share one
 * in-flight request (a scheduled refresh and a racing 401 must not both fire).
 * Returns the new access token, or null if refresh failed (caller logs out).
 */
export function refreshTokens(): Promise<string | null> {
  if (inFlight) return inFlight;
  const refresh = getRefreshToken();
  if (!refresh) return Promise.resolve(null);

  inFlight = (async () => {
    try {
      const res = await fetch(`${API_URL}/v1/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refresh }),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { access_token: string; refresh_token: string };
      if (!data.access_token) return null;
      setTokens(data.access_token, data.refresh_token, { remember: rememberMePreferred() });
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event(TOKEN_REFRESHED_EVENT));
      }
      scheduleRefresh(); // chain the next one off the new token
      return data.access_token;
    } catch {
      return null; // network blip — the token is still valid until it expires
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

/** (Re)arm the timer to refresh shortly before the current token expires. */
export function scheduleRefresh(): void {
  if (typeof window === "undefined") return;
  if (timer) clearTimeout(timer);
  timer = null;
  const token = getToken();
  if (!token) return;
  const remaining = msUntilExpiry(token);
  if (remaining === null) return;
  const delay = Math.max(MIN_DELAY_MS, remaining - REFRESH_LEAD_MS);
  timer = setTimeout(() => {
    void refreshTokens();
  }, delay);
}

function onVisible(): void {
  if (document.visibilityState !== "visible") return;
  const token = getToken();
  if (!token) return;
  const remaining = msUntilExpiry(token);
  if (remaining !== null && remaining < REFRESH_LEAD_MS) {
    void refreshTokens(); // a throttled background timer may have missed it
  }
}

/** Start silent refresh for the current session. Idempotent. */
export function startAuthRefresh(): void {
  if (typeof window === "undefined") return;
  document.removeEventListener("visibilitychange", onVisible);
  document.addEventListener("visibilitychange", onVisible);
  scheduleRefresh();
}

/** Stop refreshing (on logout). */
export function stopAuthRefresh(): void {
  if (typeof window === "undefined") return;
  if (timer) clearTimeout(timer);
  timer = null;
  document.removeEventListener("visibilitychange", onVisible);
}
