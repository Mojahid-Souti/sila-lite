"use client";

/**
 * DEMO ONLY — the usage dashboard shown in the settings modal while recording.
 *
 * ============================================================================
 * TO REVERT: set DEMO_USAGE to false in lib/demo-flags.ts. That is the whole
 * change. The real panel (agent/member counts + jump links) comes straight
 * back, and nothing here runs.
 * ============================================================================
 *
 * The figures are INVENTED. Real agent names are used where the workspace has
 * them, because a cost table full of "Agent 1 / Agent 2" tells a viewer nothing
 * about the product — but the money beside them is not real.
 *
 * The metrics are the ones the Command Center is specified to track (runs,
 * token cost, hours saved, success rate, p95 latency, top agents), so the demo
 * shows the product's own roadmap rather than invented categories.
 */

import { cn } from "@/lib/utils";
import { useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/** Frosted panel — the same material as the chat's inline charts, so the two
 *  tooltips read as one system rather than two lookalikes drifting apart. */
const GLASS = "border border-white/60 bg-white/70 shadow-lg backdrop-blur-xl backdrop-saturate-150";

const AXIS = { fontSize: 11, fill: "#94a3b8" } as const;
const SERIES = ["#2D13EA", "#7C6CF5", "#22C7A9", "#FF7800", "#F2508F", "#0EA5E9", "#A855F7"];

function money(value: number): string {
  return `OMR ${value.toFixed(value < 10 ? 3 : 2)}`;
}

/** Thirty days of runs and spend. Deterministic — a demo that reshuffles on
 *  every re-render is a demo that cannot be narrated twice — and SCALED so the
 *  daily runs sum to exactly what the agent table totals. A panel adds up the
 *  table; a headline of 1,128 runs over a table summing to 565 is the kind of
 *  arithmetic that loses a room. `perRun` is the table's blended cost, so the
 *  spend tile reconciles too. */
function usageSeries(
  totalRuns: number,
  perRun: number
): { day: string; runs: number; cost: number }[] {
  const shape: number[] = [];
  for (let i = 29; i >= 0; i--) {
    const date = new Date(2026, 8, 13 - i);
    const weekday = date.getDay() !== 0 && date.getDay() !== 6;
    // A working-week rhythm with a steady climb, so the shape says something.
    const base = weekday ? 34 + (29 - i) * 1.1 : 9 + (29 - i) * 0.3;
    shape.push(Math.max(base + ((i * 37) % 11) - 5, 1));
  }
  const raw = shape.reduce((n, v) => n + v, 0);
  const out: { day: string; runs: number; cost: number }[] = [];
  let used = 0;
  shape.forEach((value, index) => {
    const date = new Date(2026, 8, 13 - (29 - index));
    // The last day absorbs the rounding remainder, so the column totals match.
    const runs =
      index === shape.length - 1 ? totalRuns - used : Math.round((value / raw) * totalRuns);
    used += runs;
    out.push({
      day: date.toLocaleDateString(undefined, { day: "numeric", month: "short" }),
      runs,
      cost: Math.round(runs * perRun * 100) / 100,
    });
  });
  return out;
}

/** The workspace's agents and the Bazaar templates, by name. Fixed rather than
 *  borrowed from the live agent list: the borrowed names arrived in load order
 *  and sat beside run counts that had nothing to do with them. */
const RUN_COSTS: { name: string; runs: number; per: number; p95: number; ok: number }[] = [
  { name: "Retention Pack", runs: 128, per: 0.043, p95: 34, ok: 0.98 },
  { name: "SmartQuote", runs: 164, per: 0.037, p95: 26, ok: 0.99 },
  { name: "OKR Reporting Pack", runs: 62, per: 0.096, p95: 58, ok: 0.97 },
  { name: "Data Analyst", runs: 96, per: 0.031, p95: 22, ok: 0.99 },
  { name: "Excavation Permit Assistant", runs: 74, per: 0.041, p95: 31, ok: 0.96 },
  { name: "Process Design Document", runs: 41, per: 0.128, p95: 71, ok: 0.95 },
];

/** Minutes a person would have spent producing one of these by hand — the
 *  Command Center's own hours-saved idea, stated rather than hidden in a sum. */
const MINUTES_SAVED: Record<string, number> = {
  Dashboards: 25,
  "Slide decks": 40,
  Documents: 55,
  Grafana: 15,
  "Emails sent": 6,
};

const BY_OUTPUT = [
  { name: "Dashboards", value: 214 },
  { name: "Slide decks", value: 96 },
  { name: "Documents", value: 74 },
  { name: "Grafana", value: 61 },
  { name: "Emails sent", value: 143 },
];

const CONNECTOR_KEYS = ["Outlook", "Microsoft Teams", "Google Sheets", "Grafana", "Power BI"];

/** How each deliverable's runs split — by the agent that produced it, and by
 *  the connector it went through. Fixed weights per row, so the stacks are
 *  deterministic and every column still sums to the total above it. */
const SPLIT_BY_AGENT: Record<string, number[]> = {
  Dashboards: [0.32, 0.06, 0.24, 0.3, 0.04, 0.04],
  "Slide decks": [0.26, 0.08, 0.34, 0.22, 0.05, 0.05],
  Documents: [0.06, 0.34, 0.08, 0.05, 0.22, 0.25],
  Grafana: [0.38, 0.05, 0.32, 0.18, 0.04, 0.03],
  "Emails sent": [0.24, 0.3, 0.16, 0.05, 0.17, 0.08],
};
const SPLIT_BY_CONNECTOR: Record<string, number[]> = {
  Dashboards: [0.3, 0.2, 0.4, 0.05, 0.05],
  "Slide decks": [0.4, 0.3, 0.2, 0.05, 0.05],
  Documents: [0.45, 0.4, 0.1, 0.03, 0.02],
  Grafana: [0.1, 0.05, 0.15, 0.65, 0.05],
  "Emails sent": [0.85, 0.1, 0.03, 0.01, 0.01],
};

/** Deliverables as stacked rows: each bar is one output type, segmented by
 *  whoever produced it. Stacking MEANS something here — the parts are runs of
 *  the same thing and they sum to the column total. */
function stackedOutputs(keys: string[], split: Record<string, number[]>) {
  return BY_OUTPUT.map((o) => {
    const row: Record<string, string | number> = { name: o.name, total: o.value };
    const weights = split[o.name] ?? [];
    let used = 0;
    keys.forEach((key, i) => {
      // The last slice takes the remainder, so rounding never loses a run.
      const value =
        i === keys.length - 1 ? o.value - used : Math.round(o.value * (weights[i] ?? 0));
      used += value;
      row[key] = Math.max(value, 0);
    });
    return row;
  });
}

/** A name long enough to wrap a chart axis onto three lines. The full name is
 *  in the tooltip; the axis keeps one line so the bars stay aligned. */
function short(name: string, max = 18): string {
  return name.length <= max ? name : `${name.slice(0, max - 1).trimEnd()}…`;
}

function GlassTip({ title, lines, swatch }: { title: string; lines: string[]; swatch?: string }) {
  return (
    <div className={cn("min-w-[10rem] max-w-[15rem] rounded-2xl px-3 py-2.5", GLASS)}>
      <div className="flex items-center gap-2">
        {swatch && <span className="size-2 shrink-0 rounded-full" style={{ background: swatch }} />}
        <span className="min-w-0 font-medium text-[11.5px] text-neutral-500">{title}</span>
      </div>
      {lines.map((line, i) => (
        <p
          key={line}
          className={
            i === 0
              ? "mt-1 font-semibold text-[19px] text-neutral-900 leading-none tabular-nums"
              : "mt-1 text-[11px] text-neutral-400 tabular-nums"
          }
        >
          {line}
        </p>
      ))}
    </div>
  );
}

type TipProps = {
  active?: boolean;
  payload?: {
    value?: number;
    name?: string;
    color?: string;
    fill?: string;
    payload?: Record<string, unknown>;
  }[];
  label?: string;
};

function UsageTip({ active, payload, label }: TipProps) {
  const entry = payload?.[0];
  if (!active || !entry) return null;
  const row = (entry.payload ?? {}) as { cost?: number };
  return (
    <GlassTip
      title={String(label ?? "")}
      swatch={SERIES[0]}
      lines={[`${entry.value} runs`, `${money(row.cost ?? 0)} spent`]}
    />
  );
}

function ShareTip({ active, payload }: TipProps) {
  const entry = payload?.[0];
  if (!active || !entry) return null;
  const row = (entry.payload ?? {}) as { name?: string; cost?: number; share?: number };
  return (
    <GlassTip
      title={String(row.name ?? "")}
      swatch={entry.color ?? entry.fill}
      lines={[money(row.cost ?? 0), `${row.share ?? 0}% of spend`]}
    />
  );
}

function StackTip({ active, payload, label }: TipProps) {
  if (!active || !payload?.length) return null;
  const parts = payload.filter((p) => Number(p.value ?? 0) > 0);
  const total = parts.reduce((n, p) => n + Number(p.value ?? 0), 0);
  return (
    <div className={cn("min-w-[12rem] max-w-[17rem] rounded-2xl px-3 py-2.5", GLASS)}>
      <p className="font-medium text-[11.5px] text-neutral-500">{String(label ?? "")}</p>
      <p className="mt-1 font-semibold text-[19px] text-neutral-900 leading-none tabular-nums">
        {total} runs
      </p>
      <ul className="mt-2 space-y-1">
        {parts.map((part) => (
          <li key={String(part.name)} className="flex items-center gap-2 text-[11.5px]">
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ background: part.color ?? part.fill }}
            />
            <span className="min-w-0 flex-1 truncate text-neutral-600">{String(part.name)}</span>
            <span className="shrink-0 text-neutral-500 tabular-nums">{part.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * One KPI tile. The unit is its own small, muted run beside the figure — as
 * part of the same 20px text "OMR 47.36" wrapped onto two lines and threw the
 * tile out of step with its neighbours. The figure never wraps; it steps down
 * a size on a narrow screen instead.
 */
function Kpi({
  label,
  value,
  sub,
  unit,
  unitAfter = false,
}: {
  label: string;
  value: string;
  sub: string;
  unit?: string;
  /** "251 h" reads unit-last; "OMR 47.36" reads unit-first. */
  unitAfter?: boolean;
}) {
  const mark = unit ? (
    <span className="font-medium text-[12px] text-neutral-400">{unit}</span>
  ) : null;
  return (
    <div className="min-w-0 rounded-xl border border-neutral-200 bg-white p-3">
      <p className="truncate text-[10.5px] text-neutral-400 uppercase tracking-wider">{label}</p>
      <p className="mt-1.5 flex items-baseline gap-1 whitespace-nowrap leading-none">
        {!unitAfter && mark}
        <span className="font-semibold text-[17px] text-neutral-900 tabular-nums sm:text-[20px]">
          {value}
        </span>
        {unitAfter && mark}
      </p>
      <p className="mt-1.5 truncate text-[11.5px] text-neutral-500">{sub}</p>
    </div>
  );
}

function Panel({
  title,
  note,
  className,
  children,
}: {
  title: string;
  /** A string, or a control — the deliverables panel puts its toggle here. */
  note?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("rounded-xl border border-neutral-200 bg-white p-3.5", className)}>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h3 className="font-medium text-[12.5px] text-neutral-700">{title}</h3>
        {note && <span className="shrink-0 text-[11px] text-neutral-400">{note}</span>}
      </div>
      {children}
    </section>
  );
}

export function UsageDemoPanel() {
  const [breakdown, setBreakdown] = useState<"agent" | "connector">("agent");
  const rows = RUN_COSTS.map((r) => ({
    ...r,
    cost: Math.round(r.runs * r.per * 100) / 100,
  })).sort((a, b) => b.cost - a.cost);
  const spend = rows.reduce((n, r) => n + r.cost, 0);
  // Every headline is derived from the same table the reader can add up.
  const totalRuns = rows.reduce((n, r) => n + r.runs, 0);
  const perRun = spend / Math.max(totalRuns, 1);
  const series = usageSeries(totalRuns, perRun);
  const totalCost = spend;
  const share = rows.map((r) => ({ ...r, share: Math.round((r.cost / spend) * 100) }));
  const weightedOk =
    rows.reduce((n, r) => n + r.ok * r.runs, 0) / rows.reduce((n, r) => n + r.runs, 0);
  // Hours saved: the Command Center's own idea — minutes a person would have
  // spent on each run, by the shape of the output.
  const hoursSaved = Math.round(
    BY_OUTPUT.reduce((n, o) => n + o.value * (MINUTES_SAVED[o.name] ?? 10), 0) / 60
  );
  const stackKeys = breakdown === "agent" ? rows.map((r) => r.name) : CONNECTOR_KEYS;
  const stackSplit = breakdown === "agent" ? SPLIT_BY_AGENT : SPLIT_BY_CONNECTOR;

  return (
    <div className="min-w-0 space-y-4">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi label="Runs" value={totalRuns.toLocaleString()} sub="Last 30 days" />
        <Kpi label="Spend" unit="OMR" value={totalCost.toFixed(2)} sub="Across all agents" />
        <Kpi
          label="Cost per run"
          unit="OMR"
          value={(totalCost / Math.max(totalRuns, 1)).toFixed(3)}
          sub="Blended"
        />
        <Kpi
          label="Hours saved"
          value={hoursSaved.toLocaleString()}
          unit="h"
          unitAfter
          sub="Versus by hand"
        />
        <Kpi
          label="Success rate"
          value={(weightedOk * 100).toFixed(1)}
          unit="%"
          unitAfter
          sub="Runs completed"
        />
        <Kpi label="Active agents" value={String(rows.length)} sub="Ran at least once" />
      </div>

      <Panel title="Usage over time" note="Runs per day · last 30 days">
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 6, right: 6, bottom: 0, left: -18 }}>
              <defs>
                <linearGradient id="usageFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={SERIES[0]} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={SERIES[0]} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="day" tick={AXIS} tickLine={false} axisLine={false} interval={6} />
              <YAxis tick={AXIS} tickLine={false} axisLine={false} width={44} />
              <Tooltip cursor={{ stroke: "#cbd5e1", strokeDasharray: 4 }} content={<UsageTip />} />
              {/* No entry animation. The path animates to whatever width the
                  container reported at mount and keeps that `d` when the
                  container settles wider — the axis spanned 30 days while the
                  area stopped two-thirds across. It also means the charts are
                  fully drawn the instant the modal opens, which is what a
                  recording wants. */}
              <Area
                type="monotone"
                dataKey="runs"
                stroke={SERIES[0]}
                strokeWidth={2}
                fill="url(#usageFill)"
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
        {/* A donut, not bars: agent names run long ("Daily Education Summary
            (from Bazaar)") and wrapped a category axis onto three lines, which
            threw the bars out of alignment. A legend holds a long name on one
            row, and share of spend is the question this chart answers. */}
        <Panel title="Share of spend" note="By agent">
          <div className="flex flex-col items-center gap-3 sm:flex-row">
            <div className="h-36 w-36 shrink-0 sm:h-40 sm:w-40">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={share}
                    dataKey="cost"
                    nameKey="name"
                    innerRadius="58%"
                    outerRadius="88%"
                    paddingAngle={2}
                    stroke="none"
                    isAnimationActive={false}
                  >
                    {share.map((r, i) => (
                      <Cell key={r.name} fill={SERIES[i % SERIES.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<ShareTip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            {/* The name gets a floor. With every column flexible it collapsed
                to zero at the modal's width and the legend showed figures with
                nothing to attach them to. */}
            {/* Two lines per row. On one line the name, the amount and the
                share competed for the same space and the name lost — the
                legend showed "OMI…" against a colour with nothing to name it.
                The name owns the first line; the figures sit under it. */}
            <ul className="w-full min-w-0 flex-1 space-y-2">
              {share.map((r, i) => (
                <li key={r.name} className="flex items-start gap-2 text-[12px]">
                  <span
                    className="mt-1.5 size-2 shrink-0 rounded-full"
                    style={{ background: SERIES[i % SERIES.length] }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-neutral-700" title={r.name}>
                      {r.name}
                    </span>
                    <span className="block text-[11px] text-neutral-400 tabular-nums">
                      {money(r.cost)} · {r.share}%
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Panel>

        {/* Stacked, because the parts are runs of the SAME thing and sum to the
            column total — the one shape where stacking says something. The
            toggle swaps the breakdown between who produced it and what it went
            through, which is what the separate connectors panel used to show.
            Columns, one per output type. The earlier vertical attempt lost
            three of five bars to the Cell-inside-Bar fragility this codebase
            has hit before; a stack is one <Bar> per series with no Cells at
            all, so that failure cannot recur here. */}
        <Panel
          title="What it produced"
          note={
            <span className="inline-flex overflow-hidden rounded-lg border border-neutral-200">
              {(["agent", "connector"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setBreakdown(mode)}
                  className={cn(
                    "px-2 py-0.5 text-[11px] capitalize transition-colors",
                    breakdown === mode
                      ? "bg-neutral-900 text-white"
                      : "bg-white text-neutral-500 hover:bg-neutral-50"
                  )}
                >
                  By {mode}
                </button>
              ))}
            </span>
          }
        >
          <div className="h-44 min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={stackedOutputs(stackKeys, stackSplit)}
                margin={{ top: 4, right: 6, bottom: 0, left: -18 }}
              >
                <CartesianGrid stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="name" tick={AXIS} tickLine={false} axisLine={false} />
                <YAxis tick={AXIS} tickLine={false} axisLine={false} width={44} />
                <Tooltip cursor={{ fill: "#f8fafc" }} content={<StackTip />} />
                {stackKeys.map((key, i) => (
                  <Bar
                    key={key}
                    dataKey={key}
                    stackId="runs"
                    fill={SERIES[i % SERIES.length]}
                    maxBarSize={54}
                    isAnimationActive={false}
                    radius={i === stackKeys.length - 1 ? [5, 5, 0, 0] : undefined}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
            {stackKeys.map((key, i) => (
              <li key={key} className="flex min-w-0 items-center gap-1.5 text-[11px]">
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ background: SERIES[i % SERIES.length] }}
                />
                <span className="truncate text-neutral-500">{short(key, 22)}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel title="Run cost breakdown" note="Ordered by spend">
        <div className="-mx-1 overflow-x-auto px-1">
          <table className="w-full min-w-[34rem] border-collapse text-[12.5px]">
            <thead>
              <tr className="border-neutral-200 border-b text-left text-[11px] text-neutral-400 uppercase tracking-wider">
                <th className="py-1.5 pr-3 font-medium">Agent</th>
                <th className="py-1.5 pr-3 text-right font-medium">Runs</th>
                <th className="py-1.5 pr-3 text-right font-medium">p95</th>
                <th className="py-1.5 pr-3 text-right font-medium">OK</th>
                <th className="py-1.5 pr-3 text-right font-medium">Per run</th>
                <th className="py-1.5 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.name} className="border-neutral-100 border-b last:border-0">
                  <td className="py-1.5 pr-3">
                    <span className="flex items-center gap-2">
                      <span
                        className="size-2 shrink-0 rounded-full"
                        style={{ background: SERIES[i % SERIES.length] }}
                      />
                      <span className="truncate text-neutral-800" title={r.name}>
                        {short(r.name, 34)}
                      </span>
                    </span>
                  </td>
                  <td className="py-1.5 pr-3 text-right text-neutral-600 tabular-nums">{r.runs}</td>
                  <td className="py-1.5 pr-3 text-right text-neutral-600 tabular-nums">{r.p95}s</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">
                    <span className={r.ok >= 0.97 ? "text-emerald-600" : "text-amber-600"}>
                      {Math.round(r.ok * 100)}%
                    </span>
                  </td>
                  <td className="py-1.5 pr-3 text-right text-neutral-600 tabular-nums">
                    {money(r.per)}
                  </td>
                  <td className="py-1.5 text-right font-medium text-neutral-900 tabular-nums">
                    {money(r.cost)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
