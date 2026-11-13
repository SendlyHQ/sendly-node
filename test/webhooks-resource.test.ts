/**
 * Tests for the Webhooks resource against the bodies the API sends
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Sendly } from "../src/client";
import { SendlyError, ValidationError } from "../src/errors";
import type {
  WebhookDelivery,
  WebhookRecoveryPreview,
  WebhookSecretRotation,
  WebhookTestResult,
} from "../src/types";
import { mockFetchResponse } from "./fixtures/responses";

describe("Webhooks resource", () => {
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

  describe("getDeliveries()", () => {
    const delivery = {
      id: "del_1",
      webhook_id: "whk_1",
      event_type: "message.delivered",
      status: "delivered",
      success: true,
      response_status_code: 200,
      http_status: 200,
      response_time: 84,
      response_time_ms: 84,
      response_body: "ok",
      error_message: null,
      error_code: null,
      attempt_number: 1,
      max_attempts: 6,
      next_retry_at: null,
      created_at: "2026-09-24T10:00:00.000Z",
      delivered_at: "2026-09-24T10:00:00.084Z",
    };

    it("unwraps the deliveries envelope", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse({
          deliveries: [delivery, { ...delivery, id: "del_2", attempt_number: 2 }],
          pagination: { limit: 50, offset: 0 },
        }),
      );

      const deliveries: WebhookDelivery[] =
        await client.webhooks.getDeliveries("whk_1");

      expect(deliveries).toHaveLength(2);
      expect(deliveries[0].webhookId).toBe("whk_1");
      expect(deliveries[0].eventType).toBe("message.delivered");
      expect(deliveries[0].attemptNumber).toBe(1);
      expect(deliveries[0].responseTimeMs).toBe(84);
      expect(deliveries[0].success).toBe(true);
      expect(deliveries[0].httpStatus).toBe(200);
      expect(deliveries[0].responseBody).toBe("ok");
      expect(deliveries[1].attemptNumber).toBe(2);
    });

    it("reads event_id once the server sends it", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse({
          deliveries: [{ ...delivery, event_id: "evt_abc" }],
          pagination: { limit: 50, offset: 0 },
        }),
      );

      const [first] = await client.webhooks.getDeliveries("whk_1");

      expect(first.eventId).toBe("evt_abc");
    });

    it("sends limit, offset and status", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse({ deliveries: [], pagination: { limit: 20, offset: 50 } }),
      );

      const result = await client.webhooks.getDeliveries("whk_1", {
        limit: 20,
        offset: 50,
        status: "failed",
      });

      expect(result).toEqual([]);
      const url = new URL(fetchMock.mock.calls[0][0]);
      expect(url.pathname).toBe("/api/v1/webhooks/whk_1/deliveries");
      expect(url.searchParams.get("limit")).toBe("20");
      expect(url.searchParams.get("offset")).toBe("50");
      expect(url.searchParams.get("status")).toBe("failed");
    });
  });

  describe("listEventTypes()", () => {
    const wire = {
      events: [
        {
          type: "message.delivered",
          description: "Message has been successfully delivered to the recipient",
        },
        { type: "message.failed", description: "Message delivery failed permanently" },
      ],
    };

    it("returns the event type names", async () => {
      fetchMock.mockResolvedValue(mockFetchResponse(wire));

      const types = await client.webhooks.listEventTypes();

      expect(types).toEqual(["message.delivered", "message.failed"]);
      expect(fetchMock.mock.calls[0][0]).toContain("/v1/webhooks/event-types");
    });

    it("listEventTypeDetails returns each type with its description", async () => {
      fetchMock.mockResolvedValue(mockFetchResponse(wire));

      const details = await client.webhooks.listEventTypeDetails();

      expect(details).toEqual(wire.events);
      expect(details[0].description).toBe(
        "Message has been successfully delivered to the recipient",
      );
    });
  });

  describe("test()", () => {
    it("reads the status code and response time from the delivery", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse({
          success: true,
          message: "Test webhook delivered successfully in 120ms",
          delivery: {
            id: "del_t",
            delivery_id: "del_t",
            webhook_url: "https://example.com/hooks",
            event_type: "webhook.test",
            status: "delivered",
            response_time: 120,
            status_code: 200,
            response_body: "ok",
            delivered_at: "2026-09-25T10:00:00.000Z",
          },
        }),
      );

      const result: WebhookTestResult = await client.webhooks.test("whk_1");

      expect(result.success).toBe(true);
      expect(result.statusCode).toBe(200);
      expect(result.responseTimeMs).toBe(120);
      expect(result.message).toBe("Test webhook delivered successfully in 120ms");
      expect(result.delivery?.id).toBe("del_t");
    });

    it("still throws when the test delivery fails", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse(
          {
            success: false,
            message: "Test webhook failed: Connection refused",
          },
          400,
        ),
      );

      const error = await client.webhooks.test("whk_1").catch((e: unknown) => e);

      expect(error).toBeInstanceOf(SendlyError);
      expect((error as SendlyError).message).toBe(
        "Test webhook failed: Connection refused",
      );
      expect((error as SendlyError).statusCode).toBe(400);
    });
  });

  describe("webhook URL checks", () => {
    it("create() rejects a URL that is not https:// with a ValidationError before any request", async () => {
      const plain = await client.webhooks
        .create({ url: "http://localhost:3000/webhooks", events: ["message.delivered"] })
        .catch((e: unknown) => e);

      expect(plain).toBeInstanceOf(ValidationError);
      expect((plain as ValidationError).message).toBe("Webhook URL must be HTTPS");
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("create() without a URL or events throws a ValidationError before any request", async () => {
      const noUrl = await client.webhooks
        .create({ url: "", events: ["message.delivered"] })
        .catch((e: unknown) => e);
      const noEvents = await client.webhooks
        .create({ url: "https://example.com/hooks", events: [] })
        .catch((e: unknown) => e);

      expect(noUrl).toBeInstanceOf(ValidationError);
      expect(noEvents).toBeInstanceOf(ValidationError);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("update() rejects a URL that is not https:// with a ValidationError before any request", async () => {
      const plain = await client.webhooks
        .update("whk_1", { url: "http://127.0.0.1:8080/hook" })
        .catch((e: unknown) => e);

      expect(plain).toBeInstanceOf(ValidationError);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("rotateSecret()", () => {
    it("returns the new secret and when it was rotated", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse({
          success: true,
          id: "whk_1",
          secret: "whsec_new",
          new_secret: "whsec_new",
          new_secret_version: 3,
          grace_period_hours: 24,
          rotated_at: "2026-09-25T10:00:00.000Z",
          message:
            "Webhook secret rotated successfully. Save this secret - it won't be shown again.",
        }),
      );

      const rotation: WebhookSecretRotation =
        await client.webhooks.rotateSecret("whk_1");

      expect(rotation.newSecret).toBe("whsec_new");
      expect(rotation.secret).toBe("whsec_new");
      expect(rotation.newSecretVersion).toBe(3);
      expect(rotation.rotatedAt).toBe("2026-09-25T10:00:00.000Z");
      expect(rotation.gracePeriodHours).toBe(24);
      expect(rotation.webhook).toBeUndefined();
    });
  });

  describe("recoveryPreview()", () => {
    const preview = {
      circuitState: "open",
      circuitOpenedAt: "2026-09-24T08:00:00.000Z",
      failureCount: 12,
      auditFailures: {
        total: 3,
        byStatus: { failed: 2, cancelled: 1 },
        byEventType: { "message.delivered": 2, "message.opt_out": 1 },
      },
      missingFromMessages: {
        total: 4,
        byEventType: { "message.sent": 4 },
      },
      histogram: [
        { bucket: "2026-09-24T08:00:00.000Z", missing: 4, failed: 3 },
      ],
      samples: [
        {
          id: "msg_1",
          toMasked: "+1555***4567",
          eventType: "message.delivered",
          occurredAt: "2026-09-24T08:30:00.000Z",
        },
      ],
      windowSuggestion: {
        since: "2026-09-24T08:00:00.000Z",
        until: "2026-09-24T10:00:00.000Z",
      },
      since: "2026-09-23T10:00:00.000Z",
      until: "2026-09-24T10:00:00.000Z",
    };

    it("sends since, until and comma-separated event_types and keeps the camelCase keys", async () => {
      fetchMock.mockResolvedValue(mockFetchResponse(preview));

      const result: WebhookRecoveryPreview = await client.webhooks.recoveryPreview(
        "whk_1",
        {
          since: "2026-09-23T10:00:00.000Z",
          until: "2026-09-24T10:00:00.000Z",
          eventTypes: ["message.delivered", "message.failed"],
        },
      );

      const [calledUrl, init] = fetchMock.mock.calls[0];
      const url = new URL(calledUrl);
      expect(init.method).toBe("GET");
      expect(url.pathname).toBe("/api/v1/webhooks/whk_1/recovery-preview");
      expect(url.searchParams.get("since")).toBe("2026-09-23T10:00:00.000Z");
      expect(url.searchParams.get("until")).toBe("2026-09-24T10:00:00.000Z");
      expect(url.searchParams.get("event_types")).toBe(
        "message.delivered,message.failed",
      );

      expect(result.circuitState).toBe("open");
      expect(result.circuitOpenedAt).toBe("2026-09-24T08:00:00.000Z");
      expect(result.failureCount).toBe(12);
      expect(result.auditFailures.byStatus.cancelled).toBe(1);
      expect(result.auditFailures.byEventType["message.opt_out"]).toBe(1);
      expect(result.missingFromMessages.total).toBe(4);
      expect(result.histogram[0].missing).toBe(4);
      expect(result.samples[0].toMasked).toBe("+1555***4567");
      expect(result.windowSuggestion?.since).toBe("2026-09-24T08:00:00.000Z");
    });

    it("sends no query when no options are given", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse({ ...preview, circuitOpenedAt: null, windowSuggestion: null }),
      );

      const result = await client.webhooks.recoveryPreview("whk_1");

      const url = new URL(fetchMock.mock.calls[0][0]);
      expect(url.search).toBe("");
      expect(result.windowSuggestion).toBeNull();
    });

    it("rejects an id that is not whk_ prefixed before any request", async () => {
      await expect(client.webhooks.recoveryPreview("bad")).rejects.toThrow(
        "Invalid webhook ID format",
      );
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
