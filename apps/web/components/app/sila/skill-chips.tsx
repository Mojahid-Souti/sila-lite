"use client";

import type { SilaSkillRef } from "@/lib/sila-socket";
import { ScrollText, X } from "lucide-react";
import { useTranslations } from "next-intl";

/**
 * The skills attached to the chat, as composer cards beside the template's —
 * same small tilted square, in the skills' colour. Removing one reconnects the
 * chat without it (lib/sila-socket.ts).
 */
export function SkillChips({
  skills,
  onRemove,
}: {
  skills: SilaSkillRef[];
  onRemove: (id: string) => void;
}) {
  const t = useTranslations("sila.skills");
  return (
    <>
      {skills.map((skill) => (
        <div
          key={skill.id}
          title={t("chipHint")}
          className="-rotate-2 relative flex w-[5.5rem] shrink-0 origin-bottom-left flex-col items-center gap-1.5 rounded-2xl border border-emerald-300/60 bg-white px-2 pt-3 pb-2 shadow-md transition-transform duration-200 hover:rotate-0"
        >
          <span className="grid size-9 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
            <ScrollText className="size-4" />
          </span>
          <span className="w-full truncate text-center font-medium text-[10.5px] text-neutral-800">
            {skill.name}
          </span>
          <button
            type="button"
            aria-label={t("remove", { name: skill.name })}
            onClick={() => onRemove(skill.id)}
            className="-top-1.5 -right-1.5 absolute grid size-5 place-items-center rounded-full border border-neutral-200 bg-white text-neutral-400 shadow-sm hover:text-neutral-700"
          >
            <X className="size-3" />
          </button>
        </div>
      ))}
    </>
  );
}
