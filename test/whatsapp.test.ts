/**
 * Tests for WhatsApp Resource - senders
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { Sendly } from "../src/client";
import { AuthenticationError, NotFoundError } from "../src/errors";
import { mockFetchResponse } from "./fixtures/responses";
import type {
  WhatsAppSender,
  WhatsAppSendersList,
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
});
