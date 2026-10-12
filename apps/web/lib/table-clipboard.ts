/**
 * Putting a table on the clipboard so it pastes as a TABLE.
 *
 * Plain text pastes into Teams, Outlook and Notion as a wall of tabs. Those
 * editors build a real table when the clipboard also carries a `text/html`
 * flavour — which is what Copilot does, and why its copy behaves and ours did
 * not. So both flavours go on the clipboard: HTML for rich targets, TSV for
 * plain ones (a terminal, a code editor), and the receiving app picks.
 *
 * The HTML carries INLINE styles on purpose. Outlook and Teams strip
 * stylesheets and classes; an inline `border` is the only styling that
 * survives the paste.
 *
 * Complexity: O(cells) over the table.
 */

const HEADER_BG = "#f3f4f6";
const BORDER = "1px solid #d4d4d8";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** One `<table>` with inline styles that survive an Outlook/Teams paste. */
export function tableToHtml(header: string[], rows: string[][]): string {
  const th = header
    .map(
      (cell) =>
        `<th style="border:${BORDER};background:${HEADER_BG};padding:8px 12px;` +
        `text-align:left;font-weight:600">${escapeHtml(cell)}</th>`
    )
    .join("");
  const body = rows
    .map(
      (cells) =>
        `<tr>${cells
          .map(
            (cell) =>
              `<td style="border:${BORDER};padding:8px 12px;vertical-align:top">` +
              `${escapeHtml(cell)}</td>`
          )
          .join("")}</tr>`
    )
    .join("");
  const style = "border-collapse:collapse;font-family:inherit;font-size:14px";
  return `<table style="${style}"><thead><tr>${th}</tr></thead><tbody>${body}</tbody></table>`;
}

/** Tab-separated, for plain-text targets. */
export function tableToTsv(header: string[], rows: string[][]): string {
  return [header, ...rows].map((r) => r.join("\t")).join("\n");
}

/** RFC-4180 CSV: quote any field containing a comma, quote or newline. */
export function tableToCsv(header: string[], rows: string[][]): string {
  const cell = (value: string) =>
    /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
  return [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
}

/**
 * Copy as both HTML and plain text. Returns false if the browser refused, so
 * the caller can say so rather than showing a false "Copied".
 */
export async function copyTable(header: string[], rows: string[][]): Promise<boolean> {
  const html = tableToHtml(header, rows);
  const text = tableToTsv(header, rows);
  try {
    // Firefox has no ClipboardItem for text/html; fall back to plain text
    // rather than failing the copy outright.
    if (typeof ClipboardItem === "function" && navigator.clipboard?.write) {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([text], { type: "text/plain" }),
        }),
      ]);
      return true;
    }
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Save the table as a .csv the user can open in Excel or Sheets. */
export function downloadCsv(header: string[], rows: string[][], filename: string): void {
  // The BOM is what makes Excel read UTF-8 rather than mangling accents.
  const blob = new Blob([`﻿${tableToCsv(header, rows)}`], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
