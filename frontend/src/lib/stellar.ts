/**
 * Stellar utility functions for interacting with the Horizon API
 */

import { createError, ErrorCodes, StandardError } from "@/lib/errors";
import { getPublicEnv } from "@/lib/env";

interface AccountDetails {
  id: string;
  balances: Array<{
    balance: string;
    asset_type: string;
    asset_code?: string;
    asset_issuer?: string;
  }>;
}

function getHorizonUrl() {
  return getPublicEnv().horizonUrl.replace(/\/$/, "");
}

/**
 * Fetches the account details for a given Stellar public key
 * @param publicKey - The Stellar public key
 * @returns Account details from Horizon API or throws a StandardError
 */
export async function getAccountDetails(
  publicKey: string,
): Promise<AccountDetails> {
  try {
    const response = await fetch(`${getHorizonUrl()}/accounts/${publicKey}`);
    if (!response.ok) {
      if (response.status === 404) {
        throw createError(ErrorCodes.STELLAR_ACCOUNT_NOT_FOUND);
      }
      throw createError(ErrorCodes.STELLAR_FETCH_FAILED);
    }
    return await response.json();
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error.code === ErrorCodes.STELLAR_ACCOUNT_NOT_FOUND ||
        error.code === ErrorCodes.STELLAR_FETCH_FAILED)
    ) {
      throw error as StandardError;
    }
    console.error("Error fetching account details:", error);
    throw createError(ErrorCodes.STELLAR_FETCH_FAILED);
  }
}

/**
 * Fetches the native (XLM) balance for a given Stellar public key
 * @param publicKey - The Stellar public key
 * @returns XLM balance as a string or throws a StandardError
 */
export async function getNativeBalance(
  publicKey: string,
): Promise<string> {
  const accountDetails = await getAccountDetails(publicKey);

  const nativeBalance = accountDetails.balances.find(
    (balance) => balance.asset_type === "native",
  );

  if (!nativeBalance) {
    throw createError(ErrorCodes.STELLAR_BALANCE_NOT_FOUND);
  }

  return nativeBalance.balance;
}

/**
 * Abbreviates a Stellar public key
 * @param publicKey - The full Stellar public key
 * @param startChars - Number of characters to show at the start (default: 4)
 * @param endChars - Number of characters to show at the end (default: 4)
 * @returns Abbreviated key (e.g., GABCD...WXYZ)
 */
export function abbreviatePublicKey(
  publicKey: string,
  startChars: number = 4,
  endChars: number = 4,
): string {
  if (!publicKey || publicKey.length < startChars + endChars) {
    return publicKey;
  }
  return `${publicKey.substring(0, startChars)}...${publicKey.substring(
    publicKey.length - endChars,
  )}`;
}

/**
 * Formats a balance to a readable string with limited decimal places
 * @param balance - The balance as a string
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted balance string
 */
export function formatBalance(balance: string, decimals: number = 2): string {
  try {
    const num = parseFloat(balance);
    if (isNaN(num)) return "0.00";
    return num.toFixed(decimals);
  } catch {
    return "0.00";
  }
}
