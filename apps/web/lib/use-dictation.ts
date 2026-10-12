"use client";

import { useCallback, useRef, useState } from "react";

// Minimal Web Speech typings (not in the standard DOM lib).
type SpeechResult = { 0: { transcript: string } };
type SpeechEvent = { results: ArrayLike<SpeechResult> };
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: SpeechEvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};
type RecognitionCtor = new () => Recognition;

function getCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * Push-to-talk dictation via the browser Web Speech API — calls `onText` with
 * the final transcript so the caller can drop it into the composer. Client-side
 * only (no server round-trip, so no auto-response). Unsupported on some browsers.
 */
export function useDictation(onText: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const recRef = useRef<Recognition | null>(null);
  const supported = getCtor() !== null;

  const toggle = useCallback(() => {
    if (recRef.current) {
      recRef.current.stop();
      return;
    }
    const Ctor = getCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = "en-US";
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (e) => {
      const text = Array.from(e.results, (r) => r[0].transcript)
        .join(" ")
        .trim();
      if (text) onText(text);
    };
    const cleanup = () => {
      recRef.current = null;
      setListening(false);
    };
    rec.onend = cleanup;
    rec.onerror = cleanup;
    recRef.current = rec;
    setListening(true);
    rec.start();
  }, [onText]);

  return { supported, listening, toggle };
}
