"use client";

import { cn } from "@/lib/utils";
import { useEffect, useRef } from "react";

// iOS-style drum/wheel picker. Each column snap-scrolls; the parent box draws ONE
// selection band across all columns and a top/bottom fade. Used for the time
// (hour · minute · AM/PM) and the timezone — same look, equal widths.

const ITEM_H = 34;
const VISIBLE = 3; // odd — selection sits in the middle row (compact: one above + one below)
const PAD = (VISIBLE - 1) / 2;
const FADE = "linear-gradient(to bottom, transparent, #000 30%, #000 70%, transparent)";

type Item = { value: string; label: string };

function WheelColumn({
  items,
  value,
  onChange,
  width = "w-10",
  textClass = "text-sm",
}: {
  items: Item[];
  value: string;
  onChange: (v: string) => void;
  width?: string;
  textClass?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const settle = useRef<number | null>(null);
  const idx = Math.max(
    0,
    items.findIndex((i) => i.value === value)
  );

  // Mount-only: once open, the wheel's own scroll is the source of truth, so we
  // don't re-run on idx changes (that would fight the user's momentum).
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional mount-only scroll
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = idx * ITEM_H;
  }, []);

  function handleScroll() {
    if (settle.current) window.clearTimeout(settle.current);
    settle.current = window.setTimeout(() => {
      const el = ref.current;
      if (!el) return;
      const i = Math.min(items.length - 1, Math.max(0, Math.round(el.scrollTop / ITEM_H)));
      if (items[i].value !== value) onChange(items[i].value);
    }, 80);
  }

  return (
    <div
      ref={ref}
      onScroll={handleScroll}
      className={cn(
        "snap-y snap-mandatory overflow-y-scroll scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        width
      )}
      style={{ height: VISIBLE * ITEM_H, maskImage: FADE, WebkitMaskImage: FADE }}
    >
      <div style={{ height: PAD * ITEM_H }} />
      {items.map((it) => (
        <div
          key={it.value}
          className={cn(
            "flex items-center justify-center px-1 text-center font-medium text-neutral-800 tabular-nums",
            textClass
          )}
          style={{ height: ITEM_H, scrollSnapAlign: "center" }}
        >
          {it.label}
        </div>
      ))}
      <div style={{ height: PAD * ITEM_H }} />
    </div>
  );
}

function WheelBox({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-neutral-200 bg-white",
        className
      )}
    >
      {/* one selection band across every column */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-1.5 top-1/2 z-0 -translate-y-1/2 rounded-lg bg-neutral-100"
        style={{ height: ITEM_H }}
      />
      <div className="relative z-10 flex items-center justify-center gap-0.5 px-2">{children}</div>
    </div>
  );
}

const HOURS12: Item[] = Array.from({ length: 12 }, (_, i) => ({
  value: String(i + 1),
  label: String(i + 1),
}));
const MINUTES: Item[] = Array.from({ length: 60 }, (_, i) => ({
  value: String(i),
  label: String(i).padStart(2, "0"),
}));
const AMPM: Item[] = [
  { value: "AM", label: "AM" },
  { value: "PM", label: "PM" },
];

const to24 = (h12: number, ampm: string) => (h12 % 12) + (ampm === "PM" ? 12 : 0);

export function TimeWheel({
  hour,
  minute,
  onChange,
  className,
}: {
  hour: number;
  minute: number;
  onChange: (hour: number, minute: number) => void;
  className?: string;
}) {
  const h12 = ((hour + 11) % 12) + 1;
  const ampm = hour < 12 ? "AM" : "PM";
  return (
    <WheelBox className={className}>
      <WheelColumn
        items={HOURS12}
        value={String(h12)}
        onChange={(v) => onChange(to24(Number(v), ampm), minute)}
      />
      <span className="pb-0.5 font-medium text-neutral-300">:</span>
      <WheelColumn
        items={MINUTES}
        value={String(minute)}
        onChange={(v) => onChange(hour, Number(v))}
      />
      <WheelColumn
        items={AMPM}
        value={ampm}
        onChange={(v) => onChange(to24(h12, v), minute)}
        width="w-12"
      />
    </WheelBox>
  );
}

/** A single-column wheel for arbitrary string options (e.g. timezone). */
export function WheelSelect({
  options,
  value,
  onChange,
  className,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <WheelBox className={className}>
      <WheelColumn
        items={options.map((o) => ({ value: o, label: o }))}
        value={value}
        onChange={onChange}
        width="w-full"
        textClass="text-xs"
      />
    </WheelBox>
  );
}
