"use client";

import type { SilaChart, SilaDashboard } from "@/lib/sila-socket";
import { cn } from "@/lib/utils";
import { BarChart3, Search } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/**
 * In-Sila data dashboard — charts built server-side from an uploaded file,
 * rendered inline in the trace with Recharts (the data never leaves the box).
 * Styled like a compact analytics artifact: a dense KPI strip, a 2-col chart
 * grid, and a SEARCHABLE data table. On wide screens the block breaks out of
 * the chat column to the right (the timeline rail pins its left edge).
 */

// A calm categorical palette (neutral-forward, brand-adjacent).
const COLORS = ["#0ea5e9", "#8b5cf6", "#f59e0b", "#10b981", "#ef4444", "#64748b"];

// Big values compact to "10.91B" (full number on hover) so a 13-digit stat or
// axis tick can never spill; small ones keep at most 2 decimals.
function fmtCompact(value: number): string {
  if (Math.abs(value) >= 100_000) {
    return new Intl.NumberFormat("en", {
      notation: "compact",
      maximumFractionDigits: 2,
    }).format(value);
  }
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function fmtCell(raw: unknown): string {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (raw !== "" && raw !== null && Number.isFinite(n)) return fmtCompact(n);
  return String(raw ?? "");
}

const tickFmt = (v: number | string) => (typeof v === "number" ? fmtCompact(v) : String(v));

function StatCard({ chart }: { chart: SilaChart }) {
  const numeric = typeof chart.value === "number";
  return (
    <div className="flex min-w-0 flex-col rounded-lg border border-neutral-200 bg-white px-3 py-2.5">
      <span
        title={chart.title}
        className="truncate text-[11px] font-medium uppercase tracking-wide text-neutral-400"
      >
        {chart.title}
      </span>
      <span
        title={numeric ? (chart.value as number).toLocaleString() : undefined}
        className="mt-0.5 truncate text-[19px] font-semibold tabular-nums text-neutral-900"
      >
        {numeric ? fmtCompact(chart.value as number) : "—"}
      </span>
      {chart.sub && <span className="truncate text-[10.5px] text-neutral-400">{chart.sub}</span>}
    </div>
  );
}

function TableCard({ chart }: { chart: SilaChart }) {
  const cols = chart.columns ?? [];
  const rows = chart.data ?? [];
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      cols.some((c) =>
        String(row[c] ?? "")
          .toLowerCase()
          .includes(q)
      )
    );
  }, [rows, cols, query]);

  return (
    <div className="min-w-0 rounded-lg border border-neutral-200 bg-white p-3 sm:col-span-2">
      <div className="mb-2 flex items-center gap-2">
        <p className="min-w-0 flex-1 truncate font-medium text-[12.5px] text-neutral-700">
          {chart.title}
        </p>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2 size-3 -translate-y-1/2 text-neutral-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…"
            aria-label={`Search ${chart.title}`}
            className="h-6.5 w-36 rounded-md border border-neutral-200 bg-neutral-50 pl-6 pr-2 text-[11.5px] text-neutral-800 placeholder:text-neutral-400 focus:border-neutral-400 focus:outline-none"
          />
        </div>
      </div>
      <div className="max-h-72 overflow-auto">
        <table className="w-full border-collapse text-[12px]">
          <thead className="sticky top-0 z-10">
            <tr className="bg-neutral-50">
              {cols.map((c, i) => (
                <th
                  key={c}
                  className={`border-neutral-200 border-b px-2 py-1.5 font-semibold text-neutral-600 ${
                    i === 0 ? "text-left" : "text-right"
                  }`}
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((row, i) => (
              // Value+index: first-column values repeat (10x "West" broke keys).
              <tr key={`${String(row[cols[0]] ?? "")}-${i}`} className="even:bg-neutral-50/50">
                {cols.map((c, j) => (
                  <td
                    key={c}
                    className={`border-neutral-100 border-b px-2 py-1.5 tabular-nums text-neutral-700 ${
                      j === 0 ? "text-left font-medium" : "text-right"
                    }`}
                  >
                    {j === 0 ? String(row[c] ?? "") : fmtCell(row[c])}
                  </td>
                ))}
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={cols.length} className="px-2 py-4 text-center text-neutral-400">
                  No rows match "{query}"
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-1.5 text-right text-[10.5px] text-neutral-400">
        {filtered.length.toLocaleString()} of {rows.length.toLocaleString()} rows
      </p>
    </div>
  );
}

function ChartCard({ chart, className }: { chart: SilaChart; className?: string }) {
  const data = chart.data ?? [];
  return (
    <div className={cn("min-w-0 rounded-lg border border-neutral-200 bg-white p-3", className)}>
      <p className="mb-2 truncate text-[12.5px] font-medium text-neutral-700">{chart.title}</p>
      <div className="h-56">
        {/* Fixed pixel height + minWidth quiet Recharts' width(-1)/height(-1)
            warnings when the block first renders before layout settles. */}
        <ResponsiveContainer width="100%" height={224} minWidth={0}>
          {chart.kind === "line" ? (
            <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="x" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} />
              <YAxis
                tick={{ fontSize: 10, fill: "#94a3b8" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={tickFmt}
                width={52}
              />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
                formatter={(v) => (typeof v === "number" ? fmtCompact(v) : String(v))}
              />
              {(chart.series ?? []).length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
              {(chart.series ?? []).map((s, i) => (
                <Line
                  key={s}
                  type="monotone"
                  dataKey={s}
                  stroke={COLORS[i % COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                />
              ))}
            </LineChart>
          ) : chart.kind === "radar" ? (
            <RadarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
              <PolarGrid stroke="#e2e8f0" />
              <PolarAngleAxis dataKey="name" tick={{ fontSize: 10, fill: "#64748b" }} />
              <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 9, fill: "#cbd5e1" }} />
              {(chart.series ?? []).map((s, i) => (
                <Radar
                  key={s}
                  name={s}
                  dataKey={s}
                  stroke={COLORS[i % COLORS.length]}
                  fill={COLORS[i % COLORS.length]}
                  fillOpacity={0.15}
                />
              ))}
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
            </RadarChart>
          ) : chart.kind === "scatter" ? (
            <ScatterChart margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                type="number"
                dataKey="x"
                tick={{ fontSize: 10, fill: "#94a3b8" }}
                tickLine={false}
                tickFormatter={tickFmt}
                domain={["auto", "auto"]}
              />
              <YAxis
                type="number"
                dataKey="y"
                tick={{ fontSize: 10, fill: "#94a3b8" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={tickFmt}
                width={52}
                domain={["auto", "auto"]}
              />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
                formatter={(v) => (typeof v === "number" ? fmtCompact(v) : String(v))}
              />
              <Scatter data={data} fill={COLORS[0]} fillOpacity={0.7} />
            </ScatterChart>
          ) : chart.kind === "bar" || chart.kind === "histogram" ? (
            <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10, fill: "#94a3b8" }}
                tickLine={false}
                interval={0}
                angle={-20}
                textAnchor="end"
                height={40}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "#94a3b8" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={tickFmt}
                width={52}
              />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
                formatter={(v) => (typeof v === "number" ? fmtCompact(v) : String(v))}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {data.map((entry, i) => (
                  <Cell key={`${String(entry.name ?? "")}-${i}`} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          ) : (
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius="45%"
                outerRadius="80%"
                paddingAngle={2}
              >
                {data.map((entry, i) => (
                  <Cell key={`${String(entry.name ?? "")}-${i}`} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
                formatter={(v) => (typeof v === "number" ? fmtCompact(v) : String(v))}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function SilaDashboardBlock({ dashboard }: { dashboard: SilaDashboard }) {
  const stats = dashboard.charts.filter((c) => c.kind === "stat");
  const charts = dashboard.charts.filter((c) => c.kind !== "stat");
  return (
    // Break out of the chat column to the RIGHT on wide screens (the trace
    // rail pins the left edge) — dashboards want width, prose doesn't.
    <div className="min-w-0 flex-1 overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50/60 lg:-mr-10 xl:-mr-32">
      <div className="flex items-center gap-2 border-neutral-200 border-b bg-white px-3.5 py-2.5">
        <BarChart3 className="size-4 text-neutral-500" />
        <span className="font-medium text-[13px] text-neutral-900">{dashboard.title}</span>
        <span className="ml-auto text-[11.5px] text-neutral-400">
          {dashboard.source} · {dashboard.rows.toLocaleString()} rows
        </span>
      </div>
      <div className="space-y-3 p-3">
        {(dashboard.notes ?? []).length > 0 && (
          // P4/P5: the executive summary rides the dashboard's notes — pinned
          // to the top of the rendered surface, above the KPI strip.
          <ul className="space-y-1 rounded-lg border border-neutral-200 bg-white px-3.5 py-2.5">
            {(dashboard.notes ?? []).map((note) => (
              <li key={note} className="flex gap-2 text-[12px] leading-snug text-neutral-600">
                <span className="mt-0.5 text-neutral-300">•</span>
                {note}
              </li>
            ))}
          </ul>
        )}
        {stats.length > 0 && (
          // auto-fit: cards always fill the full row width and wrap as needed
          // (a fixed column count left empty tracks when there were few KPIs).
          <div className="grid grid-cols-[repeat(auto-fit,minmax(10.5rem,1fr))] gap-2.5">
            {stats.map((c, i) => (
              // Title+index keys: chart edits briefly produced same-titled
              // siblings, and duplicate keys made React drop/dupe cards.
              <StatCard key={`${c.title}-${i}`} chart={c} />
            ))}
          </div>
        )}
        {/* Tables span both columns, so one in the middle of the flow left the
            chart before it alone in a half-empty row — and an odd count left the
            last chart alone at the bottom. Plots first, packed in pairs, the odd
            one out stretched to full width; tables last. */}
        <div className="grid gap-3 sm:grid-cols-2">
          {(() => {
            const plots = charts.filter((c) => c.kind !== "table");
            const tables = charts.filter((c) => c.kind === "table");
            const oddLast = plots.length % 2 === 1 ? plots.length - 1 : -1;
            return [
              ...plots.map((c, i) => (
                <ChartCard
                  key={`${c.title}-${i}`}
                  chart={c}
                  className={i === oddLast ? "sm:col-span-2" : undefined}
                />
              )),
              ...tables.map((c, i) => <TableCard key={`${c.title}-t${i}`} chart={c} />),
            ];
          })()}
        </div>
      </div>
    </div>
  );
}
