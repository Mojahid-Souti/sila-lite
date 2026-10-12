"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { type NotificationOut, api } from "@/lib/api";
import { relativeTime } from "@/lib/relative-time";
import { useToken } from "@/lib/use-token";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, BookmarkCheck, LayoutTemplate, ScrollText, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

/** How often the bell looks for news while the app is open. */
const REFRESH_MS = 30_000;

const KIND_ICON: Record<string, typeof Bell> = {
  "agent.hired": BookmarkCheck,
  "template.selected": LayoutTemplate,
  "skill.attached": ScrollText,
  "skill.imported": ShieldCheck,
  "skill.published": ShieldCheck,
};

/**
 * The header bell: the signed-in user's notifications, written by the server
 * where things happen (a hire, a template or skill picked, an import vetted).
 * An unread count on the bell; the list marks an entry read when it is opened.
 */
export function NotificationBell() {
  const t = useTranslations("nav.notifications");
  const token = useToken();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api.notifications.list(token),
    enabled: !!token,
    refetchInterval: REFRESH_MS,
    refetchIntervalInBackground: false,
  });
  const unread = data?.unread ?? 0;
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["notifications"] });

  const readOne = useMutation({
    mutationFn: (n: NotificationOut) => api.notifications.read(n.id, token),
    onSettled: refresh,
  });
  const readAll = useMutation({
    mutationFn: () => api.notifications.readAll(token),
    onSettled: refresh,
  });

  function open(n: NotificationOut) {
    if (!n.read) readOne.mutate(n);
    // Server links are app-internal paths only (the API refuses anything else).
    if (n.link?.startsWith("/") && !n.link.startsWith("//")) router.push(n.link);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={unread ? `${t("open")} — ${t("unread", { count: unread })}` : t("open")}
          className="relative grid size-9 place-items-center rounded-md text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
        >
          <Bell className="size-4" />
          {unread > 0 && (
            <span className="-right-0.5 -top-0.5 absolute grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 font-semibold text-[10px] text-white ring-2 ring-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-neutral-100 border-b px-3 py-2.5">
          <span className="font-semibold text-neutral-900 text-sm">{t("title")}</span>
          {unread > 0 && (
            <button
              type="button"
              onClick={() => readAll.mutate()}
              className="font-medium text-primary text-xs hover:underline"
            >
              {t("markAllRead")}
            </button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto py-1">
          {(data?.items ?? []).length === 0 ? (
            <p className="px-3 py-6 text-center text-neutral-500 text-xs">{t("empty")}</p>
          ) : (
            data?.items.map((n) => {
              const Icon = KIND_ICON[n.kind] ?? Bell;
              return (
                <DropdownMenuItem
                  key={n.id}
                  onSelect={() => open(n)}
                  className="flex cursor-pointer items-start gap-2.5 px-3 py-2"
                >
                  <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-neutral-100 text-neutral-600">
                    <Icon className="size-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block truncate text-[13px] ${
                        n.read ? "text-neutral-700" : "font-semibold text-neutral-950"
                      }`}
                    >
                      {n.title}
                    </span>
                    {n.body && (
                      <span className="block truncate text-[12px] text-neutral-500">{n.body}</span>
                    )}
                    <span className="block text-[11px] text-neutral-400">
                      {relativeTime(n.created_at)}
                    </span>
                  </span>
                  {!n.read && <span className="mt-2 size-2 shrink-0 rounded-full bg-primary" />}
                </DropdownMenuItem>
              );
            })
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
