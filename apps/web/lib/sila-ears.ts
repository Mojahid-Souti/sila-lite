"use client";

/**
 * SILA's ears — hands-free audio engine (no React, no network).
 *
 * Two modes on one persistent mic stream:
 *  - "wake":         watches for a DOUBLE CLAP (two sharp transients within
 *                    ~1s) and fires onWake. Nothing is recorded or sent.
 *  - "conversation": voice-activity detection segments utterances — when you
 *                    start talking a MediaRecorder spins up; ~1.4s of silence
 *                    ends the utterance (onUtteranceEnd → caller sends
 *                    voice_end). While SILA speaks, listening is "ducked" so
 *                    she doesn't hear herself (browser AEC helps too).
 *
 * Complexity: one rAF-paced analyser loop, O(fftSize) per tick (~every 50ms).
 */

export type EarsMode = "off" | "wake" | "conversation";

type EarsCallbacks = {
  onWake: () => void;
  onUtteranceStart: () => void;
  onUtteranceChunk: (chunk: Blob) => void;
  onUtteranceEnd: () => void;
};

// --- Tuning (calibrated for a quiet office; adjust if SILA mishears) -------
const TICK_MS = 50;
const CLAP_PEAK = 0.45; // amplitude a clap must exceed
const CLAP_MIN_GAP_MS = 120; // two claps: min/max spacing
const CLAP_MAX_GAP_MS = 900;
const SPEECH_START_RMS = 0.03; // above noise floor → talking
const SPEECH_END_RMS = 0.015; // below → silence
const SPEECH_START_TICKS = 3; // ~150ms of voice to trigger
const SPEECH_END_MS = 1400; // silence that ends an utterance
const MAX_UTTERANCE_MS = 20_000; // safety cut

export class SilaEars {
  private stream: MediaStream | null = null;
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private buf: Float32Array<ArrayBuffer> | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private recorder: MediaRecorder | null = null;

  private mode: EarsMode = "off";
  private ducked = false;
  private lastClapAt = 0;
  private clapArmed = true;
  private voiceTicks = 0;
  private silenceMs = 0;
  private utteranceMs = 0;
  private speaking = false;

  constructor(private cb: EarsCallbacks) {}

  /** Opens the mic (one permission prompt) and starts the analyser loop. */
  async start(mode: Exclude<EarsMode, "off">): Promise<void> {
    if (!this.stream) {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    }
    if (!this.ctx) {
      this.ctx = new AudioContext();
      const source = this.ctx.createMediaStreamSource(this.stream);
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 1024;
      source.connect(this.analyser);
      this.buf = new Float32Array(this.analyser.fftSize);
    }
    if (this.ctx.state === "suspended") await this.ctx.resume();
    this.setMode(mode);
    if (!this.timer) this.timer = setInterval(() => this.tick(), TICK_MS);
  }

  setMode(mode: EarsMode): void {
    this.mode = mode;
    this.voiceTicks = 0;
    this.silenceMs = 0;
    if (mode !== "conversation") this.abortUtterance();
  }

  /** True while SILA's own audio is playing — pauses speech detection. */
  setDucked(ducked: boolean): void {
    this.ducked = ducked;
    if (ducked) this.abortUtterance();
  }

  get currentMode(): EarsMode {
    return this.mode;
  }

  get isCapturing(): boolean {
    return this.speaking;
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.abortUtterance();
    if (this.stream) for (const t of this.stream.getTracks()) t.stop();
    this.stream = null;
    void this.ctx?.close();
    this.ctx = null;
    this.analyser = null;
    this.mode = "off";
  }

  // --- internals -----------------------------------------------------------

  private tick(): void {
    if (!this.analyser || !this.buf || this.mode === "off") return;
    this.analyser.getFloatTimeDomainData(this.buf);
    let peak = 0;
    let sum = 0;
    for (const v of this.buf) {
      const a = Math.abs(v);
      if (a > peak) peak = a;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / this.buf.length);

    if (this.mode === "wake") this.detectClaps(peak);
    else if (this.mode === "conversation" && !this.ducked) this.segmentSpeech(rms);
  }

  private detectClaps(peak: number): void {
    const now = performance.now();
    // Re-arm only after the room goes quiet again (one clap = one trigger).
    if (peak < CLAP_PEAK * 0.4) this.clapArmed = true;
    if (!this.clapArmed || peak < CLAP_PEAK) return;
    this.clapArmed = false;
    const gap = now - this.lastClapAt;
    if (gap > CLAP_MIN_GAP_MS && gap < CLAP_MAX_GAP_MS) {
      this.lastClapAt = 0;
      this.cb.onWake();
    } else {
      this.lastClapAt = now;
    }
  }

  private segmentSpeech(rms: number): void {
    if (!this.speaking) {
      this.voiceTicks = rms > SPEECH_START_RMS ? this.voiceTicks + 1 : 0;
      if (this.voiceTicks >= SPEECH_START_TICKS) this.beginUtterance();
      return;
    }
    this.utteranceMs += TICK_MS;
    if (rms < SPEECH_END_RMS) {
      this.silenceMs += TICK_MS;
      if (this.silenceMs >= SPEECH_END_MS || this.utteranceMs >= MAX_UTTERANCE_MS) {
        this.endUtterance();
      }
    } else {
      this.silenceMs = 0;
    }
  }

  private beginUtterance(): void {
    if (!this.stream || this.recorder) return;
    this.speaking = true;
    this.silenceMs = 0;
    this.utteranceMs = 0;
    this.voiceTicks = 0;
    const recorder = new MediaRecorder(this.stream, { mimeType: "audio/webm;codecs=opus" });
    this.recorder = recorder;
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.cb.onUtteranceChunk(e.data);
    };
    recorder.start(250);
    this.cb.onUtteranceStart();
  }

  private endUtterance(): void {
    const recorder = this.recorder;
    if (!recorder) return;
    this.recorder = null;
    this.speaking = false;
    recorder.onstop = () => {
      // Let the final ondataavailable chunk flush before signalling the end.
      setTimeout(() => this.cb.onUtteranceEnd(), 150);
    };
    recorder.stop();
  }

  private abortUtterance(): void {
    const recorder = this.recorder;
    this.recorder = null;
    this.speaking = false;
    if (recorder) {
      recorder.ondataavailable = null;
      recorder.onstop = null;
      try {
        recorder.stop();
      } catch {
        /* already stopped */
      }
    }
  }
}
