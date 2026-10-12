"use client";

/**
 * Admin Panel — section shell.
 *
 * ⚠️ ALL admin-panel work lives under this one folder: app/(app)/admin/.
 *    - pages       → app/(app)/admin/<route>/page.tsx
 *    - components  → app/(app)/admin/_components/*  (co-located, underscore = not a route)
 *    - hooks/utils → app/(app)/admin/_lib/*
 *    Reuse the shared API client (@/lib/api) and shadcn UI (@/components/ui/*);
 *    don't edit files outside this folder. That keeps the merge clean.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-[1400px] px-5 py-6 lg:px-7">{children}</div>;
}
