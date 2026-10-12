"use client";

import { API_URL } from "@/lib/constants";
import { SilaEars } from "@/lib/sila-ears";
import { useCallback, useEffect, useRef, useState } from "react";

export type SilaSocketState = "idle" | "listening" | "thinking" | "speaking";

/**
 * Is a turn still in flight?
 *
 * NOT `state !== "idle"`. The server only ever sends `listening` / `thinking` /
 * `speaking`; `idle` is the client's pre-connect value and never comes back
 * once a socket is open. A turn ENDS on `listening`, so treating `idle` as the
 * finished signal left every reply permanently "live" — its attachment cards
 * never rendered and the "Working…" heartbeat span forever, which reads as a
 * hang long after the work is done (live: a 14-second turn looked like 15
 * minutes).
 */
export function isTurnInFlight(state: SilaSocketState): boolean {
  return state === "thinking" || state === "speaking";
}
export type SilaConnection = "disconnected" | "connecting" | "ready" | "error";

// A healthy session opens a handful of sockets: first connect, a mode or
// template switch, a token refresh, a bounded close-retry. Anything past this
// in one window is a loop, not a user.
const CONNECT_WINDOW_MS = 10_000;
const MAX_CONNECTS_PER_WINDOW = 12;

export type SilaToolEvent = { name: string; status: "running" | "done" };

// Fan-out roster (cutover): one lane per parallel worker.
export type SilaWorkerStatus = "queued" | "running" | "done" | "failed";
export type SilaWorkerLane = {
  workerId: string;
  label: string;
  status: SilaWorkerStatus;
  result?: string;
};

function upsertLane(
  roster: SilaWorkerLane[],
  frame: { worker_id: string; label: string; status: SilaWorkerStatus; result?: string }
): SilaWorkerLane[] {
  const lane: SilaWorkerLane = {
    workerId: frame.worker_id,
    label: frame.label,
    status: frame.status,
    result: frame.result,
  };
  const i = roster.findIndex((l) => l.workerId === frame.worker_id);
  if (i === -1) return [...roster, lane];
  const next = [...roster];
  next[i] = { ...next[i], ...lane };
  return next;
}

/** Ordered turn timeline — text the brain streams and tool steps, interleaved
 *  in the order they actually happened (so the trace reads chronologically). */
// One structured row of the reflected build spec (label/value; id = the interview
// slot an inline edit records back into; readonly rows aren't editable).
export type SilaSpecSlot = {
  id: string;
  label: string;
  value: string;
  kind?: string;
  readonly?: boolean;
};

/** One chart in an in-Sila data dashboard (built server-side from an uploaded
 *  CSV — deterministic; the model never computes the numbers). */
export type SilaChart = {
  kind: "line" | "bar" | "pie" | "stat" | "table" | "scatter" | "histogram" | "radar";
  title: string;
  data?: Record<string, string | number>[];
  series?: string[]; // line: the numeric series keys ("x" is the axis); radar: groups
  columns?: string[]; // table: ordered column names; radar: the metrics profiled
  value?: number; // stat
  sub?: string; // stat subtitle
};
export type SilaDashboard = {
  title: string;
  source: string;
  rows: number;
  columns: { name: string; kind: string }[];
  charts: SilaChart[];
  // P4/P5: executive-summary bullets pinned above the KPI strip.
  notes?: string[];
};

/** One web result behind an answer. */
export type SilaSource = { title: string; url: string; domain?: string };

/** Anything a turn HANDS BACK — a deck, a document, a sheet, a dashboard, an
 *  agent. Carried as data rather than a markdown link in prose, so the UI can
 *  attach it whether or not the model remembered to mention it. */
/** One step of the turn's task list, as published by `track_tasks`. */
export type SilaTask = { title: string; done: boolean };

/** One thing the security gateway found in a deliverable. `preview` is the
 *  redacted match ("12****78"); the raw value never leaves the server. */
export type SilaFinding = {
  type: string;
  label: string;
  severity: "info" | "low" | "medium" | "high" | "critical";
  preview: string;
  /** Where to look — "Slide 3", "Section 'Background'", "Purpose". */
  location: string;
};

/** The gateway's verdict on one artifact. `blocked` makes the card unopenable;
 *  `notice` shows the findings but still opens. */
export type SilaSecurity = {
  status: "clear" | "notice" | "blocked";
  findings: SilaFinding[];
};

/** A counted read in progress — an inbox, a channel — with the items handled
 *  so far, so the trace can show "3 of 23 · 13%" and a scrolling list. */
export type SilaReadProgress = {
  done: number;
  total: number;
  items: { title: string; meta?: string }[];
};

export type SilaArtifact = {
  kind: "agent" | "deck" | "doc" | "sheet" | "pdf" | "dashboard" | "grafana";
  name: string;
  /** Download or open target. Absent for an agent, which routes internally. */
  url?: string | null;
  subtitle?: string | null;
  /** Agent only. */
  id?: string;
  integrations?: string[];
  web?: boolean;
  /** The security gateway's verdict, when the producer ran it. */
  security?: SilaSecurity;
};

