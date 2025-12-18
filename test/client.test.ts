/**
 * Tests for Sendly Client
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { Sendly } from "../src/client";
import type { SendlyConfig } from "../src/types";

describe("Sendly Client", () => {
  describe("Constructor", () => {
    it("should initialize with API key string", () => {
      const client = new Sendly("sk_test_v1_valid_key");
      expect(client).toBeInstanceOf(Sendly);
      expect(client.isTestMode()).toBe(true);
    });

    it("should initialize with config object", () => {
      const config: SendlyConfig = {
        apiKey: "sk_live_v1_valid_key",
        baseUrl: "https://custom.api.com",
        timeout: 60000,
        maxRetries: 5,
      };
      const client = new Sendly(config);
      expect(client).toBeInstanceOf(Sendly);
      expect(client.isTestMode()).toBe(false);
      expect(client.getBaseUrl()).toBe("https://custom.api.com");
    });

    it("should use default values when not provided", () => {
      const client = new Sendly("sk_test_v1_valid_key");
      expect(client.getBaseUrl()).toBe("https://sendly.live/api");
    });

    it("should throw error for invalid API key format", () => {
      expect(() => new Sendly("invalid_key")).toThrow(
        "Invalid API key format",
      );
    });

    it("should throw error for empty API key", () => {
      expect(() => new Sendly("")).toThrow("Invalid API key format");
    });

    it("should throw error for API key without version", () => {
      expect(() => new Sendly("sk_test_invalid")).toThrow(
        "Invalid API key format",
      );
    });

    it("should throw error for API key with wrong prefix", () => {
      expect(() => new Sendly("pk_test_v1_invalid")).toThrow(
        "Invalid API key format",
      );
    });

    it("should throw error for non-HTTPS baseUrl in production", () => {
      expect(
        () =>
          new Sendly({
            apiKey: "sk_live_v1_valid_key",
            baseUrl: "http://api.example.com",
          }),
      ).toThrow("API key must only be transmitted over HTTPS");
    });

    it("should allow localhost with HTTP", () => {
      expect(
        () =>
          new Sendly({
            apiKey: "sk_test_v1_valid_key",
            baseUrl: "http://localhost:3000",
          }),
      ).not.toThrow();
    });

    it("should allow 127.0.0.1 with HTTP", () => {
      expect(
        () =>
          new Sendly({
            apiKey: "sk_test_v1_valid_key",
            baseUrl: "http://127.0.0.1:3000",
          }),
      ).not.toThrow();
    });
  });

  describe("isTestMode()", () => {
    it("should return true for test API key", () => {
      const client = new Sendly("sk_test_v1_valid_key");
      expect(client.isTestMode()).toBe(true);
    });

    it("should return false for live API key", () => {
      const client = new Sendly("sk_live_v1_valid_key");
      expect(client.isTestMode()).toBe(false);
    });
  });

  describe("getBaseUrl()", () => {
    it("should return configured base URL", () => {
      const client = new Sendly({
        apiKey: "sk_test_v1_valid_key",
        baseUrl: "https://custom.api.com",
      });
      expect(client.getBaseUrl()).toBe("https://custom.api.com");
    });

    it("should return default base URL", () => {
      const client = new Sendly("sk_test_v1_valid_key");
      expect(client.getBaseUrl()).toBe("https://sendly.live/api");
    });
  });

  describe("getRateLimitInfo()", () => {
    it("should return undefined before any requests", () => {
      const client = new Sendly("sk_test_v1_valid_key");
      expect(client.getRateLimitInfo()).toBeUndefined();
    });

    it("should return rate limit info after a request", async () => {
      const client = new Sendly("sk_test_v1_valid_key");

      // Mock fetch
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({
          "Content-Type": "application/json",
          "X-RateLimit-Limit": "100",
          "X-RateLimit-Remaining": "95",
          "X-RateLimit-Reset": "3600",
        }),
        json: async () => ({
          id: "msg_test",
          to: "+15551234567",
          from: "+15559876543",
          text: "Test",
          status: "queued",
          segments: 1,
          creditsUsed: 1,
          isSandbox: true,
          createdAt: "2025-01-15T10:00:00Z",
        }),
      });

      await client.messages.send({
        to: "+15551234567",
        text: "Test message",
      });

      const rateLimitInfo = client.getRateLimitInfo();
      expect(rateLimitInfo).toBeDefined();
      expect(rateLimitInfo?.limit).toBe(100);
      expect(rateLimitInfo?.remaining).toBe(95);
      expect(rateLimitInfo?.reset).toBe(3600);
    });
  });

  describe("messages resource", () => {
    it("should have messages resource", () => {
      const client = new Sendly("sk_test_v1_valid_key");
      expect(client.messages).toBeDefined();
      expect(client.messages.send).toBeInstanceOf(Function);
      expect(client.messages.list).toBeInstanceOf(Function);
      expect(client.messages.get).toBeInstanceOf(Function);
    });
  });
});
