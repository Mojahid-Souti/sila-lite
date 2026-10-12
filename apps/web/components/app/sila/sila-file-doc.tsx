"use client";

import { SimpleMarkdown } from "@/lib/simple-markdown";
import { Download, Loader, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

/**
 * Attached-file preview — the same side pane as the plan document: the chat slides
 * left, the file's content renders read-only, close returns the chat. CSV/TSV
 * render as a real SPREADSHEET grid (column letters, row numbers, sticky header —
 * the Claude-style preview Mojahid asked for); other text files render as text;
 * binaries show a friendly note.
 */

const GRID_MAX_ROWS = 300;
const GRID_MAX_COLS = 30;

/** Minimal RFC-4180-ish parser: quoted fields, embedded commas/newlines. O(chars). */
function parseCsv(text: string, delim: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === delim) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      rows.push(row);
      row = [];
      if (rows.length > GRID_MAX_ROWS) break;
    } else {
      cell += ch;
    }
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function colLetter(i: number): string {
  let s = "";
  let n = i;
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

const NUMERIC = /^-?[\d,]+(\.\d+)?%?$/;

function CsvGrid({ content, name }: { content: string; name: string }) {
  const rows = useMemo(
    () => parseCsv(content, name.toLowerCase().endsWith(".tsv") ? "\t" : ","),
    [content, name]
  );
  if (rows.length === 0) return null;
  const header = rows[0];
  const body = rows.slice(1, GRID_MAX_ROWS);
  const cols = Math.min(header.length, GRID_MAX_COLS);
  const truncated = rows.length > GRID_MAX_ROWS || header.length > GRID_MAX_COLS;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full border-collapse text-[12px]">
          <thead className="sticky top-0 z-10">
            <tr>
              <th className="w-10 border border-neutral-200 bg-neutral-100 px-1.5 py-1 font-medium text-[10.5px] text-neutral-400" />
              {header.slice(0, cols).map((_, i) => (
                <th
                  key={colLetter(i)}
                  className="border border-neutral-200 bg-neutral-100 px-2 py-1 text-center font-medium text-[10.5px] text-neutral-400"
                >
                  {colLetter(i)}
                </th>
              ))}
            </tr>
            <tr>
              <th className="border border-neutral-200 bg-neutral-50 px-1.5 py-1 text-right font-medium text-[10.5px] text-neutral-400">
                1
              </th>
              {header.slice(0, cols).map((h, i) => (
                <th
                  key={`h-${colLetter(i)}`}
                  className="whitespace-nowrap border border-neutral-200 bg-neutral-50 px-2 py-1 text-left font-semibold text-neutral-800"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {body.map((r, ri) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: static parsed rows
              <tr key={`r-${ri}`} className="even:bg-neutral-50/50">
                <td className="border border-neutral-100 bg-neutral-50 px-1.5 py-1 text-right text-[10.5px] text-neutral-400">
                  {ri + 2}
                </td>
                {header.slice(0, cols).map((_, ci) => {
                  const v = r[ci] ?? "";
                  return (
                    <td
                      key={colLetter(ci)}
                      className={`whitespace-nowrap border border-neutral-100 px-2 py-1 text-neutral-700 ${
                        NUMERIC.test(v.trim()) ? "text-right tabular-nums" : "text-left"
                      }`}
                    >
                      {v}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {truncated && (
        <p className="shrink-0 border-neutral-200 border-t bg-neutral-50 px-4 py-1.5 text-[11px] text-neutral-400">
          Preview truncated — the agent works from the full file.
        </p>
      )}
    </div>
  );
}

/** What `GET /v1/files/{id}/preview` returns for a file SILA generated. */
type GeneratedPreview = {
  filename: string;
  mode: "sheet" | "markdown" | "text" | "pdf" | "none";
  text?: string;
  size_bytes: number;
  truncated: boolean;
};

/**
 * Load the preview for a generated artifact.
 *
 * Returns `pending` while in flight so the pane can open IMMEDIATELY on click
 * and fill in — waiting for the fetch before opening would make the click feel
 * broken on the exact files (a converted deck) that take longest.
 */
function useGeneratedPreview(url?: string) {
  const [state, setState] = useState<{
    pending: boolean;
    preview?: GeneratedPreview;
    failed?: boolean;
  }>({ pending: Boolean(url) });

  useEffect(() => {
    if (!url) {
      setState({ pending: false });
      return;
    }
    let cancelled = false;
    setState({ pending: true });
    fetch(`${url}/preview`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((preview: GeneratedPreview) => {
        if (!cancelled) setState({ pending: false, preview });
      })
      .catch(() => {
        // A failed preview must still leave a usable pane — the download works.
        if (!cancelled) setState({ pending: false, failed: true });
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  return state;
}

export function SilaFileDoc({
  name,
  content,
  fileUrl,
  onClose,
}: {
  name: string;
  /** Inline text — the path for a file the USER attached. */
  content?: string;
  /** `/v1/files/{id}` for a file SILA GENERATED: the pane fetches the preview
   *  and offers the download from its own header. */
  fileUrl?: string;
  onClose: () => void;
}) {
  const { pending, preview, failed } = useGeneratedPreview(fileUrl);
  // A generated file's real name comes from the server (the artifact's display
  // name is prose, e.g. 'Brief (PDF)'), so prefer it once it arrives.
  const displayName = preview?.filename ?? name;
  // Only a real extension earns the chip. Splitting on "." unconditionally
  // turned a prose title into a shouted one ("SILA EXPLAINER VIDEO SCRIPT").
  const suffix = displayName.includes(".") ? (displayName.split(".").pop() ?? "") : "";
  const ext = suffix && suffix.length <= 5 && !suffix.includes(" ") ? suffix.toUpperCase() : "";
  const text = content ?? preview?.text;
  const mode = fileUrl ? (preview?.mode ?? "none") : /\.(csv|tsv)$/i.test(name) ? "sheet" : "text";

  return (
    <div className="flex h-full min-w-0 flex-col border-neutral-200 border-l bg-white">
      <div className="flex h-12 shrink-0 items-center gap-2 border-neutral-200 border-b px-4">
        <span
          dir="auto"
          className="min-w-0 flex-1 truncate font-medium text-[13px] text-neutral-800"
        >
          {displayName}
        </span>
        {ext && (
          <span className="shrink-0 rounded bg-neutral-100 px-1.5 py-0.5 font-medium text-[10px] text-neutral-500">
            {ext}
          </span>
        )}
        {fileUrl && (
          <a
            href={fileUrl}
            download
            title={`Download ${displayName}`}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-neutral-200 px-2.5 py-1 font-medium text-[12px] text-neutral-700 transition-colors hover:bg-neutral-50"
          >
            <Download className="size-3.5" />
            Download
          </a>
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close the preview"
          className="grid size-7 shrink-0 place-items-center rounded-lg text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-800"
        >
          <X className="size-4" />
        </button>
      </div>

      {pending ? (
        <div className="flex min-h-0 flex-1 items-center justify-center gap-2 text-neutral-400">
          <Loader className="size-4 animate-spin" />
          <span className="text-[13px]">Loading preview…</span>
        </div>
      ) : mode === "pdf" && fileUrl ? (
        // The API serves this route as a PDF and nothing else, so the browser's
        // own sandboxed viewer renders it.
        <iframe
          src={`${fileUrl}/view`}
          title={`Preview of ${displayName}`}
          className="min-h-0 w-full flex-1 border-0"
        />
      ) : mode === "sheet" && text ? (
        <CsvGrid content={text} name={displayName} />
      ) : (
        <div className="sila-scroll min-w-0 flex-1 overflow-y-auto px-6 py-5">
          {mode === "markdown" && text ? (
            <div dir="auto" className="text-[13.5px] text-neutral-800 leading-relaxed">
              <SimpleMarkdown text={text} />
            </div>
          ) : text ? (
            <pre
              dir="auto"
              className="whitespace-pre-wrap break-words font-mono text-[12.5px] leading-relaxed text-neutral-700"
            >
              {text}
            </pre>
          ) : (
            <p className="text-[13px] text-neutral-500">
              {failed
                ? "The preview could not be loaded — the file is still available to download."
                : fileUrl
                  ? "This file type has no in-browser preview. Download it to open in its own app."
                  : /\.(csv|tsv)$/i.test(name ?? "")
                    ? "This file was uploaded as a full dataset — SILA analyzes the complete file on the server, so no inline preview is kept in the chat."
                    : "No text preview is available for this file type — the agent still reads the full document through the knowledge base."}
            </p>
          )}
        </div>
      )}

      <p className="shrink-0 border-neutral-200 border-t px-6 py-2.5 text-[11px] text-neutral-400">
        {preview?.truncated
          ? "Preview truncated — download the file for the full contents."
          : fileUrl
            ? "Preview — download for the original file."
            : "Preview of what was attached — the agent works from the full document."}
      </p>
    </div>
  );
}
