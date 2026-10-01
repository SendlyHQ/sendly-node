/**
 * Tests for the Campaigns resource against the bodies the API sends
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Sendly } from "../src/client";
import { ValidationError } from "../src/errors";
import type {
  Campaign,
  CampaignPreview,
  CampaignSendResult,
  CampaignStatus,
} from "../src/types";
import { mockFetchResponse } from "./fixtures/responses";

const row = {
  id: "camp_1",
  userId: "user_1",
  organizationId: "org_1",
  name: "Fall promo",
  status: "completed",
  messageText: "Hi {{name}}, 20% off this week",
  fromSender: null,
  targetType: "contact_list",
  targetListId: "lst_1",
  manualRecipients: null,
  excludeOptedOut: true,
  sendNow: false,
  scheduledAt: "2026-09-20T15:00:00.000Z",
  timezone: "America/New_York",
  batchId: "batch_1",
  totalRecipients: 5,
  estimatedCredits: 10,
  sentCount: 5,
  deliveredCount: 4,
  failedCount: 1,
  creditsUsed: 10,
  creditsRefunded: 0,
  createdAt: "2026-09-19T10:00:00.000Z",
  updatedAt: "2026-09-20T15:01:00.000Z",
  sentAt: "2026-09-20T15:00:02.000Z",
  completedAt: "2026-09-20T15:01:00.000Z",
  targetList: { id: "lst_1", name: "VIPs", contactCount: 5 },
};

const rowWithTwins = {
  ...row,
  text: row.messageText,
  contact_list_ids: ["lst_1"],
  created_at: row.createdAt,
  updated_at: row.updatedAt,
};

const draft = {
  ...row,
  status: "draft",
  scheduledAt: null,
  batchId: null,
  totalRecipients: 0,
  estimatedCredits: 0,
  sentCount: 0,
  deliveredCount: 0,
  failedCount: 0,
  creditsUsed: 0,
  sentAt: null,
  completedAt: null,
  targetList: undefined,
};

const updatableFields = [
  "name",
  "messageText",
  "status",
  "targetType",
  "targetListId",
  "manualRecipients",
  "excludeOptedOut",
  "sendNow",
  "scheduledAt",
  "timezone",
  "fromSender",
];

function createCampaignService(_url: string, init: RequestInit): Response {
  const data = JSON.parse(init.body as string);
  if (typeof data.messageText !== "string") {
    return mockFetchResponse(
      {
        error: "create_failed",
        message:
          'Failed to create campaign: null value in column "message_text" of relation "campaigns" violates not-null constraint',
      },
      500,
    );
  }
  return mockFetchResponse(
    {
      ...draft,
      name: data.name,
      messageText: data.messageText,
      targetListId: data.targetListId || null,
    },
    201,
  );
}

function updateCampaignService(_url: string, init: RequestInit): Response {
  const updates = JSON.parse(init.body as string);
  const updated: Record<string, unknown> = { ...draft };
  for (const field of updatableFields) {
    if (updates[field] !== undefined) updated[field] = updates[field];
  }
  if (updates.targetListId !== undefined) {
    updated.targetListId = updates.targetListId || null;
  }
  return mockFetchResponse(updated);
}

function sentBody(fetchMock: ReturnType<typeof vi.fn>, index = 0): unknown {
  return JSON.parse(fetchMock.mock.calls[index][1].body);
}

function expectDecoded(campaign: Campaign) {
  expect(campaign.id).toBe("camp_1");
  expect(campaign.name).toBe("Fall promo");
  expect(campaign.text).toBe("Hi {{name}}, 20% off this week");
  expect(campaign.contactListIds).toEqual(["lst_1"]);
  expect(campaign.status).toBe("completed");
  expect(campaign.recipientCount).toBe(5);
  expect(campaign.sentCount).toBe(5);
  expect(campaign.deliveredCount).toBe(4);
  expect(campaign.failedCount).toBe(1);
  expect(campaign.estimatedCredits).toBe(10);
  expect(campaign.creditsUsed).toBe(10);
  expect(campaign.scheduledAt).toBe("2026-09-20T15:00:00.000Z");
  expect(campaign.timezone).toBe("America/New_York");
  expect(campaign.startedAt).toBe("2026-09-20T15:00:02.000Z");
  expect(campaign.completedAt).toBe("2026-09-20T15:01:00.000Z");
  expect(campaign.createdAt).toBe("2026-09-19T10:00:00.000Z");
  expect(campaign.updatedAt).toBe("2026-09-20T15:01:00.000Z");
}

describe("Campaigns resource", () => {
  let client: Sendly;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    client = new Sendly({ apiKey: "sk_test_v1_valid_key", maxRetries: 0 });
    fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("decoding a campaign", () => {
    it("get() reads the camelCase row", async () => {
      fetchMock.mockResolvedValue(mockFetchResponse(row));

      expectDecoded(await client.campaigns.get("camp_1"));
    });

    it("get() reads the row with its snake_case twins", async () => {
      fetchMock.mockResolvedValue(mockFetchResponse(rowWithTwins));

      expectDecoded(await client.campaigns.get("camp_1"));
    });

    it("list() decodes every campaign", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse({
          campaigns: [row, { ...rowWithTwins, id: "camp_2" }],
          total: 2,
          limit: 50,
          offset: 0,
        }),
      );

      const result = await client.campaigns.list();

      expect(result.total).toBe(2);
      expectDecoded(result.campaigns[0]);
      expect(result.campaigns[1].id).toBe("camp_2");
      expect(result.campaigns[1].deliveredCount).toBe(4);
    });

    it("keeps a draft's empty schedule and counts", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse({
          ...row,
          status: "draft",
          scheduledAt: null,
          batchId: null,
          totalRecipients: 0,
          estimatedCredits: 0,
          sentCount: 0,
          deliveredCount: 0,
          failedCount: 0,
          creditsUsed: 0,
          sentAt: null,
          completedAt: null,
          targetListId: null,
          targetList: undefined,
        }),
      );

      const campaign = await client.campaigns.get("camp_1");

      expect(campaign.status).toBe("draft");
      expect(campaign.scheduledAt).toBeNull();
      expect(campaign.startedAt).toBeNull();
      expect(campaign.completedAt).toBeNull();
      expect(campaign.contactListIds).toEqual([]);
      expect(campaign.sentCount).toBe(0);
    });

    it("types the statuses the API uses", () => {
      const statuses: CampaignStatus[] = [
        "draft",
        "scheduled",
        "sending",
        "completed",
        "cancelled",
        "failed",
      ];
      expect(statuses).toContain("completed");
    });
  });

  describe("create()", () => {
    it("sends messageText and targetListId, the keys the campaign service reads", async () => {
      fetchMock.mockImplementation(async (url: string, init: RequestInit) =>
        createCampaignService(url, init),
      );

      const campaign = await client.campaigns.create({
        name: "Fall promo",
        text: "Hi {{name}}, 20% off this week",
        contactListIds: ["lst_1"],
      });

      expect(campaign.status).toBe("draft");
      expect(campaign.text).toBe("Hi {{name}}, 20% off this week");
      expect(campaign.contactListIds).toEqual(["lst_1"]);
      expect(sentBody(fetchMock)).toEqual({
        name: "Fall promo",
        text: "Hi {{name}}, 20% off this week",
        messageText: "Hi {{name}}, 20% off this week",
        contactListIds: ["lst_1"],
        targetListId: "lst_1",
      });
    });

    it("rejects more than one contact list without calling the API", async () => {
      await expect(
        client.campaigns.create({
          name: "Fall promo",
          text: "Hi",
          contactListIds: ["lst_1", "lst_2"],
        }),
      ).rejects.toThrow(ValidationError);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("update()", () => {
    it("sends messageText and targetListId, so the new text and list are saved", async () => {
      fetchMock.mockImplementation(async (url: string, init: RequestInit) =>
        updateCampaignService(url, init),
      );

      const campaign = await client.campaigns.update("camp_1", {
        text: "New copy for {{name}}",
        contactListIds: ["lst_2"],
      });

      expect(campaign.text).toBe("New copy for {{name}}");
      expect(campaign.contactListIds).toEqual(["lst_2"]);
      expect(sentBody(fetchMock)).toEqual({
        text: "New copy for {{name}}",
        messageText: "New copy for {{name}}",
        contact_list_ids: ["lst_2"],
        targetListId: "lst_2",
      });
    });

    it("clears the contact list when given an empty array", async () => {
      fetchMock.mockImplementation(async (url: string, init: RequestInit) =>
        updateCampaignService(url, init),
      );

      const campaign = await client.campaigns.update("camp_1", {
        contactListIds: [],
      });

      expect(campaign.contactListIds).toEqual([]);
      expect(sentBody(fetchMock)).toEqual({
        contact_list_ids: [],
        targetListId: null,
      });
    });

    it("rejects more than one contact list without calling the API", async () => {
      await expect(
        client.campaigns.update("camp_1", { contactListIds: ["lst_1", "lst_2"] }),
      ).rejects.toThrow(ValidationError);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("send()", () => {
    it("returns the batch the campaign was sent in", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse({
          batchId: "batch_9",
          status: "completed",
          total: 3,
          sent: 3,
          failed: 0,
          retrying: 0,
          optedOutSkipped: 1,
          invalidSkipped: 0,
          creditsUsed: 6,
          creditsRefunded: 0,
          messages: [
            { index: 0, id: "msg_1", to: "+15551230001", status: "sent" },
            { index: 1, id: "msg_2", to: "+15551230002", status: "sent" },
            { index: 2, id: "msg_3", to: "+15551230003", status: "sent" },
          ],
        }),
      );

      const result: CampaignSendResult = await client.campaigns.send("camp_1");

      expect(result.id).toBe("camp_1");
      expect(result.batchId).toBe("batch_9");
      expect(result.status).toBe("completed");
      expect(result.recipientCount).toBe(3);
      expect(result.sentCount).toBe(3);
      expect(result.failedCount).toBe(0);
      expect(result.creditsUsed).toBe(6);
      expect(result.optedOutSkipped).toBe(1);
      expect(result.messages).toHaveLength(3);
      expect(fetchMock.mock.calls[0][0]).toContain("/v1/campaigns/camp_1/send");
    });
  });

  describe("preview()", () => {
    it("reads the camelCase preview", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse({
          totalRecipients: 3,
          estimatedCredits: 14,
          optedOutCount: 1,
          invalidCount: 0,
          invalidNumberCount: 0,
          landlineCount: 0,
          sampleRecipients: [{ phone: "+15551230001", name: "Ada" }],
          blockedCount: 0,
          sendableCount: 3,
          byCountry: {
            US: { count: 2, credits: 4, allowed: true },
            GB: { count: 1, credits: 10, allowed: true },
          },
          warnings: [],
          messagingProfile: {
            canSendDomestic: true,
            canSendInternational: true,
            verificationType: "toll_free",
            verificationStatus: "verified",
          },
          recipientCount: 3,
          currentBalance: 500,
          hasEnoughCredits: true,
        }),
      );

      const preview: CampaignPreview = await client.campaigns.preview("camp_1");

      expect(preview.id).toBe("camp_1");
      expect(preview.recipientCount).toBe(3);
      expect(preview.estimatedCredits).toBe(14);
      expect(preview.currentBalance).toBe(500);
      expect(preview.hasEnoughCredits).toBe(true);
      expect(preview.sendableCount).toBe(3);
      expect(preview.optedOutCount).toBe(1);
      expect(preview.sampleRecipients).toEqual([{ phone: "+15551230001", name: "Ada" }]);
      expect(preview.byCountry?.GB.credits).toBe(10);
      expect(preview.breakdown).toEqual([
        { country: "US", count: 2, creditsPerMessage: 2, totalCredits: 4 },
        { country: "GB", count: 1, creditsPerMessage: 10, totalCredits: 10 },
      ]);
    });
  });
});
