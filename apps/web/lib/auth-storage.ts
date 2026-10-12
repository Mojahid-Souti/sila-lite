// Auth tokens live under SILA-namespaced keys. The generic "access_token" /
// "refresh_token" names were collision-prone and an obvious target for token-scanning
// scripts — especially since the embedded n8n editor runs same-origin and shares this
// localStorage. We read the legacy keys as a fallback and migrate them away on load
// (see migrateLegacyTokens + lib/storage-cleanup), so no one gets logged out.
const ACCESS_KEY = "sila_access_token";
const REFRESH_KEY = "sila_refresh_token";
const REMEMBER_KEY = "sila_remember_me";

const LEGACY_ACCESS = "access_token";
const LEGACY_REFRESH = "refresh_token";

function safeWindow(): Window | null {
  return typeof window === "undefined" ? null : window;
}

function read(w: Window, key: string, legacy: string): string {
  return (
    w.localStorage.getItem(key) ??
    w.sessionStorage.getItem(key) ??
    w.localStorage.getItem(legacy) ??
    w.sessionStorage.getItem(legacy) ??
    ""
  );
}

export function getToken(): string {
  const w = safeWindow();
  return w ? read(w, ACCESS_KEY, LEGACY_ACCESS) : "";
}

export function getRefreshToken(): string {
  const w = safeWindow();
  return w ? read(w, REFRESH_KEY, LEGACY_REFRESH) : "";
}

export function setTokens(
  access: string,
  refresh: string | undefined,
  options: { remember: boolean }
): void {
  const w = safeWindow();
  if (!w) return;
  const store = options.remember ? w.localStorage : w.sessionStorage;
  const other = options.remember ? w.sessionStorage : w.localStorage;
  store.setItem(ACCESS_KEY, access);
  if (refresh) store.setItem(REFRESH_KEY, refresh);
  other.removeItem(ACCESS_KEY);
  other.removeItem(REFRESH_KEY);
  if (options.remember) {
    w.localStorage.setItem(REMEMBER_KEY, "1");
  } else {
    w.localStorage.removeItem(REMEMBER_KEY);
  }
}

export function clearTokens(): void {
  const w = safeWindow();
  if (!w) return;
  for (const k of [ACCESS_KEY, REFRESH_KEY, LEGACY_ACCESS, LEGACY_REFRESH]) {
    w.sessionStorage.removeItem(k);
    w.localStorage.removeItem(k);
  }
  w.localStorage.removeItem(REMEMBER_KEY);
}

/** Move tokens off the legacy un-namespaced keys onto the SILA keys, then drop the
 *  legacy ones. Idempotent; safe to run on every load. */
export function migrateLegacyTokens(): void {
  const w = safeWindow();
  if (!w) return;
  const pairs: [string, string][] = [
    [LEGACY_ACCESS, ACCESS_KEY],
    [LEGACY_REFRESH, REFRESH_KEY],
  ];
  for (const store of [w.localStorage, w.sessionStorage]) {
    for (const [legacy, next] of pairs) {
      const value = store.getItem(legacy);
      if (value === null) continue;
      if (store.getItem(next) === null) store.setItem(next, value);
      store.removeItem(legacy);
    }
  }
}

export function rememberMePreferred(): boolean {
  const w = safeWindow();
  if (!w) return false;
  return w.localStorage.getItem(REMEMBER_KEY) === "1";
}
