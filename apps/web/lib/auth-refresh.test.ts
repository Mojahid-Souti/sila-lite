import { describe, expect, it } from "vitest";
import { msUntilExpiry } from "./auth-refresh";

function jwtWithExp(expSeconds: number): string {
  const payload = btoa(JSON.stringify({ exp: expSeconds }))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `header.${payload}.sig`;
}

describe("msUntilExpiry", () => {
  it("returns time remaining for a valid token", () => {
    const remaining = msUntilExpiry(jwtWithExp(Math.floor(Date.now() / 1000) + 3600));
    expect(remaining).not.toBeNull();
    expect(remaining as number).toBeGreaterThan(3_500_000);
    expect(remaining as number).toBeLessThanOrEqual(3_600_000);
  });

  it("is negative for an already-expired token", () => {
    const remaining = msUntilExpiry(jwtWithExp(Math.floor(Date.now() / 1000) - 60));
    expect(remaining as number).toBeLessThan(0);
  });

  it("returns null for a garbled token", () => {
    expect(msUntilExpiry("not-a-jwt")).toBeNull();
    expect(msUntilExpiry("")).toBeNull();
  });

  it("returns null when the payload has no exp claim", () => {
    const payload = btoa(JSON.stringify({ sub: "u1" })).replace(/=+$/, "");
    expect(msUntilExpiry(`h.${payload}.s`)).toBeNull();
  });
});
