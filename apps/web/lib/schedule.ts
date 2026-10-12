// Friendly rendering of a cron schedule for the agent card + the edit panel.
// Handles the presets the build wizard emits (daily / weekdays / weekly / every-N-min),
// and falls back to the raw cron for anything custom.

const DAYS = ["Sundays", "Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays"];

function formatTime(h: number, m: number): string {
  const ampm = h < 12 ? "AM" : "PM";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}:${String(m).padStart(2, "0")} ${ampm}`;
}

export function formatSchedule(cron?: string | null, timezone?: string | null): string {
  if (!cron) return "On demand";
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return cron;
  const [min, hour, dom, mon, dow] = parts;
  const tz = timezone ? ` ${timezone}` : "";

  const everyMin = min.match(/^\*\/(\d+)$/);
  if (everyMin && hour === "*" && dom === "*" && mon === "*" && dow === "*") {
    return `Every ${everyMin[1]} minutes`;
  }

  const h = Number(hour);
  const m = Number(min);
  if (!Number.isNaN(h) && !Number.isNaN(m) && dom === "*" && mon === "*") {
    const time = formatTime(h, m);
    if (dow === "*") return `Daily ${time}${tz}`;
    if (dow === "1-5") return `Weekdays ${time}${tz}`;
    if (/^[0-6]$/.test(dow)) return `${DAYS[Number(dow)]} ${time}${tz}`;
  }
  return cron;
}
