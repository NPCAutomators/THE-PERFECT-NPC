import { afterEach, describe, expect, it, vi } from "vitest";

import { PromiseTimeoutError, withTimeout } from "./promise-timeout";

describe("withTimeout", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns a value that arrives before the deadline", async () => {
    await expect(withTimeout(Promise.resolve("ready"), 100, "status")).resolves.toBe(
      "ready",
    );
  });

  it("preserves a source rejection", async () => {
    const failure = new Error("offline");
    await expect(withTimeout(Promise.reject(failure), 100, "status")).rejects.toBe(
      failure,
    );
  });

  it("rejects a stalled request with an actionable timeout error", async () => {
    vi.useFakeTimers();
    const pending = new Promise<never>(() => {});
    const result = withTimeout(pending, 2_500, "System status");

    const assertion = expect(result).rejects.toEqual(
      new PromiseTimeoutError("System status", 2_500),
    );
    await vi.advanceTimersByTimeAsync(2_500);
    await assertion;
  });
});