export type SilaSegment =
  | { type: "text"; text: string }
  // SILA's reasoning (<think>…</think>) — shown in the collapsible thinking section,
  // never in the answer text.
  | { type: "thinking"; text: string }
  | {
      type: "tool";
      name: string;
      status: "running" | "done";
      result?: string;
      note?: string;
      /** Citations from a search step. Carried on the frame rather than left to
       *  the model to repeat in prose, so they always render. */
      sources?: SilaSource[];
      /** What the step produced — rendered as attachment tiles after the reply. */
      artifacts?: SilaArtifact[];
      /** The turn's task checklist, republished each time it changes. */
      tasks?: SilaTask[];
      /** A counted read (inbox, channel) — accumulated from progress frames. */
      progress?: SilaReadProgress;
    }
  // A workflow SILA built — renders inline in the trace as a collapsible read-only
  // canvas block (persisted with the message via m.trace).
  | { type: "canvas"; workflowId?: string; definition?: SilaCanvasDef }
  // A dry-run sample of the agent's output, shown BEFORE building ("show me first"),
  // OR (kind: "confirm") the reflected spec as an inline confirm block. Carries the
  // confirm request_id so the block renders Accept/Adjust itself.
  | {
      type: "preview";
      kind?: string;
      output: string;
      destination?: string | null;
      spec?: string;
      specSlots?: SilaSpecSlot[];
      requestId?: string;
    }
  // The Plan-mode plan artifact — Accept/Adjust/Discard live on the card while its
  // requestId matches the pending ask; read-only after (and on reload).
  | { type: "plan"; plan: SilaPlanArtifact; requestId?: string }
  // An in-Sila data dashboard built from an uploaded file — rendered with Recharts.
  | { type: "dashboard"; dashboard: SilaDashboard }
  // An outbound email SILA drafted — renders inline as an Outlook draft card with
  // Send/Cancel while its requestId is the pending confirm; read-only after.
  | { type: "email"; draft: SilaEmailDraft; requestId?: string };

function pushText(tl: SilaSegment[], text: string): SilaSegment[] {
  const last = tl[tl.length - 1];
  if (last && last.type === "text") {
    return [...tl.slice(0, -1), { type: "text", text: last.text + text }];
  }
  return [...tl, { type: "text", text }];
}

function pushThinking(tl: SilaSegment[], text: string): SilaSegment[] {
  const last = tl[tl.length - 1];
  if (last && last.type === "thinking") {
    return [...tl.slice(0, -1), { type: "thinking", text: last.text + text }];
  }
  return [...tl, { type: "thinking", text }];
}

const READ_ITEMS_KEPT = 40; // enough to scroll; the full text is in the stash

function noteTool(
  tl: SilaSegment[],
  name: string,
  note: string,
  progress?: { done: number; total: number; item?: { title: string; meta?: string } }
): SilaSegment[] {
  // A live stage note ("Designing the layout…") for the open running step. A
  // counted read also carries the item just handled, appended to the step's
  // running list so the trace can scroll through what was read.
  for (let i = tl.length - 1; i >= 0; i--) {
    const s = tl[i];
    if (s.type === "tool" && s.name === name && s.status === "running") {
      if (!progress) return tl.map((x, j) => (j === i ? { ...s, note } : x));
      const items = progress.item
        ? [...(s.progress?.items ?? []), progress.item].slice(-READ_ITEMS_KEPT)
        : (s.progress?.items ?? []);
      const merged: SilaSegment = {
        ...s,
        note,
        progress: { done: progress.done, total: progress.total, items },
      };
      return tl.map((x, j) => (j === i ? merged : x));
    }
  }
  return tl;
}

function upsertTool(
  tl: SilaSegment[],
  name: string,
  status: "running" | "done",
  result?: string,
  sources?: SilaSource[],
  artifacts?: SilaArtifact[],
  tasks?: SilaTask[]
): SilaSegment[] {
  if (status === "running") return [...tl, { type: "tool", name, status }];
  const done: SilaSegment = {
    type: "tool",
    name,
    status: "done",
    result,
    sources,
    artifacts,
    tasks,
  };
  for (let i = tl.length - 1; i >= 0; i--) {
    const s = tl[i];
    if (s.type === "tool" && s.name === name && s.status === "running") {
      // The done frame replaces the step; what the running step accumulated
      // (the read list) is carried, or it would vanish the moment it finished.
      const kept: SilaSegment = s.progress ? { ...done, progress: s.progress } : done;
      return tl.map((x, j) => (j === i ? kept : x));
    }
  }
  return [...tl, done];
}

/** A skill attached to the chat, as the server confirms it (published ones only). */
export type SilaSkillRef = { id: string; name: string };

