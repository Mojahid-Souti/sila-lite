"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { useToken } from "@/lib/use-token";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { Check, Eye, Presentation } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * Slides launcher: pick a palette (the engine's built-in design systems — these
 * are what actually render) or a workspace corporate .pptx, and a slide count.
 * The pick lands as a composer chip; the user adds the topic and sends.
 *
 * The palette previews are honest mini-covers built from the SAME tokens the
 * renderer uses (apps/api/sila/services/slides/tokens.py) — what you see is what
 * the deck looks like.
 */

const COUNTS = ["Auto", "3-5", "6-10", "11-15"] as const;

/** What the deck is FOR. The palette decides how it looks; this decides what
 *  goes on the slides — how dense, how technical, what a slide leads with. The
 *  launcher previously only asked about looks, so every deck came out the same
 *  shape regardless of audience. */
const DECK_TYPES = [
  { value: "", label: "Auto", sub: "SILA decides" },
  { value: "pitch", label: "Pitch", sub: "Punchy, few words" },
  { value: "report", label: "Report", sub: "Detail, tables, charts" },
  { value: "exec", label: "Executive brief", sub: "Findings first" },
  { value: "technical", label: "Technical", sub: "Full spec, caveats" },
] as const;

type PalettePreview = {
  value: string;
  label: string;
  sub: string;
  bg: string;
  text: string;
  muted: string;
  accent: string;
  serif?: boolean;
};

// Mirrors PALETTES in the backend tokens.py — keep in sync.
const PALETTES: PalettePreview[] = [
  {
    value: "modern-slate",
    label: "Modern Slate",
    sub: "Navy · blue",
    bg: "#0F1B2D",
    text: "#F5F7FA",
    muted: "#8FA3BF",
    accent: "#3B82F6",
  },
  {
    value: "midnight-teal",
    label: "Midnight Teal",
    sub: "Teal · aqua",
    bg: "#0A2A2E",
    text: "#F0F7F6",
    muted: "#93BAB6",
    accent: "#2DD4BF",
  },
  {
    value: "royal-indigo",
    label: "Royal Indigo",
    sub: "Indigo · gold",
    bg: "#161734",
    text: "#F2F2FA",
    muted: "#9EA0C8",
    accent: "#FBBF24",
  },
  {
    value: "high-contrast-bold",
    label: "High Contrast",
    sub: "Black · lime",
    bg: "#0A0A0A",
    text: "#FFFFFF",
    muted: "#9C9C9C",
    accent: "#C6FF3D",
  },
  {
    value: "minimal-editorial",
    label: "Minimal Editorial",
    sub: "Cream · olive",
    bg: "#F7F4EC",
    text: "#2B2A26",
    muted: "#6E6A5F",
    accent: "#6B7A3F",
    serif: true,
  },
  {
    value: "warm-sand",
    label: "Warm Sand",
    sub: "Sand · terracotta",
    bg: "#F5EFE6",
    text: "#2E2A24",
    muted: "#6B6459",
    accent: "#B25B33",
    serif: true,
  },
];

function PaletteCard({
  p,
  selected,
  onSelect,
}: {
  p: PalettePreview;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button type="button" onClick={onSelect} className="group text-left">
      <div
        className={cn(
          "relative aspect-[16/9] overflow-hidden rounded-xl border transition-colors",
          selected
            ? "border-neutral-900 ring-2 ring-neutral-900/80 ring-offset-2"
            : "border-neutral-200 group-hover:border-neutral-300"
        )}
        style={{ background: p.bg }}
      >
        {/* honest mini-cover: accent bar + title + subtitle, from the real tokens */}
        <div className="absolute inset-0 flex flex-col justify-center px-4">
          <span className="mb-1.5 h-[3px] w-7 rounded-full" style={{ background: p.accent }} />
          <span
            className={cn(
              "font-semibold text-[15px] leading-tight tracking-tight",
              p.serif && "font-serif"
            )}
            style={{ color: p.text }}
          >
            Your presentation title
          </span>
          <span className="mt-1 text-[9.5px]" style={{ color: p.muted }}>
            A subtitle or key message
          </span>
        </div>
        {selected && (
          <span className="absolute inset-0 grid place-items-center bg-black/25">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1 font-medium text-[12px] text-neutral-900">
              <Check className="size-3.5" /> Selected
            </span>
          </span>
        )}
      </div>
      <p className="mt-1.5 truncate px-0.5 text-[13px] text-neutral-800">{p.label}</p>
      <p className="truncate px-0.5 text-[11px] text-neutral-400">{p.sub}</p>
    </button>
  );
}

