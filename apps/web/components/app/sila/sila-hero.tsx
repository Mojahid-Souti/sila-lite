"use client";

import { SilaAvatar } from "@/components/app/sila/sila-avatar";
import type { SilaState } from "@/components/app/sila/sila-script";
import { useWorkspaces } from "@/components/app/workspace-context";
import { useSilaSocket } from "@/lib/sila-socket";
import { useToken } from "@/lib/use-token";
import { ArrowUp, Check, Loader2, Mic, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const MIC_CONSENT_KEY = "sila-mic-consent";

/**
 * SILA home — hands-free concierge. Clap twice to wake her, talk naturally
 * (no buttons), she checks in when you go quiet and sleeps if you leave.
 * Typing always works; the orb tap is a manual wake/sleep fallback.
 */
export function SilaHero() {
  const t = useTranslations("sila");
  const router = useRouter();
  const token = useToken();
  const { currentId } = useWorkspaces();
  const [consentOpen, setConsentOpen] = useState(false);

  const sila = useSilaSocket({
    token,
    workspaceId: currentId,
    onNavigate: (path) => router.push(path),
  });

  // Returning visitor with consent on file: arm the ears automatically.
  // (Browsers may keep the AudioContext suspended until a gesture — the
  // one-time pointer listener retries on the first click anywhere.)
  const { enableHandsFree } = sila;
  useEffect(() => {
    if (typeof window === "undefined" || !localStorage.getItem(MIC_CONSENT_KEY)) return;
    enableHandsFree().catch(() => {
      const retry = () => void enableHandsFree().catch(() => undefined);
      window.addEventListener("pointerdown", retry, { once: true });
    });
  }, [enableHandsFree]);

  function tapOrb() {
    if (!localStorage.getItem(MIC_CONSENT_KEY)) {
      setConsentOpen(true);
      return;
    }
    if (sila.awake) sila.goToSleep();
    else sila.wakeUp();
  }

  const [input, setInput] = useState("");
  const [lastAsked, setLastAsked] = useState("");

  function ask(text: string) {
    if (!text.trim()) return;
    setLastAsked(text.trim());
    sila.send(text);
    setInput("");
  }

  // Orb: calm while asleep; live server states while awake or typing.
  const orbState: SilaState = sila.awake
    ? sila.state === "idle"
      ? "listening"
      : sila.state
    : sila.state === "thinking" || sila.state === "speaking"
      ? sila.state
      : "idle";

  const heard = sila.transcript || lastAsked;

  return (
    <section className="flex w-full max-w-2xl flex-col items-center px-4">
      <button
        type="button"
        onClick={tapOrb}
        aria-pressed={sila.awake}
        aria-label={sila.awake ? t("sleepAria") : t("wakeAria")}
        className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-neutral-300"
      >
        <SilaAvatar state={sila.capturing ? "listening" : orbState} variant="icon" />
      </button>

      {/* Caption area — fixed min height so the orb never jumps */}
      <div className="mt-3 flex min-h-28 w-full flex-col items-center">
        {sila.capturing ? (
          <p className="flex items-center gap-2 font-semibold text-lg text-neutral-900 tracking-tight">
            <span className="inline-block size-2.5 animate-pulse rounded-full bg-red-500" />
            {t("hearing")}
          </p>
        ) : sila.connection === "error" ? (
          <p className="font-medium text-neutral-400 text-sm">{t("offline")}</p>
        ) : sila.reply ? (
          <p className="max-w-xl text-center font-semibold text-lg text-neutral-900 tracking-tight">
            {sila.reply}
          </p>
        ) : heard && sila.state === "thinking" ? (
          <p className="text-center text-base text-neutral-400">“{heard}”</p>
        ) : sila.awake ? (
          <p className="font-semibold text-lg text-neutral-900 tracking-tight">
            {t(`states.${sila.state === "idle" ? "listening" : sila.state}`)}
          </p>
        ) : (
          <p className="font-medium text-base text-neutral-500">
            {sila.handsFree ? t("clapHint") : t("enableHint")}
          </p>
        )}

        {sila.tools.length > 0 && (
          <ul className="mt-4 w-full max-w-sm space-y-1.5">
            {sila.tools.map((tool) => (
              <li
                key={tool.name}
                className="sila-trail-card flex items-center gap-2.5 rounded-xl border border-neutral-200 bg-white/80 px-3.5 py-2.5 shadow-sm backdrop-blur"
              >
                {tool.status === "running" ? (
                  <Loader2 className="size-4 shrink-0 animate-spin text-neutral-400" />
                ) : (
                  <span className="grid size-4 shrink-0 place-items-center rounded-full bg-emerald-100">
                    <Check className="size-3 text-emerald-600" />
                  </span>
                )}
                <span className="text-neutral-700 text-sm">{t(`tools.${tool.name}`)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Composer — typing always works; mic icon = manual wake/sleep */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
        className="w-full max-w-xl rounded-2xl border border-neutral-200 bg-white shadow-sm transition-colors focus-within:border-neutral-300 focus-within:shadow-md"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              ask(input);
            }
          }}
          rows={2}
          placeholder={t("placeholder")}
          className="block w-full resize-none bg-transparent px-4 pt-3.5 text-neutral-900 text-sm leading-relaxed placeholder:text-neutral-400 focus:outline-none"
        />
        <div className="flex items-center justify-between px-2.5 pb-2.5">
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label={t("attach")}
              title={t("attachSoon")}
              className="grid size-8 place-items-center rounded-lg text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600"
            >
              <Plus className="size-4" />
            </button>
            <button
              type="button"
              onClick={tapOrb}
              aria-label={sila.awake ? t("sleepAria") : t("wakeAria")}
              className={`grid size-8 place-items-center rounded-lg transition-colors ${
                sila.awake
                  ? "bg-red-50 text-red-600"
                  : "text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
              }`}
            >
              <Mic className="size-4" />
            </button>
          </div>
          <button
            type="submit"
            disabled={!input.trim() || sila.state === "thinking"}
            aria-label={t("send")}
            className="grid size-8 shrink-0 place-items-center rounded-lg bg-neutral-950 text-white transition-colors hover:bg-neutral-800 disabled:opacity-30"
          >
            {sila.connection === "connecting" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ArrowUp className="size-4" />
            )}
          </button>
        </div>
      </form>

      {/* Mic consent — shown once; Phase 9 security checklist */}
      {consentOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-neutral-950/20 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-6 text-center shadow-xl">
            <span className="mx-auto grid size-12 place-items-center rounded-full bg-neutral-100 text-neutral-600">
              <Mic className="size-6" />
            </span>
            <h2 className="mt-3 font-semibold text-base text-neutral-950">{t("consentTitle")}</h2>
            <p className="mt-1 text-neutral-500 text-sm">{t("consentBody")}</p>
            <div className="mt-5 flex justify-center gap-2">
              <button
                type="button"
                onClick={() => setConsentOpen(false)}
                className="inline-flex h-9 items-center rounded-lg border border-neutral-200 px-4 font-medium text-neutral-700 text-sm hover:bg-neutral-50"
              >
                {t("consentDeny")}
              </button>
              <button
                type="button"
                onClick={async () => {
                  localStorage.setItem(MIC_CONSENT_KEY, "yes");
                  setConsentOpen(false);
                  try {
                    await sila.enableHandsFree();
                    sila.wakeUp();
                  } catch {
                    /* mic denied at browser level */
                  }
                }}
                className="inline-flex h-9 items-center rounded-lg bg-neutral-950 px-4 font-medium text-sm text-white hover:bg-neutral-800"
              >
                {t("consentAllow")}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
