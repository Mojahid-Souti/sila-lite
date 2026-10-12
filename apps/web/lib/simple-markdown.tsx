"use client";

import { SilaInlineChart } from "@/components/app/sila/sila-inline-chart";
import { parseChartSpec } from "@/lib/chart-spec";
import { copyTable, downloadCsv } from "@/lib/table-clipboard";
import { Check, Copy, Download } from "lucide-react";
import { Fragment, useState } from "react";

/**
 * Tiny, dependency-free Markdown renderer for MODEL OUTPUT (the stack is frozen —
 * no react-markdown). Covers: #..###### headings, - / * bullet + 1. numbered
 * lists, GFM tables (with a copy-as-TSV button), --- horizontal rules, fenced
 * code blocks (```markdown fences are UNWRAPPED — weak models love wrapping the
 * whole answer in one), paragraphs, and inline **bold** / *italic* / `code`.
 * Anything else renders as plain text — never HTML (no injection surface).
 */

/** Friendly names for the fence languages that actually turn up. */
const LANG_LABELS: Record<string, string> = {
  py: "Python",
  python: "Python",
  js: "JavaScript",
  javascript: "JavaScript",
  ts: "TypeScript",
  typescript: "TypeScript",
  tsx: "TSX",
  jsx: "JSX",
  sh: "Shell",
  bash: "Shell",
  shell: "Shell",
  zsh: "Shell",
  sql: "SQL",
  json: "JSON",
  yaml: "YAML",
  yml: "YAML",
  html: "HTML",
  css: "CSS",
  go: "Go",
  rust: "Rust",
  java: "Java",
  dockerfile: "Dockerfile",
  text: "Text",
};

/**
 * A fenced code block.
 *
 * A header bar carries the language and a copy button that is always visible —
 * the old panel had neither, so a long block was an unlabelled grey slab and
 * the only way to discover you could copy it was to hover. The body scrolls in
 * its own container, which keeps a wide line from stretching the message.
 */
function MdCode({ code, lang }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    });
  };
  const label = lang ? (LANG_LABELS[lang] ?? lang.toUpperCase()) : "Code";
  const lines = code.split("\n").length;
  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-2 border-neutral-200 border-b bg-neutral-50 py-1.5 pr-1.5 pl-3">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate font-medium text-[11.5px] text-neutral-600">{label}</span>
          <span className="shrink-0 text-[11px] text-neutral-400">
            {lines} line{lines === 1 ? "" : "s"}
          </span>
        </span>
        <button
          type="button"
          onClick={copy}
          title="Copy code"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 font-medium text-[11.5px] text-neutral-500 transition-colors hover:bg-neutral-200/70 hover:text-neutral-900"
        >
          {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="sila-scroll overflow-x-auto px-3.5 py-3 text-[12.5px] text-neutral-800 leading-[1.65]">
        <code className="font-mono">{code}</code>
      </pre>
    </div>
  );
}

/** A rendered table + a Copy button that yields tab-separated rows (paste-ready
 *  for Slack/Sheets/Excel). Self-contained so the parser stays a pure function. */
