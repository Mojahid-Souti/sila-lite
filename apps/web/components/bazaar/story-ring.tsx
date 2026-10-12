"use client";

/**
 * Instagram-style ring around a monogram avatar — the Bazaar's "profile
 * picture" for an agent. Brand-blue gradient (Mojahid's choice). Used by
 * the trending strip, its story viewer, and the catalog card headers.
 * NOTE: the wrappers must be grid/inline-grid — inline spans paint gradient
 * padding as slivers instead of a ring.
 */

/** Two-letter monogram ("Daily Education Summary" → "DE"). */
export function monogram(name: string): string {
  const words = name.trim().split(/\s+/);
  return ((words[0]?.[0] ?? "") + (words[1]?.[0] ?? words[0]?.[1] ?? "")).toUpperCase();
}

export function StoryRing({
  name,
  size = "size-16",
  text = "text-lg",
  ring = "p-[2.5px]",
  animated = false,
}: {
  name: string;
  /** Tailwind size classes for the inner avatar circle. */
  size?: string;
  /** Tailwind text size for the monogram. */
  text?: string;
  /** Ring thickness (padding on the gradient layer). */
  ring?: string;
  /** Liquid ring: the gradient flows around the circle like water in a pipe
   *  (the TOP trending pick). Honors prefers-reduced-motion. */
  animated?: boolean;
}) {
  const avatar = (
    <span className="relative grid rounded-full bg-white p-[2px]">
      <span
        className={`grid ${size} place-items-center rounded-full bg-primary/[0.07] font-semibold ${text} text-primary`}
      >
        {monogram(name)}
      </span>
    </span>
  );

  if (animated) {
    // A conic gradient rotating BEHIND the white inner circle — only the ring
    // edge shows, so the light band reads as liquid circulating in the ring.
    return (
      <span className={`relative inline-grid rounded-full ${ring}`}>
        <span
          aria-hidden
          className="absolute inset-0 animate-[spin_2.6s_linear_infinite] rounded-full bg-[conic-gradient(from_0deg,#1d4ed8_0%,#93c5fd_28%,#2563eb_52%,#60a5fa_78%,#1d4ed8_100%)] motion-reduce:animate-none"
        />
        {avatar}
      </span>
    );
  }

  return (
    <span
      className={`inline-grid rounded-full bg-gradient-to-tr from-primary via-primary/60 to-primary/20 ${ring}`}
    >
      {avatar}
    </span>
  );
}
