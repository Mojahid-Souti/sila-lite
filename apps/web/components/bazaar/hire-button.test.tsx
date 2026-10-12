import { HireButton } from "@/components/bazaar/hire-button";
import { type BazaarAgentOut, api } from "@/lib/api";
import { ToastProvider } from "@/lib/toast";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import messages from "../../messages/en.json";

/** Hiring an agent shows a toast at once and refreshes the bell. */
describe("HireButton", () => {
  it("toasts the hire and asks the bell to refresh", async () => {
    vi.spyOn(api.hires, "hire").mockResolvedValue({
      id: "h",
      workspace_id: "w",
      agent_id: "a",
      hired_at: "2026-09-28T07:00:00+00:00",
    });
    const client = new QueryClient();
    const refresh = vi.spyOn(client, "invalidateQueries");
    const agent = { id: "a", name: "Leave Helper", kind: "chat" } as BazaarAgentOut;
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <QueryClientProvider client={client}>
          <ToastProvider>
            <HireButton agentId="a" workspaceId="w" token="t" initialHired={false} agent={agent} />
          </ToastProvider>
        </QueryClientProvider>
      </NextIntlClientProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: /hire/i }));

    expect(await screen.findByText("Leave Helper hired — it's in My agents")).toBeInTheDocument();
    await waitFor(() => expect(refresh).toHaveBeenCalledWith({ queryKey: ["notifications"] }));
  });
});
