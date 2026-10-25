import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  apiRequestTimeoutMs,
  ApiRequestTimeoutError,
  DEFAULT_API_TIMEOUT_MS,
  withRequestTimeout,
} from "./request-timeout";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe("API request timeout configuration", () => {
  it("has a safe default and accepts a valid build-time override", () => {
    expect(apiRequestTimeoutMs(undefined)).toBe(DEFAULT_API_TIMEOUT_MS);
    expect(apiRequestTimeoutMs("5000")).toBe(5000);
    expect(apiRequestTimeoutMs("120000")).toBe(120000);
  });

  it.each(["", "0", "-1", "oops", "2.5", "Infinity", "120001", "99999999999999999999"])(
    "falls back for invalid value %j",
    (value) => expect(apiRequestTimeoutMs(value)).toBe(DEFAULT_API_TIMEOUT_MS),
  );

  it.each([0, -1, 120001, 1.5, Number.NaN])("rejects invalid per-call limit %s", async (timeoutMs) => {
    await expect(withRequestTimeout(() => Promise.resolve("ok"), { timeoutMs })).rejects.toThrow(RangeError);
  });
});

describe("withRequestTimeout", () => {
  it("returns the result of a fast request and removes its timer", async () => {
    const operation = vi.fn().mockResolvedValue({ ok: true });
    await expect(withRequestTimeout(operation, { timeoutMs: 250 })).resolves.toEqual({ ok: true });
    expect(operation).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("times out a never-settling fetch and aborts its signal", async () => {
    let receivedSignal: AbortSignal | undefined;
    const pending = withRequestTimeout(async (signal) => {
      receivedSignal = signal;
      return new Promise<string>(() => {});
    }, { timeoutMs: 500 });
    const asserted = expect(pending).rejects.toBeInstanceOf(ApiRequestTimeoutError);
    await vi.advanceTimersByTimeAsync(500);
    await asserted;
    expect(receivedSignal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("bounds stalled JSON parsing as well as a stalled initial fetch", async () => {
    const pending = withRequestTimeout(async () => {
      const response = { json: () => new Promise<unknown>(() => {}) };
      return response.json();
    }, { timeoutMs: 75 });
    const asserted = expect(pending).rejects.toThrow(/timed out after 1 seconds/);
    await vi.advanceTimersByTimeAsync(75);
    await asserted;
  });

  it("ignores a late transport result after the timeout has rejected", async () => {
    const lateResponse = deferred<string>();
    const pending = withRequestTimeout(() => lateResponse.promise, { timeoutMs: 50 });
    const asserted = expect(pending).rejects.toBeInstanceOf(ApiRequestTimeoutError);
    await vi.advanceTimersByTimeAsync(50);
    await asserted;
    lateResponse.resolve("too late");
    await Promise.resolve();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("distinguishes caller cancellation from a timeout, even when the operation ignores the signal", async () => {
    const caller = new AbortController();
    let requestSignal: AbortSignal | undefined;
    const pending = withRequestTimeout((signal) => {
      requestSignal = signal;
      return new Promise<never>(() => {});
    }, { timeoutMs: 2000, signal: caller.signal });
    const asserted = expect(pending).rejects.toMatchObject({ name: "AbortError" });
    await Promise.resolve();
    caller.abort();
    await asserted;
    expect(requestSignal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not run an operation if the caller was already aborted", async () => {
    const caller = new AbortController();
    caller.abort();
    const operation = vi.fn().mockResolvedValue("unexpected");
    await expect(withRequestTimeout(operation, { signal: caller.signal })).rejects.toMatchObject({ name: "AbortError" });
    expect(operation).not.toHaveBeenCalled();
  });

  it("returns the original server error instead of calling it a timeout", async () => {
    const failure = new Error("HTTP 503");
    await expect(withRequestTimeout(async () => { throw failure; }, { timeoutMs: 100 })).rejects.toBe(failure);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("keeps a successful retry independent of an earlier timed-out request", async () => {
    const never = new Promise<string>(() => {});
    const original = withRequestTimeout(() => never, { timeoutMs: 50 });
    const originalRejected = expect(original).rejects.toBeInstanceOf(ApiRequestTimeoutError);
    await vi.advanceTimersByTimeAsync(50);
    await originalRejected;
    await expect(withRequestTimeout(() => Promise.resolve("retry worked"), { timeoutMs: 50 })).resolves.toBe("retry worked");
  });
});
