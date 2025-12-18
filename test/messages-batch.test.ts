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
import type { BatchMessageResponse, BatchListResponse } from "../src/types";

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
    const mockBatchResponse: BatchMessageResponse = {
      batchId: "batch_test123",
      status: "completed",
      total: 2,
      queued: 2,
      sent: 2,
      failed: 0,
      creditsUsed: 2,
      messages: [
        {
          id: "msg_batch1",
          to: "+15551234567",
          status: "queued",
        },
        {
          id: "msg_batch2",
          to: "+15559876543",
          status: "queued",
        },
      ],
      createdAt: "2025-01-15T10:00:00Z",
      completedAt: "2025-01-15T10:00:05Z",
    };

    describe("Happy path", () => {
      it("should send batch messages successfully", async () => {
        fetchMock.mockResolvedValue(mockFetchResponse(mockBatchResponse));

        const result = await client.messages.sendBatch({
          messages: [
            { to: "+15551234567", text: "Hello User 1!" },
            { to: "+15559876543", text: "Hello User 2!" },
          ],
        });

        expect(result).toEqual(mockBatchResponse);
        expect(result.batchId).toBe("batch_test123");
        expect(result.total).toBe(2);
        expect(result.queued).toBe(2);
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

      it("should throw error for too many messages (>1000)", async () => {
        const messages = Array.from({ length: 1001 }, (_, i) => ({
          to: "+15551234567",
          text: `Message ${i}`,
        }));

        await expect(client.messages.sendBatch({ messages })).rejects.toThrow(
          "Maximum 1000 messages per batch",
        );
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
    const mockBatchResponse: BatchMessageResponse = {
      batchId: "batch_test123",
      status: "completed",
      total: 2,
      queued: 2,
      sent: 2,
      failed: 0,
      creditsUsed: 2,
      messages: [
        {
          id: "msg_batch1",
          to: "+15551234567",
          status: "queued",
        },
        {
          id: "msg_batch2",
          to: "+15559876543",
          status: "queued",
        },
      ],
      createdAt: "2025-01-15T10:00:00Z",
      completedAt: "2025-01-15T10:00:05Z",
    };

    describe("Happy path", () => {
      it("should get batch status by ID", async () => {
        fetchMock.mockResolvedValue(mockFetchResponse(mockBatchResponse));

        const result = await client.messages.getBatch("batch_test123");

        expect(result).toEqual(mockBatchResponse);
        expect(result.batchId).toBe("batch_test123");
        expect(result.status).toBe("completed");
        expect(fetchMock).toHaveBeenCalledWith(
          expect.stringContaining("/v1/messages/batch/batch_test123"),
          expect.objectContaining({
            method: "GET",
          }),
        );
      });

      it("should get processing batch", async () => {
        const processingBatch: BatchMessageResponse = {
          ...mockBatchResponse,
          status: "processing",
          sent: 1,
          completedAt: null,
        };

        fetchMock.mockResolvedValue(mockFetchResponse(processingBatch));

        const result = await client.messages.getBatch("batch_test123");

        expect(result.status).toBe("processing");
        expect(result.completedAt).toBeNull();
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
          .mockResolvedValueOnce(mockFetchResponse(mockBatchResponse));

        const result = await client.messages.getBatch("batch_test123");
        expect(result).toEqual(mockBatchResponse);
      });
    });

    describe("Network error", () => {
      it("should retry on network error", async () => {
        fetchMock
          .mockRejectedValueOnce(new Error("Network error"))
          .mockResolvedValueOnce(mockFetchResponse(mockBatchResponse));

        const result = await client.messages.getBatch("batch_test123");
        expect(result).toEqual(mockBatchResponse);
      });
    });
  });

  describe("listBatches()", () => {
    const mockBatchList: BatchListResponse = {
      data: [
        {
          batchId: "batch_1",
          status: "completed",
          total: 2,
          queued: 2,
          sent: 2,
          failed: 0,
          creditsUsed: 2,
          messages: [],
          createdAt: "2025-01-15T10:00:00Z",
          completedAt: "2025-01-15T10:00:05Z",
        },
        {
          batchId: "batch_2",
          status: "processing",
          total: 3,
          queued: 3,
          sent: 1,
          failed: 0,
          creditsUsed: 1,
          messages: [],
          createdAt: "2025-01-15T10:05:00Z",
          completedAt: null,
        },
      ],
      count: 2,
    };

    describe("Happy path", () => {
      it("should list batches with default options", async () => {
        fetchMock.mockResolvedValue(mockFetchResponse(mockBatchList));

        const result = await client.messages.listBatches();

        expect(result).toEqual(mockBatchList);
        expect(result.data).toHaveLength(2);
        expect(fetchMock).toHaveBeenCalledWith(
          expect.stringContaining("/v1/messages/batches"),
          expect.objectContaining({
            method: "GET",
          }),
        );
      });

      it("should list batches with custom limit", async () => {
        fetchMock.mockResolvedValue(mockFetchResponse(mockBatchList));

        await client.messages.listBatches({ limit: 10 });

        const url = fetchMock.mock.calls[0][0];
        expect(url).toContain("limit=10");
      });

      it("should list batches with offset", async () => {
        fetchMock.mockResolvedValue(mockFetchResponse(mockBatchList));

        await client.messages.listBatches({ limit: 10, offset: 20 });

        const url = fetchMock.mock.calls[0][0];
        expect(url).toContain("offset=20");
      });

      it("should list batches with status filter", async () => {
        fetchMock.mockResolvedValue(mockFetchResponse(mockBatchList));

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
          .mockResolvedValueOnce(mockFetchResponse(mockBatchList));

        const result = await client.messages.listBatches();
        expect(result).toEqual(mockBatchList);
      });
    });

    describe("Network error", () => {
      it("should retry on network error", async () => {
        fetchMock
          .mockRejectedValueOnce(new Error("Network error"))
          .mockResolvedValueOnce(mockFetchResponse(mockBatchList));

        const result = await client.messages.listBatches();
        expect(result).toEqual(mockBatchList);
      });
    });
  });
});
