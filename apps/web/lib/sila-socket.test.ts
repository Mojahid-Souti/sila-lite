import { type SilaSocketState, isTurnInFlight } from "@/lib/sila-socket";
import { describe, expect, it } from "vitest";

/**
 * The turn-finished signal. Gets its own test because getting it wrong is
 * invisible in types and lint, and costs the user the whole result: attachment
 * cards never render and the "Working…" heartbeat spins forever, so a
 * 14-second turn reads as a 15-minute hang.
 */
describe("isTurnInFlight", () => {
  it("is true only while SILA is thinking or speaking", () => {
    expect(isTurnInFlight("thinking")).toBe(true);
    expect(isTurnInFlight("speaking")).toBe(true);
  });

  it("treats `listening` as finished — it is how the server ENDS every turn", () => {
    // The regression: `state !== "idle"` looks equivalent and is not. The
    // server never sends `idle` once a socket is open, so that form reports a
    // finished turn as still running, forever.
    expect(isTurnInFlight("listening")).toBe(false);
  });

  it("treats the pre-connect `idle` as finished too", () => {
    expect(isTurnInFlight("idle")).toBe(false);
  });

  it("covers every state the socket can hold", () => {
    const all: SilaSocketState[] = ["idle", "listening", "thinking", "speaking"];
    // If a state is added, it must be classified deliberately rather than
    // falling through to "finished" by accident.
    expect(all.filter(isTurnInFlight)).toEqual(["thinking", "speaking"]);
  });
});
