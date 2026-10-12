"use client";

import { usePathname } from "next/navigation";

/**
 * 3D flip entrance for the login-04 split card, shared by login + signup.
 * Keyed on the pathname so navigating login ↔ signup re-fires the flip —
 * the card swings in around its vertical axis instead of hard-cutting.
 * Reduced motion falls back to a plain fade.
 */
export function AuthCardTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div style={{ perspective: "1600px" }}>
      <div
        key={pathname}
        className="origin-center will-change-transform motion-safe:animate-auth-flip-in motion-reduce:animate-auth-fade-in"
      >
        {children}
      </div>
    </div>
  );
}
