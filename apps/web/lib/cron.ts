// The schedule wizard's model: "Every [n] [unit]" + a time (for days/weeks) + days
// (for weeks), with a raw-cron escape hatch. build/parse round-trip the presets the
// build flow emits; anything else falls back to the editable custom cron.

export type Unit = "minutes" | "hours" | "days" | "weeks";

export type ScheduleSpec = {
  n: number; // every N
  unit: Unit;
  hour: number; // 0-23, for days/weeks
  minute: number; // 0-59
  dow: number[]; // 0=Sun … 6=Sat, for weeks
  custom: string; // non-empty → used verbatim (fully editable)
};

export const DEFAULT_SPEC: ScheduleSpec = {
  n: 1,
  unit: "days",
  hour: 9,
  minute: 0,
  dow: [1],
  custom: "",
};

export function buildCron(s: ScheduleSpec): string {
  if (s.custom.trim()) return s.custom.trim();
  const n = Math.max(1, Math.floor(s.n || 1));
  const m = Math.min(59, Math.max(0, Math.floor(s.minute || 0)));
  const h = Math.min(23, Math.max(0, Math.floor(s.hour || 0)));
  switch (s.unit) {
    case "minutes":
      return `*/${n} * * * *`;
    case "hours":
      return `0 */${n} * * *`;
    case "days":
      return n === 1 ? `${m} ${h} * * *` : `${m} ${h} */${n} * *`;
    case "weeks": {
      const dows = s.dow.length ? [...s.dow].sort((a, b) => a - b).join(",") : "*";
      return `${m} ${h} * * ${dows}`;
    }
  }
}

export function parseCron(cron?: string | null): ScheduleSpec {
  if (!cron) return { ...DEFAULT_SPEC };
  const p = cron.trim().split(/\s+/);
  if (p.length !== 5) return { ...DEFAULT_SPEC, custom: cron };
  const [min, hour, dom, , dowf] = p;

  const everyMin = min.match(/^\*\/(\d+)$/);
  if (everyMin && hour === "*" && dom === "*" && dowf === "*")
    return { ...DEFAULT_SPEC, n: Number(everyMin[1]), unit: "minutes" };

  const everyHour = hour.match(/^\*\/(\d+)$/);
  if (min === "0" && everyHour && dom === "*" && dowf === "*")
    return { ...DEFAULT_SPEC, n: Number(everyHour[1]), unit: "hours" };

  const m = Number(min);
  const h = Number(hour);
  if (!Number.isNaN(m) && !Number.isNaN(h)) {
    const everyDay = dom.match(/^\*\/(\d+)$/);
    if (everyDay && dowf === "*")
      return { ...DEFAULT_SPEC, n: Number(everyDay[1]), unit: "days", minute: m, hour: h };
    if (dom === "*" && dowf === "*")
      return { ...DEFAULT_SPEC, n: 1, unit: "days", minute: m, hour: h };
    if (dom === "*" && dowf === "1-5")
      return { ...DEFAULT_SPEC, unit: "weeks", minute: m, hour: h, dow: [1, 2, 3, 4, 5] };
    if (dom === "*" && /^[0-6](,[0-6])*$/.test(dowf))
      return {
        ...DEFAULT_SPEC,
        unit: "weeks",
        minute: m,
        hour: h,
        dow: dowf.split(",").map(Number),
      };
  }
  return { ...DEFAULT_SPEC, custom: cron };
}
