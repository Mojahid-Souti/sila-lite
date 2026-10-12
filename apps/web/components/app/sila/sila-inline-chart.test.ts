import { CHART_VIEWS, parseChartSpec } from "@/lib/chart-spec";
import { describe, expect, it } from "vitest";

describe("parseChartSpec", () => {
  it("accepts the documented object form", () => {
    const spec = parseChartSpec(
      '{"type":"bar","title":"Agent states","data":[{"label":"Draft","value":8}]}'
    );
    expect(spec?.type).toBe("bar");
    expect(spec?.title).toBe("Agent states");
    expect(spec?.data).toEqual([{ label: "Draft", value: 8 }]);
  });

  it("accepts a bare array and defaults to a bar chart", () => {
    const spec = parseChartSpec('[{"label":"A","value":1},{"name":"B","value":2}]');
    expect(spec?.type).toBe("bar");
    expect(spec?.data.map((d) => d.label)).toEqual(["A", "B"]);
  });

  it("returns null on anything malformed so the raw block still shows", () => {
    // A broken chart must never blank out the message it sits in.
    expect(parseChartSpec("not json")).toBeNull();
    expect(parseChartSpec("{}")).toBeNull();
    expect(parseChartSpec('{"data":[]}')).toBeNull();
    expect(parseChartSpec('{"data":[{"label":"A","value":"x"}]}')).toBeNull();
  });

  it("drops unusable rows but keeps the usable ones", () => {
    const spec = parseChartSpec('{"data":[{"label":"A","value":1},{"label":"","value":2}]}');
    expect(spec?.data).toEqual([{ label: "A", value: 1 }]);
  });

  it("caps the point count so one reply cannot paste a whole table", () => {
    const many = Array.from({ length: 90 }, (_, i) => ({ label: `L${i}`, value: i }));
    expect(parseChartSpec(JSON.stringify({ data: many }))?.data).toHaveLength(40);
  });

  it("accepts every view the switcher offers", () => {
    // The fence's type only picks the STARTING view; the reader can move
    // between all four, so each has to survive the parse.
    for (const view of CHART_VIEWS) {
      const spec = parseChartSpec(`{"type":"${view}","data":[{"label":"A","value":1}]}`);
      expect(spec?.type).toBe(view);
    }
  });

  it("falls back to a bar chart on an unknown view", () => {
    expect(parseChartSpec('{"type":"sankey","data":[{"label":"A","value":1}]}')?.type).toBe("bar");
  });
});
