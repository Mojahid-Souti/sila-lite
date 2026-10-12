"use client";

import { TimeWheel } from "@/components/agent/time-wheel";
import { cn } from "@/lib/utils";
import { useState } from "react";

// The schedule question's picker (build interview) — the same day + time-wheel feel as
// the edit modal, producing a cron string as the answer (the gate passes a 5-field cron
// straight through). Compact for the docked ask sheet.

const FREQ = [
  { id: "weekdays", label: "Weekdays" },
  { id: "daily", label: "Every day" },
  { id: "weekly", label: "Weekly" },
] as const;
type Freq = (typeof FREQ)[number]["id"];
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function SilaSchedulePicker({ onDone }: { onDone: (cron: string) => void }) {
  const [freq, setFreq] = useState<Freq>("weekdays");
  const [dow, setDow] = useState<number[]>([1]);
  const [hour, setHour] = useState(9);
  const [minute, setMinute] = useState(0);

  function cron(): string {
    if (freq === "daily") return `${minute} ${hour} * * *`;
    if (freq === "weekdays") return `${minute} ${hour} * * 1-5`;
    const days = dow.length ? [...dow].sort((a, b) => a - b).join(",") : "1";
    return `${minute} ${hour} * * ${days}`;
  }

  return (
    <div className="space-y-3">
      {/* Frequency segmented */}
      <div className="inline-flex rounded-lg border border-neutral-200 bg-neutral-50 p-1">
        {FREQ.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFreq(f.id)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              freq === f.id
                ? "bg-white text-neutral-900 shadow-sm"
                : "text-neutral-500 hover:text-neutral-800"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Weekly day chips */}
      {freq === "weekly" && (
        <div className="flex flex-wrap gap-1.5">
          {DOW.map((d, i) => {
            const on = dow.includes(i);
            return (
              <button
                key={d}
                type="button"
                onClick={() => setDow((prev) => (on ? prev.filter((x) => x !== i) : [...prev, i]))}
                className={cn(
                  "size-9 rounded-lg border text-xs font-semibold transition-colors",
                  on
                    ? "border-neutral-900 bg-neutral-900 text-white"
                    : "border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                )}
              >
                {d[0]}
              </button>
            );
          })}
        </div>
      )}

      {/* Time wheel */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-neutral-500">at</span>
        <TimeWheel
          hour={hour}
          minute={minute}
          onChange={(h, m) => {
            setHour(h);
            setMinute(m);
          }}
          className="w-44"
        />
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => onDone(cron())}
          className="inline-flex h-9 items-center rounded-lg bg-neutral-950 px-5 font-medium text-sm text-white transition-colors hover:bg-neutral-800"
        >
          Set schedule
        </button>
      </div>
    </div>
  );
}