type ServerFrame =
  | { type: "ready"; session_id: string }
  | { type: "skills"; items: SilaSkillRef[] }
  | { type: "state"; value: SilaSocketState }
  | { type: "token"; content: string }
  | { type: "thinking"; content: string }
  | { type: "transcript"; content: string }
  | {
      type: "tool";
      name: string;
      sources?: SilaSource[];
      artifacts?: SilaArtifact[];
      status: "running" | "progress" | "done";
      result?: string;
      note?: string;
      tasks?: SilaTask[];
      progress?: { done: number; total: number; item?: { title: string; meta?: string } };
    }
  | {
      type: "ui";
      command: string;
      path?: string;
      modal?: string;
      prompt?: string;
      workflow_id?: string;
      definition?: SilaCanvasDef;
      kind?: string;
      output?: string;
      destination?: string | null;
      spec?: string;
      spec_slots?: SilaSpecSlot[];
      request_id?: string;
      plan?: SilaPlanArtifact;
      dashboard?: SilaDashboard;
      expert?: { slots?: Record<string, string> };
      draft?: SilaEmailDraft;
    }
  | { type: "say"; value: "start" | "end"; content?: string }
  | { type: "ask_user"; request_id: string; questions: SilaAskQuestion[]; freeform?: boolean }
  | {
      type: "request_credentials";
      request_id: string;
      provider: string;
      label: string;
      fields: SilaCredentialField[];
    }
  | { type: "request_connect"; request_id: string; provider: string; label: string }
  // Fan-out (cutover): the planner's decomposition + per-worker roster lanes.
  // Additive — unknown frames already no-op in the switch below; the roster UI
  // renders these in a later slice. `expert` detail is server-stripped for Beginners.
  | { type: "plan"; run_id: string; subtasks: { id: string; label: string }[] }
  | {
      type: "worker";
      run_id: string;
      worker_id: string;
      label: string;
      status: "queued" | "running" | "done" | "failed";
      result?: string;
    }
  | { type: "error"; message: string };

