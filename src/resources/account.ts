/**
 * Account Resource
 * @packageDocumentation
 */

import type { HttpClient } from "../utils/http";
import type { Account, Credits, CreditTransaction, ApiKey } from "../types";

/**
 * Account API resource
 *
 * Access account information, credit balance, and API keys.
 *
 * @example
 * ```typescript
 * // Get credit balance
 * const credits = await sendly.account.getCredits();
 * console.log(`Available: ${credits.availableBalance} credits`);
 *
 * // Get transaction history
 * const transactions = await sendly.account.getCreditTransactions();
 *
 * // List API keys
 * const keys = await sendly.account.listApiKeys();
 * ```
 */
export class AccountResource {
  private readonly http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  /**
   * Get account information
   *
   * @returns Account details
   *
   * @example
   * ```typescript
   * const account = await sendly.account.get();
   * console.log(`Account: ${account.email}`);
   * ```
   */
  async get(): Promise<Account> {
    const account = await this.http.request<Account>({
      method: "GET",
      path: "/account",
    });

    return account;
  }

  /**
   * Get credit balance
   *
   * @returns Current credit balance and reserved credits
   *
   * @example
   * ```typescript
   * const credits = await sendly.account.getCredits();
   *
   * console.log(`Total balance: ${credits.balance}`);
   * console.log(`Reserved (scheduled): ${credits.reservedBalance}`);
   * console.log(`Available to use: ${credits.availableBalance}`);
   * ```
   */
  async getCredits(): Promise<Credits> {
    const credits = await this.http.request<Credits>({
      method: "GET",
      path: "/credits",
    });

    return credits;
  }

  /**
   * Get credit transaction history
   *
   * @param options - Pagination options
   * @returns Array of credit transactions
   *
   * @example
   * ```typescript
   * const transactions = await sendly.account.getCreditTransactions();
   *
   * for (const tx of transactions) {
   *   const sign = tx.amount > 0 ? '+' : '';
   *   console.log(`${tx.type}: ${sign}${tx.amount} credits - ${tx.description}`);
   * }
   * ```
   */
  async getCreditTransactions(options?: {
    limit?: number;
    offset?: number;
  }): Promise<CreditTransaction[]> {
    const transactions = await this.http.request<CreditTransaction[]>({
      method: "GET",
      path: "/credits/transactions",
      query: {
        limit: options?.limit,
        offset: options?.offset,
      },
    });

    return transactions;
  }

  /**
   * List API keys for the account
   *
   * Note: This returns key metadata, not the actual secret keys.
   *
   * @returns Array of API keys
   *
   * @example
   * ```typescript
   * const keys = await sendly.account.listApiKeys();
   *
   * for (const key of keys) {
   *   console.log(`${key.name}: ${key.prefix}...${key.lastFour} (${key.type})`);
   * }
   * ```
   */
  async listApiKeys(): Promise<ApiKey[]> {
    const keys = await this.http.request<ApiKey[]>({
      method: "GET",
      path: "/keys",
    });

    return keys;
  }

  /**
   * Get a specific API key by ID
   *
   * @param id - API key ID
   * @returns API key details
   *
   * @example
   * ```typescript
   * const key = await sendly.account.getApiKey('key_xxx');
   * console.log(`Last used: ${key.lastUsedAt}`);
   * ```
   */
  async getApiKey(id: string): Promise<ApiKey> {
    const key = await this.http.request<ApiKey>({
      method: "GET",
      path: `/keys/${encodeURIComponent(id)}`,
    });

    return key;
  }

  /**
   * Get usage statistics for an API key
   *
   * @param id - API key ID
   * @returns Usage statistics
   *
   * @example
   * ```typescript
   * const usage = await sendly.account.getApiKeyUsage('key_xxx');
   * console.log(`Messages sent: ${usage.messagesSent}`);
   * ```
   */
  async getApiKeyUsage(
    id: string
  ): Promise<{
    keyId: string;
    messagesSent: number;
    messagesDelivered: number;
    messagesFailed: number;
    creditsUsed: number;
    periodStart: string;
    periodEnd: string;
  }> {
    const usage = await this.http.request<{
      keyId: string;
      messagesSent: number;
      messagesDelivered: number;
      messagesFailed: number;
      creditsUsed: number;
      periodStart: string;
      periodEnd: string;
    }>({
      method: "GET",
      path: `/keys/${encodeURIComponent(id)}/usage`,
    });

    return usage;
  }
}
