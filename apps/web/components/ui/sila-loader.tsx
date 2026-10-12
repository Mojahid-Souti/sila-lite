import { SilaGlyph } from "@/components/app/sila/sila-brand";
import { cn } from "@/lib/utils";

/**
 * The brand loading state — the S mark coin-flipping (see .sila-loader-mark in
 * globals.css). Use INSTEAD of generic spinners: SilaLoader inline in a section,
 * PageLoader centered for a whole page/route.
 */
export function SilaLoader({
  size = "md",
  label,
  className,
}: {
  size?: "sm" | "md" | "lg";
  label?: string;
  className?: string;
}) {
  const mark = { sm: "size-5", md: "size-8", lg: "size-11" }[size];
  return (
    <output
      aria-label={label ?? "Loading"}
      className={cn("flex flex-col items-center gap-3", className)}
    >
      <SilaGlyph className={cn("sila-loader-mark text-neutral-900", mark)} />
      {label && <p className="text-[13px] text-neutral-400">{label}</p>}
    </output>
  );
}

/** A full page/route loading state — the mark centered with room to breathe. */
export function PageLoader({ label }: { label?: string }) {
  return (
    <div className="grid min-h-[50vh] w-full place-items-center">
      <SilaLoader size="lg" label={label} />
    </div>
  );
}
