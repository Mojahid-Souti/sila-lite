/** The ```chart fence's data contract, and its parser.

Kept out of the component so it is a pure function with no JSX — testable on its
own, and the renderer imports it rather than owning it.
*/

const MAX_POINTS = 40;

/** The views the switcher offers. The fence only ever *asks* for one of these;
 *  the reader can move between them, so the model's choice is a starting point
 *  rather than a verdict on how the numbers are best seen. */
export const CHART_VIEWS = ["bar", "line", "area", "pie"] as const;
export type ChartView = (typeof CHART_VIEWS)[number];

export type InlineChartSpec = {
  type?: ChartView;
  title?: string;
  data: { label: string; value: number }[];
};

function asView(value: unknown): ChartView | null {
  return CHART_VIEWS.includes(value as ChartView) ? (value as ChartView) : null;
}

/** Parse a ```chart fence. Returns null on anything malformed — a bad block
 *  must fall back to showing the raw text, never break the message. */
export function parseChartSpec(raw: string): InlineChartSpec | null {
  try {
    const parsed = JSON.parse(raw);
    const rows = Array.isArray(parsed) ? parsed : parsed?.data;
    if (!Array.isArray(rows) || rows.length === 0) return null;
    const data = rows
      .map((r) => ({
        label: String(r?.label ?? r?.name ?? "").slice(0, 40),
        value: Number(r?.value),
      }))
      .filter((r) => r.label && Number.isFinite(r.value))
      .slice(0, MAX_POINTS);
    if (data.length === 0) return null;
    return {
      type: (Array.isArray(parsed) ? null : asView(parsed?.type)) ?? "bar",
      title: Array.isArray(parsed) ? undefined : String(parsed?.title ?? "").slice(0, 120),
      data,
    };
  } catch {
    return null;
  }
}
