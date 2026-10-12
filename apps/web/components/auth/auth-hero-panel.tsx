import Image from "next/image";

/**
 * The right half of the login-04 split card, shared by login + signup so the
 * two pages stay in lockstep. A full-bleed cover photo (dark robot portrait)
 * with a bottom scrim carrying the tagline; hidden below md where the form
 * takes the full width.
 */
export function AuthHeroPanel() {
  return (
    <div className="relative hidden min-h-[560px] overflow-hidden md:block">
      <Image
        src="/anthropomorphic-robot-indoors.jpg"
        alt=""
        fill
        priority
        sizes="(min-width: 768px) 50vw, 0px"
        // Bias the crop toward the head so wide/short panels don't decapitate it.
        className="object-cover object-[50%_30%]"
      />
      {/* Legibility scrim behind the tagline. */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-black/90 via-black/55 to-transparent"
      />
      {/* Editorial lockup: kicker / serif headline / subline (left-aligned). */}
      <div className="absolute inset-x-0 bottom-0 p-8 md:p-10">
        {/* Text shadows keep every line legible where the photo's bright
            shoulder crosses the lockup (the crop shifts with viewport). */}
        <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-sky-200 [text-shadow:0_1px_4px_rgba(0,0,0,0.95)]">
          Sovereign AI marketplace
        </p>
        <p className="mt-3 max-w-[360px] font-serif text-3xl italic leading-[1.15] tracking-tight text-white [text-shadow:0_2px_10px_rgba(0,0,0,0.7)] [text-wrap:balance]">
          Your link to every AI&nbsp;agent.
        </p>
        <p className="mt-3 max-w-[360px] text-[13.5px] leading-relaxed text-neutral-200 [text-shadow:0_1px_4px_rgba(0,0,0,0.8)]">
          Sovereign, vetted, and ready to hire — all on your own infrastructure.
        </p>
      </div>
    </div>
  );
}
