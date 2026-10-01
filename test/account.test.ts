/**
 * Tests for the Account resource against the bodies the API sends
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Sendly } from "../src/client";
import type { Account, ApiKey, CreditTransaction } from "../src/types";
import { mockFetchResponse } from "./fixtures/responses";

function sentBody(fetchMock: ReturnType<typeof vi.fn>, index = 0): unknown {
  return JSON.parse(fetchMock.mock.calls[index][1].body);
}

describe("Account resource", () => {
  let client: Sendly;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    client = new Sendly({ apiKey: "sk_live_v1_valid_key", maxRetries: 0 });
    fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("get()", () => {
    const wire = {
      user: {
        id: "user_1",
        email: "ops@acme.example",
        createdAt: "2026-01-02T03:04:05.000Z",
      },
      organization: { id: "org_1", name: "Acme", isPersonal: false },
      credits: { balance: "0", reservedBalance: 12 },
      verification: {
        status: "verified",
        type: "toll_free",
        region: "us",
        submittedAt: "2026-02-01T00:00:00.000Z",
        updatedAt: "2026-02-03T00:00:00.000Z",
      },
      apiKey: {
        id: "key_1",
        name: "Production",
        type: "live",
        scopes: ["sms:send", "sms:read"],
        createdAt: "2026-01-05T00:00:00.000Z",
        lastUsedAt: null,
      },
      limits: { messagesPerMinute: 60, messagesPerDay: 10000 },
    };

    it("reads the user fields the API nests under user", async () => {
      fetchMock.mockResolvedValue(mockFetchResponse(wire));

      const account: Account = await client.account.get();

      expect(account.id).toBe("user_1");
      expect(account.email).toBe("ops@acme.example");
      expect(account.createdAt).toBe("2026-01-02T03:04:05.000Z");
      expect(account.organization?.id).toBe("org_1");
      expect(account.credits).toEqual({ balance: 0, reservedBalance: 12 });
      expect(account.verification?.status).toBe("verified");
      expect(account.apiKey?.scopes).toEqual(["sms:send", "sms:read"]);
      expect(account.limits?.messagesPerDay).toBe(10000);
    });

    it("still maps a flat body", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse({
          id: "user_2",
          email: "flat@acme.example",
          createdAt: "2025-05-05T00:00:00.000Z",
        }),
      );

      const account = await client.account.get();

      expect(account.id).toBe("user_2");
      expect(account.email).toBe("flat@acme.example");
      expect(account.createdAt).toBe("2025-05-05T00:00:00.000Z");
    });
  });

  describe("getCreditTransactions()", () => {
    const wire = {
      transactions: [
        {
          id: "txn_1",
          amount: -2,
          balance_after: 498,
          type: "usage",
          description: "SMS to +15551234567",
          created_at: "2026-09-24T10:00:00.000Z",
        },
        {
          id: "txn_2",
          amount: 500,
          balance_after: 500,
          type: "transfer",
          description: "Transfer from Acme",
          created_at: "2026-09-23T10:00:00.000Z",
        },
      ],
    };

    it("unwraps the transactions envelope and camelCases each item", async () => {
      fetchMock.mockResolvedValue(mockFetchResponse(wire));

      const result: CreditTransaction[] =
        await client.account.getCreditTransactions({ limit: 2, offset: 4 });

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: "txn_1",
        type: "usage",
        amount: -2,
        balanceAfter: 498,
        description: "SMS to +15551234567",
        createdAt: "2026-09-24T10:00:00.000Z",
      });
      const types: string[] = [];
      for (const tx of result) types.push(tx.type);
      expect(types).toEqual(["usage", "transfer"]);

      const url = new URL(fetchMock.mock.calls[0][0]);
      expect(url.pathname).toBe("/api/v1/credits/transactions");
      expect(url.searchParams.get("limit")).toBe("2");
      expect(url.searchParams.get("offset")).toBe("4");
    });

    it("filters by type", async () => {
      fetchMock.mockResolvedValue(mockFetchResponse({ transactions: [] }));

      const result = await client.account.getCreditTransactions({ type: "refund" });

      expect(result).toEqual([]);
      const url = new URL(fetchMock.mock.calls[0][0]);
      expect(url.searchParams.get("type")).toBe("refund");
    });

    it("types every transaction kind the ledger records", () => {
      const kinds: CreditTransaction["type"][] = [
        "purchase",
        "usage",
        "refund",
        "bonus",
        "transfer",
        "admin_grant",
        "admin_seed",
        "a_future_kind",
      ];
      expect(kinds).toHaveLength(8);
    });
  });

  describe("createApiKey()", () => {
    const flatBody = {
      id: "key_new",
      name: "Prod",
      key: "sk_live_v1_abcdefghijklmnop",
      keyPrefix: "sk_live_v1_a",
      type: "live",
      createdAt: "2026-09-25T09:00:00.000Z",
    };

    it("sends the type the caller asks for", async () => {
      fetchMock.mockResolvedValue(mockFetchResponse(flatBody));

      await client.account.createApiKey("Prod", { type: "live" });

      expect(sentBody(fetchMock)).toEqual({ name: "Prod", type: "live" });
    });

    it("always sends a type, test by default", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse({ ...flatBody, type: "test", key: "sk_test_v1_x" }),
      );

      await client.account.createApiKey("CI");

      expect(sentBody(fetchMock)).toEqual({ name: "CI", type: "test" });
    });

    it("sends scopes and expiresAt when given", async () => {
      fetchMock.mockResolvedValue(mockFetchResponse(flatBody));

      await client.account.createApiKey("CI", {
        scopes: ["sms:send"],
        expiresAt: "2027-01-01T00:00:00.000Z",
      });

      expect(sentBody(fetchMock)).toEqual({
        name: "CI",
        type: "test",
        scopes: ["sms:send"],
        expiresAt: "2027-01-01T00:00:00.000Z",
      });
    });

    it("builds apiKey from the flat body servers without apiKey send", async () => {
      fetchMock.mockResolvedValue(mockFetchResponse(flatBody));

      const result = await client.account.createApiKey("Prod", { type: "live" });

      expect(result.key).toBe("sk_live_v1_abcdefghijklmnop");
      expect(result.apiKey.id).toBe("key_new");
      expect(result.apiKey.name).toBe("Prod");
      expect(result.apiKey.type).toBe("live");
      expect(result.apiKey.prefix).toBe("sk_live_v1_a...");
      expect(result.apiKey.createdAt).toBe("2026-09-25T09:00:00.000Z");
      expect(result.apiKey.isRevoked).toBe(false);
      expect(result.apiKey.expiresAt).toBeNull();
      expect(result.apiKey.permissions).toBeUndefined();
    });

    it("fills permissions from the scopes it sent, and shows a flat body applied no expiry", async () => {
      fetchMock.mockResolvedValue(mockFetchResponse(flatBody));

      const result = await client.account.createApiKey("CI", {
        scopes: ["sms:send"],
        expiresAt: "2027-01-01T00:00:00.000Z",
      });

      expect(result.apiKey.permissions).toEqual(["sms:send"]);
      expect(result.apiKey.expiresAt).toBeNull();
    });

    it("uses the apiKey object when the server sends one", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse({
          ...flatBody,
          expiresAt: null,
          apiKey: {
            id: "key_new",
            name: "Prod",
            type: "live",
            prefix: "sk_live_v1_a...",
            scopes: ["sms:send", "sms:read"],
            permissions: ["sms:send", "sms:read"],
            isActive: true,
            isRevoked: false,
            createdAt: "2026-09-25T09:00:00.000Z",
            lastUsedAt: null,
            expiresAt: null,
          },
        }),
      );

      const result = await client.account.createApiKey("Prod", { type: "live" });

      expect(result.key).toBe("sk_live_v1_abcdefghijklmnop");
      expect(result.apiKey.permissions).toEqual(["sms:send", "sms:read"]);
      expect(result.apiKey.prefix).toBe("sk_live_v1_a...");
    });
  });

  describe("API key payloads", () => {
    it("getApiKey fills permissions and isRevoked from scopes and isActive", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse({
          id: "key_1",
          name: "Old",
          type: "live",
          prefix: "sk_live_v1_q...",
          scopes: ["sms:send"],
          isActive: false,
          createdAt: "2026-01-01T00:00:00.000Z",
          lastUsedAt: null,
          expiresAt: null,
          revokedAt: "2026-03-01T00:00:00.000Z",
        }),
      );

      const key: ApiKey = await client.account.getApiKey("key_1");

      expect(key.permissions).toEqual(["sms:send"]);
      expect(key.isRevoked).toBe(true);
      expect(key.prefix).toBe("sk_live_v1_q...");
    });

    it("rotateApiKey fills prefix, permissions and isRevoked on both keys", async () => {
      const row = {
        userId: "user_1",
        organizationId: "org_1",
        type: "live",
        scopes: ["sms:send", "sms:read"],
        source: "manual",
        lastUsedAt: null,
        revokedAt: null,
        revokedReason: null,
        gracePeriodHours: 24,
        isEnterpriseMaster: false,
        createdAt: "2026-09-25T09:00:00.000Z",
      };
      fetchMock.mockResolvedValue(
        mockFetchResponse({
          newKey: {
            ...row,
            id: "key_2",
            name: "Prod (rotated)",
            keyId: "key_2pub",
            keyPrefix: "sk_live_v1_n",
            isActive: true,
            expiresAt: null,
            rotatedFromId: "key_1",
            key: "sk_live_v1_newsecret",
            warning: "This key will only be shown once. Store it securely.",
          },
          oldKey: {
            ...row,
            id: "key_1",
            name: "Prod",
            keyId: "key_1pub",
            keyPrefix: "sk_live_v1_o",
            isActive: true,
            expiresAt: "2026-09-26T09:00:00.000Z",
            rotatedFromId: null,
          },
          message: "Old key will expire in 24 hours",
        }),
      );

      const { newKey, oldKey, message } = await client.account.rotateApiKey("key_1");

      expect(newKey.key).toBe("sk_live_v1_newsecret");
      expect(newKey.prefix).toBe("sk_live_v1_n...");
      expect(newKey.permissions).toEqual(["sms:send", "sms:read"]);
      expect(newKey.isRevoked).toBe(false);
      expect(oldKey.prefix).toBe("sk_live_v1_o...");
      expect(oldKey.expiresAt).toBe("2026-09-26T09:00:00.000Z");
      expect(oldKey.isRevoked).toBe(false);
      expect(message).toBe("Old key will expire in 24 hours");
    });

    it("listApiKeys keeps the fields the list already sends", async () => {
      const listed = {
        id: "key_1",
        name: "Prod",
        type: "live",
        prefix: "sk_live_v1_a...",
        scopes: ["sms:send"],
        permissions: ["sms:send"],
        isActive: true,
        isRevoked: false,
        createdAt: "2026-01-01T00:00:00.000Z",
        lastUsedAt: null,
        expiresAt: null,
      };
      fetchMock.mockResolvedValue(mockFetchResponse({ keys: [listed] }));

      const keys = await client.account.listApiKeys();

      expect(keys).toEqual([listed]);
    });
  });
});
