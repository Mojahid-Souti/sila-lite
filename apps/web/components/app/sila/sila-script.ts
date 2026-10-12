// SILA demo scenarios — scripted, frontend-only. Each step advances when its
// typewriter/interaction completes; the Phase-16 brain will emit the same step
// shapes (speak / open_modal / await_input / tool-progress) over WebSocket.

export type SilaState = "idle" | "listening" | "thinking" | "speaking";

export type SilaStep =
  | { kind: "user"; textKey: string }
  | { kind: "sila"; textKey: string }
  | { kind: "upload" }
  | { kind: "screenShare" }
  | { kind: "trail"; itemKeys: string[] };

export type SilaScenario = {
  id: string;
  chipKey: string;
  steps: SilaStep[];
};

export const SILA_SCENARIOS: SilaScenario[] = [
  {
    id: "docs",
    chipKey: "chips.docs",
    steps: [
      { kind: "user", textKey: "s1.user" },
      { kind: "sila", textKey: "s1.need" },
      { kind: "upload" },
      { kind: "sila", textKey: "s1.got" },
      {
        kind: "trail",
        itemKeys: ["s1.t1", "s1.t2", "s1.t3", "s1.t4"],
      },
      { kind: "sila", textKey: "s1.done" },
    ],
  },
  {
    id: "screen",
    chipKey: "chips.screen",
    steps: [
      { kind: "user", textKey: "s2.user" },
      { kind: "sila", textKey: "s2.ask" },
      { kind: "screenShare" },
      { kind: "sila", textKey: "s2.seeing" },
    ],
  },
  {
    id: "report",
    chipKey: "chips.report",
    steps: [
      { kind: "user", textKey: "s3.user" },
      { kind: "sila", textKey: "s3.plan" },
      {
        kind: "trail",
        itemKeys: ["s3.t1", "s3.t2", "s3.t3", "s3.t4"],
      },
      { kind: "sila", textKey: "s3.done" },
    ],
  },
];

// Fallback when the user types their own request.
export const GENERIC_SCENARIO: SilaScenario = {
  id: "generic",
  chipKey: "",
  steps: [{ kind: "sila", textKey: "generic.reply" }],
};
