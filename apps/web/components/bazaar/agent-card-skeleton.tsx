import { Skeleton } from "@/components/ui/skeleton";

/** Card-shaped loading placeholder — matches BazaarAgentCard's feed anatomy
 *  (header avatar row → cover → action row → caption). */
export function AgentCardSkeleton() {
  return (
    <div className="flex flex-col rounded-xl border border-neutral-200 bg-white p-3.5">
      <div className="flex items-center gap-2.5">
        <Skeleton className="size-9 rounded-full" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-3.5 w-2/3" />
          <Skeleton className="h-2.5 w-1/3" />
        </div>
        <Skeleton className="h-3 w-14" />
      </div>
      <Skeleton className="mt-3 h-28 w-full rounded-lg" />
      <div className="mt-2.5 flex items-center justify-between">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-8 w-16 rounded-lg" />
      </div>
      <Skeleton className="mt-2 h-3 w-4/5" />
    </div>
  );
}
