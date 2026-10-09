/**
 * Which failed responses the HTTP client retries
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Sendly } from "../src/client";
import { RateLimitError, SendlyError } from "../src/errors";
import { mockFetchResponse } from "./fixtures/responses";

describe("Retry policy", () => {
  let client: Sendly;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    client = new Sendly({ apiKey: "sk_test_v1_valid_key", maxRetries: 3 });
    fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  async function settle<T>(promise: Promise<T>): Promise<unknown> {
    const outcome = promise.then(
      (value) => ({ value }),
      (error: unknown) => ({ error }),
    );
    await vi.runAllTimersAsync();
    const result = await outcome;
    return "error" in result ? result.error : result.value;
  }

  const final4xx: Array<[number, string, string, () => Promise<unknown>]> = [
    [
      410,
      "expired",
      "Verification code has expired",
      () => client.verify.check("ver_1", { code: "123456" }),
    ],
    [
      429,
      "max_attempts_exceeded",
      "Maximum verification attempts exceeded",
      () => client.verify.check("ver_1", { code: "123456" }),
    ],
    [
      409,
      "conflict",
      "Label with this name already exists",
      () => client.labels.create({ name: "VIP" }),
    ],
    [
      409,
      "conflict",
      "Draft already processed",
      () => client.drafts.approve("drf_1"),
    ],
    [
      422,
      "channel_not_supported",
      "This is a WhatsApp conversation, which reply cannot send yet.",
      () => client.conversations.reply("conv_1", { text: "Hi" }),
    ],
  ];

  for (const [status, code, message, call] of final4xx) {
    it(`surfaces a ${status} ${code} on the first attempt`, async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse({ error: code, message }, status),
      );

      const error = await settle(call());

      expect(error).toBeInstanceOf(SendlyError);
      expect((error as SendlyError).code).toBe(code);
      expect((error as SendlyError).statusCode).toBe(status);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  }

  it("still retries a 503 up to maxRetries", async () => {
    fetchMock.mockResolvedValue(
      mockFetchResponse(
        { error: "internal_error", message: "Service unavailable" },
        503,
      ),
    );

    const error = await settle(client.labels.list());

    expect((error as SendlyError).statusCode).toBe(503);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("still retries a 408 and then succeeds", async () => {
    fetchMock
      .mockResolvedValueOnce(
        mockFetchResponse({ error: "request_timeout", message: "Timeout" }, 408),
      )
      .mockResolvedValueOnce(mockFetchResponse({ data: [] }));

    const result = await settle(client.labels.list());

    expect(result).toEqual({ data: [] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("still retries a network failure", async () => {
    fetchMock
      .mockRejectedValueOnce(new Error("socket hang up"))
      .mockResolvedValueOnce(mockFetchResponse({ data: [] }));

    const result = await settle(client.labels.list());

    expect(result).toEqual({ data: [] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  describe("429s from API key checks", () => {
    const busy = () =>
      mockFetchResponse(
        {
          error: "too_many_concurrent_verifications",
          message:
            "Too many API key checks are already running for this account from this address. Try again in 1 second.",
          retryAfter: 1,
        },
        429,
        { "Retry-After": "1" },
      );

    it("retries a too_many_concurrent_verifications 429 and then succeeds", async () => {
      fetchMock
        .mockResolvedValueOnce(busy())
        .mockResolvedValueOnce(mockFetchResponse({ data: [] }));

      const result = await settle(client.labels.list());

      expect(result).toEqual({ data: [] });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("waits the Retry-After before that retry", async () => {
      fetchMock
        .mockResolvedValueOnce(busy())
        .mockResolvedValueOnce(mockFetchResponse({ data: [] }));

      const pending = client.labels.list();
      await vi.advanceTimersByTimeAsync(999);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      await expect(pending).resolves.toEqual({ data: [] });
    });

    it("keeps the idempotency key on that retry, because the request never ran", async () => {
      fetchMock.mockResolvedValueOnce(busy()).mockResolvedValueOnce(
        mockFetchResponse({ id: "msg_1", status: "queued" }, 201),
      );

      await settle(client.messages.send({ to: "+15551234567", text: "Hi" }));

      const keyOf = (call: number) =>
        new Headers(fetchMock.mock.calls[call][1].headers).get("Idempotency-Key");
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(keyOf(1)).toBe(keyOf(0));
    });

    it("raises a RateLimitError once maxRetries run out", async () => {
      fetchMock.mockImplementation(async () => busy());

      const error = await settle(client.labels.list());

      expect(error).toBeInstanceOf(RateLimitError);
      expect((error as RateLimitError).code).toBe("too_many_concurrent_verifications");
      expect((error as RateLimitError).retryAfter).toBe(1);
      expect(fetchMock).toHaveBeenCalledTimes(4);
    });

    it("does not wait out a busy 429 whose Retry-After is over a minute", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse(
          {
            error: "too_many_concurrent_verifications",
            message: "Too many API key checks are already running.",
            retryAfter: 120,
          },
          429,
          { "Retry-After": "120" },
        ),
      );

      const error = await settle(client.labels.list());

      expect((error as RateLimitError).code).toBe("too_many_concurrent_verifications");
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("raises a too_many_failed_key_attempts 429 on the first attempt as a RateLimitError", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse(
          {
            error: "too_many_failed_key_attempts",
            message: "Too many failed API key attempts. Try again in 240 seconds.",
            retryAfter: 240,
          },
          429,
          { "Retry-After": "240" },
        ),
      );

      const error = await settle(client.labels.list());

      expect(error).toBeInstanceOf(RateLimitError);
      expect((error as RateLimitError).code).toBe("too_many_failed_key_attempts");
      expect((error as RateLimitError).retryAfter).toBe(240);
      expect((error as RateLimitError).message).toBe(
        "Too many failed API key attempts. Try again in 240 seconds.",
      );
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("still raises an ordinary rate_limit_exceeded on the first attempt", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse(
          {
            error: "rate_limit_exceeded",
            message: "Rate limit exceeded. Limit: 60 requests per minute.",
            retryAfter: 42,
          },
          429,
          { "Retry-After": "42" },
        ),
      );

      const error = await settle(client.labels.list());

      expect(error).toBeInstanceOf(RateLimitError);
      expect((error as RateLimitError).code).toBe("rate_limit_exceeded");
      expect((error as RateLimitError).retryAfter).toBe(42);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("multipart uploads", () => {
    const file = Buffer.from("fake-image");

    it("surfaces a 409 upgrade_in_progress on the first attempt", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse(
          {
            error: "upgrade_in_progress",
            message:
              "An upgrade is already pending for this workspace. Cancel or resolve it first.",
            pendingVerificationId: "bv_1",
          },
          409,
        ),
      );

      const error = await settle(
        client.businessUpgrade.start(
          "org_1",
          {
            businessName: "Acme LLC",
            brn: "12-3456789",
            brnType: "EIN",
            brnCountry: "US",
            entityType: "PRIVATE_PROFIT",
          },
          { einDoc: { buffer: Buffer.from("%PDF-1.4") } },
        ),
      );

      expect((error as SendlyError).code).toBe("upgrade_in_progress");
      expect((error as SendlyError).statusCode).toBe(409);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("does not retry a response that is not JSON", async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "Content-Type": "text/html" }),
        text: async () => "<html>proxy</html>",
      } as unknown as Response);

      const error = await settle(client.media.upload(file, { contentType: "image/png" }));

      expect((error as SendlyError).code).toBe("invalid_response");
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it.each([
      [413, "file_too_large", 'The file in field "file" is too large.'],
      [415, "unsupported_media_type", "Only JPEG, PNG, and GIF images are allowed for MMS"],
    ])("does not retry a %i upload refusal, and keeps its code and reason", async (status, code, message) => {
      fetchMock.mockResolvedValue(mockFetchResponse({ error: code, message }, status));

      const error = await settle(client.media.upload(file, { contentType: "image/webp" }));

      expect(error).toBeInstanceOf(SendlyError);
      expect((error as SendlyError).code).toBe(code);
      expect((error as SendlyError).statusCode).toBe(status);
      expect((error as SendlyError).message).toBe(message);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("retries a busy key-check 429 after its Retry-After, with the same key", async () => {
      fetchMock
        .mockResolvedValueOnce(
          mockFetchResponse(
            {
              error: "too_many_concurrent_verifications",
              message:
                "Too many API key checks are already running for this account from this address. Try again in 1 second.",
              retryAfter: 1,
            },
            429,
            { "Retry-After": "1" },
          ),
        )
        .mockResolvedValueOnce(
          mockFetchResponse({ id: "med_1", url: "https://cdn.example/1.png" }),
        );

      const pending = client.media.upload(file, { contentType: "image/png" });
      await vi.advanceTimersByTimeAsync(999);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      await expect(pending).resolves.toMatchObject({ id: "med_1" });

      const keyOf = (call: number) =>
        new Headers(fetchMock.mock.calls[call][1].headers).get("Idempotency-Key");
      expect(keyOf(1)).toBe(keyOf(0));
    });

    it("keeps the upload's idempotency key when it retries a 5xx", async () => {
      fetchMock
        .mockResolvedValueOnce(
          mockFetchResponse({ error: "internal_error", message: "Bad gateway" }, 502),
        )
        .mockResolvedValueOnce(
          mockFetchResponse({ id: "med_1", url: "https://cdn.example/1.png" }),
        );

      await settle(client.media.upload(file, { contentType: "image/png" }));

      const keyOf = (call: number) =>
        new Headers(fetchMock.mock.calls[call][1].headers).get("Idempotency-Key");
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(keyOf(1)).toBe(keyOf(0));
    });

    it("still retries a 502 from the API", async () => {
      fetchMock
        .mockResolvedValueOnce(
          mockFetchResponse({ error: "internal_error", message: "Bad gateway" }, 502),
        )
        .mockResolvedValueOnce(
          mockFetchResponse({ id: "med_1", url: "https://cdn.example/1.png" }),
        );

      const result = await settle(client.media.upload(file, { contentType: "image/png" }));

      expect(result).toMatchObject({ id: "med_1" });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });
});
