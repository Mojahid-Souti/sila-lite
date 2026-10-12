"use client";

import Nango from "@nangohq/frontend";

// WS-9 — Nango Connect UI helper. The browser only ever holds a short-lived
// session token (minted server-side) and, on success, an opaque connectionId.
// A raw provider token NEVER reaches the browser — Nango keeps it encrypted.
//
// baseURL = the white-label Connect UI (served under our origin via the
// /nango-connect rewrite); apiURL = the Nango API the UI talks to. Both are
// public values, safe to expose.

const CONNECT_URL = process.env.NEXT_PUBLIC_NANGO_CONNECT_URL ?? "http://localhost:3009";
const API_URL = process.env.NEXT_PUBLIC_NANGO_API_URL ?? "http://localhost:3003";

export class ConnectCancelled extends Error {
  constructor() {
    super("Connection cancelled");
    this.name = "ConnectCancelled";
  }
}

/**
 * Open the Connect UI for a pre-minted session token and resolve with the new
 * connectionId once the user finishes authorizing. Rejects on error, and with
 * `ConnectCancelled` if the user closes the UI without connecting.
 */
export function runConnect(sessionToken: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    let settled = false;
    const nango = new Nango({ connectSessionToken: sessionToken });
    const ui = nango.openConnectUI({
      sessionToken,
      baseURL: CONNECT_URL,
      apiURL: API_URL,
      onEvent: (event) => {
        if (settled) return;
        if (event.type === "connect") {
          settled = true;
          resolve(event.payload.connectionId);
          ui.close();
        } else if (event.type === "error") {
          settled = true;
          reject(new Error(event.payload.errorMessage || "Connection failed"));
          ui.close();
        } else if (event.type === "close") {
          settled = true;
          reject(new ConnectCancelled());
        }
      },
    });
  });
}