function CorporateCard({
  name,
  subtitle,
  thumbnails,
  selected,
  onSelect,
}: {
  name: string;
  subtitle: string;
  thumbnails?: string[];
  selected: boolean;
  onSelect: () => void;
}) {
  const thumbs = thumbnails ?? [];
  const [frame, setFrame] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const startPreview = () => {
    if (thumbs.length < 2 || timer.current) return;
    timer.current = setInterval(() => setFrame((f) => (f + 1) % thumbs.length), 700);
  };
  const stopPreview = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    setFrame(0);
  };
  // biome-ignore lint/correctness/useExhaustiveDependencies: unmount-only cleanup
  useEffect(() => stopPreview, []);

  return (
    <button
      type="button"
      onClick={onSelect}
      onMouseEnter={startPreview}
      onMouseLeave={stopPreview}
      className="group text-left"
    >
      <div
        className={cn(
          "relative aspect-[16/9] overflow-hidden rounded-xl border bg-neutral-100 transition-colors",
          selected
            ? "border-neutral-900 ring-2 ring-neutral-900/80 ring-offset-2"
            : "border-neutral-200 group-hover:border-neutral-300"
        )}
      >
        {thumbs.length > 0 ? (
          thumbs.map((t, i) => (
            <img
              // biome-ignore lint/suspicious/noArrayIndexKey: frames are static and never reorder
              key={i}
              src={t}
              alt={i === 0 ? `${name} slide preview` : ""}
              draggable={false}
              className={cn(
                "absolute inset-0 h-full w-full object-cover transition-opacity duration-300",
                i === frame ? "opacity-100" : "opacity-0"
              )}
            />
          ))
        ) : (
          <div className="absolute inset-0 flex flex-col justify-center px-5">
            <span className="font-semibold text-[15px] text-neutral-900 leading-tight">{name}</span>
            <span className="mt-1 text-[10px] text-neutral-500">{subtitle}</span>
          </div>
        )}
        {thumbs.length > 1 && !selected && (
          <span className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 font-medium text-[10.5px] text-white opacity-0 backdrop-blur transition-opacity group-hover:opacity-100">
            <Eye className="size-3" /> {frame + 1}/{thumbs.length}
          </span>
        )}
        {selected && (
          <span className="absolute inset-0 grid place-items-center bg-black/25">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1 font-medium text-[12px] text-neutral-900">
              <Check className="size-3.5" /> Selected
            </span>
          </span>
        )}
      </div>
      <p className="mt-1.5 truncate px-0.5 text-[13px] text-neutral-800">{name}</p>
      <p className="truncate px-0.5 text-[11px] text-neutral-400">{subtitle}</p>
    </button>
  );
}

// `palette` is set for a built-in design system; `thumb` for a corporate upload.
export type SlideTemplatePick = {
  name: string;
  count: string;
  thumb?: string;
  palette?: string;
  /** Deck type — shapes the CONTENT, where palette shapes the look. */
  deckType?: string;
  deckTypeLabel?: string;
};

