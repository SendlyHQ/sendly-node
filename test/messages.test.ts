/**
 * Tests for Messages Resource - send, list, get, listAll
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
  TimeoutError,
} from "../src/errors";
import { mockFetchResponse } from "./fixtures/responses";
import type { Message, MessageListResponse } from "../src/types";

describe("Messages Resource", () => {
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

  describe("send()", () => {
    const mockMessage: Message = {
      id: "msg_test123",
      to: "+15551234567",
      from: "+15559876543",
      text: "Hello from Sendly!",
      status: "queued",
      error: null,
      segments: 1,
      creditsUsed: 1,
      isSandbox: true,
      createdAt: "2025-01-15T10:00:00Z",
      deliveredAt: null,
    };

    describe("Happy path", () => {
      it("should send a message successfully", async () => {
        fetchMock.mockResolvedValue(mockFetchResponse(mockMessage));

        const result = await client.messages.send({
          to: "+15551234567",
          text: "Hello from Sendly!",
        });

        expect(result).toEqual(mockMessage);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock).toHaveBeenCalledWith(
          expect.stringContaining("/v1/messages"),
          expect.objectContaining({
            method: "POST",
            headers: expect.objectContaining({
              Authorization: "Bearer sk_test_v1_valid_key",
              "Content-Type": "application/json",
            }),
            body: JSON.stringify({
              to: "+15551234567",
              text: "Hello from Sendly!",
            }),
          }),
        );
      });

      it("should send a message with custom sender ID", async () => {
        fetchMock.mockResolvedValue(mockFetchResponse(mockMessage));

        await client.messages.send({
          to: "+15551234567",
          text: "Hello!",
          from: "Sendly",
        });

        const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(callBody.from).toBe("Sendly");
      });

      it("should send a message with phone number as sender", async () => {
        fetchMock.mockResolvedValue(mockFetchResponse(mockMessage));

        await client.messages.send({
          to: "+15551234567",
          text: "Hello!",
          from: "+15559876543",
        });

        const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(callBody.from).toBe("+15559876543");
      });
    });

    describe("Validation errors", () => {
      it("should throw ValidationError for invalid phone format", async () => {
        await expect(
          client.messages.send({
            to: "15551234567",
            text: "Hello!",
          }),
        ).rejects.toThrow(ValidationError);
      });

      it("should throw ValidationError for empty phone", async () => {
        await expect(
          client.messages.send({
            to: "",
            text: "Hello!",
          }),
        ).rejects.toThrow(ValidationError);
      });

      it("should throw ValidationError for phone with invalid characters", async () => {
        await expect(
          client.messages.send({
            to: "+1-555-123-4567",
            text: "Hello!",
          }),
        ).rejects.toThrow(ValidationError);
      });

      it("should throw ValidationError for empty text", async () => {
        await expect(
          client.messages.send({
            to: "+15551234567",
            text: "",
          }),
        ).rejects.toThrow(ValidationError);
      });

      it("should throw ValidationError for non-string text", async () => {
        await expect(
          client.messages.send({
            to: "+15551234567",
            text: 123 as any,
          }),
        ).rejects.toThrow(ValidationError);
      });

      it("should throw ValidationError for invalid sender ID", async () => {
        await expect(
          client.messages.send({
            to: "+15551234567",
            text: "Hello!",
            from: "A", // Too short
          }),
        ).rejects.toThrow(ValidationError);
      });
    });

    describe("HTTP 401 - Authentication failure", () => {
      it("should throw AuthenticationError for invalid API key", async () => {
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
          client.messages.send({
            to: "+15551234567",
            text: "Hello!",
          }),
        ).rejects.toThrow(AuthenticationError);
      });

      it("should throw AuthenticationError for unauthorized", async () => {
        fetchMock.mockResolvedValue(
          mockFetchResponse(
            {
              error: "unauthorized",
              message: "Unauthorized",
            },
            401,
          ),
        );

        await expect(
          client.messages.send({
            to: "+15551234567",
            text: "Hello!",
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
              creditsNeeded: 5,
              currentBalance: 2,
            },
            402,
          ),
        );

        await expect(
          client.messages.send({
            to: "+15551234567",
            text: "Hello!",
          }),
        ).rejects.toThrow(InsufficientCreditsError);

        try {
          await client.messages.send({
            to: "+15551234567",
            text: "Hello!",
          });
        } catch (error) {
          expect((error as InsufficientCreditsError).creditsNeeded).toBe(5);
          expect((error as InsufficientCreditsError).currentBalance).toBe(2);
        }
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
          client.messages.send({
            to: "+15551234567",
            text: "Hello!",
          }),
        ).rejects.toThrow(NotFoundError);
      });
    });

    describe("HTTP 429 - Rate limit", () => {
      it("should throw RateLimitError with retry after", async () => {
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
          client.messages.send({
            to: "+15551234567",
            text: "Hello!",
          }),
        ).rejects.toThrow(RateLimitError);

        // Rate limit errors throw immediately without retry
        expect(fetchMock).toHaveBeenCalledTimes(1);

        // Verify retryAfter is included in error
        try {
          await client.messages.send({
            to: "+15551234567",
            text: "Hello!",
          });
        } catch (error) {
          expect((error as RateLimitError).retryAfter).toBe(60);
        }
      });
    });

    describe("HTTP 500 - Server error", () => {
      it("should retry on 500 error", async () => {
        fetchMock
          .mockResolvedValueOnce(
            mockFetchResponse(
              {
                error: "internal_error",
                message: "Internal server error",
              },
              500,
            ),
          )
          .mockResolvedValueOnce(mockFetchResponse(mockMessage));

        const result = await client.messages.send({
          to: "+15551234567",
          text: "Hello!",
        });

        expect(result).toEqual(mockMessage);
        expect(fetchMock).toHaveBeenCalledTimes(2);
      });

      it("should throw after max retries", async () => {
        fetchMock.mockResolvedValue(
          mockFetchResponse(
            {
              error: "internal_error",
              message: "Internal server error",
            },
            500,
          ),
        );

        await expect(
          client.messages.send({
            to: "+15551234567",
            text: "Hello!",
          }),
        ).rejects.toThrow();

        // Should retry 3 times (1 original + 3 retries = 4 total)
        expect(fetchMock).toHaveBeenCalledTimes(4);
      }, 40000); // Increase timeout for retries with backoff
    });

    describe("Network error", () => {
      it("should throw NetworkError on connection failure", async () => {
        fetchMock.mockRejectedValue(new Error("Network request failed"));

        await expect(
          client.messages.send({
            to: "+15551234567",
            text: "Hello!",
          }),
        ).rejects.toThrow(NetworkError);

        // Should retry 3 times (1 original + 3 retries = 4 total)
        expect(fetchMock).toHaveBeenCalledTimes(4);
      }, 40000); // Increase timeout for retries with backoff

      it("should retry on network error", async () => {
        fetchMock
          .mockRejectedValueOnce(new Error("Network request failed"))
          .mockResolvedValueOnce(mockFetchResponse(mockMessage));

        const result = await client.messages.send({
          to: "+15551234567",
          text: "Hello!",
        });

        expect(result).toEqual(mockMessage);
        expect(fetchMock).toHaveBeenCalledTimes(2);
      });
    });

    describe("Timeout error", () => {
      it("should throw TimeoutError on timeout", async () => {
        const abortError = new Error("The operation was aborted");
        abortError.name = "AbortError";
        fetchMock.mockRejectedValue(abortError);

        await expect(
          client.messages.send({
            to: "+15551234567",
            text: "Hello!",
          }),
        ).rejects.toThrow(TimeoutError);

        // Should retry 3 times (1 original + 3 retries = 4 total)
        expect(fetchMock).toHaveBeenCalledTimes(4);
      }, 40000); // Increase timeout for retries with backoff
    });
  });

  describe("list()", () => {
    const mockList: MessageListResponse = {
      data: [
        {
          id: "msg_1",
          to: "+15551234567",
          from: "+15559876543",
          text: "Message 1",
          status: "delivered",
          error: null,
          segments: 1,
          creditsUsed: 1,
          isSandbox: true,
          createdAt: "2025-01-15T10:00:00Z",
          deliveredAt: "2025-01-15T10:01:00Z",
        },
        {
          id: "msg_2",
          to: "+15551234568",
          from: "+15559876543",
          text: "Message 2",
          status: "queued",
          error: null,
          segments: 1,
          creditsUsed: 1,
          isSandbox: true,
          createdAt: "2025-01-15T10:02:00Z",
          deliveredAt: null,
        },
      ],
      count: 2,
    };

    describe("Happy path", () => {
      it("should list messages with default options", async () => {
        fetchMock.mockResolvedValue(mockFetchResponse(mockList));

        const result = await client.messages.list();

        expect(result).toEqual(mockList);
        expect(result.data).toHaveLength(2);
        expect(fetchMock).toHaveBeenCalledWith(
          expect.stringContaining("/v1/messages"),
          expect.objectContaining({
            method: "GET",
          }),
        );
      });

      it("should list messages with custom limit", async () => {
        fetchMock.mockResolvedValue(mockFetchResponse(mockList));

        await client.messages.list({ limit: 10 });

        const url = fetchMock.mock.calls[0][0];
        expect(url).toContain("limit=10");
      });

      it("should list messages with offset", async () => {
        fetchMock.mockResolvedValue(mockFetchResponse(mockList));

        await client.messages.list({ limit: 10, offset: 20 });

        const url = fetchMock.mock.calls[0][0];
        expect(url).toContain("limit=10");
        expect(url).toContain("offset=20");
      });

      it("should list messages with status filter", async () => {
        fetchMock.mockResolvedValue(mockFetchResponse(mockList));

        await client.messages.list({ status: "delivered" });

        const url = fetchMock.mock.calls[0][0];
        expect(url).toContain("status=delivered");
      });
    });

    describe("Validation errors", () => {
      it("should throw ValidationError for invalid limit", async () => {
        await expect(client.messages.list({ limit: 0 })).rejects.toThrow(
          ValidationError,
        );

        await expect(client.messages.list({ limit: 101 })).rejects.toThrow(
          ValidationError,
        );

        await expect(client.messages.list({ limit: -1 })).rejects.toThrow(
          ValidationError,
        );
      });

      it("should throw ValidationError for non-integer limit", async () => {
        await expect(client.messages.list({ limit: 50.5 })).rejects.toThrow(
          ValidationError,
        );
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

        await expect(client.messages.list()).rejects.toThrow(
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

        await expect(client.messages.list()).rejects.toThrow(RateLimitError);
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
          .mockResolvedValueOnce(mockFetchResponse(mockList));

        const result = await client.messages.list();
        expect(result).toEqual(mockList);
      });
    });

    describe("Network error", () => {
      it("should retry on network error", async () => {
        fetchMock
          .mockRejectedValueOnce(new Error("Network error"))
          .mockResolvedValueOnce(mockFetchResponse(mockList));

        const result = await client.messages.list();
        expect(result).toEqual(mockList);
      });
    });
  });

  describe("get()", () => {
    const mockMessage: Message = {
      id: "msg_test123",
      to: "+15551234567",
      from: "+15559876543",
      text: "Hello!",
      status: "delivered",
      error: null,
      segments: 1,
      creditsUsed: 1,
      isSandbox: true,
      createdAt: "2025-01-15T10:00:00Z",
      deliveredAt: "2025-01-15T10:01:00Z",
    };

    describe("Happy path", () => {
      it("should get a message by ID", async () => {
        fetchMock.mockResolvedValue(mockFetchResponse(mockMessage));

        const result = await client.messages.get("msg_test123");

        expect(result).toEqual(mockMessage);
        expect(fetchMock).toHaveBeenCalledWith(
          expect.stringContaining("/v1/messages/msg_test123"),
          expect.objectContaining({
            method: "GET",
          }),
        );
      });

      it("should get a message by UUID", async () => {
        fetchMock.mockResolvedValue(mockFetchResponse(mockMessage));

        const uuid = "550e8400-e29b-41d4-a716-446655440000";
        await client.messages.get(uuid);

        expect(fetchMock).toHaveBeenCalledWith(
          expect.stringContaining(`/v1/messages/${uuid}`),
          expect.any(Object),
        );
      });
    });

    describe("Validation errors", () => {
      it("should throw ValidationError for empty ID", async () => {
        await expect(client.messages.get("")).rejects.toThrow(ValidationError);
      });

      it("should throw ValidationError for invalid ID format", async () => {
        await expect(client.messages.get("invalid-id")).rejects.toThrow(
          ValidationError,
        );
      });

      it("should throw ValidationError for non-string ID", async () => {
        await expect(client.messages.get(123 as any)).rejects.toThrow(
          ValidationError,
        );
      });
    });

    describe("HTTP 404 - Not found", () => {
      it("should throw NotFoundError for non-existent message", async () => {
        fetchMock.mockResolvedValue(
          mockFetchResponse(
            {
              error: "not_found",
              message: "Message not found",
            },
            404,
          ),
        );

        await expect(client.messages.get("msg_nonexistent")).rejects.toThrow(
          NotFoundError,
        );
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

        await expect(client.messages.get("msg_test123")).rejects.toThrow(
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

        await expect(client.messages.get("msg_test123")).rejects.toThrow(
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
          .mockResolvedValueOnce(mockFetchResponse(mockMessage));

        const result = await client.messages.get("msg_test123");
        expect(result).toEqual(mockMessage);
      });
    });

    describe("Network error", () => {
      it("should retry on network error", async () => {
        fetchMock
          .mockRejectedValueOnce(new Error("Network error"))
          .mockResolvedValueOnce(mockFetchResponse(mockMessage));

        const result = await client.messages.get("msg_test123");
        expect(result).toEqual(mockMessage);
      });
    });
  });

  describe("listAll()", () => {
    describe("Happy path", () => {
      it("should iterate through all messages", async () => {
        const page1 = {
          data: Array.from({ length: 100 }, (_, i) => ({
            id: `msg_${i}`,
            to: "+15551234567",
            from: "+15559876543",
            text: `Message ${i}`,
            status: "delivered" as const,
            error: null,
            segments: 1,
            creditsUsed: 1,
            isSandbox: true,
            createdAt: "2025-01-15T10:00:00Z",
            deliveredAt: "2025-01-15T10:01:00Z",
          })),
          count: 100,
        };

        const page2 = {
          data: Array.from({ length: 50 }, (_, i) => ({
            id: `msg_${i + 100}`,
            to: "+15551234567",
            from: "+15559876543",
            text: `Message ${i + 100}`,
            status: "delivered" as const,
            error: null,
            segments: 1,
            creditsUsed: 1,
            isSandbox: true,
            createdAt: "2025-01-15T10:00:00Z",
            deliveredAt: "2025-01-15T10:01:00Z",
          })),
          count: 50,
        };

        fetchMock
          .mockResolvedValueOnce(mockFetchResponse(page1))
          .mockResolvedValueOnce(mockFetchResponse(page2));

        const messages: Message[] = [];
        for await (const message of client.messages.listAll()) {
          messages.push(message);
        }

        expect(messages).toHaveLength(150);
        expect(messages[0].id).toBe("msg_0");
        expect(messages[149].id).toBe("msg_149");
        expect(fetchMock).toHaveBeenCalledTimes(2);
      });

      it("should handle single page", async () => {
        const page = {
          data: Array.from({ length: 10 }, (_, i) => ({
            id: `msg_${i}`,
            to: "+15551234567",
            from: "+15559876543",
            text: `Message ${i}`,
            status: "delivered" as const,
            error: null,
            segments: 1,
            creditsUsed: 1,
            isSandbox: true,
            createdAt: "2025-01-15T10:00:00Z",
            deliveredAt: "2025-01-15T10:01:00Z",
          })),
          count: 10,
        };

        fetchMock.mockResolvedValue(mockFetchResponse(page));

        const messages: Message[] = [];
        for await (const message of client.messages.listAll({ limit: 100 })) {
          messages.push(message);
        }

        expect(messages).toHaveLength(10);
        expect(fetchMock).toHaveBeenCalledTimes(1);
      });

      it("should handle empty results", async () => {
        fetchMock.mockResolvedValue(mockFetchResponse({ data: [], count: 0 }));

        const messages: Message[] = [];
        for await (const message of client.messages.listAll()) {
          messages.push(message);
        }

        expect(messages).toHaveLength(0);
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

        const generator = client.messages.listAll();
        await expect(generator.next()).rejects.toThrow(AuthenticationError);
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

        const generator = client.messages.listAll();
        await expect(generator.next()).rejects.toThrow(RateLimitError);
        // Rate limit errors throw immediately without retry
        expect(fetchMock).toHaveBeenCalledTimes(1);
      });
    });

    describe("Network error", () => {
      it("should throw NetworkError", async () => {
        fetchMock.mockRejectedValue(new Error("Network error"));

        const generator = client.messages.listAll();
        await expect(generator.next()).rejects.toThrow(NetworkError);
        expect(fetchMock).toHaveBeenCalledTimes(4);
      }, 40000);
    });
  });
});
