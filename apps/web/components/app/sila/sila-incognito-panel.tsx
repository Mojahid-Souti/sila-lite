"use client";

import type { SilaCredentialField, SilaCredentialValues } from "@/lib/sila-socket";
import { cn } from "@/lib/utils";
import { Eye, EyeOff, Lock } from "lucide-react";
import { useState } from "react";

/**
 * Incognito credential panel — collects a secret SILA needs for an integration
 * (e.g. a Slack token) with masked inputs. The value goes straight to the backend's
 * encrypted store; it is NEVER echoed into the transcript. Docked above the composer
 * (positioning lives in sila-chat), mirroring the ask sheet.
 */
export function SilaIncognitoPanel({
  label,
  fields,
  onSubmit,
  onSkip,
}: {
  label: string;
  fields: SilaCredentialField[];
  onSubmit: (values: SilaCredentialValues) => void;
  onSkip: () => void;
}) {
  const [values, setValues] = useState<SilaCredentialValues>({});
  const [reveal, setReveal] = useState<Record<string, boolean>>({});
  const complete = fields.every((f) => (values[f.key] ?? "").trim().length > 0);

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-xl">
      <div className="flex items-center gap-2 text-neutral-900">
        <Lock className="size-4 text-neutral-500" />
        <span className="font-medium text-[15px]">Connect {label}</span>
      </div>
      <p className="mt-1 text-[12px] text-neutral-400">
        Stored encrypted with the integration — never saved in this chat.
      </p>

      <div className="mt-3 space-y-2.5">
        {fields.map((f) => {
          const masked = !!f.secret && !reveal[f.key];
          return (
            <label key={f.key} className="block">
              <span className="mb-1 block text-[12px] text-neutral-500">{f.label}</span>
              <div className="relative">
                <input
                  type={masked ? "password" : "text"}
                  value={values[f.key] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                  autoComplete="off"
                  spellCheck={false}
                  className={cn(
                    "w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-400",
                    f.secret && "pr-10"
                  )}
                />
                {f.secret && (
                  <button
                    type="button"
                    onClick={() => setReveal((r) => ({ ...r, [f.key]: !r[f.key] }))}
                    aria-label={masked ? "Show" : "Hide"}
                    className="-translate-y-1/2 absolute top-1/2 right-2 text-neutral-400 transition-colors hover:text-neutral-700"
                  >
                    {masked ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                  </button>
                )}
              </div>
            </label>
          );
        })}
      </div>

      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={onSkip}
          className="rounded-lg px-3 py-2 text-neutral-500 text-sm transition-colors hover:text-neutral-800"
        >
          Skip
        </button>
        <button
          type="button"
          disabled={!complete}
          onClick={() => onSubmit(values)}
          className="inline-flex h-9 items-center rounded-lg bg-neutral-950 px-5 font-medium text-sm text-white transition-colors hover:bg-neutral-800 disabled:opacity-40"
        >
          Connect
        </button>
      </div>
    </div>
  );
}