function MdTable({ header, rows }: { header: string[]; rows: string[][] }) {
  const [copied, setCopied] = useState<"ok" | "failed" | null>(null);
  let k = 0;
  const copy = () => {
    void copyTable(header, rows).then((ok) => {
      setCopied(ok ? "ok" : "failed");
      window.setTimeout(() => setCopied(null), 1800);
    });
  };
  return (
    <div className="my-3 overflow-hidden rounded-2xl border border-neutral-200 bg-white">
      <div className="sila-scroll overflow-x-auto">
        <table className="w-full border-collapse text-[14px]">
          <thead>
            <tr>
              {/* Sentence case, not uppercase: 12px caps is the setting that made
                  a column head read as fine print rather than a heading. */}
              {header.map((h) => (
                <th
                  key={k++}
                  className="whitespace-nowrap border-neutral-200 border-b bg-white px-4 py-3 text-left font-semibold text-[13.5px] text-neutral-900"
                >
                  {renderInline(h)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((cells) => (
              // Zebra rather than a rule under every row: the eye tracks a wide
              // row on the band, and the table stops looking like a grid.
              <tr key={k++} className="even:bg-neutral-50/70">
                {cells.map((c) => (
                  <td
                    key={k++}
                    className="px-4 py-3 align-top text-[14px] text-neutral-800 leading-relaxed"
                  >
                    {renderInline(c)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between gap-2 border-neutral-100 border-t px-4 py-2">
        <span className="text-[12px] text-neutral-400 tabular-nums">
          {rows.length} row{rows.length === 1 ? "" : "s"}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => downloadCsv(header, rows, "table")}
            title="Download as CSV (opens in Excel or Sheets)"
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 font-medium text-[12px] text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
          >
            <Download className="size-3.5" />
            CSV
          </button>
          <button
            type="button"
            onClick={copy}
            title="Copy — pastes as a real table into Teams, Outlook or Notion"
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 font-medium text-[12px] text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
          >
            {copied === "ok" ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            {copied === "ok" ? "Copied" : copied === "failed" ? "Copy blocked" : "Copy"}
          </button>
        </span>
      </div>
    </div>
  );
}

/** Only http/https/mailto hrefs render as links — model output is untrusted, so
 *  a `javascript:`/`data:` URL must never become a clickable anchor. */
function safeHref(url: string): string | null {
  const u = url.trim();
  return /^(https?:\/\/|mailto:)/i.test(u) ? u : null;
}

/** At least three comma-separated columns on every line, and more than one
 *  line. Deliberately strict: prose with a comma in it is not a table. */
function looksLikeCsv(text: string): boolean {
  const lines = text.split("\n").filter((l) => l.trim());
  if (lines.length < 2 || lines.length > 500) return false;
  const columns = splitCsvLine(lines[0]).length;
  if (columns < 3) return false;
  return lines.every((line) => splitCsvLine(line).length === columns);
}

/** One CSV line → its fields, honouring quotes so a quoted comma stays put. */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      out.push(field);
      field = "";
    } else {
      field += ch;
    }
  }
  out.push(field);
  return out.map((f) => f.trim());
}

function parseCsvBlock(text: string): { header: string[]; rows: string[][] } | null {
  const lines = text.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return null;
  const [head, ...body] = lines.map(splitCsvLine);
  return { header: head, rows: body };
}

function renderInline(text: string): React.ReactNode[] {
  // Split on [link](url), **bold**, *italic*, `code`, and bare URLs — first match
  // wins, then recurse on the rest.
  const out: React.ReactNode[] = [];
  let rest = text;
  let key = 0;
  const pattern =
    /(\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|\*([^*\n]+)\*|`([^`\n]+)`|(https?:\/\/[^\s)]+))/;
  while (rest) {
    const m = pattern.exec(rest);
    if (!m || m.index === undefined) {
      out.push(rest);
      break;
    }
    if (m.index > 0) out.push(rest.slice(0, m.index));
    if (m[2] !== undefined && m[3] !== undefined) {
      // [text](url)
      const href = safeHref(m[3]);
      out.push(
        href ? (
          // A parenthesised link, not a button chip. The chip was introduced to
          // stop a file link getting lost in prose — but every produced file now
          // also renders as an attachment tile under the message, so the chip
          // was a second, louder copy of the same affordance mid-sentence. The
          // parentheses keep it findable while reading as part of the sentence.
          <span key={key++} className="whitespace-nowrap">
            {"("}
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-blue-600 underline decoration-blue-300 underline-offset-2 hover:text-blue-700"
            >
              {m[2]}
            </a>
            {")"}
          </span>
        ) : (
          <span key={key++}>{m[2]}</span>
        )
      );
    } else if (m[4] !== undefined) {
      // Recurse: bold can wrap a link, and rendering the content as plain text
      // printed "[Open the dashboard](http://…)" with its brackets showing.
      out.push(<strong key={key++}>{renderInline(m[4])}</strong>);
    } else if (m[5] !== undefined) {
      out.push(<em key={key++}>{renderInline(m[5])}</em>);
    } else if (m[6] !== undefined) {
      out.push(
        <code key={key++} className="rounded bg-neutral-100 px-1 py-0.5 text-[12px]">
          {m[6]}
        </code>
      );
    } else if (m[7] !== undefined) {
      // A bare URL → autolink.
      const href = safeHref(m[7]);
      out.push(
        href ? (
          <a
            key={key++}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all font-medium text-blue-600 underline decoration-blue-300 underline-offset-2 hover:text-blue-700"
          >
            {m[7]}
          </a>
        ) : (
          <span key={key++}>{m[7]}</span>
        )
      );
    }
    rest = rest.slice(m.index + m[0].length);
  }
  return out;
}

function isTableRow(line: string): boolean {
  const t = line.trim();
  return t.startsWith("|") && t.endsWith("|") && t.length > 2;
}

function isDividerRow(line: string): boolean {
  return isTableRow(line) && /^\|[\s:|-]+\|$/.test(line.trim());
}

function splitCells(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}

export function SimpleMarkdown({ text }: { text: string }) {
  const lines = text.replaceAll("\r\n", "\n").split("\n");
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    // Fenced code block. A weak model often wraps its ANSWER in ```markdown —
    // unwrap those (render the content as markdown); real code renders as a
    // copyable mono panel. The closing fence may be missing at stream end.
    const fence = /^```(\w*)\s*$/.exec(trimmed);
    if (fence) {
      const lang = fence[1].toLowerCase();
      i += 1;
      const body: string[] = [];
      while (i < lines.length && !/^```\s*$/.test(lines[i].trim())) {
        body.push(lines[i]);
        i += 1;
      }
      i += 1; // skip the closing fence (or run past EOF)
      const content = body.join("\n").trim();
      // A ```chart fence renders as a real chart. SILA drew ASCII bar charts in
      // code blocks because a normal reply had no way to show a figure — the
      // dashboard tool was the only charting path and that is a whole artifact.
      if (lang === "chart" && content) {
        const spec = parseChartSpec(content);
        if (spec) {
          blocks.push(<SilaInlineChart key={key++} spec={spec} />);
          continue;
        }
        // Malformed — fall through and show the raw block rather than nothing.
      }
      // A ```csv fence is DATA, so it renders as the table it describes —
      // readable, copyable into Teams, and downloadable — rather than as a wall
      // of commas the reader has to parse by eye.
      const csv = lang === "csv" || (lang === "" && looksLikeCsv(content));
      if (csv && content) {
        const parsed = parseCsvBlock(content);
        if (parsed) {
          blocks.push(<MdTable key={key++} header={parsed.header} rows={parsed.rows} />);
          continue;
        }
      }
      const mdish =
        ["", "markdown", "md"].includes(lang) &&
        /(^\s*\|.*\|\s*$)|(^#{1,6}\s)|(^[-*]\s)/m.test(content);
      if (content) {
        blocks.push(
          mdish ? (
            <SimpleMarkdown key={key++} text={content} />
          ) : (
            <MdCode key={key++} code={content} lang={lang} />
          )
        );
      }
      continue;
    }

    // Horizontal rule: --- / *** / ___ alone on a line (checked before lists —
    // bullets require a space after the marker, so "---" never matches those).
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push(<hr key={key++} className="my-3 border-neutral-200" />);
      i += 1;
      continue;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(trimmed);
    if (heading) {
      const level = heading[1].length;
      const cls =
        level === 1
          ? "mt-1 text-[17px] font-semibold text-neutral-900"
          : level === 2
            ? "mt-1 text-[15px] font-semibold text-neutral-900"
            : level === 3
              ? "text-[13.5px] font-semibold text-neutral-800"
              : "text-[12.5px] font-semibold uppercase tracking-wide text-neutral-500";
      blocks.push(
        <p key={key++} className={cls}>
          {renderInline(heading[2])}
        </p>
      );
      i += 1;
      continue;
    }

    // Unordered list (- or *, needs a trailing space).
    if (/^[-*]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*]\s+/, ""));
        i += 1;
      }
      blocks.push(
        <ul key={key++} className="list-disc space-y-1.5 pl-5">
          {items.map((item) => (
            <li key={key++}>{renderInline(item)}</li>
          ))}
        </ul>
      );
      continue;
    }

    // Ordered list (1. 2. 3.) — preserves the author's starting number.
    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      const start = Number.parseInt(trimmed, 10) || 1;
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ""));
        i += 1;
      }
      blocks.push(
        <ol key={key++} start={start} className="list-decimal space-y-1.5 pl-5">
          {items.map((item) => (
            <li key={key++}>{renderInline(item)}</li>
          ))}
        </ol>
      );
      continue;
    }

    if (isTableRow(trimmed) && i + 1 < lines.length && isDividerRow(lines[i + 1])) {
      const header = splitCells(trimmed);
      i += 2; // skip the divider
      const rows: string[][] = [];
      while (i < lines.length && isTableRow(lines[i])) {
        rows.push(splitCells(lines[i]));
        i += 1;
      }
      blocks.push(<MdTable key={key++} header={header} rows={rows} />);
      continue;
    }

    // Paragraph — swallow consecutive non-empty, non-special lines.
    const para: string[] = [trimmed];
    i += 1;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,6})\s+/.test(lines[i].trim()) &&
      !/^[-*]\s+/.test(lines[i].trim()) &&
      !/^\d+\.\s+/.test(lines[i].trim()) &&
      !/^(-{3,}|\*{3,}|_{3,})$/.test(lines[i].trim()) &&
      !/^```/.test(lines[i].trim()) &&
      !isTableRow(lines[i].trim())
    ) {
      para.push(lines[i].trim());
      i += 1;
    }
    blocks.push(
      <p key={key++}>
        {para.map((p, n) => (
          <Fragment key={key++}>
            {n > 0 && " "}
            {renderInline(p)}
          </Fragment>
        ))}
      </p>
    );
  }

  return <div className="space-y-2.5">{blocks}</div>;
}
