"use client";

import { type RefObject, useEffect, useRef } from "react";

/**
 * Makes an SVG logo's "eye" follow the cursor (googly-eye), with an occasional
 * blink — and, optionally, little hands that slide out from behind the mark to
 * cover the eye (`covered`, the password peek-a-boo).
 *
 * Motion model: a rAF loop lerps the pupil toward a clamped target vector
 * (elliptical `travel` bounds keep it inside the mark); pointer-leave eases it
 * back to center. Blink is a quick scaleY squash around the eye's own center.
 * While covered, the hands lerp from their resting spot (hidden behind a bone
 * shape) down over the eye, and the pupil shrinks away — all in the same loop,
 * so toggling mid-motion stays smooth. Respects prefers-reduced-motion.
 * O(1) per frame; everything cleaned up on unmount.
 */
export function useGooglyEye(opts: {
  svgRef: RefObject<SVGSVGElement | null>;
  pupilRef: RefObject<SVGGElement | null>;
  /** Eye center in viewBox units. */
  eye: { cx: number; cy: number };
  viewBox: { x: number; y: number; w: number; h: number };
  /** Max pupil travel in viewBox units (ellipse radii). */
  travel: { x: number; y: number };
  /** Hands that cover the eye while `covered` (viewBox units). */
  hands?: { ref: RefObject<SVGGElement | null>; restOffsetY: number };
  covered?: boolean;
  enabled?: boolean;
}): void {
  const { svgRef, pupilRef, eye, viewBox, travel, hands, covered = false, enabled = true } = opts;

  // Read by the running loop via a ref, so toggling `covered` doesn't restart
  // the effect (which would snap every in-flight lerp back to zero).
  const coveredRef = useRef(covered);
  coveredRef.current = covered;
  const handsElRef = hands?.ref;
  const handsRest = hands?.restOffsetY ?? 0;

  useEffect(() => {
    if (!enabled) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const SATURATE_PX = 140; // cursor distance at which the eye hits max travel
    const FOLLOW = 0.14; // lerp factor — the "smooth" in smooth
    const COVER = 0.16; // hands slide a touch slower than the eye darts
    const BLINK_MS = 110;

    const pos = { x: 0, y: 0 };
    let target = { x: 0, y: 0 };
    let squash = 1;
    let squashTarget = 1;
    let cover = 0;
    let raf = 0;
    let blinkTimer: ReturnType<typeof setTimeout>;

    const onMove = (e: PointerEvent) => {
      const el = svgRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      // The eye's center in screen coordinates.
      const cx = r.left + ((eye.cx - viewBox.x) / viewBox.w) * r.width;
      const cy = r.top + ((eye.cy - viewBox.y) / viewBox.h) * r.height;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist = Math.hypot(dx, dy) || 1;
      const reach = Math.min(1, dist / SATURATE_PX);
      target = { x: (dx / dist) * travel.x * reach, y: (dy / dist) * travel.y * reach };
    };
    const onLeave = () => {
      target = { x: 0, y: 0 };
    };

    const scheduleBlink = () => {
      blinkTimer = setTimeout(
        () => {
          squashTarget = 0.15;
          setTimeout(() => {
            squashTarget = 1;
            scheduleBlink();
          }, BLINK_MS);
        },
        2800 + Math.random() * 3500
      );
    };

    const tick = () => {
      pos.x += (target.x - pos.x) * FOLLOW;
      pos.y += (target.y - pos.y) * FOLLOW;
      squash += (squashTarget - squash) * 0.4;
      cover += ((coveredRef.current ? 1 : 0) - cover) * COVER;
      const shown = 1 - cover; // pupil shrinks away as the hands arrive
      pupilRef.current?.setAttribute(
        "transform",
        // Follow-translate, then blink-squash + cover-shrink about the eye center.
        `translate(${pos.x} ${pos.y}) translate(${eye.cx} ${eye.cy}) scale(${shown} ${squash * shown}) translate(${-eye.cx} ${-eye.cy})`
      );
      if (handsElRef?.current) {
        handsElRef.current.setAttribute("transform", `translate(0 ${handsRest * (1 - cover)})`);
        // Fade in fast while sliding — guarantees full invisibility at rest.
        handsElRef.current.setAttribute("opacity", String(Math.min(1, cover * 1.8)));
      }
      raf = requestAnimationFrame(tick);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    raf = requestAnimationFrame(tick);
    scheduleBlink();
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      cancelAnimationFrame(raf);
      clearTimeout(blinkTimer);
    };
  }, [
    enabled,
    eye.cx,
    eye.cy,
    viewBox.x,
    viewBox.y,
    viewBox.w,
    viewBox.h,
    travel.x,
    travel.y,
    svgRef,
    pupilRef,
    handsElRef,
    handsRest,
  ]);
}
