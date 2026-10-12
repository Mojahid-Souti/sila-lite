import { SilaGlyph } from "@/components/app/sila/sila-brand";

export function AuthPageShell({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-[88vh] flex-col">{children}</div>;
}

export function AuthBrandMark({ eyesCovered = false }: { eyesCovered?: boolean }) {
  // The S mark (Sila-01) with the live googly eye: follows the cursor, blinks,
  // and covers its eye with little hands while a password is being typed.
  return <SilaGlyph live covered={eyesCovered} className="size-14 text-neutral-950" />;
}

export function AuthFooter() {
  return (
    <div className="mt-8 flex flex-col items-center justify-between gap-2 border-t border-neutral-100 pt-5 text-xs text-neutral-500 sm:flex-row">
      <p>&copy; {new Date().getFullYear()} Sila. All rights reserved.</p>
      <div className="flex items-center gap-3">
        <a href="/legal/privacy" className="hover:text-neutral-700 hover:underline">
          Privacy Policy
        </a>
        <span aria-hidden>·</span>
        <a href="/legal/terms" className="hover:text-neutral-700 hover:underline">
          Terms &amp; Conditions
        </a>
      </div>
    </div>
  );
}
