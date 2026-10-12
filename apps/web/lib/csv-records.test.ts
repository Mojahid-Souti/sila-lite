import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { csvPreview, csvRecords } from "@/lib/csv-records";
import { describe, expect, it } from "vitest";

// The OKR team's acceptance file: Excel's BOM, CRLF, and line breaks inside
// quoted Actual Progress cells.
const CLEAN = readFileSync(
  resolve(__dirname, "../../api/tests/fixtures/okr/okr-grc-test-1-clean.csv"),
  "utf8"
);

describe("csvRecords", () => {
  it("keeps a quoted line break inside its cell", () => {
    expect(csvRecords('a,b\n1,"line one\nline two"\n')).toEqual([
      ["a", "b"],
      ["1", "line one\nline two"],
    ]);
  });

  it("reads doubled quotes, CRLF and a BOM", () => {
    expect(csvRecords('﻿a,b\r\n"say ""hi""",2\r\n')).toEqual([
      ["a", "b"],
      ['say "hi"', "2"],
    ]);
  });

  it("counts the acceptance file as 18 key results under one header", () => {
    const records = csvRecords(CLEAN);
    expect(CLEAN.split(/\r?\n/).length).toBeGreaterThan(19); // lines would lie
    expect(records.length).toBe(19);
    expect(records[0][0]).toBe("#"); // the BOM is not glued to the first header
  });
});

describe("csvPreview", () => {
  it("says 18 rows for 18 key results, not the physical line count", () => {
    expect(csvPreview(CLEAN, 220).split("\n")[0]).toBe("18 rows · 16 columns");
  });

  it("falls back to the text for a one-line file", () => {
    expect(csvPreview("just a header", 220)).toBe("just a header");
  });
});
