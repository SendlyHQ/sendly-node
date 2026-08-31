/**
 * Tests for automatic idempotency keys - generation, retry reuse, rotation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Sendly } from "../src/client";
import { ValidationError } from "../src/errors";
import { mockFetchResponse, mockMessage } from "./fixtures/responses";

function keyOfCall(fetchMock: ReturnType<typeof vi.fn>, index: number): string | undefined {
  const headers = fetchMock.mock.calls[index][1].headers as Record<string, string>;
  return headers["Idempotency-Key"];
}

describe("Idempotency keys", () => {
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

  describe("Automatic key generation", () => {
    it("should attach an auto-generated key to POST requests", async () => {
      fetchMock.mockResolvedValue(mockFetchResponse(mockMessage));

      await client.messages.send({ to: "+15551234567", text: "Hello!" });

      const key = keyOfCall(fetchMock, 0);
      expect(key).toMatch(
        /^sendly-node-retry-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
      expect(key!.length).toBeLessThanOrEqual(255);
    });

    it("should not attach a key to GET requests", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse({ data: [], pagination: { total: 0 } }),
      );

      await client.messages.list({ limit: 10 });

      expect(keyOfCall(fetchMock, 0)).toBeUndefined();
    });

    it("should not attach a key to DELETE requests", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse({
          id: "schd_x",
          status: "cancelled",
          creditsRefunded: 1,
        }),
      );

      await client.messages.cancelScheduled(
        "3f8b7c1a-9d4e-4f6a-8b2c-1e5d7a9c3b6f",
      );

      expect(keyOfCall(fetchMock, 0)).toBeUndefined();
    });

    it("should not auto-attach a key to batch sends (server dedupes by content)", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse({
          batchId: "batch_x",
          queued: 1,
          failed: 0,
          creditsUsed: 1,
          messages: [],
        }),
      );

      await client.messages.sendBatch({
        messages: [{ to: "+15551234567", text: "Hi!" }],
      });

      expect(keyOfCall(fetchMock, 0)).toBeUndefined();
    });

    it("should auto-attach a key to media uploads", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse({ id: "med_x", url: "https://cdn.example/x.jpg" }),
      );

      await client.media.upload(Buffer.from("fake-image-bytes"), {
        filename: "x.jpg",
        contentType: "image/jpeg",
      });

      expect(keyOfCall(fetchMock, 0)).toMatch(/^sendly-node-retry-/);
    });

    it("should generate a distinct key for each logical request", async () => {
      fetchMock.mockResolvedValue(mockFetchResponse(mockMessage));

      await client.messages.send({ to: "+15551234567", text: "First" });
      await client.messages.send({ to: "+15551234567", text: "Second" });

      const first = keyOfCall(fetchMock, 0);
      const second = keyOfCall(fetchMock, 1);
      expect(first).toBeDefined();
      expect(second).toBeDefined();
      expect(first).not.toEqual(second);
    });
  });

  describe("Retry behavior", () => {
    it("should reuse the same key when retrying after a timeout", async () => {
      const abortError = new Error("The operation was aborted");
      abortError.name = "AbortError";
      fetchMock
        .mockRejectedValueOnce(abortError)
        .mockResolvedValueOnce(mockFetchResponse(mockMessage));

      const result = await client.messages.send({
        to: "+15551234567",
        text: "Hello!",
      });

      expect(result).toEqual(mockMessage);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(keyOfCall(fetchMock, 0)).toEqual(keyOfCall(fetchMock, 1));
    });

    it("should reuse the same key when retrying after a network error", async () => {
      fetchMock
        .mockRejectedValueOnce(new Error("Network request failed"))
        .mockResolvedValueOnce(mockFetchResponse(mockMessage));

      const result = await client.messages.send({
        to: "+15551234567",
        text: "Hello!",
      });

      expect(result).toEqual(mockMessage);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(keyOfCall(fetchMock, 0)).toEqual(keyOfCall(fetchMock, 1));
    });

    it("should rotate the auto-generated key when retrying after a 5xx response", async () => {
      fetchMock
        .mockResolvedValueOnce(
          mockFetchResponse(
            { error: "internal_error", message: "Internal server error" },
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
      const first = keyOfCall(fetchMock, 0);
      const second = keyOfCall(fetchMock, 1);
      expect(first).toBeDefined();
      expect(second).toBeDefined();
      expect(first).not.toEqual(second);
    });

    it("should keep the rotated key across a subsequent timeout (5xx then timeout)", async () => {
      const abortError = new Error("The operation was aborted");
      abortError.name = "AbortError";
      fetchMock
        .mockResolvedValueOnce(
          mockFetchResponse(
            { error: "internal_error", message: "Internal server error" },
            500,
          ),
        )
        .mockRejectedValueOnce(abortError)
        .mockResolvedValueOnce(mockFetchResponse(mockMessage));

      const result = await client.messages.send({
        to: "+15551234567",
        text: "Hello!",
      });

      expect(result).toEqual(mockMessage);
      expect(fetchMock).toHaveBeenCalledTimes(3);
      const first = keyOfCall(fetchMock, 0);
      const second = keyOfCall(fetchMock, 1);
      const third = keyOfCall(fetchMock, 2);
      expect(second).not.toEqual(first);
      expect(third).toEqual(second);
    });

    it("should keep the key when retrying a non-5xx HTTP error", async () => {
      fetchMock
        .mockResolvedValueOnce(
          mockFetchResponse(
            { error: "conflict", message: "Resource busy" },
            409,
          ),
        )
        .mockResolvedValueOnce(mockFetchResponse(mockMessage));

      const result = await client.messages.send({
        to: "+15551234567",
        text: "Hello!",
      });

      expect(result).toEqual(mockMessage);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(keyOfCall(fetchMock, 0)).toEqual(keyOfCall(fetchMock, 1));
    });

    it("should rotate the auto key on 5xx for media uploads too", async () => {
      fetchMock
        .mockResolvedValueOnce(
          mockFetchResponse(
            { error: "internal_error", message: "Internal server error" },
            502,
          ),
        )
        .mockResolvedValueOnce(
          mockFetchResponse({ id: "med_x", url: "https://cdn.example/x.jpg" }),
        );

      await client.media.upload(Buffer.from("fake-image-bytes"));

      expect(fetchMock).toHaveBeenCalledTimes(2);
      const first = keyOfCall(fetchMock, 0);
      const second = keyOfCall(fetchMock, 1);
      expect(first).toMatch(/^sendly-node-retry-/);
      expect(second).toMatch(/^sendly-node-retry-/);
      expect(first).not.toEqual(second);
    });
  });

  describe("Caller-supplied keys", () => {
    it("should send the caller's key verbatim", async () => {
      fetchMock.mockResolvedValue(mockFetchResponse(mockMessage));

      await client.messages.send(
        { to: "+15551234567", text: "Hello!" },
        { idempotencyKey: "order-4821-shipped" },
      );

      expect(keyOfCall(fetchMock, 0)).toEqual("order-4821-shipped");
    });

    it("should never rotate the caller's key, even across a 5xx retry", async () => {
      fetchMock
        .mockResolvedValueOnce(
          mockFetchResponse(
            { error: "internal_error", message: "Internal server error" },
            500,
          ),
        )
        .mockResolvedValueOnce(mockFetchResponse(mockMessage));

      await client.messages.send(
        { to: "+15551234567", text: "Hello!" },
        { idempotencyKey: "order-4821-shipped" },
      );

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(keyOfCall(fetchMock, 0)).toEqual("order-4821-shipped");
      expect(keyOfCall(fetchMock, 1)).toEqual("order-4821-shipped");
    });

    it("should reuse the caller's key across a timeout retry", async () => {
      const abortError = new Error("The operation was aborted");
      abortError.name = "AbortError";
      fetchMock
        .mockRejectedValueOnce(abortError)
        .mockResolvedValueOnce(mockFetchResponse(mockMessage));

      await client.messages.send(
        { to: "+15551234567", text: "Hello!" },
        { idempotencyKey: "signup-otp-user-99" },
      );

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(keyOfCall(fetchMock, 0)).toEqual("signup-otp-user-99");
      expect(keyOfCall(fetchMock, 1)).toEqual("signup-otp-user-99");
    });

    it("should accept a key on sendBatch", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse({
          batchId: "batch_x",
          queued: 1,
          failed: 0,
          creditsUsed: 1,
          messages: [],
        }),
      );

      await client.messages.sendBatch(
        { messages: [{ to: "+15551234567", text: "Hi!" }] },
        { idempotencyKey: "campaign-77-wave-1" },
      );

      expect(keyOfCall(fetchMock, 0)).toEqual("campaign-77-wave-1");
    });

    it("should accept a key on schedule", async () => {
      const scheduledAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      fetchMock.mockResolvedValue(
        mockFetchResponse({
          id: "schd_x",
          to: "+15551234567",
          text: "Reminder!",
          status: "scheduled",
          scheduledAt,
          createdAt: new Date().toISOString(),
        }),
      );

      await client.messages.schedule(
        { to: "+15551234567", text: "Reminder!", scheduledAt },
        { idempotencyKey: "reminder-visit-31" },
      );

      expect(keyOfCall(fetchMock, 0)).toEqual("reminder-visit-31");
    });

    it("should ignore an empty-string key and still auto-generate", async () => {
      fetchMock.mockResolvedValue(mockFetchResponse(mockMessage));

      await client.messages.send(
        { to: "+15551234567", text: "Hello!" },
        { idempotencyKey: "" },
      );

      expect(keyOfCall(fetchMock, 0)).toMatch(/^sendly-node-retry-/);
    });

    it("should ignore a whitespace-only key and still auto-generate", async () => {
      fetchMock.mockResolvedValue(mockFetchResponse(mockMessage));

      await client.messages.send(
        { to: "+15551234567", text: "Hello!" },
        { idempotencyKey: "   " },
      );

      expect(keyOfCall(fetchMock, 0)).toMatch(/^sendly-node-retry-/);
    });

    it("should reject a non-ASCII key immediately without a network call", async () => {
      await expect(
        client.messages.send(
          { to: "+15551234567", text: "Hello!" },
          { idempotencyKey: "Заказ-42" },
        ),
      ).rejects.toThrow(ValidationError);

      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("should reject a key longer than 255 characters immediately", async () => {
      await expect(
        client.messages.send(
          { to: "+15551234567", text: "Hello!" },
          { idempotencyKey: "k".repeat(256) },
        ),
      ).rejects.toThrow(ValidationError);

      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("should accept a key on the WhatsApp send branch", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse({
          id: "msg_wa",
          channel: "whatsapp",
          to: "+15551234567",
          from: "+15559876543",
          status: "queued",
          whatsapp: { kind: "text" },
        }),
      );

      await client.messages.send(
        {
          channel: "whatsapp",
          to: "+15551234567",
          from: "+15559876543",
          text: "Hello!",
        },
        { idempotencyKey: "wa-hello-1" },
      );

      expect(keyOfCall(fetchMock, 0)).toEqual("wa-hello-1");
    });

    it("should accept a key on the RCS send branch", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse({
          id: "msg_rcs",
          channel: "rcs",
          to: "+15551234567",
          status: "queued",
        }),
      );

      await client.messages.send(
        { channel: "rcs", to: "+15551234567", text: "Hello!" },
        { idempotencyKey: "rcs-hello-1" },
      );

      expect(keyOfCall(fetchMock, 0)).toEqual("rcs-hello-1");
    });

    it("should accept a key on sendGroup", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse({
          id: "msg_x",
          group_message_id: "grp_x",
          to: ["+14155551234", "+14155555678"],
          status: "queued",
        }),
      );

      await client.messages.sendGroup(
        { to: ["+14155551234", "+14155555678"], text: "Team sync at noon" },
        { idempotencyKey: "standup-ping-0823" },
      );

      expect(keyOfCall(fetchMock, 0)).toEqual("standup-ping-0823");
    });
  });
});
