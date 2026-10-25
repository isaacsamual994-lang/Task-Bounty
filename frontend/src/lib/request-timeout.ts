/**
 * Bound async API reads (including body parsing), even when a fetch adapter
 * ignores AbortSignal. Caller cancellation and timeouts have different errors.
 * Never blindly retry writes: this only controls one request's lifetime.
 */
export const DEFAULT_API_TIMEOUT_MS = 15_000;
const MAX_API_TIMEOUT_MS = 120_000;

/**
 * Client-side override at build time, e.g. NEXT_PUBLIC_API_REQUEST_TIMEOUT_MS=10000.
 * Reject invalid/missing settings instead of accidentally disabling the limit.
 */
export function apiRequestTimeoutMs(
  configured: string | undefined = process.env.NEXT_PUBLIC_API_REQUEST_TIMEOUT_MS,
): number {
  if (!configured) return DEFAULT_API_TIMEOUT_MS;
  const parsed = Number(configured);
  return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= MAX_API_TIMEOUT_MS
    ? parsed
    : DEFAULT_API_TIMEOUT_MS;
}

export class ApiRequestTimeoutError extends Error {
  constructor(milliseconds: number) {
    super(`Request timed out after ${Math.ceil(milliseconds / 1000)} seconds. Please try again.`);
    this.name = "ApiRequestTimeoutError";
  }
}

function abortError(): Error {
  const error = new Error("Request was cancelled.");
  error.name = "AbortError";
  return error;
}

export interface RequestTimeoutOptions {
  /** Maximum time for the whole operation, including parsing the response. */
  timeoutMs?: number;
  /** Optional external signal for route changes or component unmount. */
  signal?: AbortSignal;
}

/**
 * Resolve with the operation's result, or reject on timeout/caller abort.
 * Late responses cannot settle this promise after the deadline, even if the
 * underlying fetch ignores the abort; the supplied signal cancels real fetches.
 */
export async function withRequestTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  { timeoutMs = apiRequestTimeoutMs(), signal }: RequestTimeoutOptions = {},
): Promise<T> {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > MAX_API_TIMEOUT_MS) {
    throw new RangeError("timeoutMs must be a positive integer at most 120000");
  }
  if (signal?.aborted) throw abortError();

  const controller = new AbortController();
  let deadline: ReturnType<typeof setTimeout> | undefined;
  let cancelRequest: ((reason: Error) => void) | undefined;

  const cancelled = new Promise<never>((_resolve, reject) => {
    cancelRequest = reject;
  });
  const onCallerAbort = () => {
    cancelRequest?.(abortError());
    controller.abort();
  };
  signal?.addEventListener("abort", onCallerAbort, { once: true });

  const timedOut = new Promise<never>((_resolve, reject) => {
    deadline = setTimeout(() => {
      reject(new ApiRequestTimeoutError(timeoutMs));
      controller.abort();
    }, timeoutMs);
  });

  try {
    // Deferring the operation ensures cancellation can win if the caller
    // aborts between registration and the next microtask.
    const running = Promise.resolve().then(() => {
      if (controller.signal.aborted) throw abortError();
      return operation(controller.signal);
    });
    return await Promise.race([running, timedOut, cancelled]);
  } finally {
    if (deadline !== undefined) clearTimeout(deadline);
    signal?.removeEventListener("abort", onCallerAbort);
  }
}
