/**
 * Tests for the Enterprise resource against the bodies the API sends
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Sendly } from "../src/client";
import type {
  CreditAnalytics,
  CreatedApiKey,
  EnterpriseWebhook,
  EnterpriseWebhookSecretRotation,
  InheritVerificationResult,
  ProvisionWorkspaceOptions,
  ProvisionWorkspaceResult,
} from "../src/types";
import { mockFetchResponse } from "./fixtures/responses";

function sentBody(fetchMock: ReturnType<typeof vi.fn>, index = 0): unknown {
  return JSON.parse(fetchMock.mock.calls[index][1].body);
}

describe("Enterprise resource", () => {
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

  describe("workspaces.inheritVerification()", () => {
    const inherited = {
      verificationId: "bv_2",
      status: "pending",
      type: "toll_free",
      tollFreeNumber: null,
      inheritedFrom: "org_src",
      newNumber: true,
    };

    it("sends purchaseNewNumber with the source workspace", async () => {
      fetchMock.mockResolvedValue(mockFetchResponse(inherited, 201));

      const result: InheritVerificationResult =
        await client.enterprise.workspaces.inheritVerification("org_ws", {
          sourceWorkspaceId: "org_src",
          purchaseNewNumber: true,
        });

      expect(sentBody(fetchMock)).toEqual({
        sourceWorkspaceId: "org_src",
        purchaseNewNumber: true,
      });
      expect(fetchMock.mock.calls[0][0]).toContain(
        "/v1/enterprise/workspaces/org_ws/verification/inherit",
      );
      expect(result.verificationId).toBe("bv_2");
      expect(result.newNumber).toBe(true);
    });

    it("omits purchaseNewNumber by default", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse({ ...inherited, newNumber: undefined }, 201),
      );

      await client.enterprise.workspaces.inheritVerification("org_ws", {
        sourceWorkspaceId: "org_src",
      });

      expect(sentBody(fetchMock)).toEqual({ sourceWorkspaceId: "org_src" });
    });
  });

  describe("workspaces.transferCredits()", () => {
    it("sends the source as sourceWorkspaceId, the key the API reads", async () => {
      fetchMock.mockImplementation(async (_url: string, init: RequestInit) => {
        const { sourceWorkspaceId, amount } = JSON.parse(init.body as string);
        if (!sourceWorkspaceId || typeof sourceWorkspaceId !== "string") {
          return mockFetchResponse({ error: "sourceWorkspaceId is required" }, 400);
        }
        return mockFetchResponse({
          success: true,
          amount,
          sourceBalance: 400,
          targetBalance: 100,
        });
      });

      const result = await client.enterprise.workspaces.transferCredits("org_target", {
        sourceWorkspaceId: "org_source",
        amount: 100,
      });

      expect(sentBody(fetchMock)).toEqual({
        sourceWorkspaceId: "org_source",
        amount: 100,
      });
      expect(fetchMock.mock.calls[0][0]).toContain(
        "/v1/enterprise/workspaces/org_target/transfer-credits",
      );
      expect(result.success).toBe(true);
      expect(result.sourceBalance).toBe(400);
      expect(result.targetBalance).toBe(100);
    });
  });

  describe("analytics.credits()", () => {
    it("returns the credit totals", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse({
          period: "30d",
          totalBalance: 500,
          totalLifetime: 1200,
          totalUsed: 700,
          workspaceCount: 3,
        }),
      );

      const credits: CreditAnalytics = await client.enterprise.analytics.credits({
        period: "30d",
      });

      expect(credits.totalBalance).toBe(500);
      expect(credits.totalLifetime).toBe(1200);
      expect(credits.totalUsed).toBe((credits.totalLifetime ?? 0) - (credits.totalBalance ?? 0));
      expect(credits.workspaceCount).toBe(3);
      expect(credits.data).toEqual([]);
    });
  });

  describe("webhooks", () => {
    it("set() returns the signing secret on first registration", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse({
          url: "https://hooks.example.com/sendly",
          events: null,
          workspaces: null,
          signingSecret: "3f2a9c",
        }),
      );

      const webhook: EnterpriseWebhook = await client.enterprise.webhooks.set({
        url: "https://hooks.example.com/sendly",
      });

      expect(webhook.signingSecret).toBe("3f2a9c");
      expect(webhook.events).toBeNull();
    });

    it("set() sends the events and workspaces filters", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse({
          url: "https://hooks.example.com/sendly",
          events: ["message.delivered"],
          workspaces: ["org_1"],
        }),
      );

      const webhook = await client.enterprise.webhooks.set({
        url: "https://hooks.example.com/sendly",
        events: ["message.delivered"],
        workspaces: ["org_1"],
      });

      expect(sentBody(fetchMock)).toEqual({
        url: "https://hooks.example.com/sendly",
        events: ["message.delivered"],
        workspaces: ["org_1"],
      });
      expect(webhook.events).toEqual(["message.delivered"]);
      expect(webhook.workspaces).toEqual(["org_1"]);
      expect(webhook.signingSecret).toBeUndefined();
    });

    it("rotateSecret() returns the new secret and when it was rotated", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse({
          success: true,
          secret: "9b1d7e",
          rotated_at: "2026-09-25T10:00:00.000Z",
          message:
            "Webhook signing secret rotated. Save this secret - it won't be shown again.",
        }),
      );

      const rotation: EnterpriseWebhookSecretRotation =
        await client.enterprise.webhooks.rotateSecret();

      expect(rotation.success).toBe(true);
      expect(rotation.secret).toBe("9b1d7e");
      expect(rotation.rotatedAt).toBe("2026-09-25T10:00:00.000Z");
    });
  });

  describe("provision()", () => {
    const result = {
      workspace: { id: "org_new", name: "Acme East", slug: "acme-east" },
      verification: {
        id: "bv_9",
        status: "pending",
        tollFreeNumber: null,
        inherited: false,
      },
      optInPage: { id: "oip_1", slug: "acme-7f3a", url: "https://sendly.live/opt-in/acme-7f3a" },
      legalPages: {
        privacyUrl: "https://sendly.live/legal/acme-7f3a-privacy",
        termsUrl: "https://sendly.live/legal/acme-7f3a-terms",
        privacyPageId: "lp_1",
        termsPageId: "lp_2",
      },
      businessPage: { id: "bp_1", slug: "acme-9k2b", url: "https://sendly.live/biz/acme-9k2b" },
      key: {
        id: "key_1",
        name: "Primary",
        key: "sk_test_v1_abc",
        keyPrefix: "sk_test_v1_a",
        type: "test",
      },
      webhook: { url: "https://hooks.example.com/acme" },
      credits: { error: "Insufficient credits" },
      apiBaseUrl: "https://sendly.live",
      dashboardUrl: "https://sendly.live/enterprise/workspaces/org_new",
    };

    it("provisions a workspace with a generated business page and no website", async () => {
      fetchMock.mockResolvedValue(mockFetchResponse(result, 201));

      const options: ProvisionWorkspaceOptions = {
        name: "Acme East",
        generateBusinessPage: true,
        keyName: "Primary",
        webhookUrl: "https://hooks.example.com/acme",
        verification: {
          businessName: "Acme East LLC",
          doingBusinessAs: "Acme",
          entityType: "PRIVATE_PROFIT",
          address: { street: "1 Main St", city: "Austin", state: "TX", zip: "78701" },
          contact: {
            firstName: "Ada",
            lastName: "Lovelace",
            email: "ada@acme.example",
            phone: "+15125550100",
          },
          brn: "12-3456789",
          brnType: "EIN",
          useCase: "Order Notifications",
          useCaseSummary: "Order and delivery updates for customers who opt in at checkout.",
          sampleMessages: "Acme: your order #123 has shipped. Reply STOP to opt out.",
          additionalInformation: "Customers opt in at checkout.",
          ageGatedContent: false,
        },
      };
      const provisioned: ProvisionWorkspaceResult =
        await client.enterprise.provision(options);

      expect(provisioned.verification?.inherited).toBe(false);
      expect(provisioned.verification?.type).toBeUndefined();
      expect(provisioned.businessPage?.url).toBe("https://sendly.live/biz/acme-9k2b");
      expect(provisioned.optInPage?.id).toBe("oip_1");
      expect(provisioned.webhook?.url).toBe("https://hooks.example.com/acme");
      expect(provisioned.credits?.error).toBe("Insufficient credits");
      expect(provisioned.legalPages?.privacyPageId).toBe("lp_1");

      const body = sentBody(fetchMock) as Record<string, any>;
      expect(body.generateBusinessPage).toBe(true);
      expect(body.verification.entityType).toBe("PRIVATE_PROFIT");
      expect(body.verification.website).toBeUndefined();
    });

    it("forwards verificationOverrides when inheriting with a new number", async () => {
      fetchMock.mockResolvedValue(mockFetchResponse(result, 201));

      await client.enterprise.provision({
        name: "Acme West",
        sourceWorkspaceId: "org_src",
        inheritWithNewNumber: true,
        verificationOverrides: {
          businessName: "Acme West LLC",
          contact: { email: "west@acme.example" },
          address: { addr1: "9 Side St", city: "Denver", state: "CO", zip: "80202" },
        },
      });

      expect(sentBody(fetchMock)).toEqual({
        name: "Acme West",
        sourceWorkspaceId: "org_src",
        inheritWithNewNumber: true,
        verificationOverrides: {
          businessName: "Acme West LLC",
          contact: { email: "west@acme.example" },
          address: { addr1: "9 Side St", city: "Denver", state: "CO", zip: "80202" },
        },
      });
    });
  });

  describe("workspaces.createKey()", () => {
    const created = {
      id: "key_ws",
      name: "API key",
      key: "sk_test_v1_ws",
      keyPrefix: "sk_test_v1_w",
      type: "test",
      scopes: ["sms:send", "sms:read"],
      createdAt: "2026-09-25T10:00:00.000Z",
    };

    it("sends a name when none is given, because the API requires one", async () => {
      fetchMock.mockResolvedValue(mockFetchResponse(created, 201));

      const key: CreatedApiKey = await client.enterprise.workspaces.createKey("org_ws");

      const body = sentBody(fetchMock) as { name?: unknown };
      expect(typeof body.name).toBe("string");
      expect((body.name as string).length).toBeGreaterThan(0);
      expect(key.type).toBe("test");
      expect(key.scopes).toEqual(["sms:send", "sms:read"]);
    });

    it("sends the name, type and scopes it is given", async () => {
      fetchMock.mockResolvedValue(mockFetchResponse(created, 201));

      await client.enterprise.workspaces.createKey("org_ws", {
        name: "Ops",
        type: "live",
        scopes: ["sms:send"],
      });

      expect(sentBody(fetchMock)).toEqual({
        name: "Ops",
        type: "live",
        scopes: ["sms:send"],
      });
    });
  });
  describe("workspaces.provisionBulk", () => {
    it("sends up to 100 workspaces, the API's limit", async () => {
      fetchMock.mockResolvedValueOnce(
        mockFetchResponse({ results: [], summary: { total: 100, succeeded: 100, failed: 0 } }),
      );
      const workspaces = Array.from({ length: 100 }, (_, i) => ({ name: `Shop ${i}` }));

      await client.enterprise.workspaces.provisionBulk(workspaces);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect((sentBody(fetchMock) as { workspaces: unknown[] }).workspaces).toHaveLength(100);
    });

    it("refuses more than 100 workspaces before sending anything", async () => {
      const workspaces = Array.from({ length: 101 }, (_, i) => ({ name: `Shop ${i}` }));

      await expect(
        client.enterprise.workspaces.provisionBulk(workspaces),
      ).rejects.toThrow("Maximum 100 workspaces per bulk provision");
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
