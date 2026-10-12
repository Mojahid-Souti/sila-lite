import { DetailSkeleton } from "@/components/ui/page-skeletons";

/** Bazaar agent detail shape: header + a tall content block. */
export default function BazaarAgentLoading() {
  return (
    <div className="mx-auto w-full max-w-[1200px] px-5 py-6 lg:px-7">
      <DetailSkeleton />
    </div>
  );
}