export function SilaSlidesLauncher({
  open,
  onClose,
  workspaceId,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  workspaceId?: string;
  onPick: (pick: SlideTemplatePick) => void;
}) {
  const token = useToken();
  // selection is a palette value ("modern-slate") or a corporate template id.
  const [selected, setSelected] = useState<string>(PALETTES[0].value);
  const [count, setCount] = useState<(typeof COUNTS)[number]>("Auto");
  const [deckType, setDeckType] = useState<string>("");

  const { data: templates } = useQuery({
    queryKey: ["pptx-templates", workspaceId],
    queryFn: () => api.connectors.listPptxTemplates(workspaceId ?? "", token),
    enabled: open && !!token && !!workspaceId,
  });

  // Only the workspace's own uploaded .pptx files — the old built-in themes are
  // replaced by the palette cards above.
  const corporate = (templates ?? []).filter((t) => !t.builtin);

  function use() {
    const type = DECK_TYPES.find((t) => t.value === deckType);
    const extra = { deckType: deckType || undefined, deckTypeLabel: type?.label };
    const p = PALETTES.find((x) => x.value === selected);
    if (p) {
      onPick({ name: p.label, palette: p.value, count, ...extra });
    } else {
      const tpl = corporate.find((t) => t.id === selected);
      if (tpl) onPick({ name: tpl.name, count, thumb: tpl.thumbnails?.[0], ...extra });
    }
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-0 p-0 sm:max-w-2xl">
        <DialogHeader className="border-neutral-100 border-b px-5 pt-5 pb-4">
          <DialogTitle className="flex items-center gap-2">
            <Presentation className="size-4.5 text-neutral-500" />
            Create slides
          </DialogTitle>
          <DialogDescription>
            Pick a style, then describe the topic (or attach a file). Upload a corporate .pptx on
            the Connectors page to keep your own branding.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[52vh] overflow-y-auto p-5">
          <p className="mb-2.5 font-medium text-[11px] text-neutral-400 uppercase tracking-wide">
            Design system
          </p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {PALETTES.map((p) => (
              <PaletteCard
                key={p.value}
                p={p}
                selected={selected === p.value}
                onSelect={() => setSelected(p.value)}
              />
            ))}
          </div>

          {corporate.length > 0 && (
            <>
              <p className="mt-5 mb-2.5 font-medium text-[11px] text-neutral-400 uppercase tracking-wide">
                Your corporate templates
              </p>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {corporate.map((t) => (
                  <CorporateCard
                    key={t.id}
                    name={t.name}
                    subtitle={`Corporate · ${(t.file_size / 1_048_576).toFixed(1)} MB`}
                    thumbnails={t.thumbnails}
                    selected={selected === t.id}
                    onSelect={() => setSelected(t.id)}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Deck TYPE sits with the count, above the palette footer: both are
            about the deck's substance, where the cards above are about looks. */}
        <div className="flex flex-wrap items-center gap-1.5 border-neutral-100 border-t px-5 pt-4">
          <span className="mr-1 text-[12.5px] text-neutral-500">Type</span>
          {DECK_TYPES.map((t) => (
            <button
              key={t.value || "auto"}
              type="button"
              onClick={() => setDeckType(t.value)}
              title={t.sub}
              className={cn(
                "rounded-full px-3 py-1 text-[12.5px] transition-colors",
                deckType === t.value
                  ? "bg-neutral-900 text-white"
                  : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div className="flex items-center gap-1.5">
            <span className="mr-1 text-[12.5px] text-neutral-500">Slides</span>
            {COUNTS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCount(c)}
                className={cn(
                  "rounded-full px-3 py-1 text-[12.5px] transition-colors",
                  count === c
                    ? "bg-neutral-900 text-white"
                    : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                )}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-3 py-2 text-neutral-500 text-sm hover:text-neutral-800"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={use}
              className="inline-flex h-9 items-center rounded-lg bg-neutral-900 px-4 font-medium text-sm text-white transition-colors hover:bg-neutral-800"
            >
              Use style
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
