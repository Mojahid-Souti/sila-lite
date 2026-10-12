import { relativeTime } from "@/lib/relative-time";
import { describe, expect, it } from "vitest";

describe("relativeTime", () => {
  const now = Date.parse("2026-09-28T12:00:00Z");
  it("reads as elapsed time while that is useful", () => {
    expect(relativeTime("2026-09-28T11:59:40Z", now)).toBe("just now");
    expect(relativeTime("2026-09-28T11:59:00Z", now)).toBe("1 minute ago");
    expect(relativeTime("2026-09-28T09:00:00Z", now)).toBe("3 hours ago");
    expect(relativeTime("2026-09-26T12:00:00Z", now)).toBe("2 days ago");
  });
  it("is empty for a date it cannot read", () => {
    expect(relativeTime("not a date", now)).toBe("");
  });
});
