import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { APIFY_TIMEOUT_MS, runApifyActor } from "./client";

/** A fetch that never answers. Its signal aborts it, the way our timeout does. */
function hangingFetch(_url: string, init: { signal: AbortSignal }) {
  return new Promise<Response>((_resolve, reject) => {
    init.signal.addEventListener("abort", () => {
      reject(Object.assign(new Error("This operation was aborted"), { name: "AbortError" }));
    });
  });
}

function concurrencyLimitResponse() {
  return new Response(JSON.stringify({ error: { message: "Exceeded the limit of concurrent Actor runs" } }), {
    status: 429,
  });
}

describe("runApifyActor wait bound", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    process.env.APIFY_API_TOKEN = "test-token";
    fetchMock = vi.fn(hangingFetch);
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete process.env.APIFY_API_TOKEN;
  });

  it("aborts the HTTP wait when the given timeoutMs runs out", async () => {
    let outcome: unknown;
    const call = runApifyActor("apify~x", {}, { timeoutMs: 45_000 }).catch((e: unknown) => {
      outcome = e;
    });

    await vi.advanceTimersByTimeAsync(44_999);
    expect(outcome).toBeUndefined();
    await vi.advanceTimersByTimeAsync(1);
    await call;

    expect((outcome as Error).name).toBe("AbortError");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("waits APIFY_TIMEOUT_MS when no timeout is given", async () => {
    let outcome: unknown;
    const call = runApifyActor("apify~x", {}).catch((e: unknown) => {
      outcome = e;
    });

    await vi.advanceTimersByTimeAsync(APIFY_TIMEOUT_MS - 1);
    expect(outcome).toBeUndefined();
    await vi.advanceTimersByTimeAsync(1);
    await call;

    expect((outcome as Error).name).toBe("AbortError");
  });

  it("counts the wait for a run slot against timeoutMs, and never calls Apify for a waiter that gave up", async () => {
    // Four runs hold every slot for their full default wait.
    const holders = Array.from({ length: 4 }, () => runApifyActor("apify~x", {}).catch((e: unknown) => e));
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(4);

    let outcome: unknown;
    const queued = runApifyActor("apify~x", {}, { timeoutMs: 10_000 }).catch((e: unknown) => {
      outcome = e;
    });
    await vi.advanceTimersByTimeAsync(9_999);
    expect(outcome).toBeUndefined();
    await vi.advanceTimersByTimeAsync(1);
    await queued;

    expect((outcome as Error).message).toMatch(/timed out waiting for a free run slot/);
    expect(fetchMock).toHaveBeenCalledTimes(4);

    // The holders abort at their 60 s default and release their slots.
    await vi.advanceTimersByTimeAsync(APIFY_TIMEOUT_MS);
    await Promise.all(holders);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("does not start a concurrency retry that cannot finish inside timeoutMs", async () => {
    fetchMock.mockResolvedValue(concurrencyLimitResponse());

    const error = await runApifyActor("apify~x", {}, { timeoutMs: 1_500 }).catch((e: unknown) => e);

    expect((error as Error).message).toMatch(/concurrent Actor runs/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries a concurrency error while the wait still allows it", async () => {
    fetchMock
      .mockResolvedValueOnce(concurrencyLimitResponse())
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: 1 }]), { status: 200 }));

    const call = runApifyActor("apify~x", {});
    await vi.advanceTimersByTimeAsync(2_000);

    await expect(call).resolves.toEqual([{ id: 1 }]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
