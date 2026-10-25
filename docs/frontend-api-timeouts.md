# Bounty discovery API timeout and Retry

The bounty-discovery GET `/api/tasks` and the wallet submission-history GET
`/api/my-submissions` requests have a **15-second** deadline by default,
covering both the network request and its JSON parsing. Override the
frontend deadline at **build time** with `NEXT_PUBLIC_API_REQUEST_TIMEOUT_MS`
(e.g. `NEXT_PUBLIC_API_REQUEST_TIMEOUT_MS=10000`). Values must be whole
milliseconds from 1 to 120000; missing or invalid values use the safe default.

`frontend/src/lib/request-timeout.ts` exports a reusable
`withRequestTimeout(operation, { signal, timeoutMs })` helper. On deadline, it
rejects with `ApiRequestTimeoutError` and aborts the transport; on caller
cancellation (filter change or component unmount), it raises `AbortError` and
does not display an error. A timed-out operation cannot subsequently resolve
its wrapper, **even when a fetch adapter ignores abort**. The bounded operation
includes parsing, not just obtaining a response header.

The `useBountyDiscovery` hook retries only when the user clicks **Retry
loading bounties**, preserving the current filters and page. The submission
history page likewise offers **Retry loading history**, retaining the current
connected wallet address. It does not
silently retry POST or other potentially non-idempotent requests. A loading
status is displayed until success or an error, and failed requests show an
accessible message with the Retry button. Query changes cancel the previous
request to stop stale responses from replacing new results.

To verify locally, run from the `frontend/` directory:

```bash
pnpm exec vitest run src/lib/request-timeout.test.ts src/components/BountyList.test.tsx
```

The test suite exercises a never-resolving request, stalled response parsing,
caller cancellation, timeouts that ignore abort signals, late results, and
success on a manual retry. This pattern can be reused by other **read-only**
API screens that need bounded loading states.
