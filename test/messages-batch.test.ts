/**
 * Tests for Batch Messages - sendBatch, getBatch, listBatches
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { Sendly } from "../src/client";
import {
  ValidationError,
  AuthenticationError,
  InsufficientCreditsError,
  NotFoundError,
  RateLimitError,
  NetworkError,
} from "../src/errors";
import { mockFetchResponse } from "./fixtures/responses";
import type {
  BatchMessageResponse,
  BatchSendResponse,
  BatchListResponse,
  BatchPreviewResponse,
} from "../src/types";
import { MAX_BATCH_MESSAGES } from "../src/types";

describe("Batch Messages", () => {
  let client: Sendly;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    client = new Sendly("sk_test_v1_valid_key");
    fetchMock = vi.fn();
    global.fetch = fetchMock;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("sendBatch()", () => {
    const mockBatchResponse = {
      batchId: "batch_test123",
      status: "completed",
      total: 2,
      sent: 2,
      failed: 0,
      retrying: 0,
      optedOutSkipped: 0,
      invalidSkipped: 0,
      creditsUsed: 4,
      creditsRefunded: 0,
      messages: [
        { index: 0, id: "msg_batch1", to: "+15551234567", status: "sent" },
        { index: 1, id: "msg_batch2", to: "+15559876543", status: "sent" },
      ],
    };

    describe("Happy path", () => {
      it("should send batch messages successfully", async () => {
        fetchMock.mockResolvedValue(mockFetchResponse(mockBatchResponse));

        const result: BatchSendResponse = await client.messages.sendBatch({
          messages: [
            { to: "+15551234567", text: "Hello User 1!" },
            { to: "+15559876543", text: "Hello User 2!" },
          ],
        });

        expect(result).toEqual(mockBatchResponse);
        expect(result.batchId).toBe("batch_test123");
        expect(result.total).toBe(2);
        expect(result.optedOutSkipped).toBe(0);
        expect(result.creditsRefunded).toBe(0);
        expect(result.messages[1].index).toBe(1);
        expect(result.queued).toBeUndefined();
        expect(fetchMock).toHaveBeenCalledWith(
          expect.stringContaining("/v1/messages/batch"),
          expect.objectContaining({
            method: "POST",
            body: JSON.stringify({
              messages: [
                { to: "+15551234567", text: "Hello User 1!" },
                { to: "+15559876543", text: "Hello User 2!" },
              ],
            }),
          }),
        );
      });

      it("should send batch with custom sender ID", async () => {
        fetchMock.mockResolvedValue(mockFetchResponse(mockBatchResponse));

        await client.messages.sendBatch({
          messages: [
            { to: "+15551234567", text: "Hello!" },
            { to: "+15559876543", text: "Hi!" },
          ],
          from: "Sendly",
        });

        const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(callBody.from).toBe("Sendly");
      });

      it("should send batch with single message", async () => {
        fetchMock.mockResolvedValue(mockFetchResponse(mockBatchResponse));

        const result = await client.messages.sendBatch({
          messages: [{ to: "+15551234567", text: "Hello!" }],
        });

        expect(result).toBeDefined();
      });

      it("should send batch with maximum 1000 messages", async () => {
        fetchMock.mockResolvedValue(mockFetchResponse(mockBatchResponse));

        const messages = Array.from({ length: 1000 }, (_, i) => ({
          to: "+15551234567",
          text: `Message ${i}`,
        }));

        await expect(
          client.messages.sendBatch({ messages }),
        ).resolves.toBeDefined();
      });

      it("should send more than 1,000 messages in one request, up to 10,000", async () => {
        fetchMock.mockResolvedValue(mockFetchResponse(mockBatchResponse));

        for (const length of [1001, MAX_BATCH_MESSAGES]) {
          const messages = Array.from({ length }, (_, i) => ({
            to: "+15551234567",
            text: `Message ${i}`,
          }));
          await client.messages.sendBatch({ messages });
        }

        expect(MAX_BATCH_MESSAGES).toBe(10000);
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(JSON.parse(fetchMock.mock.calls[1][1].body).messages).toHaveLength(
          10000,
        );
      });
    });

    describe("Validation errors", () => {
      it("should throw error for empty messages array", async () => {
        await expect(
          client.messages.sendBatch({
            messages: [],
          }),
        ).rejects.toThrow("messages must be a non-empty array");
      });

      it("should throw error for non-array messages", async () => {
        await expect(
          client.messages.sendBatch({
            messages: null as any,
          }),
        ).rejects.toThrow("messages must be a non-empty array");

        await expect(
          client.messages.sendBatch({
            messages: undefined as any,
          }),
        ).rejects.toThrow("messages must be a non-empty array");
      });

      it("should throw error for too many messages (>10,000)", async () => {
        const messages = Array.from({ length: 10001 }, (_, i) => ({
          to: "+15551234567",
          text: `Message ${i}`,
        }));

        await expect(client.messages.sendBatch({ messages })).rejects.toThrow(
          "Maximum 10,000 messages per batch",
        );
        expect(fetchMock).not.toHaveBeenCalled();
      });

      it("should throw ValidationError for invalid phone in batch", async () => {
        await expect(
          client.messages.sendBatch({
            messages: [
              { to: "+15551234567", text: "Valid" },
              { to: "invalid", text: "Invalid phone" },
            ],
          }),
        ).rejects.toThrow(ValidationError);
      });

      it("should throw ValidationError for empty text in batch", async () => {
        await expect(
          client.messages.sendBatch({
            messages: [
              { to: "+15551234567", text: "Valid" },
              { to: "+15559876543", text: "" },
            ],
          }),
        ).rejects.toThrow(ValidationError);
      });

      it("should throw ValidationError for invalid sender ID", async () => {
        await expect(
          client.messages.sendBatch({
            messages: [{ to: "+15551234567", text: "Hello" }],
            from: "A", // Too short
          }),
        ).rejects.toThrow(ValidationError);
      });
    });

    describe("HTTP 401 - Authentication failure", () => {
      it("should throw AuthenticationError", async () => {
        fetchMock.mockResolvedValue(
          mockFetchResponse(
            {
              error: "invalid_api_key",
              message: "Invalid API key",
            },
            401,
          ),
        );

        await expect(
          client.messages.sendBatch({
            messages: [{ to: "+15551234567", text: "Hello" }],
          }),
        ).rejects.toThrow(AuthenticationError);
      });
    });

    describe("HTTP 402 - Insufficient credits", () => {
      it("should throw InsufficientCreditsError", async () => {
        fetchMock.mockResolvedValue(
          mockFetchResponse(
            {
              error: "insufficient_credits",
              message: "Insufficient credits",
              creditsNeeded: 10,
              currentBalance: 5,
            },
            402,
          ),
        );

        await expect(
          client.messages.sendBatch({
            messages: [
              { to: "+15551234567", text: "Hello" },
              { to: "+15559876543", text: "Hi" },
            ],
          }),
        ).rejects.toThrow(InsufficientCreditsError);
      });
    });

    describe("HTTP 404 - Not found", () => {
      it("should throw NotFoundError", async () => {
        fetchMock.mockResolvedValue(
          mockFetchResponse(
            {
              error: "not_found",
              message: "Resource not found",
            },
            404,
          ),
        );

        await expect(
          client.messages.sendBatch({
            messages: [{ to: "+15551234567", text: "Hello" }],
          }),
        ).rejects.toThrow(NotFoundError);
      });
    });

    describe("HTTP 429 - Rate limit", () => {
      it("should throw RateLimitError", async () => {
        fetchMock.mockResolvedValue(
          mockFetchResponse(
            {
              error: "rate_limit_exceeded",
              message: "Rate limit exceeded",
              retryAfter: 60,
            },
            429,
          ),
        );

        await expect(
          client.messages.sendBatch({
            messages: [{ to: "+15551234567", text: "Hello" }],
          }),
        ).rejects.toThrow(RateLimitError);
        // Rate limit errors throw immediately without retry
        expect(fetchMock).toHaveBeenCalledTimes(1);
      });
    });

    describe("HTTP 500 - Server error", () => {
      it("should retry and succeed", async () => {
        fetchMock
          .mockResolvedValueOnce(
            mockFetchResponse(
              {
                error: "internal_error",
                message: "Server error",
              },
              500,
            ),
          )
          .mockResolvedValueOnce(mockFetchResponse(mockBatchResponse));

        const result = await client.messages.sendBatch({
          messages: [{ to: "+15551234567", text: "Hello" }],
        });

        expect(result).toEqual(mockBatchResponse);
      });
    });

    describe("Network error", () => {
      it("should retry on network error", async () => {
        fetchMock
          .mockRejectedValueOnce(new Error("Network error"))
          .mockResolvedValueOnce(mockFetchResponse(mockBatchResponse));

        const result = await client.messages.sendBatch({
          messages: [{ to: "+15551234567", text: "Hello" }],
        });

        expect(result).toEqual(mockBatchResponse);
      });
    });
  });

  describe("getBatch()", () => {
    const wireBatch = {
      id: "batch_test123",
      status: "completed",
      total: 2,
      queued: 0,
      sent: 2,
      delivered: 2,
      failed: 0,
      creditsReserved: 4,
      creditsUsed: 4,
      creditsRefunded: 0,
      createdAt: "2025-01-15T10:00:00.000Z",
      completedAt: "2025-01-15T10:00:05.000Z",
      messages: [
        {
          id: "msg_batch1",
          to: "+15551234567",
          status: "delivered",
          error: null,
          createdAt: "2025-01-15T10:00:00.000Z",
          deliveredAt: "2025-01-15T10:00:03.000Z",
        },
        {
          id: "msg_batch2",
          to: "+15559876543",
          status: "delivered",
          error: null,
          createdAt: "2025-01-15T10:00:00.000Z",
          deliveredAt: "2025-01-15T10:00:04.000Z",
        },
      ],
    };
    const mockBatchResponse = { ...wireBatch, batchId: "batch_test123" };

    describe("Happy path", () => {
      it("should get batch status by ID", async () => {
        fetchMock.mockResolvedValue(mockFetchResponse(wireBatch));

        const result: BatchMessageResponse =
          await client.messages.getBatch("batch_test123");

        expect(result).toEqual(mockBatchResponse);
        expect(result.batchId).toBe("batch_test123");
        expect(result.status).toBe("completed");
        expect(result.delivered).toBe(2);
        expect(result.creditsReserved).toBe(4);
        expect(fetchMock).toHaveBeenCalledWith(
          expect.stringContaining("/v1/messages/batch/batch_test123"),
          expect.objectContaining({
            method: "GET",
          }),
        );
      });

      it("should get processing batch", async () => {
        const processingBatch = {
          ...wireBatch,
          status: "processing",
          sent: 1,
          completedAt: null,
        };

        fetchMock.mockResolvedValue(mockFetchResponse(processingBatch));

        const result = await client.messages.getBatch("batch_test123");

        expect(result.status).toBe("processing");
        expect(result.completedAt).toBeNull();
        expect(result.batchId).toBe("batch_test123");
      });
    });

    describe("Validation errors", () => {
      it("should throw error for empty batch ID", async () => {
        await expect(client.messages.getBatch("")).rejects.toThrow(
          "Invalid batch ID format",
        );
      });

      it("should throw error for invalid batch ID format", async () => {
        await expect(client.messages.getBatch("msg_invalid")).rejects.toThrow(
          "Invalid batch ID format",
        );

        await expect(client.messages.getBatch("invalid_id")).rejects.toThrow(
          "Invalid batch ID format",
        );
      });
    });

    describe("HTTP 404 - Not found", () => {
      it("should throw NotFoundError for non-existent batch", async () => {
        fetchMock.mockResolvedValue(
          mockFetchResponse(
            {
              error: "not_found",
              message: "Batch not found",
            },
            404,
          ),
        );

        await expect(
          client.messages.getBatch("batch_nonexistent"),
        ).rejects.toThrow(NotFoundError);
      });
    });

    describe("HTTP 401 - Authentication failure", () => {
      it("should throw AuthenticationError", async () => {
        fetchMock.mockResolvedValue(
          mockFetchResponse(
            {
              error: "unauthorized",
              message: "Unauthorized",
            },
            401,
          ),
        );

        await expect(client.messages.getBatch("batch_test123")).rejects.toThrow(
          AuthenticationError,
        );
      });
    });

    describe("HTTP 429 - Rate limit", () => {
      it("should throw RateLimitError", async () => {
        fetchMock.mockResolvedValue(
          mockFetchResponse(
            {
              error: "rate_limit_exceeded",
              message: "Rate limit exceeded",
              retryAfter: 60,
            },
            429,
          ),
        );

        await expect(client.messages.getBatch("batch_test123")).rejects.toThrow(
          RateLimitError,
        );
        // Rate limit errors throw immediately without retry
        expect(fetchMock).toHaveBeenCalledTimes(1);
      });
    });

    describe("HTTP 500 - Server error", () => {
      it("should retry and succeed", async () => {
        fetchMock
          .mockResolvedValueOnce(
            mockFetchResponse(
              {
                error: "internal_error",
                message: "Server error",
              },
              500,
            ),
          )
          .mockResolvedValueOnce(mockFetchResponse(wireBatch));

        const result = await client.messages.getBatch("batch_test123");
        expect(result).toEqual(mockBatchResponse);
      });
    });

    describe("Network error", () => {
      it("should retry on network error", async () => {
        fetchMock
          .mockRejectedValueOnce(new Error("Network error"))
          .mockResolvedValueOnce(mockFetchResponse(wireBatch));

        const result = await client.messages.getBatch("batch_test123");
        expect(result).toEqual(mockBatchResponse);
      });
    });
  });

  describe("listBatches()", () => {
    const wireList = {
      data: [
        {
          id: "batch_1",
          status: "completed",
          total: 2,
          queued: 0,
          sent: 2,
          delivered: 2,
          failed: 0,
          creditsReserved: 4,
          creditsUsed: 4,
          creditsRefunded: 0,
          createdAt: "2025-01-15T10:00:00.000Z",
          completedAt: "2025-01-15T10:00:05.000Z",
        },
        {
          id: "batch_2",
          status: "processing",
          total: 3,
          queued: 2,
          sent: 1,
          delivered: 0,
          failed: 0,
          creditsReserved: 6,
          creditsUsed: 2,
          creditsRefunded: 0,
          createdAt: "2025-01-15T10:05:00.000Z",
          completedAt: null,
        },
      ],
      count: 2,
    };
    const mockBatchList = {
      ...wireList,
      data: wireList.data.map((batch) => ({ ...batch, batchId: batch.id })),
    };

    describe("Happy path", () => {
      it("should list batches with default options", async () => {
        fetchMock.mockResolvedValue(mockFetchResponse(wireList));

        const result: BatchListResponse = await client.messages.listBatches();

        expect(result).toEqual(mockBatchList);
        expect(result.data).toHaveLength(2);
        expect(result.data[0].batchId).toBe("batch_1");
        expect(result.data[1].batchId).toBe("batch_2");
        expect(result.data[0].messages).toBeUndefined();
        expect(fetchMock).toHaveBeenCalledWith(
          expect.stringContaining("/v1/messages/batches"),
          expect.objectContaining({
            method: "GET",
          }),
        );
      });

      it("should list batches with custom limit", async () => {
        fetchMock.mockResolvedValue(mockFetchResponse(wireList));

        await client.messages.listBatches({ limit: 10 });

        const url = fetchMock.mock.calls[0][0];
        expect(url).toContain("limit=10");
      });

      it("should list batches with offset", async () => {
        fetchMock.mockResolvedValue(mockFetchResponse(wireList));

        await client.messages.listBatches({ limit: 10, offset: 20 });

        const url = fetchMock.mock.calls[0][0];
        expect(url).toContain("offset=20");
      });

      it("should list batches with status filter", async () => {
        fetchMock.mockResolvedValue(mockFetchResponse(wireList));

        await client.messages.listBatches({ status: "completed" });

        const url = fetchMock.mock.calls[0][0];
        expect(url).toContain("status=completed");
      });
    });

    describe("Validation errors", () => {
      it("should throw ValidationError for invalid limit", async () => {
        await expect(client.messages.listBatches({ limit: 0 })).rejects.toThrow(
          ValidationError,
        );

        await expect(
          client.messages.listBatches({ limit: 101 }),
        ).rejects.toThrow(ValidationError);
      });
    });

    describe("HTTP 401 - Authentication failure", () => {
      it("should throw AuthenticationError", async () => {
        fetchMock.mockResolvedValue(
          mockFetchResponse(
            {
              error: "unauthorized",
              message: "Unauthorized",
            },
            401,
          ),
        );

        await expect(client.messages.listBatches()).rejects.toThrow(
          AuthenticationError,
        );
      });
    });

    describe("HTTP 429 - Rate limit", () => {
      it("should throw RateLimitError", async () => {
        fetchMock.mockResolvedValue(
          mockFetchResponse(
            {
              error: "rate_limit_exceeded",
              message: "Rate limit exceeded",
              retryAfter: 60,
            },
            429,
          ),
        );

        await expect(client.messages.listBatches()).rejects.toThrow(
          RateLimitError,
        );
        // Rate limit errors throw immediately without retry
        expect(fetchMock).toHaveBeenCalledTimes(1);
      });
    });

    describe("HTTP 500 - Server error", () => {
      it("should retry and succeed", async () => {
        fetchMock
          .mockResolvedValueOnce(
            mockFetchResponse(
              {
                error: "internal_error",
                message: "Server error",
              },
              500,
            ),
          )
          .mockResolvedValueOnce(mockFetchResponse(wireList));

        const result = await client.messages.listBatches();
        expect(result).toEqual(mockBatchList);
      });
    });

    describe("Network error", () => {
      it("should retry on network error", async () => {
        fetchMock
          .mockRejectedValueOnce(new Error("Network error"))
          .mockResolvedValueOnce(mockFetchResponse(wireList));

        const result = await client.messages.listBatches();
        expect(result).toEqual(mockBatchList);
      });
    });
  });
  describe("previewBatch()", () => {
    const wirePreview = {
      total: 2,
      sendable: 2,
      blocked: 0,
      duplicates: 0,
      creditsNeeded: 4,
      creditBalance: 500,
      hasSufficientCredits: true,
      pooled: false,
      keyType: "live",
      keyScopes: ["sms:send", "sms:read"],
      hasWriteScope: true,
      messagingProfile: {
        id: "mp_1",
        canSendDomestic: true,
        canSendInternational: false,
        verificationStatus: "verified",
        verificationType: "toll_free",
      },
      byCountry: {
        US: { count: 2, credits: 4, tier: "domestic", allowed: true },
      },
      blockedMessages: [],
      compliance: {
        messageType: "transactional",
        optedOutBlocked: 0,
        shaftBlocked: 0,
        quietHoursBlocked: 0,
        quietHoursRescheduled: 0,
        shaftBlockedMessages: [],
        quietHoursBlockedMessages: [],
      },
      warnings: [],
    };
    const request = {
      messages: [
        { to: "+15551234567", text: "Hello User 1!" },
        { to: "+15559876543", text: "Hello User 2!" },
      ],
      messageType: "transactional" as const,
    };

    it("returns the preview fields and the legacy names derived from them", async () => {
      fetchMock.mockResolvedValue(mockFetchResponse(wirePreview));

      const preview: BatchPreviewResponse =
        await client.messages.previewBatch(request);

      expect(preview.total).toBe(2);
      expect(preview.sendable).toBe(2);
      expect(preview.creditBalance).toBe(500);
      expect(preview.byCountry?.US.tier).toBe("domestic");
      expect(preview.blockedMessages).toEqual([]);
      expect(preview.canSend).toBe(true);
      expect(preview.totalMessages).toBe(2);
      expect(preview.willSend).toBe(2);
      expect(preview.currentBalance).toBe(500);
      expect(preview.hasEnoughCredits).toBe(true);
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/v1/messages/batch/preview"),
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("cannot send without credits, without the sms:send scope, or with nothing sendable", async () => {
      const cases = [
        { ...wirePreview, hasSufficientCredits: false },
        { ...wirePreview, hasWriteScope: false, keyScopes: ["sms:read"] },
        {
          ...wirePreview,
          sendable: 0,
          blocked: 2,
          blockedMessages: [
            { index: 0, to: "+15551234567", reason: "access_denied" },
            { index: 1, to: "+15559876543", reason: "access_denied" },
          ],
        },
      ];

      for (const body of cases) {
        fetchMock.mockResolvedValueOnce(mockFetchResponse(body));
        const preview = await client.messages.previewBatch(request);
        expect(preview.canSend).toBe(false);
      }
    });

    it("cannot send when a message is blocked for a reason other than an opt-out, since the send rejects the whole batch", async () => {
      const internationalReason =
        "Your verification does not allow international messaging. Complete international verification to message 200+ countries.";
      const mixedDestinations = {
        ...wirePreview,
        sendable: 1,
        blocked: 1,
        creditsNeeded: 2,
        byCountry: {
          US: { count: 1, credits: 2, tier: "domestic", allowed: true },
          GB: {
            count: 1,
            credits: 0,
            tier: "tier1",
            allowed: false,
            blockedReason: internationalReason,
          },
        },
        blockedMessages: [
          { index: 1, to: "+447700900123", reason: internationalReason },
        ],
      };
      const restrictedContent = {
        ...wirePreview,
        sendable: 1,
        blocked: 1,
        creditsNeeded: 2,
        byCountry: {
          US: { count: 2, credits: 2, tier: "domestic", allowed: false, blockedReason: "SHAFT content: cannabis" },
        },
        blockedMessages: [
          { index: 1, to: "+15559876543", reason: "SHAFT content: cannabis" },
        ],
        compliance: {
          ...wirePreview.compliance,
          shaftBlocked: 1,
          shaftBlockedMessages: [
            { index: 1, to: "+15559876543", category: "cannabis", matchedTerms: ["cbd"] },
          ],
        },
        warnings: ["1 message blocked due to SHAFT content violations"],
      };

      for (const body of [mixedDestinations, restrictedContent]) {
        fetchMock.mockResolvedValueOnce(mockFetchResponse(body));
        const preview = await client.messages.previewBatch(request);
        expect(preview.sendable).toBe(1);
        expect(preview.willSend).toBe(1);
        expect(preview.canSend).toBe(false);
      }
    });

    it("can send when the only blocked messages are opt-outs, which a send skips", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse({
          ...wirePreview,
          sendable: 1,
          blocked: 1,
          creditsNeeded: 2,
          blockedMessages: [
            { index: 1, to: "+15559876543", reason: "Contact has opted out (texted STOP)" },
          ],
          compliance: { ...wirePreview.compliance, optedOutBlocked: 1 },
          warnings: ["1 message blocked - contacts opted out (texted STOP)"],
        }),
      );

      const preview = await client.messages.previewBatch(request);

      expect(preview.canSend).toBe(true);
    });

    it("does not need a balance with a test key, whose sends are free", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse({
          ...wirePreview,
          creditBalance: 0,
          hasSufficientCredits: false,
          keyType: "test",
          warnings: ["Using TEST key - messages will be simulated in sandbox mode"],
        }),
      );

      const preview = await client.messages.previewBatch(request);

      expect(preview.hasEnoughCredits).toBe(false);
      expect(preview.canSend).toBe(true);
    });

    it("previews up to 10,000 messages and rejects more before sending", async () => {
      fetchMock.mockResolvedValue(mockFetchResponse(wirePreview));

      const within = Array.from({ length: 1001 }, (_, i) => ({
        to: "+15551234567",
        text: `Message ${i}`,
      }));
      await client.messages.previewBatch({ messages: within });
      expect(fetchMock).toHaveBeenCalledTimes(1);

      const over = Array.from({ length: 10001 }, (_, i) => ({
        to: "+15551234567",
        text: `Message ${i}`,
      }));
      await expect(client.messages.previewBatch({ messages: over })).rejects.toThrow(
        "Maximum 10,000 messages per batch",
      );
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });
});
