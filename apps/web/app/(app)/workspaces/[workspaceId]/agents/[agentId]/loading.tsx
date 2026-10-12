import { DetailSkeleton } from "@/components/ui/page-skeletons";

/** Agent detail shape: header + a tall content block. */
export default function AgentDetailLoading() {
  return (
    <div className="mx-auto w-full max-w-[1400px] px-5 py-6 lg:px-7">
      <DetailSkeleton />
    </div>
  );
}
