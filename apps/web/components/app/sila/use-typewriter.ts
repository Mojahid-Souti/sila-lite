"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Typewriter: reveals `text` character by character, then calls onDone after a
 * short hold so the line can be read. O(n) over text length, one interval.
 */
export function useTypewriter(
  text: string,
  opts: { charMs?: number; holdMs?: number; onDone?: () => void } = {}
): string {
  const { charMs = 22, holdMs = 1000, onDone } = opts;
  const [count, setCount] = useState(0);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  // Reset + retype whenever the line changes.
  useEffect(() => {
    setCount(0);
    if (!text) return;
    const interval = setInterval(() => {
      setCount((c) => {
        if (c >= text.length) {
          clearInterval(interval);
          return c;
        }
        return c + 1;
      });
    }, charMs);
    return () => clearInterval(interval);
  }, [text, charMs]);

  // Fire onDone once fully typed + held.
  useEffect(() => {
    if (!text || count < text.length) return;
    const id = setTimeout(() => onDoneRef.current?.(), holdMs);
    return () => clearTimeout(id);
  }, [count, text, holdMs]);

  return text.slice(0, count);
}
