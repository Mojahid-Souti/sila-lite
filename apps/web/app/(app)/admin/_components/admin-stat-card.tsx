import { Card } from "@/components/ui/card";

/** Sample co-located admin component. Build the real ones next to this file. */
export function AdminStatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card className="rounded-xl border-neutral-200 p-4">
      <p className="text-neutral-500 text-sm">{label}</p>
      <p className="mt-1 font-semibold text-2xl text-neutral-950">{value}</p>
      {hint && <p className="mt-1 text-neutral-400 text-xs">{hint}</p>}
    </Card>
  );
}
