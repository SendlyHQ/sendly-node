/**
 * Account Resource
 * @packageDocumentation
 */

import type { HttpClient } from "../utils/http";
import type {
  Account,
  Credits,
  CreditTransaction,
  ApiKey,
  ApiKeyUsage,
  RotateApiKeyResponse,
} from "../types";

type RawApiKey = Partial<ApiKey> & {
  keyPrefix?: string | null;
  scopes?: string[] | null;
  revokedAt?: string | null;
  [key: string]: unknown;
};

function toApiKey<T extends ApiKey>(raw: RawApiKey): T {
  return {
    ...raw,
    prefix:
      raw.prefix !== undefined
        ? raw.prefix
        : raw.keyPrefix
          ? `${raw.keyPrefix}...`
          : undefined,
    permissions: raw.permissions !== undefined ? raw.permissions : raw.scopes,
    isRevoked:
      raw.isRevoked !== undefined
        ? raw.isRevoked
        : raw.revokedAt != null || raw.isActive === false,
  } as T;
}

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
    const raw = await this.http.request<
      Partial<Account> & {
        user?: { id: string; email: string; createdAt: string };
        credits?: { balance?: number | string; reservedBalance?: number | string };
      }
    >({
      method: "GET",
      path: "/account",
    });

    return {
      ...raw,
      id: raw.user?.id ?? raw.id,
      email: raw.user?.email ?? raw.email,
      createdAt: raw.user?.createdAt ?? raw.createdAt,
      ...(raw.credits && {
        credits: {
          balance: Number(raw.credits.balance ?? 0),
          reservedBalance: Number(raw.credits.reservedBalance ?? 0),
        },
      }),
    } as Account;
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
   * Get credit transaction history, newest first
   *
   * @param options - Pagination options, and a transaction type to filter by
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
   *
   * // Only refunds
   * const refunds = await sendly.account.getCreditTransactions({ type: 'refund' });
   * ```
   */
  async getCreditTransactions(options?: {
    limit?: number;
    offset?: number;
    type?: CreditTransaction["type"];
  }): Promise<CreditTransaction[]> {
    const response = await this.http.request<{
      transactions?: Array<{
        id: string;
        amount: number;
        balance_after: number;
        type: CreditTransaction["type"];
        description: string;
        created_at: string;
      }>;
    }>({
      method: "GET",
      path: "/credits/transactions",
      query: {
        limit: options?.limit,
        offset: options?.offset,
        type: options?.type,
      },
    });

    return (response.transactions ?? []).map((t) => ({
      id: t.id,
      type: t.type,
      amount: t.amount,
      balanceAfter: t.balance_after,
      description: t.description,
      createdAt: t.created_at,
    }));
  }

  async transferCredits(options: {
    targetOrganizationId: string;
    amount: number;
  }): Promise<{
    success: boolean;
    amount: number;
    sourceBalance: number;
    targetBalance: number;
  }> {
    return this.http.request({
      method: "POST",
      path: "/credits/transfer",
      body: {
        targetOrganizationId: options.targetOrganizationId,
        amount: options.amount,
      },
    });
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
   *   console.log(`${key.name}: ${key.prefix} (${key.type})`);
   * }
   * ```
   */
  async listApiKeys(): Promise<ApiKey[]> {
    const response = await this.http.request<{ keys: RawApiKey[] }>({
      method: "GET",
      path: "/account/keys",
    });

    return response.keys.map((key) => toApiKey(key));
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
    const key = await this.http.request<RawApiKey>({
      method: "GET",
      path: `/account/keys/${encodeURIComponent(id)}`,
    });

    return toApiKey(key);
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
   * console.log(`Requests: ${usage.summary.totalRequests}`);
   * ```
   */
  async getApiKeyUsage(id: string): Promise<ApiKeyUsage> {
    const usage = await this.http.request<ApiKeyUsage>({
      method: "GET",
      path: `/account/keys/${encodeURIComponent(id)}/usage`,
    });

    return usage;
  }

  /**
   * Create a new API key
   *
   * Creates a test key unless `type` is `'live'`. A live key needs a
   * verified business and a credit balance.
   *
   * `apiKey.expiresAt` in the result is the expiry the key was created
   * with, or `null` if it has none, so check it if you rely on `expiresAt`.
   * When the response does not list the key's scopes, `apiKey.permissions`
   * is the `scopes` you passed, or undefined if you passed none.
   *
   * @param name - Display name for the API key
   * @param options - `type` (`'test'` or `'live'`, default `'test'`),
   *   `scopes` to grant the key, and `expiresAt` (ISO 8601)
   * @returns The created API key with the full key value (only shown once)
   *
   * @example
   * ```typescript
   * const { apiKey, key } = await sendly.account.createApiKey('Production', {
   *   type: 'live',
   * });
   * console.log(`Created key: ${key}`); // Full key - save this!
   * console.log(`Key ID: ${apiKey.id}`);
   * ```
   *
   * @throws {SendlyError} `verification_required` (403) or `credits_required` (402) for a live key
   */
  async createApiKey(
    name: string,
    options?: {
      expiresAt?: string;
      type?: "test" | "live";
      scopes?: string[];
    },
  ): Promise<{ apiKey: ApiKey; key: string }> {
    if (!name) {
      throw new Error("API key name is required");
    }

    const response = await this.http.request<
      RawApiKey & { key: string; apiKey?: RawApiKey }
    >({
      method: "POST",
      path: "/account/keys",
      body: {
        name,
        type: options?.type ?? "test",
        ...(options?.scopes && { scopes: options.scopes }),
        ...(options?.expiresAt && { expiresAt: options.expiresAt }),
      },
    });

    const apiKey =
      response.apiKey ??
      ({
        id: response.id,
        name: response.name,
        type: response.type,
        keyPrefix: response.keyPrefix,
        createdAt: response.createdAt,
        expiresAt: response.expiresAt ?? null,
        ...(options?.scopes && { scopes: options.scopes }),
      } as RawApiKey);

    return { ...response, apiKey: toApiKey(apiKey), key: response.key };
  }

  /**
   * Revoke an API key
   *
   * @param id - API key ID to revoke
   *
   * @example
   * ```typescript
   * await sendly.account.revokeApiKey('key_xxx');
   * console.log('API key revoked');
   * ```
   */
  async revokeApiKey(id: string): Promise<void> {
    if (!id) {
      throw new Error("API key ID is required");
    }

    await this.http.request<void>({
      method: "PATCH",
      path: `/account/keys/${encodeURIComponent(id)}/revoke`,
    });
  }

  /**
   * Rename an API key
   *
   * @param id - API key ID
   * @param name - New name for the API key
   * @returns Updated API key
   *
   * @example
   * ```typescript
   * const key = await sendly.account.renameApiKey('key_xxx', 'Production Key');
   * console.log(`Renamed to: ${key.name}`);
   * ```
   */
  async renameApiKey(id: string, name: string): Promise<ApiKey> {
    if (!id) {
      throw new Error("API key ID is required");
    }
    if (!name) {
      throw new Error("New name is required");
    }

    const key = await this.http.request<RawApiKey>({
      method: "PATCH",
      path: `/account/keys/${encodeURIComponent(id)}/rename`,
      body: { name },
    });

    return toApiKey(key);
  }

  /**
   * Rotate an API key
   *
   * Issues a new key and keeps the old one working for a grace period so you
   * can roll callers over without downtime. The new secret's raw value is on
   * `newKey.key` and is shown only once — store it now.
   *
   * @param id - API key ID to rotate
   * @param options - Rotation options. `gracePeriodHours` must be 24-168
   *   inclusive (default 24) — the window the old key keeps working.
   * @returns The new key (with its one-time raw `key`), the old key, and a message
   *
   * @example
   * ```typescript
   * // Rotate with the default 24-hour grace period
   * const { newKey, oldKey, message } = await sendly.account.rotateApiKey('key_xxx');
   * console.log(`New key: ${newKey.key}`); // Save this — shown once!
   * console.log(message);                  // "Old key will expire in 24 hours"
   *
   * // Rotate with a 72-hour grace period (both keys work for 72h)
   * await sendly.account.rotateApiKey('key_xxx', { gracePeriodHours: 72 });
   * ```
   *
   * @throws {ValidationError} If `gracePeriodHours` is outside 24-168, or the
   *   key is inactive / revoked / already rotating
   * @throws {NotFoundError} If the key doesn't exist
   */
  async rotateApiKey(
    id: string,
    options?: { gracePeriodHours?: number },
  ): Promise<RotateApiKeyResponse> {
    if (!id) {
      throw new Error("API key ID is required");
    }

    const response = await this.http.request<{
      newKey: RawApiKey;
      oldKey: RawApiKey;
      message: string;
    }>({
      method: "POST",
      path: `/account/keys/${encodeURIComponent(id)}/rotate`,
      body: options?.gracePeriodHours
        ? { gracePeriodHours: options.gracePeriodHours }
        : {},
    });

    return {
      ...response,
      newKey: toApiKey(response.newKey),
      oldKey: toApiKey(response.oldKey),
    } as RotateApiKeyResponse;
  }
}
