import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * The shared skeleton kit — STRUCTURED placeholders that echo the real layout
 * (icon + title + body lines + footer), replacing the blank gray boxes that made
 * loading feel broken. Compose these on list/detail pages; keep counts small.
 */

/** One content card: icon tile + title + two body lines + footer chips. */
export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-2xl border border-neutral-200 bg-white p-4", className)}>
      <div className="flex items-center gap-3">
        <Skeleton className="size-9 rounded-lg bg-neutral-100" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <Skeleton className="h-3.5 w-2/5 bg-neutral-100" />
          <Skeleton className="h-3 w-1/4 bg-neutral-100" />
        </div>
      </div>
      <Skeleton className="mt-3.5 h-3 w-full bg-neutral-100" />
      <Skeleton className="mt-1.5 h-3 w-3/4 bg-neutral-100" />
      <div className="mt-4 flex items-center gap-1.5 border-neutral-100 border-t pt-3.5">
        <Skeleton className="h-5 w-14 rounded-full bg-neutral-100" />
        <Skeleton className="h-5 w-16 rounded-full bg-neutral-100" />
        <Skeleton className="ml-auto h-7 w-16 rounded-lg bg-neutral-100" />
      </div>
    </div>
  );
}

/** A responsive grid of card skeletons (list pages). */
export function CardGridSkeleton({
  count = 6,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-3 sm:grid-cols-2 lg:grid-cols-3", className)}>
      {Array.from({ length: count }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder list
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

/** Rows with a leading icon + two lines (connectors, documents, members). */
export function ListRowsSkeleton({
  rows = 4,
  className,
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: rows }, (_, i) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder list
          key={i}
          className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3"
        >
          <Skeleton className="size-8 rounded-lg bg-neutral-100" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-1/3 bg-neutral-100" />
            <Skeleton className="h-3 w-1/2 bg-neutral-100" />
          </div>
          <Skeleton className="h-7 w-16 rounded-lg bg-neutral-100" />
        </div>
      ))}
    </div>
  );
}

/** KPI/stat tiles (dashboards, workspace home). */
export function StatCardsSkeleton({
  count = 3,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div className={cn("grid grid-cols-1 gap-4 sm:grid-cols-3", className)}>
      {Array.from({ length: count }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder list
        <div key={i} className="rounded-xl border border-neutral-200 bg-white p-5">
          <Skeleton className="h-3 w-24 bg-neutral-100" />
          <Skeleton className="mt-3 h-7 w-16 bg-neutral-100" />
          <Skeleton className="mt-2 h-3 w-32 bg-neutral-100" />
        </div>
      ))}
    </div>
  );
}

/** A page header: title + subtitle. Pair with a body skeleton below. */
export function PageHeaderSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-2.5", className)}>
      <Skeleton className="h-8 w-64 bg-neutral-100" />
      <Skeleton className="h-4 w-96 max-w-full bg-neutral-100" />
    </div>
  );
}

/** A detail page: header + a tall content block with inner lines. */
export function DetailSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-6", className)}>
      <PageHeaderSkeleton />
      <div className="rounded-2xl border border-neutral-200 bg-white p-5">
        <Skeleton className="h-4 w-1/3 bg-neutral-100" />
        <Skeleton className="mt-3 h-3 w-full bg-neutral-100" />
        <Skeleton className="mt-1.5 h-3 w-5/6 bg-neutral-100" />
        <Skeleton className="mt-1.5 h-3 w-2/3 bg-neutral-100" />
        <div className="mt-5 flex gap-2 border-neutral-100 border-t pt-4">
          <Skeleton className="h-8 w-24 rounded-lg bg-neutral-100" />
          <Skeleton className="h-8 w-24 rounded-lg bg-neutral-100" />
        </div>
      </div>
    </div>
  );
}
