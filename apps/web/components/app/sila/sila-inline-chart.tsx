"use client";

/**
 * An inline chart inside a chat reply, from a ```chart fenced block.
 *
 * SILA could already build real dashboards, but only through the dashboard tool
 * — inside a normal answer it had no way to show a figure, so it drew ASCII bar
 * charts in a code block ("Agent states .... |████ 8"). That is the thing a
 * chart component exists to prevent, and rendering the same numbers properly is
 * a visible difference from an assistant that can only emit text.
 *
 * The reader drives the view: the fence's `type` is a starting point, and the
 * segmented control moves between bar, line, area and pie without a round-trip
 * to the model. Long category names go to HORIZONTAL bars rather than the
 * rotated, clipped axis labels this had before — a category name is a full row,
 * not a diagonal fragment.
 *
 * Deliberately narrow: one series of {label, value} pairs. Anything needing
 * axes-per-series, live data or drill-down is a dashboard, and the dashboard
 * tool already does that.
 *
 * Complexity: O(n) over the points; the fence caps n at 40.
 */

import { CHART_VIEWS, type ChartView, type InlineChartSpec } from "@/lib/chart-spec";
import { cn } from "@/lib/utils";
import { Activity, ChartArea, ChartColumn, ChartPie } from "lucide-react";
import { type ReactElement, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/** Same family as the dashboard block, so a chart reads as Sila either way. */
const COLORS = ["#2563eb", "#f97316", "#10b981", "#8b5cf6", "#ef4444", "#0ea5e9", "#eab308"];

const VIEW_META: Record<ChartView, { icon: typeof ChartColumn; label: string }> = {
  bar: { icon: ChartColumn, label: "Bar" },
  line: { icon: Activity, label: "Line" },
  area: { icon: ChartArea, label: "Area" },
  pie: { icon: ChartPie, label: "Pie" },
};

/** A category name long enough that a vertical axis would clip or rotate it.
 *  Past this the bars lie down and each name gets its own row. */
const LONG_LABEL_CHARS = 11;
const CROWDED_CATEGORIES = 7;

const AXIS_TICK = { fontSize: 11, fill: "#94a3b8" } as const;

/** Category ticks collide and clip at the plot edges once a name is more than a
 *  word long. The legend chip and the tooltip carry the full name, so the tick
 *  only has to say which column you are looking at. */
const TICK_CHARS = 10;
const shortTick = (value: unknown) => {
  const text = String(value);
  return text.length > TICK_CHARS ? `${text.slice(0, TICK_CHARS - 1)}…` : text;
};
const VALUE_LABEL = { fontSize: 11, fill: "#475569", fontWeight: 600 } as const;

type Point = { label: string; value: number };

/** Frosted panel — the tooltip and the switcher share it so they read as one
 *  material rather than two lookalikes drifting apart. */
const GLASS = "border border-white/60 bg-white/70 shadow-lg backdrop-blur-xl backdrop-saturate-150";

function ShareTooltip({
  active,
  payload,
  total,
  colorOf,
}: {
  active?: boolean;
  payload?: { payload: Point; color?: string; fill?: string }[];
  total: number;
  // A <Cell>'s fill does not reach the tooltip payload, so the bar view would
  // show a colourless dot; the caller's map is the reliable source.
  colorOf: (label: string) => string;
}) {
  const entry = payload?.[0];
  if (!active || !entry) return null;
  const point = entry.payload;
  const share = total > 0 ? Math.round((point.value / total) * 100) : 0;
  return (
    <div className={cn("min-w-[9rem] rounded-2xl px-3 py-2.5", GLASS)}>
      <div className="flex items-center gap-2">
        <span
          className="size-2 shrink-0 rounded-full"
          style={{ background: entry.color ?? entry.fill ?? colorOf(point.label) }}
        />
        <span className="truncate font-medium text-[12px] text-neutral-500">{point.label}</span>
      </div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="font-semibold text-[20px] text-neutral-900 leading-none tabular-nums">
          {point.value.toLocaleString()}
        </span>
        <span className="text-[11px] text-neutral-400 tabular-nums">{share}%</span>
      </div>
    </div>
  );
}

/** The view switcher. A real segmented control: the active pill is opaque and
 *  raised, the rest is the frosted track. */
function ViewSwitcher({
  view,
  onChange,
}: {
  view: ChartView;
  onChange: (next: ChartView) => void;
}) {
  return (
    <div className={cn("flex items-center gap-0.5 rounded-full p-0.5", GLASS)}>
      {CHART_VIEWS.map((candidate) => {
        const { icon: Icon, label } = VIEW_META[candidate];
        const active = candidate === view;
        return (
          <button
            key={candidate}
            type="button"
            onClick={() => onChange(candidate)}
            aria-pressed={active}
            aria-label={`${label} view`}
            title={`${label} view`}
            className={cn(
              "grid size-7 place-items-center rounded-full transition-all",
              active
                ? "bg-white text-neutral-900 shadow-sm ring-1 ring-black/5"
                : "text-neutral-400 hover:bg-white/60 hover:text-neutral-600"
            )}
          >
            <Icon className="size-3.5" />
          </button>
        );
      })}
    </div>
  );
}

/** Colour-matched chips carrying the full name and the number. They are the
 *  legend AND the fix for unreadable axis labels: when a name is too long for
 *  the axis the chip still spells it out. Clicking one drops that category. */
function Legend({
  data,
  hidden,
  onToggle,
}: {
  data: Point[];
  hidden: Set<string>;
  onToggle: (label: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5 border-neutral-100 border-t bg-neutral-50/60 px-3 py-2.5">
      {data.map((point, i) => {
        const off = hidden.has(point.label);
        return (
          <button
            key={point.label}
            type="button"
            onClick={() => onToggle(point.label)}
            aria-pressed={!off}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-2 py-1 transition-all",
              off
                ? "border-neutral-200 bg-transparent opacity-45"
                : "border-black/5 bg-white shadow-sm hover:shadow"
            )}
          >
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ background: COLORS[i % COLORS.length] }}
            />
            <span className="max-w-[11rem] truncate text-[11px] text-neutral-600">
              {point.label}
            </span>
            <span className="font-semibold text-[11px] text-neutral-900 tabular-nums">
              {point.value.toLocaleString()}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function SilaInlineChart({ spec }: { spec: InlineChartSpec }) {
  const [view, setView] = useState<ChartView>(spec.type ?? "bar");
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());

  const shown = useMemo(
    () => spec.data.filter((point) => !hidden.has(point.label)),
    [spec.data, hidden]
  );
  const total = useMemo(() => shown.reduce((sum, point) => sum + point.value, 0), [shown]);

  // Colour follows the point's ORIGINAL index, so hiding a category never
  // recolours the ones still on screen.
  const colorOf = useMemo(() => {
    const byLabel = new Map(spec.data.map((p, i) => [p.label, COLORS[i % COLORS.length]]));
    return (label: string) => byLabel.get(label) ?? COLORS[0];
  }, [spec.data]);

  const toggle = (label: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      // Never let the reader empty the chart — the last visible chip stays on.
      if (next.has(label)) next.delete(label);
      else if (prev.size < spec.data.length - 1) next.add(label);
      return next;
    });

  const longest = shown.reduce((max, point) => Math.max(max, point.label.length), 0);
  const lieDown =
    view === "bar" && (longest > LONG_LABEL_CHARS || shown.length > CROWDED_CATEGORIES);
  const height = lieDown ? Math.max(180, shown.length * 38 + 16) : 232;
  const tooltip = (
    <Tooltip
      cursor={{ fill: "rgba(148,163,184,0.10)" }}
      content={<ShareTooltip total={total} colorOf={colorOf} />}
    />
  );

  return (
    <figure className="my-2 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <figcaption className="flex items-center justify-between gap-3 border-neutral-100 border-b bg-gradient-to-b from-neutral-50 to-white px-3.5 py-2.5">
        <span className="min-w-0">
          <span className="block truncate font-medium text-[12.5px] text-neutral-700">
            {spec.title || "Figures"}
          </span>
          <span className="block text-[11px] text-neutral-400 tabular-nums">
            {shown.length} {shown.length === 1 ? "category" : "categories"} · total{" "}
            {total.toLocaleString()}
          </span>
        </span>
        <ViewSwitcher view={view} onChange={setView} />
      </figcaption>

      <div className="w-full px-2 py-3" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          {view === "pie" ? (
            <PieChart margin={{ top: 16, right: 16, bottom: 16, left: 16 }}>
              {tooltip}
              <Pie
                data={shown}
                dataKey="value"
                nameKey="label"
                innerRadius="46%"
                outerRadius="68%"
                paddingAngle={2}
                stroke="#fff"
                strokeWidth={2}
                labelLine={false}
                label={(props: { percent?: number }) =>
                  `${Math.round((props.percent ?? 0) * 100)}%`
                }
              >
                {shown.map((point) => (
                  <Cell key={point.label} fill={colorOf(point.label)} />
                ))}
              </Pie>
            </PieChart>
          ) : view === "line" || view === "area" ? (
            <AreaOrLine view={view} data={shown} tooltip={tooltip} />
          ) : lieDown ? (
            <BarChart
              data={shown}
              layout="vertical"
              margin={{ top: 4, right: 44, bottom: 4, left: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="label"
                tick={AXIS_TICK}
                tickLine={false}
                axisLine={false}
                width={Math.min(172, longest * 6.6 + 14)}
              />
              {tooltip}
              <Bar
                dataKey="value"
                radius={[0, 6, 6, 0]}
                barSize={18}
                label={{ position: "right", ...VALUE_LABEL }}
              >
                {shown.map((point) => (
                  <Cell key={point.label} fill={colorOf(point.label)} />
                ))}
              </Bar>
            </BarChart>
          ) : (
            <BarChart data={shown} margin={{ top: 22, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="label"
                tick={AXIS_TICK}
                tickLine={false}
                axisLine={false}
                interval={0}
                tickFormatter={shortTick}
              />
              <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={40} />
              {tooltip}
              <Bar
                dataKey="value"
                radius={[6, 6, 0, 0]}
                maxBarSize={56}
                label={{ position: "top", ...VALUE_LABEL }}
              >
                {shown.map((point) => (
                  <Cell key={point.label} fill={colorOf(point.label)} />
                ))}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>

      <Legend data={spec.data} hidden={hidden} onToggle={toggle} />
    </figure>
  );
}

/** Line and area share every axis; only the mark differs. */
function AreaOrLine({
  view,
  data,
  tooltip,
}: {
  view: "line" | "area";
  data: Point[];
  tooltip: ReactElement;
}) {
  const axes = (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
      <XAxis
        dataKey="label"
        tick={AXIS_TICK}
        tickLine={false}
        axisLine={false}
        interval={0}
        tickFormatter={shortTick}
      />
      <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={40} />
      {tooltip}
    </>
  );
  const margin = { top: 22, right: 34, bottom: 0, left: 4 };
  if (view === "area") {
    return (
      <AreaChart data={data} margin={margin}>
        <defs>
          <linearGradient id="sila-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={COLORS[0]} stopOpacity={0.28} />
            <stop offset="100%" stopColor={COLORS[0]} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        {axes}
        <Area
          type="monotone"
          dataKey="value"
          stroke={COLORS[0]}
          strokeWidth={2}
          fill="url(#sila-area)"
          dot={{ r: 3, fill: "#fff", stroke: COLORS[0], strokeWidth: 2 }}
          label={{ position: "top", ...VALUE_LABEL }}
        />
      </AreaChart>
    );
  }
  return (
    <LineChart data={data} margin={margin}>
      {axes}
      <Line
        type="monotone"
        dataKey="value"
        stroke={COLORS[0]}
        strokeWidth={2}
        dot={{ r: 3, fill: "#fff", stroke: COLORS[0], strokeWidth: 2 }}
        activeDot={{ r: 5 }}
        label={{ position: "top", ...VALUE_LABEL }}
      />
    </LineChart>
  );
}
