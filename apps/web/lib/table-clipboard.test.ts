import { tableToCsv, tableToHtml, tableToTsv } from "@/lib/table-clipboard";
import { describe, expect, it } from "vitest";

const HEADER = ["Unit", "Avg attain", "Notes"];
const ROWS = [
  ["Finance", "95.4%", 'Ahead of "plan", just'],
  ["IT & Digital", "79.8%", "Behind, one KR at risk"],
];

describe("tableToHtml", () => {
  it("emits a real table so Teams and Outlook paste it as one", () => {
    const html = tableToHtml(HEADER, ROWS);
    expect(html.startsWith("<table")).toBe(true);
    expect(html).toContain("<thead>");
    expect((html.match(/<tr>/g) ?? []).length).toBe(3); // header + two rows
  });

  it("styles inline, because rich editors strip stylesheets", () => {
    // A class or a <style> block does not survive a paste into Outlook; an
    // inline border does. This is the whole reason the copy works.
    const html = tableToHtml(HEADER, ROWS);
    expect(html).toContain("border-collapse:collapse");
    expect(html).toContain("style=");
    expect(html).not.toContain("class=");
  });

  it("escapes cell content so a stray angle bracket cannot inject markup", () => {
    const html = tableToHtml(["A"], [['<img src=x onerror="alert(1)">']]);
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });
});

describe("tableToCsv", () => {
  it("quotes fields containing a comma, a quote or a newline", () => {
    const csv = tableToCsv(["A", "B"], [["plain", 'has "quotes", and a comma']]);
    expect(csv).toContain('"has ""quotes"", and a comma"');
  });

  it("leaves ordinary fields unquoted", () => {
    expect(tableToCsv(["A"], [["plain"]])).toBe("A\r\nplain");
  });

  it("uses CRLF, which is what Excel expects", () => {
    expect(tableToCsv(["A"], [["1"], ["2"]])).toBe("A\r\n1\r\n2");
  });
});

describe("tableToTsv", () => {
  it("stays available for plain-text targets", () => {
    expect(tableToTsv(["A", "B"], [["1", "2"]])).toBe("A\tB\n1\t2");
  });
});
