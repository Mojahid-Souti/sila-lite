import { CardGridSkeleton, PageHeaderSkeleton } from "@/components/ui/page-skeletons";

/**
 * Default route-transition loading for every (app) page — a structured skeleton
 * that echoes the common list-page shape (header + card grid), shown instantly on
 * navigation so a page never flashes the brand spinner. Route segments with a
 * different shape (dashboard, detail pages) override this with their own loading.tsx.
 */
export default function AppLoading() {
  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-7 px-5 py-6 lg:px-7">
      <PageHeaderSkeleton />
      <CardGridSkeleton count={6} />
    </div>
  );
}
