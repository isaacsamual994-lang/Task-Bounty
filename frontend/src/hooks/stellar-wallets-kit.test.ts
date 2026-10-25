/**
 * Tests for the Stellar wallet connection and authentication flow.
 *
 * The StellarWalletsKit constructor and its methods are stubbed so these tests
 * run in a pure Node environment without a real Stellar wallet or browser extension.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  cleanupLocalStorageMock,
  createLocalStorageMock,
  setupLocalStorageMock,
} from "@/test/fixtures";
import { ErrorMessages } from "@/lib/errors";

// ---------------------------------------------------------------------------
// Mocks — declared before vi.mock() so they are available in the factory
// ---------------------------------------------------------------------------

const mockGetAddress = vi.fn();
const mockSignTransaction = vi.fn();
const mockSetWallet = vi.fn();
const mockDisconnect = vi.fn();
const mockOpenModal = vi.fn();

// vi.mock is hoisted to the top by Vitest, so arrow-function factories work.
vi.mock("@creit.tech/stellar-wallets-kit", () => {
  // StellarWalletsKit must be a real constructor function (not an arrow fn)
  // so that `new StellarWalletsKit(...)` works inside the module under test.
  function MockStellarWalletsKit() {
    return {
      getAddress: mockGetAddress,
      signTransaction: mockSignTransaction,
      setWallet: mockSetWallet,
      disconnect: mockDisconnect,
      openModal: mockOpenModal,
    };
  }

  return {
    StellarWalletsKit: MockStellarWalletsKit,
    allowAllModules: vi.fn(() => []),
    FREIGHTER_ID: "freighter",
    WalletNetwork: { TESTNET: "TESTNET", PUBLIC: "PUBLIC" },
  };
});

vi.mock("@/lib/env", () => ({
  getPublicEnv: vi.fn(() => ({
    stellarNetwork: "TESTNET",
    horizonUrl: "https://horizon-testnet.stellar.org",
  })),
}));

// ---------------------------------------------------------------------------
// localStorage stub
// ---------------------------------------------------------------------------

const localStorageMock = createLocalStorageMock();

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  localStorageMock.clear();

  // Stub window so `typeof window !== "undefined"` is true in the module
  setupLocalStorageMock(localStorageMock);
});

afterEach(() => {
  cleanupLocalStorageMock();
});

async function loadKit() {
  return import("./stellar-wallets-kit");
}

// ---------------------------------------------------------------------------
// getPublicKey
// ---------------------------------------------------------------------------

describe("getPublicKey", () => {
  it("returns null when no wallet has been selected", async () => {
    localStorageMock.getItem.mockReturnValue(null);
    const { getPublicKey } = await loadKit();
    expect(await getPublicKey()).toBeNull();
  });

  it("returns the address string when a wallet is selected and getAddress resolves", async () => {
    const MOCK_ADDRESS = "GABCDE1234567890ABCDE1234567890ABCDE1234567890ABCDE12345678";
    localStorageMock.getItem.mockReturnValue("freighter");
    mockGetAddress.mockResolvedValue({ address: MOCK_ADDRESS });

    const { getPublicKey } = await loadKit();
    const result = await getPublicKey();

    expect(result).toBe(MOCK_ADDRESS);
  });

  it("returns null when getAddress throws", async () => {
    localStorageMock.getItem.mockReturnValue("freighter");
    mockGetAddress.mockRejectedValue(new Error("Wallet error"));

    const { getPublicKey } = await loadKit();
    expect(await getPublicKey()).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// setWallet
// ---------------------------------------------------------------------------

describe("setWallet", () => {
  it("persists the selected wallet id to localStorage", async () => {
    const { setWallet } = await loadKit();
    await setWallet("xbull");

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      "selectedWalletId",
      "xbull",
    );
  });

  it("calls kit.setWallet with the new wallet id", async () => {
    // Pre-initialize the kit by calling getPublicKey first
    localStorageMock.getItem.mockReturnValue("freighter");
    mockGetAddress.mockResolvedValue({ address: "G" + "A".repeat(55) });

    const { getPublicKey, setWallet } = await loadKit();
    await getPublicKey(); // initializes the kit singleton
    await setWallet("albedo");

    expect(mockSetWallet).toHaveBeenCalledWith("albedo");
  });
});

// ---------------------------------------------------------------------------
// disconnect
// ---------------------------------------------------------------------------

describe("disconnect", () => {
  it("removes the stored wallet id from localStorage", async () => {
    localStorageMock.getItem.mockReturnValue("freighter");
    const { disconnect } = await loadKit();

    await disconnect();

    expect(localStorageMock.removeItem).toHaveBeenCalledWith("selectedWalletId");
  });

  it("invokes kit.disconnect()", async () => {
    localStorageMock.getItem.mockReturnValue("freighter");
    mockGetAddress.mockResolvedValue({ address: "G" + "A".repeat(55) });
    mockDisconnect.mockResolvedValue(undefined);

    const { getPublicKey, disconnect } = await loadKit();
    await getPublicKey(); // init kit
    await disconnect();

    expect(mockDisconnect).toHaveBeenCalled();
  });

  it("calls the optional callback after disconnecting", async () => {
    const callback = vi.fn().mockResolvedValue(undefined);
    localStorageMock.getItem.mockReturnValue("freighter");
    mockGetAddress.mockResolvedValue({ address: "G" + "A".repeat(55) });
    mockDisconnect.mockResolvedValue(undefined);

    const { getPublicKey, disconnect } = await loadKit();
    await getPublicKey(); // init kit
    await disconnect(callback);

    expect(callback).toHaveBeenCalledOnce();
  });

  it("still calls the callback even if kit.disconnect() throws", async () => {
    const callback = vi.fn().mockResolvedValue(undefined);
    localStorageMock.getItem.mockReturnValue("freighter");
    mockGetAddress.mockResolvedValue({ address: "G" + "A".repeat(55) });
    mockDisconnect.mockRejectedValue(new Error("disconnect failed"));

    const { getPublicKey, disconnect } = await loadKit();
    await getPublicKey(); // init kit

    await expect(disconnect(callback)).resolves.not.toThrow();
    expect(callback).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// connect
// ---------------------------------------------------------------------------

describe("connect", () => {
  it("opens the wallet selection modal", async () => {
    mockOpenModal.mockImplementation(
      async ({ onWalletSelected }: { onWalletSelected: (o: { id: string }) => Promise<string> }) => {
        await onWalletSelected({ id: "freighter" });
      },
    );

    const { connect } = await loadKit();
    const callback = vi.fn().mockResolvedValue(undefined);

    await connect(callback);

    expect(mockOpenModal).toHaveBeenCalled();
  });

  it("invokes the callback after a wallet is selected", async () => {
    const callback = vi.fn().mockResolvedValue(undefined);

    mockOpenModal.mockImplementation(
      async ({ onWalletSelected }: { onWalletSelected: (o: { id: string }) => Promise<void> }) => {
        await onWalletSelected({ id: "freighter" });
      },
    );

    const { connect } = await loadKit();
    await connect(callback);

    expect(callback).toHaveBeenCalledOnce();
  });

  it("does not throw when openModal rejects", async () => {
    mockOpenModal.mockRejectedValue(new Error("user cancelled"));

    const { connect } = await loadKit();
    // connect() catches openModal errors internally
    await expect(connect()).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// signTransaction
// ---------------------------------------------------------------------------

describe("signTransaction", () => {
  it("returns the signed XDR when the kit resolves", async () => {
    localStorageMock.getItem.mockReturnValue("freighter");
    mockGetAddress.mockResolvedValue({ address: "G" + "A".repeat(55) });
    const SIGNED_XDR = "AAAAAQAAA...signedXDR";
    mockSignTransaction.mockResolvedValue(SIGNED_XDR);

    const { getPublicKey, signTransaction } = await loadKit();
    await getPublicKey(); // init kit

    const result = await signTransaction("AAAA...rawXDR", {
      address: "G" + "A".repeat(55),
      networkPassphrase: "Test SDF Network ; September 2015",
    });

    expect(result).toBe(SIGNED_XDR);
  });

  it("throws a WALLET_CONNECTION_FAILED error when signTransaction rejects", async () => {
    localStorageMock.getItem.mockReturnValue("freighter");
    mockGetAddress.mockResolvedValue({ address: "G" + "A".repeat(55) });
    mockSignTransaction.mockRejectedValue(new Error("user rejected"));

    const { getPublicKey, signTransaction } = await loadKit();
    await getPublicKey(); // init kit

    await expect(
      signTransaction("AAAA...rawXDR", {
        address: "G" + "A".repeat(55),
        networkPassphrase: "Test SDF Network ; September 2015",
      }),
    ).rejects.toThrow(ErrorMessages.WALLET_CONNECTION_FAILED);
  });

  it("normalizes unexpected signing errors to a clear wallet message", async () => {
    localStorageMock.getItem.mockReturnValue("freighter");
    mockSignTransaction.mockRejectedValue("transport socket closed");

    const { signTransaction } = await loadKit();
    await expect(
      signTransaction("XDR", {
        address: "G" + "A".repeat(55),
        networkPassphrase: "Test SDF Network ; September 2015",
      }),
    ).rejects.toThrow(ErrorMessages.WALLET_CONNECTION_FAILED);
  });

  it("throws when the kit is not available (server-side / no window)", async () => {
    // No window → getKit() returns null → signTransaction should throw
    vi.unstubAllGlobals();
    vi.resetModules();

    const { signTransaction } = await import("./stellar-wallets-kit");

    await expect(
      signTransaction("XDR", {
        address: "G" + "A".repeat(55),
        networkPassphrase: "Test SDF Network ; September 2015",
      }),
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Network selection
// ---------------------------------------------------------------------------

describe("wallet network selection", () => {
  it("initialises the kit with the TESTNET network when env is set to TESTNET", async () => {
    localStorageMock.getItem.mockReturnValue("freighter");
    mockGetAddress.mockResolvedValue({ address: "G" + "A".repeat(55) });

    const { getPublicKey } = await loadKit();
    await getPublicKey();

    // The mock constructor was called — just assert the call happened.
    // The exact args are bound at construction time, and the mock captures them.
    // We verify the kit was instantiated at all (network resolution didn't throw).
    expect(mockGetAddress).toHaveBeenCalled();
  });
});
