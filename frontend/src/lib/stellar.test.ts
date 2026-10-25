import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorCodes, ErrorMessages } from "@/lib/errors";
import { getAccountDetails, getNativeBalance } from "@/lib/stellar";

const key = "G" + "A".repeat(55);

function horizon(status: number, payload: unknown = {}) {
  return { ok: status >= 200 && status < 300, status, json: vi.fn().mockResolvedValue(payload) } as unknown as Response;
}

describe("Horizon transaction/account failure feedback", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn()));
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it("reports a missing account with an actionable user-facing error", async () => {
    vi.mocked(fetch).mockResolvedValue(horizon(404));
    await expect(getAccountDetails(key)).rejects.toMatchObject({
      code: ErrorCodes.STELLAR_ACCOUNT_NOT_FOUND,
      message: ErrorMessages.STELLAR_ACCOUNT_NOT_FOUND,
    });
  });

  it.each([400, 429, 500, 503])("reports Horizon HTTP %i as a fetch failure", async (status) => {
    vi.mocked(fetch).mockResolvedValue(horizon(status));
    await expect(getAccountDetails(key)).rejects.toMatchObject({
      code: ErrorCodes.STELLAR_FETCH_FAILED,
      message: ErrorMessages.STELLAR_FETCH_FAILED,
    });
  });

  it("handles disconnected network errors without exposing transport details", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(fetch).mockRejectedValue(new TypeError("network unavailable"));
    await expect(getAccountDetails(key)).rejects.toMatchObject({
      code: ErrorCodes.STELLAR_FETCH_FAILED,
      message: ErrorMessages.STELLAR_FETCH_FAILED,
    });
  });

  it("normalizes a malformed Horizon JSON response to a fetch error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = horizon(200);
    vi.mocked(response.json).mockRejectedValue(new SyntaxError("invalid JSON"));
    vi.mocked(fetch).mockResolvedValue(response);

    await expect(getAccountDetails(key)).rejects.toMatchObject({
      code: ErrorCodes.STELLAR_FETCH_FAILED,
      message: ErrorMessages.STELLAR_FETCH_FAILED,
    });
  });

  it("preserves a missing-account error when fetching native balance", async () => {
    vi.mocked(fetch).mockResolvedValue(horizon(404));
    await expect(getNativeBalance(key)).rejects.toMatchObject({
      code: ErrorCodes.STELLAR_ACCOUNT_NOT_FOUND,
      message: ErrorMessages.STELLAR_ACCOUNT_NOT_FOUND,
    });
  });

  it("reports absent native balance even when other assets exist", async () => {
    vi.mocked(fetch).mockResolvedValue(horizon(200, {
      id: key, balances: [{ asset_type: "credit_alphanum4", balance: "10", asset_code: "USDC" }],
    }));
    await expect(getNativeBalance(key)).rejects.toMatchObject({
      code: ErrorCodes.STELLAR_BALANCE_NOT_FOUND,
      message: ErrorMessages.STELLAR_BALANCE_NOT_FOUND,
    });
  });

  it("returns native balance rather than a non-native token balance", async () => {
    vi.mocked(fetch).mockResolvedValue(horizon(200, {
      id: key, balances: [
        { asset_type: "credit_alphanum4", balance: "100", asset_code: "USDC" },
        { asset_type: "native", balance: "3.5" },
      ],
    }));
    await expect(getNativeBalance(key)).resolves.toBe("3.5");
  });
});