// Conference-call pacing: quiet check-in, then sleep if still silent.
const IDLE_CHECK_MS = 50_000;
const IDLE_SLEEP_MS = 105_000;
const SLEEP_PHRASES = /\b(go to sleep|goodbye|bye,? sila|that'?s all)\b/i;

/** A panel SILA opened mid-conversation (the `open_modal` UI command). */
export type SilaModal = { kind: string; prompt?: string };

/** An n8n workflow definition SILA built, for the read-only build canvas. */
export type SilaCanvasNode = { name: string; type: string; position?: [number, number] };
export type SilaCanvasDef = {
  nodes?: SilaCanvasNode[];
  connections?: Record<string, { main?: { node: string }[][] }>;
};
/** What the build canvas needs: the n8n workflow id (to embed its real canvas)
 *  and the definition (fallback / node count). */
export type SilaCanvas = { workflowId?: string; definition?: SilaCanvasDef };

/** LLM-driven elicitation — the model emits these; the bottom sheet renders them. */
export type SilaAskQuestion = {
  id: string;
  question: string;
  select: "single_select" | "multi_select";
  options: string[];
  allow_other?: boolean;
  // Optional specialised input; "schedule" renders a day + time-wheel picker (the answer
  // is a cron string) instead of the radio options.
  kind?: string;
};
export type SilaAsk = { requestId: string; questions: SilaAskQuestion[]; freeform?: boolean };
export type SilaAskAnswers = Record<string, string | string[]>;

/** Incognito credentials — a secret SILA needs for an integration. Values never
 *  enter the transcript; they go straight to the backend and into an encrypted store. */
export type SilaCredentialField = { key: string; label: string; secret?: boolean };
export type SilaCredentialRequest = {
  requestId: string;
  provider: string;
  label: string;
  fields: SilaCredentialField[];
};
export type SilaCredentialValues = Record<string, string>;

// WS-9 — the build needs an OAuth app (Slack) the user hasn't connected yet.
export type SilaConnectRequest = {
  requestId: string;
  provider: string;
  label: string;
};

/** The Outlook confirm panel: SILA drafted an email and is waiting for the user to
 *  Send or Cancel. No email is delivered until `respondEmailConfirm(true)`. */
export type SilaEmailDraft = { to: string; subject: string; body: string };
export type SilaEmailConfirm = { requestId: string; draft: SilaEmailDraft };

/** Plan→Build handoff: an accepted plan pre-seeds the build interview. The backend
 *  sanitizes it (whitelisted slots, capped values) and the gate re-validates — the
 *  seed fills answers, it never bypasses the guard. */
export type SilaBuildSeed = { agent_type: string; filled: Record<string, string> };

/** The Plan-mode plan artifact — a structured, approvable proposal. Built and
 *  validated server-side (plan_artifact.py); rendered as an inline card with
 *  Accept / Adjust / Discard when its requestId matches the live ask. */
export type SilaPlanDecision = { question: string; options: string[] };
/** One execution step — a functional, context-driven title (never "Step 1"), its
 *  data handoff, and dependency/parallel notes. */
export type SilaPlanStep = {
  title: string;
  detail?: string;
  input?: string;
  output?: string;
  dependsOn?: string;
  parallel?: boolean;
};
export type SilaPlanRisk = { risk: string; fallback: string };
export type SilaPlanArtifact = {
  goal: string;
  agentType?: string;
  content?: string;
  sources?: string;
  destination?: string;
  integrations?: string[];
  schedule?: string;
  fallback?: string;
  steps?: SilaPlanStep[];
  risks?: SilaPlanRisk[];
  checkpoints?: string[];
  openDecisions?: SilaPlanDecision[];
  bazaarMatch?: { id: string; name: string; note?: string } | null;
  seed?: SilaBuildSeed;
  /** Expert-only slot mapping — server-stripped for Beginner sockets. */
  expertSlots?: Record<string, string>;
};

export type UseSilaSocket = {
  connection: SilaConnection;
  // Human-readable reason when the server REJECTED the connection (session cap,
  // expired auth) — the chat shows it instead of failing silently.
  closeReason: string;
  state: SilaSocketState;
  reply: string;
  transcript: string;
  tools: SilaToolEvent[];
  /** Chronological text + tool steps for the current turn (for the trace). */
  timeline: SilaSegment[];
  /** Parallel-worker lanes for a fan-out turn (empty otherwise). */
  roster: SilaWorkerLane[];
  /** A panel SILA opened mid-conversation, or null. */
  modal: SilaModal | null;
  /** Dismiss the open panel. */
  clearModal: () => void;
  /** The latest n8n workflow SILA built, for the read-only build canvas. */
  canvas: SilaCanvas | null;
  /** Forget the built workflow (e.g. on a new session). */
  clearCanvas: () => void;
  /** An elicitation the model raised (the bottom-sheet wizard), or null. */
  ask: SilaAsk | null;
  /** Send the wizard's selections back to resume the turn. */
  sendAskResponse: (requestId: string, answers: SilaAskAnswers) => void;
  /** Dismiss the wizard without answering. */
  clearAsk: () => void;
  /** A masked credential SILA needs (the Incognito panel), or null. */
  credentialRequest: SilaCredentialRequest | null;
  /** Send the entered secret to the backend (it's stored encrypted, never in chat). */
  sendCredentials: (requestId: string, provider: string, values: SilaCredentialValues) => void;
  /** Dismiss the Incognito panel; tell the backend to build without it. */
  skipCredentials: (provider: string) => void;
  /** An OAuth app SILA needs connected (Nango Connect flow), or null. */
  connectRequest: SilaConnectRequest | null;
  /** Resume the build after the user connected (ok) or cancelled (!ok). */
  sendConnectResult: (provider: string, ok: boolean) => void;
  /** Dismiss the connect prompt locally. */
  clearConnectRequest: () => void;
  /** An email SILA drafted and is waiting to send (the Outlook confirm panel), or null. */
  emailConfirm: SilaEmailConfirm | null;
  /** Resume after the user hit Send (true → delivers) or Cancel (false → discards). */
  respondEmailConfirm: (confirmed: boolean) => void;
  /** Hands-free engine is running (mic open, clap detection armed). */
  handsFree: boolean;
  /** SILA is in active conversation (awake) vs waiting for the wake clap. */
  awake: boolean;
  /** The user is talking right now (an utterance is being captured). */
  capturing: boolean;
  send: (text: string) => void;
  /** Interrupt the in-flight turn (cooperative stop on the backend). */
  stop: () => void;
  /** Opens the mic once and arms clap-to-wake. */
  enableHandsFree: () => Promise<void>;
  /** Manual wake/sleep (fallback for the orb tap). */
  wakeUp: () => void;
  goToSleep: () => void;
};

/**
 * SILA client — text + hands-free voice. Clap twice to wake; speak naturally
 * (VAD segments utterances); ~50s of silence triggers "are you still there?",
 * ~105s puts her back to sleep. Audio is never persisted anywhere.
 */
export function useSilaSocket({
  token,
  workspaceId,
  onNavigate,
  model,
  mode,
  sessionId,
  buildSeed,
  template,
  skills,
  onSkills,
}: {
  token: string;
  workspaceId: string | null;
  onNavigate: (path: string) => void;
  /** Per-session model override (the picker); empty = platform default. */
  model?: string;
  /** Per-session mode (Build/Plan/Auto); empty = auto. */
  mode?: string;
  /** Resume an existing session (from Recents); empty = a fresh session. */
  sessionId?: string;
  /** Plan→Build handoff seed, sent once in the hello (an accepted plan). */
  buildSeed?: SilaBuildSeed | null;
  /** Built-in template ID (Data Analyst…) — the server whitelists it and pins
   *  the persona for the session. Never prompt text. */
  template?: string;
  /** Bazaar skill IDs attached to the chat. Undefined = keep what the session
   *  has (a resumed chat); a list — even empty — is the user's choice now. */
  skills?: string[];
  /** The server's confirmed skills (names for the chips, published only). */
  onSkills?: (items: SilaSkillRef[]) => void;
}): UseSilaSocket {
  const [connection, setConnection] = useState<SilaConnection>("disconnected");
  // Circuit-breaker bookkeeping for connect() — see the comment there.
  const attemptsRef = useRef(0);
  const attemptWindowRef = useRef(0);
  const [state, setState] = useState<SilaSocketState>("idle");
  const [reply, setReply] = useState("");
  const [transcript, setTranscript] = useState("");
  const [tools, setTools] = useState<SilaToolEvent[]>([]);
  const [timeline, setTimeline] = useState<SilaSegment[]>([]);
  const [roster, setRoster] = useState<SilaWorkerLane[]>([]);
  const [modal, setModal] = useState<SilaModal | null>(null);
  const [canvas, setCanvas] = useState<SilaCanvas | null>(null);
  const [ask, setAsk] = useState<SilaAsk | null>(null);
  const [credentialRequest, setCredentialRequest] = useState<SilaCredentialRequest | null>(null);
  const [connectRequest, setConnectRequest] = useState<SilaConnectRequest | null>(null);
  const [emailConfirm, setEmailConfirm] = useState<SilaEmailConfirm | null>(null);
  const [handsFree, setHandsFree] = useState(false);
  const [awake, setAwake] = useState(false);
  const [capturing, setCapturing] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const queueRef = useRef<string[]>([]);
  // Bounded auto-retry when a message is stuck in the queue after a drop —
  // a send must never die silently (live bug: "it not respond at all").
  const retryRef = useRef(0);
  const [closeReason, setCloseReason] = useState<string>("");
  const earsRef = useRef<SilaEars | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const playingRef = useRef<AudioBufferSourceNode | null>(null);
  const awakeRef = useRef(false);
  const lastActivityRef = useRef(0);
  const idleAskedRef = useRef(false);
  const pendingSleepRef = useRef(false);
  const onNavigateRef = useRef(onNavigate);
  onNavigateRef.current = onNavigate;
  const modelRef = useRef(model);
  modelRef.current = model;
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const sessionIdRef = useRef(sessionId);
  sessionIdRef.current = sessionId;
  const buildSeedRef = useRef(buildSeed);
  buildSeedRef.current = buildSeed;
  const templateRef = useRef(template);
  templateRef.current = template;
  const skillsRef = useRef(skills);
  skillsRef.current = skills;
  const onSkillsRef = useRef(onSkills);
  onSkillsRef.current = onSkills;
  // The set the server last confirmed: the chat echoing it back into `skills`
  // is not a change worth a reconnect.
  const confirmedSkillsRef = useRef<string | null>(null);

  const markActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    idleAskedRef.current = false;
  }, []);

  const goToSleep = useCallback(() => {
    awakeRef.current = false;
    setAwake(false);
    setCapturing(false);
    setTranscript("");
    setReply("");
    earsRef.current?.setMode("wake");
    setState("idle");
  }, []);
  const goToSleepRef = useRef(goToSleep);
  goToSleepRef.current = goToSleep;

  const stopPlayback = useCallback(() => {
    try {
      playingRef.current?.stop();
    } catch {
      /* already stopped */
    }
    playingRef.current = null;
    earsRef.current?.setDucked(false);
  }, []);

  const playWav = useCallback(
    async (data: ArrayBuffer) => {
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") await ctx.resume();
      const buffer = await ctx.decodeAudioData(data);
      stopPlayback();
      earsRef.current?.setDucked(true); // don't let her hear herself
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.onended = () => {
        if (playingRef.current === source) playingRef.current = null;
        earsRef.current?.setDucked(false);
        if (pendingSleepRef.current) {
          pendingSleepRef.current = false;
          goToSleepRef.current();
        }
      };
      playingRef.current = source;
      source.start();
    },
    [stopPlayback]
  );

  const connect = useCallback(() => {
    if (!token || !workspaceId || wsRef.current) return;
    // Circuit breaker. connect() is reachable from six places (send, wake, the
    // mode/template/token switches, the close-retry timer), and each call sets
    // state. A caller loop therefore renders without bound and React kills the
    // page with "Maximum update depth exceeded" — the tab dies mid-conversation
    // and the user loses the thread. Past a plainly impossible rate this stops
    // and shows an error instead, which is recoverable.
    const now = Date.now();
    if (now - attemptWindowRef.current > CONNECT_WINDOW_MS) {
      attemptWindowRef.current = now;
      attemptsRef.current = 0;
    }
    if (++attemptsRef.current > MAX_CONNECTS_PER_WINDOW) {
      setCloseReason("Connection kept restarting — reload the page to continue.");
      setConnection("error");
      return;
    }
    setConnection("connecting");
    let ws: WebSocket;
    try {
      ws = new WebSocket(`${API_URL.replace(/^http/, "ws")}/v1/sila/ws`);
    } catch {
      // A throwing constructor (bad URL, blocked scheme) used to leave the UI
      // on "connecting" forever: state was set, no socket existed, and no
      // handler could ever fire to correct it.
      setCloseReason("Couldn't reach SILA — check your connection and try again.");
      setConnection("error");
      return;
    }
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          type: "hello",
          token,
          workspace_id: workspaceId,
          model: modelRef.current || undefined,
          mode: modeRef.current || undefined,
          session_id: sessionIdRef.current || undefined,
          build_seed: buildSeedRef.current || undefined,
          template: templateRef.current || undefined,
          skills: skillsRef.current,
        })
      );
    };
    ws.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) {
        void playWav(event.data);
        return;
      }
      let frame: ServerFrame;
      try {
        frame = JSON.parse(event.data);
      } catch {
        return;
      }
      switch (frame.type) {
        case "skills": {
          confirmedSkillsRef.current = frame.items.map((item) => item.id).join(",");
          onSkillsRef.current?.(frame.items);
          break;
        }
        case "ready": {
          setConnection("ready");
          retryRef.current = 0;
          setCloseReason("");
          // Record the live session id so the sidebar can tell when you delete the
          // one you're in (a brand-new session has no ?session in the URL yet).
          try {
            sessionStorage.setItem("sila:active-session", frame.session_id);
          } catch {
            /* sessionStorage unavailable */
          }
          for (const text of queueRef.current.splice(0)) {
            ws.send(JSON.stringify({ type: "text", content: text }));
          }
          break;
        }
        case "state": {
          setState(frame.value);
          if (frame.value === "thinking") {
            setReply("");
            setTools([]);
            setTimeline([]);
            setRoster([]);
          }
          break;
        }
        case "token":
          setReply((r) => r + frame.content);
          setTimeline((tl) => pushText(tl, frame.content));
          break;
        case "thinking":
          // Reasoning streams into the trace only (the collapsible thinking
          // section), never the reply text.
          setTimeline((tl) => pushThinking(tl, frame.content));
          break;
        case "transcript":
          setTranscript(frame.content);
          markActivity();
          if (SLEEP_PHRASES.test(frame.content)) pendingSleepRef.current = true;
          break;
        case "tool": {
          // Destructured const so TS narrows the status union after the guard.
          const { name: toolName, status: toolStatus } = frame;
          if (toolStatus === "progress") {
            // A live stage note for the running step — update in place.
            setTimeline((tl) => noteTool(tl, toolName, frame.note ?? "", frame.progress));
            break;
          }
          setTools((t) => {
            const next = t.filter((e) => e.name !== toolName);
            return [...next, { name: toolName, status: toolStatus }];
          });
          setTimeline((tl) =>
            upsertTool(
              tl,
              toolName,
              toolStatus,
              frame.result,
              frame.sources,
              frame.artifacts,
              frame.tasks
            )
          );
          break;
        }
        case "ui":
          if (frame.command === "navigate" && frame.path) onNavigateRef.current(frame.path);
          else if (frame.command === "open_modal" && frame.modal) {
            setModal({ kind: frame.modal, prompt: frame.prompt });
          } else if (frame.command === "open_dashboard" && frame.dashboard) {
            const dash = frame.dashboard;
            // An edit re-emits the WHOLE dashboard (the server merges the new
            // charts into it). Appending gave the turn two blocks, the second a
            // superset of the first, with a seam and a gap between — so the
            // live turn's existing block is replaced in place.
            setTimeline((tl) => {
              const at = tl.findIndex((s) => s.type === "dashboard");
              const seg = { type: "dashboard" as const, dashboard: dash };
              return at === -1 ? [...tl, seg] : tl.map((s, i) => (i === at ? seg : s));
            });
          } else if (frame.command === "open_canvas") {
            setCanvas({ workflowId: frame.workflow_id, definition: frame.definition });
            // Render the workflow inline in the trace (and persist it with the turn).
            setTimeline((tl) => [
              ...tl,
              { type: "canvas", workflowId: frame.workflow_id, definition: frame.definition },
            ]);
          } else if (frame.command === "open_plan" && frame.plan) {
            const plan = { ...frame.plan, expertSlots: frame.expert?.slots };
            setTimeline((tl) => [...tl, { type: "plan", plan, requestId: frame.request_id }]);
          } else if (frame.command === "confirm_email" && frame.draft && frame.request_id) {
            const draft = frame.draft;
            const rid = frame.request_id;
            setEmailConfirm({ requestId: rid, draft });
            // Render inline in the trace (and persist it with the turn), like the
            // preview/plan cards — no popup.
            setTimeline((tl) => [...tl, { type: "email", draft, requestId: rid }]);
          } else if (frame.command === "open_preview") {
            setTimeline((tl) => [
              ...tl,
              {
                type: "preview",
                kind: frame.kind,
                output: frame.output ?? "",
                destination: frame.destination,
                spec: frame.spec,
                specSlots: frame.spec_slots,
                requestId: frame.request_id,
              },
            ]);
          }
          break;
        case "say":
          if (frame.value === "end" && frame.content) setReply(frame.content);
          break;
        case "request_credentials":
          setCredentialRequest({
            requestId: frame.request_id,
            provider: frame.provider,
            label: frame.label,
            fields: frame.fields,
          });
          break;
        case "request_connect":
          setConnectRequest({
            requestId: frame.request_id,
            provider: frame.provider,
            label: frame.label,
          });
          break;
        case "ask_user":
          setAsk({
            requestId: frame.request_id,
            questions: frame.questions,
            freeform: frame.freeform,
          });
          break;
        case "plan":
          // The planner's decomposition — seed the roster with queued lanes.
          setRoster((r) => {
            let next = r;
            for (const st of frame.subtasks)
              next = upsertLane(next, { worker_id: st.id, label: st.label, status: "queued" });
            return next;
          });
          break;
        case "worker":
          setRoster((r) =>
            upsertLane(r, {
              worker_id: frame.worker_id,
              label: frame.label,
              status: frame.status,
              result: frame.result,
            })
          );
          break;
        case "error":
          if (frame.message === "voice_unavailable") break;
          if (frame.message === "turn_failed" || frame.message === "internal") {
            // The TURN died (LLM/DB hiccup) but the socket is fine — tell the
            // user and stay usable; don't paint the whole connection red.
            setCloseReason("That request failed unexpectedly — please try again.");
            setState("idle");
            break;
          }
          setConnection("error");
          break;
      }
    };
    ws.onclose = (e) => {
      // A mode switch reconnects eagerly, so a NEWER socket may already own the
      // ref — the stale socket's close must not clobber it.
      if (wsRef.current !== ws) return;
      wsRef.current = null;
      // Server-intent close codes → a HUMAN reason the chat shows (a rejected
      // connection must never read as silence).
      if (e.code === 4401) {
        setCloseReason("Your session expired — refresh the page and sign in again.");
        setConnection("error");
        return;
      }
      if (e.code === 4403) {
        setCloseReason("You don't have access to this workspace.");
        setConnection("error");
        return;
      }
      if (e.code === 4429) {
        setCloseReason("Daily chat-session limit reached — try again tomorrow.");
        setConnection("error");
        return;
      }
      setConnection((c) => (c === "error" ? c : "disconnected"));
      goToSleepRef.current();
      // A message is waiting → retry with backoff instead of dying silently.
      if (queueRef.current.length > 0 && retryRef.current < 4) {
        const attempt = retryRef.current++;
        setTimeout(() => connect(), 700 * 2 ** attempt);
      } else if (queueRef.current.length > 0) {
        setCloseReason("Couldn't reach SILA — check your connection and try again.");
        setConnection("error");
      }
    };
    ws.onerror = () => {
      if (wsRef.current === ws) setConnection("error");
    };
  }, [token, workspaceId, playWav, markActivity]);

  const wakeUp = useCallback(() => {
    awakeRef.current = true;
    setAwake(true);
    markActivity();
    earsRef.current?.setMode("conversation");
    setState("listening");
    connect();
  }, [connect, markActivity]);

  const enableHandsFree = useCallback(async () => {
    if (earsRef.current) return;
    const ears = new SilaEars({
      onWake: () => {
        if (!awakeRef.current) wakeUp();
      },
      onUtteranceStart: () => setCapturing(true),
      onUtteranceChunk: (chunk) => {
        void chunk.arrayBuffer().then((buf) => {
          const ws = wsRef.current;
          if (ws && ws.readyState === WebSocket.OPEN) ws.send(buf);
        });
      },
      onUtteranceEnd: () => {
        setCapturing(false);
        markActivity();
        const ws = wsRef.current;
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "voice_end" }));
        }
      },
    });
    earsRef.current = ears;
    await ears.start("wake");
    setHandsFree(true);
  }, [markActivity, wakeUp]);

  // Idle check-ins while awake; sleep after prolonged silence.
  useEffect(() => {
    if (!awake) return;
    const id = setInterval(() => {
      const quiet = Date.now() - lastActivityRef.current;
      const ws = wsRef.current;
      if (quiet > IDLE_SLEEP_MS) {
        goToSleepRef.current();
      } else if (quiet > IDLE_CHECK_MS && !idleAskedRef.current) {
        idleAskedRef.current = true;
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "idle_check" }));
        }
      }
    }, 5_000);
    return () => clearInterval(id);
  }, [awake]);

  // Model switch — drop the socket so the next turn reconnects with the new
  // model in its hello. Lazy: if nothing is connected yet, this is a no-op.
  const prevModelRef = useRef(model);
  useEffect(() => {
    if (prevModelRef.current === model) return;
    prevModelRef.current = model;
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, [model]);

  // Mode switch (Build/Plan/Auto) — drop the socket and reconnect EAGERLY so the new
  // mode's prompt + tool scope (and any Plan→Build seed) are live before the next
  // message; queued sends flush on "ready", so the switch never loses a message.
  const prevModeRef = useRef(mode);
  useEffect(() => {
    if (prevModeRef.current === mode) return;
    prevModeRef.current = mode;
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
      connect();
    }
  }, [mode, connect]);

  // Skill attach/remove — reconnect so the next message carries the new set
  // (the server fences the published instructions into the prompt). A set the
  // server itself just confirmed is not a change.
  const skillsKey = skills === undefined ? null : skills.join(",");
  const prevSkillsKeyRef = useRef(skillsKey);
  useEffect(() => {
    if (prevSkillsKeyRef.current === skillsKey) return;
    prevSkillsKeyRef.current = skillsKey;
    if (skillsKey !== null && skillsKey === confirmedSkillsRef.current) return;
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
      connect();
    }
  }, [skillsKey, connect]);

  // Template pin/unpin (the Bazaar's "Use template" chip) — reconnect eagerly so
  // the persona applies (or stops applying) before the next message.
  const prevTemplateRef = useRef(template);
  useEffect(() => {
    if (prevTemplateRef.current === template) return;
    prevTemplateRef.current = template;
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
      connect();
    }
  }, [template, connect]);

  // Silent JWT refresh swapped the token — reconnect eagerly so the live socket
  // carries the FRESH token in its hello before the old one expires. Without
  // this, the server's per-turn re-verify would close the socket at expiry
  // (4401) mid-conversation; the durable session state makes the reconnect
  // invisible. Only acts on an already-open socket; the first connect always
  // uses the current token.
  const prevTokenRef = useRef(token);
  useEffect(() => {
    if (prevTokenRef.current === token) return;
    prevTokenRef.current = token;
    if (token && wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
      connect();
    }
  }, [token, connect]);

  // Session switch (Recents / New session) — drop the socket so the next turn
  // reconnects with the new session_id (or a fresh one) in its hello.
  const prevSessionRef = useRef(sessionId);
  useEffect(() => {
    if (prevSessionRef.current === sessionId) return;
    prevSessionRef.current = sessionId;
    // Switching sessions (incl. deleting the active one → new session): reset all
    // live display state so the old session's reply/canvas/sheet can't linger.
    setReply("");
    setTimeline([]);
    setTools([]);
    setAsk(null);
    setCredentialRequest(null);
    setCanvas(null);
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, [sessionId]);

  useEffect(
    () => () => {
      earsRef.current?.stop();
      earsRef.current = null;
      wsRef.current?.close();
      wsRef.current = null;
      stopPlayback();
      void audioCtxRef.current?.close();
    },
    [stopPlayback]
  );

  const send = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      setTranscript("");
      setCloseReason("");
      // Clear the live reply NOW (don't wait for the WS "thinking") so a
      // just-committed turn isn't briefly rendered twice.
      setReply("");
      setTimeline([]);
      setTools([]);
      markActivity();
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN && connection === "ready") {
        ws.send(JSON.stringify({ type: "text", content: trimmed }));
      } else {
        queueRef.current.push(trimmed);
        connect();
      }
    },
    [connect, connection, markActivity]
  );

  const clearModal = useCallback(() => setModal(null), []);
  const clearCanvas = useCallback(() => setCanvas(null), []);

  const sendAskResponse = useCallback(
    (requestId: string, answers: SilaAskAnswers) => {
      setAsk(null);
      setReply("");
      setTimeline([]);
      setTools([]);
      markActivity();
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "ask_user_response", request_id: requestId, answers }));
      }
    },
    [markActivity]
  );

  const sendCredentials = useCallback(
    (requestId: string, provider: string, values: SilaCredentialValues) => {
      setCredentialRequest(null);
      setReply("");
      setTimeline([]);
      setTools([]);
      markActivity();
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        // Goes straight to the backend's encrypted store — never rendered or persisted.
        ws.send(
          JSON.stringify({ type: "credentials_response", request_id: requestId, provider, values })
        );
      }
    },
    [markActivity]
  );

  const skipCredentials = useCallback(
    (provider: string) => {
      setCredentialRequest(null);
      markActivity();
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "credentials_response", provider, values: {} }));
      }
    },
    [markActivity]
  );

  const sendConnectResult = useCallback(
    (provider: string, ok: boolean) => {
      setConnectRequest(null);
      if (ok) {
        setReply("");
        setTimeline([]);
        setTools([]);
      }
      markActivity();
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "connect_response", provider, ok }));
      }
    },
    [markActivity]
  );

  const respondEmailConfirm = useCallback(
    (confirmed: boolean) => {
      setEmailConfirm(null);
      // The resume streams a fresh assistant turn (the send + a closing line);
      // clear the live turn so it renders on its own, like the connect resume.
      setReply("");
      setTimeline([]);
      setTools([]);
      markActivity();
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "email_confirm_response", confirmed }));
      }
    },
    [markActivity]
  );

  const stop = useCallback(() => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "stop" }));
    }
  }, []);

  return {
    connection,
    closeReason,
    state,
    reply,
    transcript,
    tools,
    timeline,
    roster,
    modal,
    clearModal,
    canvas,
    clearCanvas,
    ask,
    sendAskResponse,
    clearAsk: useCallback(() => setAsk(null), []),
    credentialRequest,
    sendCredentials,
    skipCredentials,
    connectRequest,
    sendConnectResult,
    clearConnectRequest: useCallback(() => setConnectRequest(null), []),
    emailConfirm,
    respondEmailConfirm,
    handsFree,
    awake,
    capturing,
    send,
    stop,
    enableHandsFree,
    wakeUp,
    goToSleep,
  };
}
