/**
 * Tests for Scheduled Messages - schedule, listScheduled, getScheduled, cancelScheduled
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
  ScheduledMessage,
  ScheduledMessageListResponse,
  CancelledMessageResponse,
} from "../src/types";

describe("Scheduled Messages", () => {
  let client: Sendly;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    client = new Sendly("sk_test_v1_valid_key");
    fetchMock = vi.fn();
    global.fetch = fetchMock;
    // Mock Date.now for consistent testing
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T10:00:00Z"));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe("schedule()", () => {
    const mockScheduled: ScheduledMessage = {
      id: "msg_scheduled123",
      to: "+15551234567",
      from: null,
      text: "Scheduled reminder",
      status: "scheduled",
      scheduledAt: "2025-01-20T10:00:00Z",
      creditsReserved: 1,
      error: null,
      createdAt: "2025-01-15T10:00:00Z",
      cancelledAt: null,
      sentAt: null,
    };

    describe("Happy path", () => {
      it("should schedule a message successfully", async () => {
        fetchMock.mockResolvedValue(mockFetchResponse(mockScheduled));

        const result = await client.messages.schedule({
          to: "+15551234567",
          text: "Scheduled reminder",
          scheduledAt: "2025-01-20T10:00:00Z",
        });

        expect(result).toEqual(mockScheduled);
        expect(fetchMock).toHaveBeenCalledWith(
          expect.stringContaining("/v1/messages/schedule"),
          expect.objectContaining({
            method: "POST",
            body: JSON.stringify({
              to: "+15551234567",
              text: "Scheduled reminder",
              scheduledAt: "2025-01-20T10:00:00Z",
            }),
          }),
        );
      });

      it("should schedule a message with custom sender ID", async () => {
        fetchMock.mockResolvedValue(mockFetchResponse(mockScheduled));

        await client.messages.schedule({
          to: "+15551234567",
          text: "Scheduled reminder",
          scheduledAt: "2025-01-20T10:00:00Z",
          from: "Sendly",
        });

        const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(callBody.from).toBe("Sendly");
      });
    });

    describe("Validation errors", () => {
      it("should throw ValidationError for invalid phone format", async () => {
        await expect(
          client.messages.schedule({
            to: "15551234567",
            text: "Test",
            scheduledAt: "2025-01-20T10:00:00Z",
          }),
        ).rejects.toThrow(ValidationError);
      });

      it("should throw ValidationError for empty text", async () => {
        await expect(
          client.messages.schedule({
            to: "+15551234567",
            text: "",
            scheduledAt: "2025-01-20T10:00:00Z",
          }),
        ).rejects.toThrow(ValidationError);
      });

      it("should throw error for invalid scheduledAt format", async () => {
        await expect(
          client.messages.schedule({
            to: "+15551234567",
            text: "Test",
            scheduledAt: "invalid-date",
          }),
        ).rejects.toThrow("Invalid scheduledAt format");
      });

      it("should throw error for scheduledAt in the past", async () => {
        await expect(
          client.messages.schedule({
            to: "+15551234567",
            text: "Test",
            scheduledAt: "2025-01-14T10:00:00Z", // Yesterday
          }),
        ).rejects.toThrow(
          "scheduledAt must be at least 1 minute in the future",
        );
      });

      it("should throw error for scheduledAt less than 1 minute in future", async () => {
        await expect(
          client.messages.schedule({
            to: "+15551234567",
            text: "Test",
            scheduledAt: "2025-01-15T10:00:30Z", // 30 seconds in future
          }),
        ).rejects.toThrow(
          "scheduledAt must be at least 1 minute in the future",
        );
      });

      it("should accept scheduledAt exactly 1 minute in future", async () => {
        fetchMock.mockResolvedValue(mockFetchResponse(mockScheduled));

        await expect(
          client.messages.schedule({
            to: "+15551234567",
            text: "Test",
            scheduledAt: "2025-01-15T10:01:01Z", // Just over 1 minute
          }),
        ).resolves.toBeDefined();
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
          client.messages.schedule({
            to: "+15551234567",
            text: "Test",
            scheduledAt: "2025-01-20T10:00:00Z",
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
              creditsNeeded: 1,
              currentBalance: 0,
            },
            402,
          ),
        );

        await expect(
          client.messages.schedule({
            to: "+15551234567",
            text: "Test",
            scheduledAt: "2025-01-20T10:00:00Z",
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
          client.messages.schedule({
            to: "+15551234567",
            text: "Test",
            scheduledAt: "2025-01-20T10:00:00Z",
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
          client.messages.schedule({
            to: "+15551234567",
            text: "Test",
            scheduledAt: "2025-01-20T10:00:00Z",
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
          .mockResolvedValueOnce(mockFetchResponse(mockScheduled));

        // Start operation without awaiting (fake timers freeze setTimeout)
        const promise = client.messages.schedule({
          to: "+15551234567",
          text: "Test",
          scheduledAt: "2025-01-20T10:00:00Z",
        });

        // Advance all pending timers to let retry backoff complete
        await vi.runAllTimersAsync();

        const result = await promise;
        expect(result).toEqual(mockScheduled);
      });
    });

    describe("Network error", () => {
      it("should retry on network error", async () => {
        fetchMock
          .mockRejectedValueOnce(new Error("Network error"))
          .mockResolvedValueOnce(mockFetchResponse(mockScheduled));

        // Start operation without awaiting (fake timers freeze setTimeout)
        const promise = client.messages.schedule({
          to: "+15551234567",
          text: "Test",
          scheduledAt: "2025-01-20T10:00:00Z",
        });

        // Advance all pending timers to let retry backoff complete
        await vi.runAllTimersAsync();

        const result = await promise;
        expect(result).toEqual(mockScheduled);
      });
    });
  });

  describe("listScheduled()", () => {
    const mockList: ScheduledMessageListResponse = {
      data: [
        {
          id: "msg_scheduled1",
          to: "+15551234567",
          from: null,
          text: "Message 1",
          status: "scheduled",
          scheduledAt: "2025-01-20T10:00:00Z",
          creditsReserved: 1,
          error: null,
          createdAt: "2025-01-15T10:00:00Z",
          cancelledAt: null,
          sentAt: null,
        },
        {
          id: "msg_scheduled2",
          to: "+15551234568",
          from: null,
          text: "Message 2",
          status: "scheduled",
          scheduledAt: "2025-01-21T10:00:00Z",
          creditsReserved: 1,
          error: null,
          createdAt: "2025-01-15T10:00:00Z",
          cancelledAt: null,
          sentAt: null,
        },
      ],
      count: 2,
    };

    describe("Happy path", () => {
      it("should list scheduled messages with default options", async () => {
        fetchMock.mockResolvedValue(mockFetchResponse(mockList));

        const result = await client.messages.listScheduled();

        expect(result).toEqual(mockList);
        expect(result.data).toHaveLength(2);
        expect(fetchMock).toHaveBeenCalledWith(
          expect.stringContaining("/v1/messages/scheduled"),
          expect.objectContaining({
            method: "GET",
          }),
        );
      });

      it("should list with custom limit", async () => {
        fetchMock.mockResolvedValue(mockFetchResponse(mockList));

        await client.messages.listScheduled({ limit: 10 });

        const url = fetchMock.mock.calls[0][0];
        expect(url).toContain("limit=10");
      });

      it("should list with offset", async () => {
        fetchMock.mockResolvedValue(mockFetchResponse(mockList));

        await client.messages.listScheduled({ limit: 10, offset: 20 });

        const url = fetchMock.mock.calls[0][0];
        expect(url).toContain("offset=20");
      });

      it("should list with status filter", async () => {
        fetchMock.mockResolvedValue(mockFetchResponse(mockList));

        await client.messages.listScheduled({ status: "scheduled" });

        const url = fetchMock.mock.calls[0][0];
        expect(url).toContain("status=scheduled");
      });
    });

    describe("Validation errors", () => {
      it("should throw ValidationError for invalid limit", async () => {
        await expect(
          client.messages.listScheduled({ limit: 0 }),
        ).rejects.toThrow(ValidationError);

        await expect(
          client.messages.listScheduled({ limit: 101 }),
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

        await expect(client.messages.listScheduled()).rejects.toThrow(
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

        await expect(client.messages.listScheduled()).rejects.toThrow(
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
          .mockResolvedValueOnce(mockFetchResponse(mockList));

        const promise = client.messages.listScheduled();
        await vi.runAllTimersAsync();
        const result = await promise;
        expect(result).toEqual(mockList);
      });
    });

    describe("Network error", () => {
      it("should retry on network error", async () => {
        fetchMock
          .mockRejectedValueOnce(new Error("Network error"))
          .mockResolvedValueOnce(mockFetchResponse(mockList));

        const promise = client.messages.listScheduled();
        await vi.runAllTimersAsync();
        const result = await promise;
        expect(result).toEqual(mockList);
      });
    });
  });

  describe("getScheduled()", () => {
    const mockScheduled: ScheduledMessage = {
      id: "msg_scheduled123",
      to: "+15551234567",
      from: null,
      text: "Scheduled reminder",
      status: "scheduled",
      scheduledAt: "2025-01-20T10:00:00Z",
      creditsReserved: 1,
      error: null,
      createdAt: "2025-01-15T10:00:00Z",
      cancelledAt: null,
      sentAt: null,
    };

    describe("Happy path", () => {
      it("should get a scheduled message by ID", async () => {
        fetchMock.mockResolvedValue(mockFetchResponse(mockScheduled));

        const result = await client.messages.getScheduled("msg_scheduled123");

        expect(result).toEqual(mockScheduled);
        expect(fetchMock).toHaveBeenCalledWith(
          expect.stringContaining("/v1/messages/scheduled/msg_scheduled123"),
          expect.objectContaining({
            method: "GET",
          }),
        );
      });
    });

    describe("Validation errors", () => {
      it("should throw ValidationError for empty ID", async () => {
        await expect(client.messages.getScheduled("")).rejects.toThrow(
          ValidationError,
        );
      });

      it("should throw ValidationError for invalid ID format", async () => {
        await expect(
          client.messages.getScheduled("invalid-id"),
        ).rejects.toThrow(ValidationError);
      });
    });

    describe("HTTP 404 - Not found", () => {
      it("should throw NotFoundError for non-existent message", async () => {
        fetchMock.mockResolvedValue(
          mockFetchResponse(
            {
              error: "not_found",
              message: "Scheduled message not found",
            },
            404,
          ),
        );

        await expect(
          client.messages.getScheduled("msg_nonexistent"),
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

        await expect(
          client.messages.getScheduled("msg_scheduled123"),
        ).rejects.toThrow(AuthenticationError);
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
          client.messages.getScheduled("msg_scheduled123"),
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
          .mockResolvedValueOnce(mockFetchResponse(mockScheduled));

        const promise = client.messages.getScheduled("msg_scheduled123");
        await vi.runAllTimersAsync();
        const result = await promise;
        expect(result).toEqual(mockScheduled);
      });
    });

    describe("Network error", () => {
      it("should retry on network error", async () => {
        fetchMock
          .mockRejectedValueOnce(new Error("Network error"))
          .mockResolvedValueOnce(mockFetchResponse(mockScheduled));

        const promise = client.messages.getScheduled("msg_scheduled123");
        await vi.runAllTimersAsync();
        const result = await promise;
        expect(result).toEqual(mockScheduled);
      });
    });
  });

  describe("cancelScheduled()", () => {
    const mockCancelled: CancelledMessageResponse = {
      id: "msg_scheduled123",
      status: "cancelled",
      creditsRefunded: 1,
      cancelledAt: "2025-01-15T10:05:00Z",
    };

    describe("Happy path", () => {
      it("should cancel a scheduled message", async () => {
        fetchMock.mockResolvedValue(mockFetchResponse(mockCancelled));

        const result =
          await client.messages.cancelScheduled("msg_scheduled123");

        expect(result).toEqual(mockCancelled);
        expect(result.status).toBe("cancelled");
        expect(result.creditsRefunded).toBe(1);
        expect(fetchMock).toHaveBeenCalledWith(
          expect.stringContaining("/v1/messages/scheduled/msg_scheduled123"),
          expect.objectContaining({
            method: "DELETE",
          }),
        );
      });
    });

    describe("Validation errors", () => {
      it("should throw ValidationError for empty ID", async () => {
        await expect(client.messages.cancelScheduled("")).rejects.toThrow(
          ValidationError,
        );
      });

      it("should throw ValidationError for invalid ID format", async () => {
        await expect(
          client.messages.cancelScheduled("invalid-id"),
        ).rejects.toThrow(ValidationError);
      });
    });

    describe("HTTP 404 - Not found", () => {
      it("should throw NotFoundError for non-existent message", async () => {
        fetchMock.mockResolvedValue(
          mockFetchResponse(
            {
              error: "not_found",
              message: "Scheduled message not found",
            },
            404,
          ),
        );

        await expect(
          client.messages.cancelScheduled("msg_nonexistent"),
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

        await expect(
          client.messages.cancelScheduled("msg_scheduled123"),
        ).rejects.toThrow(AuthenticationError);
      });
    });

    describe("HTTP 402 - Insufficient credits", () => {
      it("should throw ValidationError for already cancelled message", async () => {
        fetchMock.mockResolvedValue(
          mockFetchResponse(
            {
              error: "invalid_request",
              message: "Message already cancelled",
            },
            400,
          ),
        );

        await expect(
          client.messages.cancelScheduled("msg_scheduled123"),
        ).rejects.toThrow(ValidationError);
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
          client.messages.cancelScheduled("msg_scheduled123"),
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
          .mockResolvedValueOnce(mockFetchResponse(mockCancelled));

        const promise = client.messages.cancelScheduled("msg_scheduled123");
        await vi.runAllTimersAsync();
        const result = await promise;
        expect(result).toEqual(mockCancelled);
      });
    });

    describe("Network error", () => {
      it("should retry on network error", async () => {
        fetchMock
          .mockRejectedValueOnce(new Error("Network error"))
          .mockResolvedValueOnce(mockFetchResponse(mockCancelled));

        const promise = client.messages.cancelScheduled("msg_scheduled123");
        await vi.runAllTimersAsync();
        const result = await promise;
        expect(result).toEqual(mockCancelled);
      });
    });
  });
});
