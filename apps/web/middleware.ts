import { type NextRequest, NextResponse } from "next/server";

/**
 * Read-only boundary for the embedded n8n editor (#7, re-opening WS-4).
 *
 * SILA shows the user the REAL n8n canvas for a built workflow, loaded through the
 * /n8n proxy with the user's own n8n cookie. n8n itself would happily let the owner
 * edit / execute / publish — so we make it read-only HERE, server-side, by
 * default-denying every mutation and execution. This (NOT the hidden CSS chrome in
 * the viewer) is the security boundary: even a hand-crafted `fetch()` from devtools
 * is refused. Every n8n write/execute/activate is a non-GET REST call, so a single
 * "reads only" rule closes save, create, update, delete, run, activate, and
 * credential writes at once. Webhook paths are denied outright (a GET to a webhook
 * could trigger a run); the workflows we build are inactive anyway.
 */

const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function forbidden(method: string, pathname: string): NextResponse {
  console.warn(`[n8n-readonly] blocked ${method} ${pathname}`);
  return new NextResponse(
    JSON.stringify({ error: "read_only", message: "This workflow view is read-only." }),
    { status: 403, headers: { "content-type": "application/json" } }
  );
}

export function middleware(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl;
  const method = req.method.toUpperCase();

  // Webhook execution vector — refuse regardless of method.
  if (pathname.includes("/webhook")) {
    return forbidden(method, pathname);
  }
  // Everything else under /n8n: reads only. Any write/execute/activate is non-GET.
  if (!READ_METHODS.has(method)) {
    return forbidden(method, pathname);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/n8n/:path*"] };
