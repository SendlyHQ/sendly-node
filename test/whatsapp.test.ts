/**
 * Tests for WhatsApp Resource - senders
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { Sendly } from "../src/client";
import {
  AuthenticationError,
  NotFoundError,
  SendlyError,
  ValidationError,
} from "../src/errors";
import { mockFetchResponse } from "./fixtures/responses";
import type {
  WhatsAppSender,
  WhatsAppSendersList,
  WhatsAppSenderProfile,
} from "../src/resources/whatsapp";

describe("WhatsApp Resource", () => {
  let client: Sendly;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    client = new Sendly("sk_live_v1_valid_key");
    fetchMock = vi.fn();
    global.fetch = fetchMock;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mockSender: WhatsAppSender = {
    phoneNumber: "+15559876543",
    displayName: "Acme Coffee",
    status: "active",
    qualityRating: null,
    createdAt: "2026-07-30T09:12:00Z",
  };

  describe("senders.list()", () => {
    it("should list senders", async () => {
      const mockList: WhatsAppSendersList = { senders: [mockSender] };
      fetchMock.mockResolvedValue(mockFetchResponse(mockList));

      const result = await client.whatsapp.senders.list();

      expect(result).toEqual(mockList);
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/v1/whatsapp/senders"),
        expect.objectContaining({
          method: "GET",
          headers: expect.objectContaining({
            Authorization: "Bearer sk_live_v1_valid_key",
          }),
        }),
      );
    });

    it("should return an empty list when no number is connected", async () => {
      fetchMock.mockResolvedValue(mockFetchResponse({ senders: [] }));

      const result = await client.whatsapp.senders.list();

      expect(result.senders).toEqual([]);
    });

    it("should surface pending senders with null quality rating", async () => {
      const mockList: WhatsAppSendersList = {
        senders: [
          {
            ...mockSender,
            displayName: null,
            status: "pending",
          },
        ],
      };
      fetchMock.mockResolvedValue(mockFetchResponse(mockList));

      const result = await client.whatsapp.senders.list();

      expect(result.senders[0].status).toBe("pending");
      expect(result.senders[0].displayName).toBeNull();
      expect(result.senders[0].qualityRating).toBeNull();
    });

    it("should throw AuthenticationError on 401", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse(
          { error: "unauthorized", message: "Unauthorized" },
          401,
        ),
      );

      await expect(client.whatsapp.senders.list()).rejects.toThrow(
        AuthenticationError,
      );
    });

    it("should throw NotFoundError when the feature is not enabled", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse({ error: "not_found" }, 404),
      );

      await expect(client.whatsapp.senders.list()).rejects.toThrow(
        NotFoundError,
      );
    });
  });

  const mockProfile: WhatsAppSenderProfile = {
    phoneNumber: "+15559876543",
    displayName: "Acme Coffee",
    profilePhotoUrl: null,
    category: "Restaurant",
    about: "Fresh roasts daily",
    description: null,
    email: null,
    website: "https://acme.example.com",
    address: null,
  };

  describe("senders.getProfile()", () => {
    it("should get a sender's business profile", async () => {
      fetchMock.mockResolvedValue(mockFetchResponse(mockProfile));

      const result = await client.whatsapp.senders.getProfile("+15559876543");

      expect(result).toEqual(mockProfile);
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/v1/whatsapp/senders/%2B15559876543/profile"),
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("should reject an invalid phone number locally", async () => {
      await expect(
        client.whatsapp.senders.getProfile("not-a-number"),
      ).rejects.toThrow(ValidationError);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("should surface whatsapp_sender_not_connected on 404", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse(
          {
            error: "whatsapp_sender_not_connected",
            message: "This number isn't connected to WhatsApp yet.",
          },
          404,
        ),
      );

      try {
        await client.whatsapp.senders.getProfile("+15559876543");
        expect.fail("should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(SendlyError);
        expect((error as SendlyError).code).toBe(
          "whatsapp_sender_not_connected",
        );
        expect((error as SendlyError).statusCode).toBe(404);
      }
    });
  });

  describe("senders.updateProfile()", () => {
    it("should update profile fields and omit the rest", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse({ ...mockProfile, about: "New roasts weekly" }),
      );

      const result = await client.whatsapp.senders.updateProfile(
        "+15559876543",
        {
          about: "New roasts weekly",
          website: "https://acme.example.com",
        },
      );

      expect(result.about).toBe("New roasts weekly");
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/v1/whatsapp/senders/%2B15559876543/profile"),
        expect.objectContaining({ method: "PATCH" }),
      );

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body).toEqual({
        about: "New roasts weekly",
        website: "https://acme.example.com",
      });
    });

    it("should reject an invalid phone number locally", async () => {
      await expect(
        client.whatsapp.senders.updateProfile("not-a-number", {
          about: "Hi",
        }),
      ).rejects.toThrow(ValidationError);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("should surface a field validation error from the API", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse(
          {
            error: "invalid_request",
            message: "Field 'about' must be at most 139 characters.",
          },
          400,
        ),
      );

      await expect(
        client.whatsapp.senders.updateProfile("+15559876543", {
          about: "x".repeat(140),
        }),
      ).rejects.toThrow(ValidationError);
    });

    it("should surface whatsapp_requires_live_key on 403", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse(
          {
            error: "whatsapp_requires_live_key",
            message:
              "WhatsApp requires a live API key. Test keys cannot update sender profiles.",
          },
          403,
        ),
      );

      try {
        await client.whatsapp.senders.updateProfile("+15559876543", {
          about: "Hi",
        });
        expect.fail("should have thrown");
      } catch (error) {
        expect((error as SendlyError).code).toBe("whatsapp_requires_live_key");
      }
    });
  });
});
