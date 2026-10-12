"use client";

import { useEffect, useState } from "react";
import { TOKEN_REFRESHED_EVENT } from "./auth-refresh";
import { getToken } from "./auth-storage";

/**
 * The current access token, kept in sync with storage. Re-reads when the silent
 * refresh swaps the token (TOKEN_REFRESHED_EVENT) and when another tab changes
 * it (storage event) — so anything keyed on the token (e.g. the SILA WebSocket)
 * reconnects with the fresh one instead of dying at expiry.
 */
export function useToken(): string {
  const [token, setToken] = useState("");
  useEffect(() => {
    const sync = () => setToken(getToken());
    sync();
    window.addEventListener(TOKEN_REFRESHED_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(TOKEN_REFRESHED_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return token;
}
