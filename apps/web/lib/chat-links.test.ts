import { chatHref, parseSkillParam, skillChatHref, templateChatHref } from "@/lib/chat-links";
import { ROUTES } from "@/lib/constants";
import { describe, expect, it } from "vitest";

/** Links into the chat carry a template and skills as IDs only. */
describe("chat links", () => {
  it("builds the template + skills link", () => {
    expect(templateChatHref("tpl-data", ["a", "b"])).toBe(
      `${ROUTES.dashboard}?template=tpl-data&skill=a%2Cb`
    );
    expect(skillChatHref("a")).toBe(`${ROUTES.dashboard}?skill=a`);
    expect(chatHref({})).toBe(ROUTES.dashboard);
  });

  it("reads the skill parameter back, deduplicated", () => {
    expect(parseSkillParam("a, b,,a")).toEqual(["a", "b"]);
    expect(parseSkillParam(null)).toEqual([]);
  });
});
