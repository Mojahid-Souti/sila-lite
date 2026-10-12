import {
  CardGridSkeleton,
  PageHeaderSkeleton,
  StatCardsSkeleton,
} from "@/components/ui/page-skeletons";

/** Dashboard shape: hero header + KPI tiles + a quick-actions grid. */
export default function DashboardLoading() {
  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-7 px-5 py-6 lg:px-7">
      <PageHeaderSkeleton />
      <StatCardsSkeleton count={4} />
      <CardGridSkeleton count={3} />
    </div>
  );
}
