import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";

import { describe, expect, it, vi } from "vitest";

async function browserSession(authenticated = true) {
  const script = await readFile(
    new URL("../public/app.js", import.meta.url),
    "utf8",
  );
  const start = script.indexOf("async function redirectIfSessionExpired(");
  const end = script.indexOf("\nfunction setPlanningState(", start);
  if (start < 0 || end < 0) throw new Error("Session response helper missing");
  const fetch = vi.fn();
  const assign = vi.fn();
  const redirect = runInNewContext(
    `${script.slice(start, end)}\nredirectIfSessionExpired`,
    {
      fetch,
      isAuthenticatedUser: authenticated,
      window: { location: { assign } },
    },
  ) as (response: { status: number }) => Promise<boolean>;
  return { fetch, assign, redirect };
}

describe("chatbot session redirect", () => {
  it("keeps a valid login and conversation when an OBO request returns 401", async () => {
    const browser = await browserSession();
    browser.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ authenticated: true }),
    });
    expect(await browser.redirect({ status: 401 })).toBe(false);
    expect(browser.fetch).toHaveBeenCalledWith("/api/me", expect.any(Object));
    expect(browser.assign).not.toHaveBeenCalled();
  });

  it("redirects only after the session endpoint confirms expiration", async () => {
    const browser = await browserSession();
    browser.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ authenticated: false }),
    });
    expect(await browser.redirect({ status: 401 })).toBe(true);
    expect(browser.assign).toHaveBeenCalledWith("/auth/login");
  });

  it("does not discard the conversation if session verification is unavailable", async () => {
    const browser = await browserSession();
    browser.fetch.mockRejectedValue(new Error("network unavailable"));
    expect(await browser.redirect({ status: 401 })).toBe(false);
    browser.fetch.mockResolvedValue({ ok: false });
    expect(await browser.redirect({ status: 401 })).toBe(false);
    expect(browser.assign).not.toHaveBeenCalled();
  });

  it("does not force guests to log in or redirect on other failures", async () => {
    const guest = await browserSession(false);
    expect(await guest.redirect({ status: 401 })).toBe(false);
    const member = await browserSession();
    expect(await member.redirect({ status: 403 })).toBe(false);
    expect(await member.redirect({ status: 502 })).toBe(false);
    expect(guest.fetch).not.toHaveBeenCalled();
    expect(member.fetch).not.toHaveBeenCalled();
  });
});
