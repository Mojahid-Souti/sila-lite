"use client";

import { SilaAvatar } from "@/components/app/sila/sila-avatar";
import type { SilaState } from "@/components/app/sila/sila-script";
import type { UseSilaSocket } from "@/lib/sila-socket";
import { Mic, MicOff, X } from "lucide-react";
import { useEffect } from "react";

/**
 * Orb-centric voice session — the call-like view. The orb stays on screen the
 * whole time (reacting to listening/thinking/speaking) with a live caption and
 * mute/end controls. Reuses the SILA WS voice pipeline (best-effort; the browser
 * STT/TTS is a POC placeholder per CLAUDE.md). Consent is handled by the caller.
 */
export function SilaVoiceMode({ sila, onExit }: { sila: UseSilaSocket; onExit: () => void }) {
  const { enableHandsFree, wakeUp, goToSleep } = sila;
  // biome-ignore lint/correctness/useExhaustiveDependencies: arm mic on enter, sleep on exit
  useEffect(() => {
    let cancelled = false;
    enableHandsFree()
      .then(() => {
        if (!cancelled) wakeUp();
      })
      .catch(() => {
        /* mic denied — the caption shows the disconnected state */
      });
    return () => {
      cancelled = true;
      goToSleep();
    };
  }, []);

  const orbState: SilaState = sila.capturing
    ? "listening"
    : sila.state === "thinking" || sila.state === "speaking"
      ? sila.state
      : sila.awake
        ? "listening"
        : "idle";

  const caption = sila.capturing
    ? "Listening…"
    : sila.state === "thinking"
      ? "Thinking…"
      : sila.reply || (sila.awake ? "I'm listening — go ahead." : "Connecting…");

  return (
    <div className="flex h-full flex-col items-center justify-center gap-7 px-4">
      <SilaAvatar state={orbState} variant="orb" />
      <p className="min-h-7 max-w-xl text-center text-lg font-medium text-neutral-800">{caption}</p>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => (sila.awake ? goToSleep() : wakeUp())}
          aria-label={sila.awake ? "Mute" : "Resume"}
          className="inline-flex h-11 items-center gap-2 rounded-full border border-neutral-200 bg-white px-5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
        >
          {sila.awake ? <Mic className="size-4" /> : <MicOff className="size-4" />}
          {sila.awake ? "Mute" : "Resume"}
        </button>
        <button
          type="button"
          onClick={onExit}
          className="inline-flex h-11 items-center gap-2 rounded-full bg-neutral-950 px-6 text-sm font-medium text-white transition-colors hover:bg-neutral-800"
        >
          <X className="size-4" />
          End voice
        </button>
      </div>
    </div>
  );
}
