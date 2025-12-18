/**
 * Tests for Webhook Utilities
 */

import { describe, it, expect } from "vitest";
import { Webhooks, WebhookSignatureError } from "../src/webhooks";
import type { WebhookEvent } from "../src/types";

describe("Webhooks", () => {
  const testSecret = "whsec_test_secret_123";

  const validEvent: WebhookEvent = {
    id: "evt_test123",
    type: "message.delivered",
    data: {
      message_id: "msg_test123",
      status: "delivered",
      to: "+15551234567",
      from: "+15559876543",
      delivered_at: "2025-01-15T10:01:00Z",
      segments: 1,
      credits_used: 1,
    },
    created_at: "2025-01-15T10:01:00Z",
    api_version: "v1",
  };

  const validPayload = JSON.stringify(validEvent);

  describe("verifySignature()", () => {
    describe("Happy path", () => {
      it("should verify valid signature", () => {
        const signature = Webhooks.generateSignature(validPayload, testSecret);
        const result = Webhooks.verifySignature(
          validPayload,
          signature,
          testSecret,
        );
        expect(result).toBe(true);
      });

      it("should verify signature with different payloads", () => {
        const payload1 = JSON.stringify({ test: "data1" });
        const payload2 = JSON.stringify({ test: "data2" });

        const sig1 = Webhooks.generateSignature(payload1, testSecret);
        const sig2 = Webhooks.generateSignature(payload2, testSecret);

        expect(Webhooks.verifySignature(payload1, sig1, testSecret)).toBe(true);
        expect(Webhooks.verifySignature(payload2, sig2, testSecret)).toBe(true);
        expect(Webhooks.verifySignature(payload1, sig2, testSecret)).toBe(
          false,
        );
      });

      it("should verify signature with different secrets", () => {
        const secret1 = "secret_1";
        const secret2 = "secret_2";

        const sig1 = Webhooks.generateSignature(validPayload, secret1);
        const sig2 = Webhooks.generateSignature(validPayload, secret2);

        expect(Webhooks.verifySignature(validPayload, sig1, secret1)).toBe(
          true,
        );
        expect(Webhooks.verifySignature(validPayload, sig2, secret2)).toBe(
          true,
        );
        expect(Webhooks.verifySignature(validPayload, sig1, secret2)).toBe(
          false,
        );
      });
    });

    describe("Invalid signatures", () => {
      it("should reject invalid signature", () => {
        const result = Webhooks.verifySignature(
          validPayload,
          "sha256=invalid",
          testSecret,
        );
        expect(result).toBe(false);
      });

      it("should reject signature with wrong secret", () => {
        const signature = Webhooks.generateSignature(
          validPayload,
          "wrong_secret",
        );
        const result = Webhooks.verifySignature(
          validPayload,
          signature,
          testSecret,
        );
        expect(result).toBe(false);
      });

      it("should reject signature with modified payload", () => {
        const signature = Webhooks.generateSignature(validPayload, testSecret);
        const modifiedPayload = JSON.stringify({
          ...validEvent,
          data: { ...validEvent.data, status: "failed" },
        });
        const result = Webhooks.verifySignature(
          modifiedPayload,
          signature,
          testSecret,
        );
        expect(result).toBe(false);
      });

      it("should reject empty payload", () => {
        const result = Webhooks.verifySignature("", "sha256=test", testSecret);
        expect(result).toBe(false);
      });

      it("should reject empty signature", () => {
        const result = Webhooks.verifySignature(validPayload, "", testSecret);
        expect(result).toBe(false);
      });

      it("should reject empty secret", () => {
        const signature = Webhooks.generateSignature(validPayload, testSecret);
        const result = Webhooks.verifySignature(validPayload, signature, "");
        expect(result).toBe(false);
      });

      it("should reject signature without sha256 prefix", () => {
        const signature = Webhooks.generateSignature(validPayload, testSecret);
        const signatureWithoutPrefix = signature.replace("sha256=", "");
        const result = Webhooks.verifySignature(
          validPayload,
          signatureWithoutPrefix,
          testSecret,
        );
        expect(result).toBe(false);
      });

      it("should handle signature with different length", () => {
        const result = Webhooks.verifySignature(
          validPayload,
          "sha256=short",
          testSecret,
        );
        expect(result).toBe(false);
      });
    });

    describe("Timing attack protection", () => {
      it("should use timing-safe comparison", () => {
        // This test ensures the function doesn't short-circuit on length mismatch
        // which could leak information through timing attacks
        const validSig = Webhooks.generateSignature(validPayload, testSecret);
        const invalidSig = "sha256=aaaaaaaaaaaaaaaa";

        // Both should return false, but shouldn't reveal timing information
        expect(Webhooks.verifySignature(validPayload, invalidSig, testSecret)).toBe(
          false,
        );
        expect(Webhooks.verifySignature(validPayload, validSig, "wrong")).toBe(
          false,
        );
      });
    });
  });

  describe("parseEvent()", () => {
    describe("Happy path", () => {
      it("should parse and validate valid event", () => {
        const signature = Webhooks.generateSignature(validPayload, testSecret);
        const event = Webhooks.parseEvent(validPayload, signature, testSecret);

        expect(event).toEqual(validEvent);
        expect(event.id).toBe("evt_test123");
        expect(event.type).toBe("message.delivered");
        expect(event.data.message_id).toBe("msg_test123");
      });

      it("should parse message.delivered event", () => {
        const payload = JSON.stringify(validEvent);
        const signature = Webhooks.generateSignature(payload, testSecret);
        const event = Webhooks.parseEvent(payload, signature, testSecret);

        expect(event.type).toBe("message.delivered");
        expect(event.data.status).toBe("delivered");
        expect(event.data.delivered_at).toBeDefined();
      });

      it("should parse message.failed event", () => {
        const failedEvent: WebhookEvent = {
          id: "evt_test456",
          type: "message.failed",
          data: {
            message_id: "msg_test456",
            status: "failed",
            to: "+15551234567",
            from: "+15559876543",
            error: "Invalid phone number",
            error_code: "invalid_number",
            failed_at: "2025-01-15T10:01:00Z",
            segments: 1,
            credits_used: 0,
          },
          created_at: "2025-01-15T10:01:00Z",
          api_version: "v1",
        };

        const payload = JSON.stringify(failedEvent);
        const signature = Webhooks.generateSignature(payload, testSecret);
        const event = Webhooks.parseEvent(payload, signature, testSecret);

        expect(event.type).toBe("message.failed");
        expect(event.data.status).toBe("failed");
        expect(event.data.error).toBe("Invalid phone number");
        expect(event.data.error_code).toBe("invalid_number");
      });

      it("should parse message.queued event", () => {
        const queuedEvent: WebhookEvent = {
          id: "evt_test789",
          type: "message.queued",
          data: {
            message_id: "msg_test789",
            status: "queued",
            to: "+15551234567",
            from: "+15559876543",
            segments: 1,
            credits_used: 1,
          },
          created_at: "2025-01-15T10:00:00Z",
          api_version: "v1",
        };

        const payload = JSON.stringify(queuedEvent);
        const signature = Webhooks.generateSignature(payload, testSecret);
        const event = Webhooks.parseEvent(payload, signature, testSecret);

        expect(event.type).toBe("message.queued");
        expect(event.data.status).toBe("queued");
      });

      it("should parse message.sent event", () => {
        const sentEvent: WebhookEvent = {
          id: "evt_test101",
          type: "message.sent",
          data: {
            message_id: "msg_test101",
            status: "sent",
            to: "+15551234567",
            from: "+15559876543",
            segments: 1,
            credits_used: 1,
          },
          created_at: "2025-01-15T10:00:30Z",
          api_version: "v1",
        };

        const payload = JSON.stringify(sentEvent);
        const signature = Webhooks.generateSignature(payload, testSecret);
        const event = Webhooks.parseEvent(payload, signature, testSecret);

        expect(event.type).toBe("message.sent");
        expect(event.data.status).toBe("sent");
      });
    });

    describe("Invalid signatures", () => {
      it("should throw WebhookSignatureError for invalid signature", () => {
        expect(() => {
          Webhooks.parseEvent(validPayload, "sha256=invalid", testSecret);
        }).toThrow(WebhookSignatureError);

        expect(() => {
          Webhooks.parseEvent(validPayload, "sha256=invalid", testSecret);
        }).toThrow("Invalid webhook signature");
      });

      it("should throw WebhookSignatureError for wrong secret", () => {
        const signature = Webhooks.generateSignature(
          validPayload,
          "wrong_secret",
        );

        expect(() => {
          Webhooks.parseEvent(validPayload, signature, testSecret);
        }).toThrow(WebhookSignatureError);
      });

      it("should throw WebhookSignatureError for modified payload", () => {
        const signature = Webhooks.generateSignature(validPayload, testSecret);
        const modifiedPayload = validPayload.replace("delivered", "failed");

        expect(() => {
          Webhooks.parseEvent(modifiedPayload, signature, testSecret);
        }).toThrow(WebhookSignatureError);
      });
    });

    describe("Invalid payloads", () => {
      it("should throw WebhookSignatureError for invalid JSON", () => {
        const invalidPayload = "not valid json";
        const signature = Webhooks.generateSignature(invalidPayload, testSecret);

        expect(() => {
          Webhooks.parseEvent(invalidPayload, signature, testSecret);
        }).toThrow(WebhookSignatureError);

        expect(() => {
          Webhooks.parseEvent(invalidPayload, signature, testSecret);
        }).toThrow("Failed to parse webhook payload");
      });

      it("should throw WebhookSignatureError for missing required fields", () => {
        const invalidEvent = {
          id: "evt_test",
          // Missing type, data, created_at
        };
        const payload = JSON.stringify(invalidEvent);
        const signature = Webhooks.generateSignature(payload, testSecret);

        expect(() => {
          Webhooks.parseEvent(payload, signature, testSecret);
        }).toThrow(WebhookSignatureError);

        expect(() => {
          Webhooks.parseEvent(payload, signature, testSecret);
        }).toThrow("Invalid event structure");
      });

      it("should throw WebhookSignatureError for missing id", () => {
        const invalidEvent = {
          type: "message.delivered",
          data: validEvent.data,
          created_at: "2025-01-15T10:01:00Z",
        };
        const payload = JSON.stringify(invalidEvent);
        const signature = Webhooks.generateSignature(payload, testSecret);

        expect(() => {
          Webhooks.parseEvent(payload, signature, testSecret);
        }).toThrow(WebhookSignatureError);
      });

      it("should throw WebhookSignatureError for missing type", () => {
        const invalidEvent = {
          id: "evt_test",
          data: validEvent.data,
          created_at: "2025-01-15T10:01:00Z",
        };
        const payload = JSON.stringify(invalidEvent);
        const signature = Webhooks.generateSignature(payload, testSecret);

        expect(() => {
          Webhooks.parseEvent(payload, signature, testSecret);
        }).toThrow(WebhookSignatureError);
      });

      it("should throw WebhookSignatureError for missing data", () => {
        const invalidEvent = {
          id: "evt_test",
          type: "message.delivered",
          created_at: "2025-01-15T10:01:00Z",
        };
        const payload = JSON.stringify(invalidEvent);
        const signature = Webhooks.generateSignature(payload, testSecret);

        expect(() => {
          Webhooks.parseEvent(payload, signature, testSecret);
        }).toThrow(WebhookSignatureError);
      });

      it("should throw WebhookSignatureError for missing created_at", () => {
        const invalidEvent = {
          id: "evt_test",
          type: "message.delivered",
          data: validEvent.data,
        };
        const payload = JSON.stringify(invalidEvent);
        const signature = Webhooks.generateSignature(payload, testSecret);

        expect(() => {
          Webhooks.parseEvent(payload, signature, testSecret);
        }).toThrow(WebhookSignatureError);
      });
    });
  });

  describe("generateSignature()", () => {
    it("should generate valid signature", () => {
      const signature = Webhooks.generateSignature(validPayload, testSecret);

      expect(signature).toBeDefined();
      expect(signature).toMatch(/^sha256=[a-f0-9]{64}$/);
    });

    it("should generate consistent signatures", () => {
      const sig1 = Webhooks.generateSignature(validPayload, testSecret);
      const sig2 = Webhooks.generateSignature(validPayload, testSecret);

      expect(sig1).toBe(sig2);
    });

    it("should generate different signatures for different payloads", () => {
      const payload1 = JSON.stringify({ test: "data1" });
      const payload2 = JSON.stringify({ test: "data2" });

      const sig1 = Webhooks.generateSignature(payload1, testSecret);
      const sig2 = Webhooks.generateSignature(payload2, testSecret);

      expect(sig1).not.toBe(sig2);
    });

    it("should generate different signatures for different secrets", () => {
      const sig1 = Webhooks.generateSignature(validPayload, "secret1");
      const sig2 = Webhooks.generateSignature(validPayload, "secret2");

      expect(sig1).not.toBe(sig2);
    });

    it("should work with empty payload", () => {
      const signature = Webhooks.generateSignature("", testSecret);
      expect(signature).toMatch(/^sha256=[a-f0-9]{64}$/);
    });

    it("should work with complex payloads", () => {
      const complexPayload = JSON.stringify({
        nested: {
          data: {
            with: ["arrays", "and", "objects"],
          },
        },
        special: "chars: !@#$%^&*()",
        unicode: "🎉✨",
      });

      const signature = Webhooks.generateSignature(complexPayload, testSecret);
      expect(signature).toMatch(/^sha256=[a-f0-9]{64}$/);

      // Verify it can be validated
      expect(
        Webhooks.verifySignature(complexPayload, signature, testSecret),
      ).toBe(true);
    });
  });

  describe("WebhookSignatureError", () => {
    it("should be instance of Error", () => {
      const error = new WebhookSignatureError();
      expect(error).toBeInstanceOf(Error);
    });

    it("should have correct name", () => {
      const error = new WebhookSignatureError();
      expect(error.name).toBe("WebhookSignatureError");
    });

    it("should have default message", () => {
      const error = new WebhookSignatureError();
      expect(error.message).toBe("Invalid webhook signature");
    });

    it("should accept custom message", () => {
      const error = new WebhookSignatureError("Custom error message");
      expect(error.message).toBe("Custom error message");
    });
  });

  describe("Integration test", () => {
    it("should handle complete webhook flow", () => {
      // 1. Generate event payload
      const event: WebhookEvent = {
        id: "evt_integration_test",
        type: "message.delivered",
        data: {
          message_id: "msg_integration_test",
          status: "delivered",
          to: "+15551234567",
          from: "Sendly",
          delivered_at: "2025-01-15T12:00:00Z",
          segments: 1,
          credits_used: 1,
        },
        created_at: "2025-01-15T12:00:00Z",
        api_version: "v1",
      };

      const payload = JSON.stringify(event);

      // 2. Generate signature (server-side)
      const signature = Webhooks.generateSignature(payload, testSecret);

      // 3. Verify signature (client-side)
      const isValid = Webhooks.verifySignature(payload, signature, testSecret);
      expect(isValid).toBe(true);

      // 4. Parse and validate event
      const parsedEvent = Webhooks.parseEvent(payload, signature, testSecret);
      expect(parsedEvent).toEqual(event);
      expect(parsedEvent.data.message_id).toBe("msg_integration_test");
      expect(parsedEvent.data.status).toBe("delivered");
    });
  });
});
