import { panelOpenAt } from "@/components/bazaar/skill-review-list";
import { describe, expect, it } from "vitest";

/** The review panel: open when a skill waits, otherwise closed; the viewer's choice wins. */
describe("panelOpenAt", () => {
  it("opens by itself only when something waits for review", () => {
    expect(panelOpenAt(null, "", false)).toBe(false);
    expect(panelOpenAt(null, "a", true)).toBe(true);
  });

  it("keeps the viewer's choice while the waiting set is the same", () => {
    expect(panelOpenAt({ open: false, waiting: "a" }, "a", true)).toBe(false);
    expect(panelOpenAt({ open: true, waiting: "" }, "", false)).toBe(true);
  });

  it("reopens when a new skill arrives for review", () => {
    expect(panelOpenAt({ open: false, waiting: "a" }, "a,b", true)).toBe(true);
  });
});
