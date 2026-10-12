import { useChatSkills } from "@/components/app/sila/use-chat-skills";
import { ToastProvider } from "@/lib/toast";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import messages from "../../../messages/en.json";

/** The chat's skills: at most three, no duplicates, none beside the OKR pack. */
function wrapper({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={messages}>
      <QueryClientProvider client={new QueryClient()}>
        <ToastProvider>{children}</ToastProvider>
      </QueryClientProvider>
    </NextIntlClientProvider>
  );
}

function render(okrPinned = false) {
  return renderHook(
    (props: { okrPinned: boolean }) =>
      useChatSkills({ token: "", skillParam: "", okrPinned: props.okrPinned }),
    { wrapper, initialProps: { okrPinned } }
  );
}

const skill = (n: number) => ({ id: `s${n}`, name: `Skill ${n}` });

describe("useChatSkills", () => {
  it("starts undefined so a resumed chat keeps its session's skills", () => {
    expect(render().result.current.ids).toBeUndefined();
  });

  it("attaches up to three distinct skills and removes one", () => {
    const { result } = render();
    act(() => result.current.attach(skill(1)));
    act(() => result.current.attach(skill(1)));
    act(() => result.current.attach(skill(2)));
    act(() => result.current.attach(skill(3)));
    act(() => result.current.attach(skill(4)));
    expect(result.current.ids).toEqual(["s1", "s2", "s3"]);
    act(() => result.current.remove("s2"));
    expect(result.current.ids).toEqual(["s1", "s3"]);
  });

  it("refuses skills beside the OKR Reporting Pack, and drops them when it is pinned", () => {
    const pinned = render(true);
    act(() => pinned.result.current.attach(skill(1)));
    expect(pinned.result.current.ids).toBeUndefined();

    const later = render(false);
    act(() => later.result.current.attach(skill(1)));
    later.rerender({ okrPinned: true });
    expect(later.result.current.ids).toEqual([]);
  });

  it("attaches several at once, keeping what is already there", () => {
    const { result } = render();
    act(() => result.current.attach(skill(1)));
    act(() => result.current.attachMany([skill(1), skill(2), skill(3), skill(4)]));
    expect(result.current.ids).toEqual(["s1", "s2", "s3"]);
  });

  it("takes the template picker's whole set, or none for the OKR pack", () => {
    const { result } = render();
    act(() => result.current.attach(skill(1)));
    act(() => result.current.setAll([skill(2), skill(3)]));
    expect(result.current.ids).toEqual(["s2", "s3"]);
    act(() => result.current.setAll([skill(4)], { okr: true }));
    expect(result.current.ids).toEqual([]);
  });

  it("shows what the server confirmed", () => {
    const { result } = render();
    act(() => result.current.onServerSkills([skill(7)]));
    expect(result.current.skills).toEqual([skill(7)]);
  });
});
