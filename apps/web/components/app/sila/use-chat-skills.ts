"use client";

import { api } from "@/lib/api";
import { parseSkillParam } from "@/lib/chat-links";
import { MAX_CHAT_SKILLS } from "@/lib/constants";
import type { SilaSkillRef } from "@/lib/sila-socket";
import { useToast } from "@/lib/toast";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * The chat's skills: what the composer shows and what the socket hello sends.
 *
 * `undefined` until the user or the server sets them — a resumed chat then
 * keeps what its session had, and the server's `skills` frame fills the chips.
 * A chat pinned to the OKR Reporting Pack carries none (the server refuses them
 * too). The bell gets its entry from the server; the toast is immediate.
 */
export function useChatSkills({
  token,
  skillParam,
  okrPinned,
}: {
  token: string;
  /** `?skill=<id>[,<id>…]` — the Bazaar's "Use skill" / template + skills. */
  skillParam: string;
  okrPinned: boolean;
}) {
  const t = useTranslations("sila.skills");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [skills, setSkills] = useState<SilaSkillRef[] | undefined>(undefined);
  const skillsRef = useRef(skills);
  skillsRef.current = skills;

  /** The chat's set becomes `next` (capped); one toast names what was added. */
  const commit = useCallback(
    (next: SilaSkillRef[]) => {
      const before = new Set((skillsRef.current ?? []).map((s) => s.id));
      const kept = next.slice(0, MAX_CHAT_SKILLS).map(({ id, name }) => ({ id, name }));
      skillsRef.current = kept;
      setSkills(kept);
      const added = kept.filter((s) => !before.has(s.id)).map((s) => s.name);
      if (added.length === 1) toast(t("attached", { name: added[0] }), "success");
      if (added.length > 1) toast(t("attachedMany", { names: added.join(", ") }), "success");
      if (next.length > MAX_CHAT_SKILLS) toast(t("limit", { max: MAX_CHAT_SKILLS }), "error");
    },
    [t, toast]
  );

  /** Add skills to the chat (the Bazaar's "Use skill", "/ → Add a skill"). */
  const attachMany = useCallback(
    (incoming: SilaSkillRef[]) => {
      if (okrPinned) return toast(t("confidential"), "info");
      const current = skillsRef.current ?? [];
      const fresh = incoming.filter((s) => !current.some((c) => c.id === s.id));
      if (fresh.length === 0 && incoming.length === 1) {
        return toast(t("already", { name: incoming[0].name }), "info");
      }
      if (current.length >= MAX_CHAT_SKILLS && fresh.length) {
        return toast(t("limit", { max: MAX_CHAT_SKILLS }), "error");
      }
      commit([...current, ...fresh]);
    },
    [okrPinned, commit, t, toast]
  );
  const attach = useCallback((skill: SilaSkillRef) => attachMany([skill]), [attachMany]);

  /** Replace the chat's skills — the template picker hands over the whole set. */
  const setAll = useCallback(
    (next: SilaSkillRef[], { okr = false }: { okr?: boolean } = {}) => {
      if (okr) {
        skillsRef.current = [];
        setSkills([]);
        return;
      }
      commit(next);
    },
    [commit]
  );

  const remove = useCallback((id: string) => {
    setSkills((prev) => (prev ?? []).filter((s) => s.id !== id));
  }, []);

  // The server confirmed the session's skills (published ones, with names).
  const onServerSkills = useCallback(
    (items: SilaSkillRef[]) => {
      setSkills(items);
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
    [queryClient]
  );

  // "Use skill" / "Use template with skills" from the Bazaar (?skill=a,b):
  // attach the published ones once their card data arrives.
  const linkedRef = useRef("");
  useEffect(() => {
    if (!token || !skillParam || linkedRef.current === skillParam) return;
    linkedRef.current = skillParam;
    const ids = parseSkillParam(skillParam).slice(0, MAX_CHAT_SKILLS);
    Promise.allSettled(ids.map((id) => api.skills.get(id, token))).then((results) => {
      const found = results.flatMap((r) =>
        r.status === "fulfilled" && r.value.published
          ? [{ id: r.value.id, name: r.value.name }]
          : []
      );
      if (found.length) attachMany(found);
    });
  }, [token, skillParam, attachMany]);

  // Pinning the OKR Reporting Pack drops any skills (confidential session).
  useEffect(() => {
    if (okrPinned && skillsRef.current?.length) {
      setSkills([]);
      toast(t("confidential"), "info");
    }
  }, [okrPinned, t, toast]);

  return {
    skills,
    ids: skills?.map((s) => s.id),
    attach,
    attachMany,
    setAll,
    remove,
    onServerSkills,
  };
}

/** A toast when the chat starts using a template; the bell has the record. */
export function useTemplateAnnouncement(templateName: string | undefined) {
  const t = useTranslations("sila.skills");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!templateName) return;
    toast(t("templateInUse", { name: templateName }), "success");
    // The server writes the bell entry on the reconnect that pins it.
    const timer = setTimeout(
      () => void queryClient.invalidateQueries({ queryKey: ["notifications"] }),
      1500
    );
    return () => clearTimeout(timer);
  }, [templateName, t, toast, queryClient]);
}
