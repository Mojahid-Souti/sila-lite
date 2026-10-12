/**
 * CSV as RECORDS, not lines (RFC 4180): a quoted cell may hold line breaks,
 * commas and doubled quotes, and Excel's "CSV UTF-8" starts with a BOM.
 *
 * The attachment card once counted physical lines, so a sheet of 18 key
 * results whose progress cells had line breaks read "34 rows". The card's
 * count must be the count the server's parser sees.
 *
 * Complexity: O(n) in the text length, one pass.
 */

/** Every non-empty record of `text`, each as its cells. */
export function csvRecords(text: string, delimiter = ","): string[][] {
  const source = text.startsWith("﻿") ? text.slice(1) : text;
  const records: string[][] = [];
  let record: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (quoted) {
      if (ch === '"' && source[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === delimiter) {
      record.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && source[i + 1] === "\n") i++;
      record.push(cell);
      if (record.some((c) => c.trim())) records.push(record);
      record = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  record.push(cell);
  if (record.some((c) => c.trim())) records.push(record);
  return records;
}

/** The card preview: "18 rows · 16 columns" and the leading column names. */
export function csvPreview(text: string, fallbackChars: number): string {
  const records = csvRecords(text);
  if (records.length < 2) return text.slice(0, fallbackChars);
  const columns = records[0].map((c) => c.trim());
  const named = columns.filter(Boolean);
  const shown = named.slice(0, 4).join(", ");
  const more = named.length > 4 ? ` +${named.length - 4} more` : "";
  return `${records.length - 1} rows · ${columns.length} columns\n${shown}${more}`;
}
