// Mints a per-user studio session (sets the HttpOnly auth cookie) before the
// embedded studio iframe loads. Shared by the Build and Workflows pages so a
// single in-flight request is reused (the backend login is rate-limited).
"use client";

import { getToken } from "@/lib/auth-storage";
import { useCallback, useEffect, useState } from "react";

export type StudioSessionState = "minting" | "ready" | "error";

// Module-scoped Promise cache: React 19 StrictMode and rapid remounts can fire
// the mint multiple times before the cookie is set. Share one in-flight request.
let inFlightMint: Promise<Response> | null = null;
async function sharedMintRequest(token: string): Promise<Response> {
  if (inFlightMint) return inFlightMint;
  inFlightMint = fetch("/api/n8n-session", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  }).finally(() => {
    setTimeout(() => {
      inFlightMint = null;
    }, 2000);
  });
  return inFlightMint;
}

const MINT_ATTEMPTS = 3;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function useStudioSession(): {
  state: StudioSessionState;
  error: string | null;
  retry: () => void;
} {
  const [state, setState] = useState<StudioSessionState>("minting");
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0); // bump to re-run the mint

  // `attempt` is the manual-retry trigger — bumping it re-runs the mint.
  // biome-ignore lint/correctness/useExhaustiveDependencies: attempt is an intentional re-run signal
  useEffect(() => {
    let cancelled = false;
    async function mint() {
      const token = getToken();
      if (!token) {
        if (!cancelled) {
          setState("error");
          setError("You are not signed in.");
        }
        return;
      }
      // A transient network hiccup (dev-server reload, API restart) shows up as
      // "Failed to fetch" — retry with backoff before declaring the view dead.
      let lastError = "";
      for (let i = 0; i < MINT_ATTEMPTS && !cancelled; i++) {
        try {
          const res = await sharedMintRequest(token);
          if (!res.ok) {
            const body = await res.clone().text();
            throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
          }
          if (!cancelled) setState("ready");
          return;
        } catch (err) {
          lastError = err instanceof Error ? err.message : String(err);
          if (i < MINT_ATTEMPTS - 1) await sleep(800 * 2 ** i);
        }
      }
      if (!cancelled) {
        setState("error");
        setError(lastError);
      }
    }
    setState("minting");
    setError(null);
    void mint();
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  return {
    state,
    error,
    retry: useCallback(() => setAttempt((a) => a + 1), []),
  };
}
