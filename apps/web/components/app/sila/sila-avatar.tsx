"use client";

import { SilaGlyph } from "@/components/app/sila/sila-brand";
import type { SilaState } from "@/components/app/sila/sila-script";
import dynamic from "next/dynamic";

// Both layers are WebGL — client-only.
const AgentAudioVisualizerAura = dynamic(
  () =>
    import("@/components/agents-ui/agent-audio-visualizer-aura").then(
      (m) => m.AgentAudioVisualizerAura
    ),
  { ssr: false }
);
const OrbCore = dynamic(
  () => import("@/components/agents-ui/voice-orb-core").then((m) => m.OrbCore),
  { ssr: false }
);

const OMANTEL_BLUE = "#2D13EA" as const;
const OMANTEL_ORANGE = "#ED7D31" as const;

// Layer-specific state mappings (each library names states differently).
const AURA_STATE: Record<SilaState, "listening" | "thinking" | "speaking"> = {
  idle: "listening",
  listening: "listening",
  thinking: "thinking",
  speaking: "speaking",
};
const CORE_STATE: Record<SilaState, "idle" | "listening" | "connecting" | "speaking"> = {
  idle: "idle",
  listening: "listening",
  thinking: "connecting",
  speaking: "speaking",
};

/**
 * SILA's face: a big glowing core (orb) centered inside the Aura's flowing
 * ribbons — one presence. Both canvases share the exact same square box
 * (the aura's size-variant height is overridden so `inset-0` really fills),
 * the core sits behind (z-0) and the ribbons wrap in front (z-10).
 */
export function SilaAvatar({
  state,
  variant = "orb",
}: {
  state: SilaState;
  /** "orb" = the glowing core + aura (desaturated to black & white), for voice.
   *  "icon" = just the static Sila mark — no orb, no aura, no animation. */
  variant?: "orb" | "icon";
}) {
  if (variant === "icon") {
    return <SilaGlyph className="size-20 text-neutral-900 sm:size-24" />;
  }
  return (
    // `grayscale` desaturates the WebGL orb + aura to black & white.
    <div className="animate-sila-float relative grid size-72 place-items-center grayscale sm:size-96">
      {/* TUNING: the core ball's size is these two classes (mobile / desktop).
          Bigger = less gap to the aura ring. Container size is on the div above. */}
      <OrbCore
        state={CORE_STATE[state]}
        variant="omantel"
        className="z-0 size-56 drop-shadow-[0_0_28px_rgba(0,0,0,0.25)] sm:size-[19rem]"
      />
      <AgentAudioVisualizerAura
        size="lg"
        state={AURA_STATE[state]}
        color={OMANTEL_BLUE}
        color2={OMANTEL_ORANGE}
        themeMode="light"
        className="absolute inset-0 z-10 h-full w-full"
      />
    </div>
  );
}
