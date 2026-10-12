"use client";

import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { useId } from "react";

export type IconCardOption = {
  value: string;
  label: string;
  icon: LucideIcon;
};

/**
 * Accessible single-select of wide icon cards. Native radio inputs in a
 * fieldset → the browser gives us correct grouping, roving focus, and arrow-key
 * navigation for free, with zero new dependencies. The real inputs are visually
 * hidden; the cards react to `:peer-focus-visible` for a keyboard focus ring.
 */
export function IconCardGroup({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: IconCardOption[];
  value: string | null;
  onChange: (value: string) => void;
  ariaLabel: string;
}) {
  const name = useId();
  return (
    <fieldset className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <legend className="sr-only">{ariaLabel}</legend>
      {options.map((opt) => {
        const selected = value === opt.value;
        const Icon = opt.icon;
        return (
          <label key={opt.value} className="block cursor-pointer">
            <input
              type="radio"
              name={name}
              value={opt.value}
              checked={selected}
              onChange={() => onChange(opt.value)}
              className="peer sr-only"
            />
            <div
              className={cn(
                "flex flex-col items-center gap-2.5 rounded-2xl border p-5 text-center transition-all peer-focus-visible:ring-2 peer-focus-visible:ring-neutral-300",
                selected
                  ? "border-neutral-950 bg-neutral-50 ring-2 ring-neutral-200"
                  : "border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50"
              )}
            >
              <Icon className={cn("size-6", selected ? "text-neutral-950" : "text-neutral-500")} />
              <span className="text-sm font-medium text-neutral-800">{opt.label}</span>
            </div>
          </label>
        );
      })}
    </fieldset>
  );
}
