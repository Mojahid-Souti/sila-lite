"use client";

import { Eye, MonitorUp, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * SILA's "eyes" — she asks to see your screen; the browser's native share
 * picker grants it (getDisplayMedia, pure frontend). A small live tile shows
 * what she sees. Phase 16E streams these frames to the brain.
 */
export function SilaScreenShare({
  onGranted,
  onDenied,
}: {
  onGranted: () => void;
  onDenied: () => void;
}) {
  const t = useTranslations("sila.share");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [asking, setAsking] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  const stop = useCallback(() => {
    setStream((s) => {
      if (s) for (const track of s.getTracks()) track.stop();
      return null;
    });
  }, []);

  // Cleanup on unmount; also end the tile when the user stops from the
  // browser's own "stop sharing" bar.
  useEffect(() => {
    if (!stream) return;
    const video = videoRef.current;
    if (video) video.srcObject = stream;
    const [track] = stream.getVideoTracks();
    if (track) track.onended = stop;
    return stop;
  }, [stream, stop]);

  async function allow() {
    setAsking(false);
    try {
      const media = await navigator.mediaDevices.getDisplayMedia({ video: true });
      setStream(media);
      onGranted();
    } catch {
      onDenied();
    }
  }

  if (asking) {
    return (
      <div className="fixed inset-0 z-50 grid place-items-center bg-neutral-950/20 p-4 backdrop-blur-[2px]">
        <div className="sila-pulse-ring w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-6 text-center shadow-xl">
          <span className="mx-auto grid size-12 place-items-center rounded-full bg-neutral-100 text-neutral-600">
            <MonitorUp className="size-6" />
          </span>
          <h2 className="mt-3 font-semibold text-base text-neutral-950">{t("title")}</h2>
          <p className="mt-1 text-neutral-500 text-sm">{t("body")}</p>
          <div className="mt-5 flex justify-center gap-2">
            <button
              type="button"
              onClick={() => {
                setAsking(false);
                onDenied();
              }}
              className="inline-flex h-9 items-center rounded-lg border border-neutral-200 px-4 font-medium text-neutral-700 text-sm hover:bg-neutral-50"
            >
              {t("deny")}
            </button>
            <button
              type="button"
              onClick={allow}
              className="inline-flex h-9 items-center rounded-lg bg-neutral-950 px-4 font-medium text-sm text-white hover:bg-neutral-800"
            >
              {t("allow")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!stream) return null;

  return (
    <div className="fixed right-5 bottom-5 z-50 w-72 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xl">
      <div className="flex items-center justify-between px-3 py-2">
        <span className="inline-flex items-center gap-1.5 font-medium text-neutral-700 text-xs">
          <Eye className="size-3.5 text-emerald-600" />
          {t("viewing")}
        </span>
        <button
          type="button"
          onClick={stop}
          aria-label={t("stop")}
          className="grid size-6 place-items-center rounded-md text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
        >
          <X className="size-3.5" />
        </button>
      </div>
      <video ref={videoRef} autoPlay muted className="block w-full bg-neutral-950" />
    </div>
  );
}
