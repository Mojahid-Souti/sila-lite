import { type SilaSkillRef, useSilaSocket } from "@/lib/sila-socket";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Skills ride the socket hello as IDs only, and a change of skills reconnects
 * so the next message carries them — but the chat echoing back the list the
 * server just confirmed must not reconnect (that would loop).
 */
class FakeSocket {
  static opened: FakeSocket[] = [];
  static OPEN = 1;
  readyState = 0;
  sent: string[] = [];
  binaryType = "";
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(public url: string) {
    FakeSocket.opened.push(this);
  }
  send(data: string) {
    this.sent.push(data);
  }
  close() {
    this.readyState = 3;
  }
  open() {
    this.readyState = 1;
    this.onopen?.();
  }
  hello(): Record<string, unknown> {
    return JSON.parse(this.sent[0]);
  }
}

beforeEach(() => {
  FakeSocket.opened = [];
  vi.stubGlobal("WebSocket", FakeSocket);
});
afterEach(() => vi.unstubAllGlobals());

function render(skills: string[] | undefined, onSkills = vi.fn()) {
  return renderHook(
    (props: { skills?: string[] }) =>
      useSilaSocket({
        token: "t",
        workspaceId: "w",
        onNavigate: () => {},
        skills: props.skills,
        onSkills,
      }),
    { initialProps: { skills } }
  );
}

describe("skills in the socket hello", () => {
  it("sends the skill IDs, and leaves them out when the chat set none", () => {
    const withSkills = render(["a", "b"]);
    act(() => withSkills.result.current.send("hi"));
    act(() => FakeSocket.opened[0].open());
    expect(FakeSocket.opened[0].hello().skills).toEqual(["a", "b"]);

    const resumed = render(undefined);
    act(() => resumed.result.current.send("hi"));
    act(() => FakeSocket.opened[1].open());
    expect("skills" in FakeSocket.opened[1].hello()).toBe(false);
  });

  it("reconnects on a change, but not on the server's own confirmation", () => {
    const onSkills = vi.fn();
    const hook = render(undefined, onSkills);
    act(() => hook.result.current.send("hi"));
    act(() => FakeSocket.opened[0].open());

    const confirmed: SilaSkillRef[] = [{ id: "a", name: "brainstorming" }];
    act(() =>
      FakeSocket.opened[0].onmessage?.({
        data: JSON.stringify({ type: "skills", items: confirmed }),
      })
    );
    expect(onSkills).toHaveBeenCalledWith(confirmed);
    hook.rerender({ skills: ["a"] }); // the chat shows what the server confirmed
    expect(FakeSocket.opened).toHaveLength(1);

    hook.rerender({ skills: ["a", "b"] }); // the user adds one
    expect(FakeSocket.opened).toHaveLength(2);
    act(() => FakeSocket.opened[1].open());
    expect(FakeSocket.opened[1].hello().skills).toEqual(["a", "b"]);
  });
});
