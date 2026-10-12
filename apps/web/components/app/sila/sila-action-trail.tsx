"use client";

import { Check, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

/**
 * Action trail — the "JARVIS effect": while SILA works, task cards appear one
 * by one (spinner → check). Demo timing is randomized; Phase 16 replaces the
 * timers with real tool-call progress events.
 */
export function SilaActionTrail({
  itemKeys,
  onDone,
}: {
  itemKeys: string[];
  onDone: () => void;
}) {
  const t = useTranslations("sila");
  // How many items are visible; the last visible one is "running".
  const [progress, setProgress] = useState(1);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    if (progress > itemKeys.length) {
      const id = setTimeout(() => onDoneRef.current(), 700);
      return () => clearTimeout(id);
    }
    const id = setTimeout(() => setProgress((p) => p + 1), 1100 + Math.random() * 900);
    return () => clearTimeout(id);
  }, [progress, itemKeys.length]);

  return (
    <ul className="mt-5 w-full max-w-sm space-y-1.5">
      {itemKeys.slice(0, Math.min(progress, itemKeys.length)).map((key, i) => {
        const running = i === progress - 1 && progress <= itemKeys.length;
        return (
          <li
            key={key}
            className="sila-trail-card flex items-center gap-2.5 rounded-xl border border-neutral-200 bg-white/80 px-3.5 py-2.5 shadow-sm backdrop-blur"
          >
            {running ? (
              <Loader2 className="size-4 shrink-0 animate-spin text-neutral-400" />
            ) : (
              <span className="grid size-4 shrink-0 place-items-center rounded-full bg-emerald-100">
                <Check className="size-3 text-emerald-600" />
              </span>
            )}
            <span className="text-neutral-700 text-sm">{t(key)}</span>
          </li>
        );
      })}
    </ul>
  );
}
