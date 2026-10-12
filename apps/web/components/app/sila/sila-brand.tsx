"use client";

import { useGooglyEye } from "@/lib/use-googly-eye";
import { cn } from "@/lib/utils";
import { useRef } from "react";

// The official Sila logo geometry (source SVGs in apps/web/public/brand),
// inlined so it scales crisply. Default fill is black (currentColor), so a
// caller can recolor via a text-* class if ever needed.
//
// - SilaGlyph  = Sila-01.svg — the S mark alone (chat avatar, collapsed nav).
// - SilaLockup = Sila-02.svg — the S mark + "Sila" wordmark (sidebar header).

/** The S mark alone (Sila-01). Square, padded viewBox so the whole mark shows
 *  comfortably (not edge-to-edge) inside a square box. `live` makes the eye
 *  follow the cursor + blink (opt-in — the glyph also renders as tiny message
 *  avatars, which shouldn't each run a tracking loop). `covered` slides two
 *  little hands out from behind the top bone to hide the eye (password
 *  peek-a-boo); only meaningful while `live`. */
export function SilaGlyph({
  className,
  live = false,
  covered = false,
}: {
  className?: string;
  live?: boolean;
  covered?: boolean;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const pupilRef = useRef<SVGGElement | null>(null);
  const handsRef = useRef<SVGGElement | null>(null);

  useGooglyEye({
    svgRef,
    pupilRef,
    eye: { cx: 960.13, cy: 540.13 },
    viewBox: { x: 817, y: 392, w: 290, h: 290 },
    // Same design as the lockup mark at ~1.43x scale — travel scales with it.
    travel: { x: 14, y: 9 },
    hands: { ref: handsRef, restOffsetY: -78 },
    covered,
    enabled: live,
  });

  return (
    <svg
      ref={svgRef}
      viewBox="817 392 290 290"
      className={cn("text-neutral-900", className)}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Sila"
    >
      <g fill="currentColor">
        {/* Pupil first, hands above it, bones on top — so the hands cover the
            eye but emerge from BEHIND the top bone. */}
        <g ref={pupilRef}>
          <path d="M960.13,569.23c-7.97,0-14.84-2.88-20.6-8.64-5.76-5.76-8.64-12.62-8.64-20.6s2.88-15.06,8.64-20.73c5.76-5.67,12.62-8.5,20.6-8.5s14.79,2.84,20.46,8.5c5.67,5.67,8.5,12.58,8.5,20.73s-2.84,14.84-8.5,20.6c-5.67,5.76-12.49,8.64-20.46,8.64Z" />
        </g>
        <g ref={handsRef} transform="translate(0 -78)" opacity="0">
          <circle cx="945.5" cy="540.13" r="26" />
          <circle cx="975.5" cy="540.13" r="26" />
        </g>
        <path d="M829.7,565.85c18.81-18.81,49.32-18.81,68.15.01,14.92,14.92,33.92,23.38,53.41,25.32,5.83.58,11.7.57,17.52-.01,19.49-1.94,38.46-10.37,53.39-25.3,18.82-18.82,49.32-18.81,68.13,0,18.82,18.82,18.83,49.31,0,68.14-18.81,18.81-49.31,18.82-68.14,0-14.92-14.92-33.9-23.37-53.4-25.3-5.82-.59-11.71-.59-17.53,0-19.49,1.94-38.46,10.37-53.39,25.3-18.82,18.82-49.33,18.84-68.15.01-18.82-18.82-18.82-49.34,0-68.16Z" />
        <path d="M829.7,445.98c18.81-18.81,49.32-18.81,68.15.01,14.92,14.92,33.92,23.38,53.41,25.32,5.83.58,11.7.57,17.52-.01,19.49-1.94,38.46-10.37,53.39-25.3,18.82-18.82,49.32-18.81,68.13,0,18.82,18.82,18.83,49.31,0,68.14-18.81,18.81-49.31,18.82-68.14,0-14.92-14.92-33.9-23.37-53.4-25.3-5.82-.59-11.71-.59-17.53,0-19.49,1.94-38.46,10.37-53.39,25.3-18.82,18.82-49.33,18.84-68.15.01-18.82-18.82-18.82-49.34,0-68.16Z" />
      </g>
    </svg>
  );
}

/** The full Sila lockup (Sila-02) — S mark + "Sila" wordmark + tagline. Rendered
 *  from the cropped source asset so the whole thing (slogan included) shows; it's
 *  black, so an <img> is fine. Width follows the container height. */
export function SilaLockup({ className }: { className?: string }) {
  return <img src="/brand/sila-lockup.svg" alt="Sila" className={className} />;
}
