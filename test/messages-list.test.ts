/**
 * Tests for message fields, list pagination and listAll against the API
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Sendly } from "../src/client";
import type { Message, MessageListResponse } from "../src/types";
import { mockFetchResponse } from "./fixtures/responses";

function listed(id: string) {
  return {
    id,
    to: "+15551234567",
    from: "+18005550100",
    text: "Hi",
    status: "failed",
    error: "Carrier rejected the message",
    errorCode: "carrier_rejected",
    retryCount: 0,
    segments: 1,
    creditsUsed: 0,
    isSandbox: false,
    createdAt: "2026-09-24T10:00:00.000Z",
    deliveredAt: null,
    message_format: "sms",
  };
}

const mediaUrl = "https://cdn.example.com/media/1.png";

function mmsRead(id: string) {
  return {
    ...listed(id),
    status: "delivered",
    error: null,
    errorCode: null,
    creditsUsed: 3,
    deliveredAt: "2026-09-24T10:00:05.000Z",
    message_format: "mms",
    batch_id: "batch_1",
    media_urls: [mediaUrl],
  };
}

function mmsReadWithCamelCase(id: string) {
  return {
    ...mmsRead(id),
    direction: "outbound",
    messageFormat: "mms",
    batchId: "batch_1",
    mediaUrls: [mediaUrl],
  };
}

function expectMmsFields(message: Message) {
  expect(message.messageFormat).toBe("mms");
  expect(message.batchId).toBe("batch_1");
  expect(message.mediaUrls).toEqual([mediaUrl]);
}

describe("Messages", () => {
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

  describe("message fields", () => {
    it("types the fields a simulated send returns", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse(
          {
            id: "msg_sim",
            to: "+447700900123",
            from: "SENDLY",
            text: "Hi",
            status: "delivered",
            metadata: {},
            simulated: true,
            simulatedReason:
              "This account isn't set up to send to this destination yet, so the message was simulated, not delivered to a handset.",
            actionUrl: "/verify",
          },
          201,
        ),
      );

      const message: Message = await client.messages.send({
        to: "+447700900123",
        text: "Hi",
      });

      expect(message.simulated).toBe(true);
      expect(message.simulatedReason).toMatch(/simulated/);
      expect(message.actionUrl).toBe("/verify");
    });

    it("reads the sender type a send returns", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse(
          {
            id: "msg_1",
            to: "+15551234567",
            from: "+18005550100",
            text: "Hi",
            status: "queued",
            error: null,
            segments: 1,
            creditsUsed: 2,
            senderType: "explicit",
            createdAt: "2026-09-24T10:00:00.000Z",
            metadata: {},
          },
          201,
        ),
      );

      const message = await client.messages.send({
        to: "+15551234567",
        text: "Hi",
        from: "+18005550100",
      });

      expect(message.senderType === "explicit").toBe(true);
      expect(message.messageFormat).toBeUndefined();
    });

    it("reads the format and media of an MMS send, which the API sends in snake_case", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse(
          {
            id: "msg_mms",
            to: "+15551234567",
            from: "+18005550100",
            text: "Hi",
            status: "queued",
            error: null,
            segments: 1,
            creditsUsed: 3,
            senderType: "explicit",
            createdAt: "2026-09-24T10:00:00.000Z",
            metadata: {},
            message_format: "mms",
            media_urls: [mediaUrl],
          },
          201,
        ),
      );

      const message = await client.messages.send({
        to: "+15551234567",
        text: "Hi",
        from: "+18005550100",
        mediaUrls: [mediaUrl],
      });

      expect(message.messageFormat).toBe("mms");
      expect(message.mediaUrls).toEqual([mediaUrl]);
      expect(message.batchId).toBeUndefined();
    });

    it("get() reads the format, batch and media whether the API sends them in snake_case or both cases", async () => {
      for (const body of [mmsRead("msg_mms"), mmsReadWithCamelCase("msg_mms")]) {
        fetchMock.mockResolvedValueOnce(mockFetchResponse(body));

        const message = await client.messages.get("msg_mms");

        expectMmsFields(message);
        expect((message as unknown as Record<string, unknown>).message_format).toBe("mms");
      }
    });

    it("list() and listAll() read the format, batch and media of every message", async () => {
      const page = {
        data: [listed("msg_1"), mmsRead("msg_2")],
        pagination: { total: 2, limit: 50, offset: 0, page: 1, totalPages: 1, hasMore: false },
        count: 2,
      };
      fetchMock
        .mockResolvedValueOnce(mockFetchResponse(page))
        .mockResolvedValueOnce(mockFetchResponse(page));

      const { data } = await client.messages.list();

      expect(data[0].messageFormat).toBe("sms");
      expect(data[0].batchId).toBeUndefined();
      expect(data[0].mediaUrls).toBeUndefined();
      expectMmsFields(data[1]);

      const all: Message[] = [];
      for await (const message of client.messages.listAll()) {
        all.push(message);
      }

      expect(all[0].messageFormat).toBe("sms");
      expectMmsFields(all[1]);
    });

    it("reads the AI summary on the messages of a conversation", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse({
          id: "conv_1",
          phoneNumber: "+15551234567",
          status: "active",
          unreadCount: 1,
          messageCount: 1,
          lastMessageText: "Where is my order?",
          lastMessageAt: "2026-09-24T10:00:00.000Z",
          lastMessageDirection: "inbound",
          metadata: {},
          tags: [],
          contactId: null,
          createdAt: "2026-09-24T10:00:00.000Z",
          updatedAt: "2026-09-24T10:00:00.000Z",
          isGroup: false,
          messages: {
            data: [
              {
                id: "msg_in",
                userId: "user_1",
                organizationId: "org_1",
                to: "+18005550100",
                from: "+15551234567",
                text: "Where is my order?",
                direction: "inbound",
                status: "received",
                error: null,
                errorCode: null,
                isSandbox: false,
                segments: 1,
                creditsUsed: 0,
                messageFormat: "sms",
                mediaUrls: [],
                batchId: null,
                conversationId: "conv_1",
                metadata: {},
                aiMetadata: {
                  intent: "support",
                  intentConfidence: 0.92,
                  sentiment: "neutral",
                  sentimentConfidence: 0.8,
                  summary: "Asks where their order is.",
                  classifiedAt: "2026-09-24T10:00:01.000Z",
                  model: "classifier",
                },
                createdAt: "2026-09-24T10:00:00.000Z",
                deliveredAt: null,
              },
            ],
            pagination: { total: 1, limit: 50, offset: 0, hasMore: false },
          },
        }),
      );

      const conversation = await client.conversations.get("conv_1", {
        includeMessages: true,
      });

      const message = conversation.messages!.data[0];
      expect(message.aiMetadata?.summary).toBe("Asks where their order is.");
      expect(message.messageFormat).toBe("sms");
    });
  });

  describe("list()", () => {
    it("returns the pagination block", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse({
          data: [listed("msg_1"), listed("msg_2")],
          pagination: {
            total: 57,
            limit: 2,
            offset: 0,
            page: 1,
            totalPages: 29,
            hasMore: true,
          },
          count: 2,
        }),
      );

      const result: MessageListResponse = await client.messages.list({ limit: 2 });

      expect(result.count).toBe(2);
      expect(result.pagination?.total).toBe(57);
      expect(result.pagination?.hasMore).toBe(true);
    });
  });

  describe("listAll()", () => {
    it("sends the filters on every page, starts at the offset and stops when hasMore is false", async () => {
      fetchMock
        .mockResolvedValueOnce(
          mockFetchResponse({
            data: [listed("msg_1"), listed("msg_2")],
            pagination: { total: 13, limit: 2, offset: 10, page: 6, totalPages: 7, hasMore: true },
            count: 2,
          }),
        )
        .mockResolvedValueOnce(
          mockFetchResponse({
            data: [listed("msg_3")],
            pagination: { total: 13, limit: 2, offset: 12, page: 7, totalPages: 7, hasMore: false },
            count: 1,
          }),
        );

      const ids: string[] = [];
      for await (const message of client.messages.listAll({
        status: "failed",
        offset: 10,
        limit: 2,
      })) {
        ids.push(message.id);
      }

      expect(ids).toEqual(["msg_1", "msg_2", "msg_3"]);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      const first = new URL(fetchMock.mock.calls[0][0]);
      expect(first.searchParams.get("status")).toBe("failed");
      expect(first.searchParams.get("offset")).toBe("10");
      expect(first.searchParams.get("limit")).toBe("2");
      const second = new URL(fetchMock.mock.calls[1][0]);
      expect(second.searchParams.get("status")).toBe("failed");
      expect(second.searchParams.get("offset")).toBe("12");
    });

    it("stops on a full last page when the API says there is no more", async () => {
      fetchMock.mockResolvedValueOnce(
        mockFetchResponse({
          data: [listed("msg_1"), listed("msg_2")],
          pagination: { total: 2, limit: 2, offset: 0, page: 1, totalPages: 1, hasMore: false },
          count: 2,
        }),
      );

      const ids: string[] = [];
      for await (const message of client.messages.listAll({ limit: 2 })) {
        ids.push(message.id);
      }

      expect(ids).toEqual(["msg_1", "msg_2"]);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("falls back to the page size when there is no pagination block", async () => {
      fetchMock
        .mockResolvedValueOnce(
          mockFetchResponse({ data: [listed("msg_1"), listed("msg_2")], count: 2 }),
        )
        .mockResolvedValueOnce(mockFetchResponse({ data: [listed("msg_3")], count: 1 }));

      const ids: string[] = [];
      for await (const message of client.messages.listAll({ limit: 2 })) {
        ids.push(message.id);
      }

      expect(ids).toEqual(["msg_1", "msg_2", "msg_3"]);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });
});
