/**
 * Tests for RCS Resource - agents, capability, and messages.send with
 * channel='rcs'
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
import type { RcsAgent, RcsAgentListResponse } from "../src/resources/rcs";
import type { RcsMessage } from "../src/types";

describe("RCS Resource", () => {
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

  const mockAgent: RcsAgent = {
    id: "rcs_agent_123",
    name: "Acme Coffee",
    status: "approved",
    useCase: "customer service",
    sendable: true,
    createdAt: "2026-07-30T09:12:00Z",
  };

  const mockRcsMessage: RcsMessage = {
    id: "msg_rcs_123",
    channel: "rcs",
    message_format: "rcs",
    to: "+15551234567",
    from: "Acme Coffee",
    text: "Your table is ready!",
    status: "sent",
    segments: 1,
    creditsUsed: 2,
    rcs: { kind: "text", agentId: "rcs_agent_123", agentName: "Acme Coffee" },
    createdAt: "2026-07-30T10:00:00Z",
    metadata: {},
  };

  const mockFallbackMessage: RcsMessage = {
    id: "msg_rcs_456",
    channel: "sms",
    fellBackTo: "sms",
    message_format: "sms",
    to: "+15551234567",
    from: "+18005550199",
    text: "Your table is ready!",
    status: "sent",
    segments: 1,
    creditsUsed: 2,
    rcs: { requestedChannel: "rcs", agentId: "rcs_agent_123" },
    createdAt: "2026-07-30T10:00:00Z",
    metadata: {},
  };

  describe("agents.list()", () => {
    it("should list agents", async () => {
      const mockList: RcsAgentListResponse = { agents: [mockAgent] };
      fetchMock.mockResolvedValue(mockFetchResponse(mockList));

      const result = await client.rcs.agents.list();

      expect(result).toEqual(mockList);
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/v1/rcs/agents"),
        expect.objectContaining({
          method: "GET",
          headers: expect.objectContaining({
            Authorization: "Bearer sk_live_v1_valid_key",
          }),
        }),
      );
    });

    it("should return an empty list when no agent is registered", async () => {
      fetchMock.mockResolvedValue(mockFetchResponse({ agents: [] }));

      const result = await client.rcs.agents.list();

      expect(result.agents).toEqual([]);
    });

    it("should surface non-sendable agents", async () => {
      const mockList: RcsAgentListResponse = {
        agents: [
          {
            ...mockAgent,
            status: "submitted",
            useCase: null,
            sendable: false,
          },
        ],
      };
      fetchMock.mockResolvedValue(mockFetchResponse(mockList));

      const result = await client.rcs.agents.list();

      expect(result.agents[0].status).toBe("submitted");
      expect(result.agents[0].sendable).toBe(false);
      expect(result.agents[0].useCase).toBeNull();
    });

    it("should throw AuthenticationError on 401", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse(
          { error: "unauthorized", message: "Unauthorized" },
          401,
        ),
      );

      await expect(client.rcs.agents.list()).rejects.toThrow(
        AuthenticationError,
      );
    });

    it("should throw NotFoundError when the feature is not enabled", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse({ error: "not_found" }, 404),
      );

      await expect(client.rcs.agents.list()).rejects.toThrow(NotFoundError);
    });
  });

  describe("capability()", () => {
    it("should check recipient capability", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse({
          to: "+15551234567",
          agentId: "rcs_agent_123",
          capable: true,
          features: ["RICHCARD_STANDALONE", "ACTION_OPEN_URL"],
        }),
      );

      const result = await client.rcs.capability({ to: "+15551234567" });

      expect(result.capable).toBe(true);
      expect(result.features).toContain("RICHCARD_STANDALONE");
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/v1/rcs/capability?to=%2B15551234567"),
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("should pass agentId when provided", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse({
          to: "+15551234567",
          agentId: "rcs_agent_123",
          capable: false,
          features: [],
        }),
      );

      const result = await client.rcs.capability({
        to: "+15551234567",
        agentId: "rcs_agent_123",
      });

      expect(result.capable).toBe(false);
      expect(result.features).toEqual([]);
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("agentId=rcs_agent_123"),
        expect.anything(),
      );
    });

    it("should reject an invalid phone number locally", async () => {
      await expect(client.rcs.capability({ to: "invalid" })).rejects.toThrow(
        ValidationError,
      );
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("should surface rcs_requires_live_key on 403", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse(
          {
            error: "rcs_requires_live_key",
            message:
              "RCS capability checks require a live API key. Test keys cannot query RCS capability.",
          },
          403,
        ),
      );

      try {
        await client.rcs.capability({ to: "+15551234567" });
        expect.fail("should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(SendlyError);
        expect((error as SendlyError).code).toBe("rcs_requires_live_key");
        expect((error as SendlyError).statusCode).toBe(403);
      }
    });

    it("should surface rcs_agent_ambiguous on 400", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse(
          {
            error: "rcs_agent_ambiguous",
            message:
              "This workspace has more than one RCS agent. Pass agentId to pick one.",
          },
          400,
        ),
      );

      try {
        await client.rcs.capability({ to: "+15551234567" });
        expect.fail("should have thrown");
      } catch (error) {
        expect((error as SendlyError).code).toBe("rcs_agent_ambiguous");
      }
    });
  });

  describe("messages.send() with channel: 'rcs'", () => {
    it("should send a text message", async () => {
      fetchMock.mockResolvedValue(mockFetchResponse(mockRcsMessage, 201));

      const message = await client.messages.send({
        channel: "rcs",
        to: "+15551234567",
        text: "Your table is ready!",
      });

      expect(message.channel).toBe("rcs");
      if (message.channel === "rcs") {
        expect(message.rcs.kind).toBe("text");
        expect(message.rcs.agentName).toBe("Acme Coffee");
      }

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body).toEqual({
        channel: "rcs",
        to: "+15551234567",
        text: "Your table is ready!",
      });
    });

    it("should send text with suggestions and agentId", async () => {
      fetchMock.mockResolvedValue(mockFetchResponse(mockRcsMessage, 201));

      await client.messages.send({
        channel: "rcs",
        to: "+15551234567",
        agentId: "rcs_agent_123",
        text: "Your table is ready!",
        suggestions: [
          { reply: { text: "On my way", postbackData: "omw" } },
          {
            action: {
              text: "View menu",
              postbackData: "menu",
              url: "https://example.com/menu",
            },
          },
        ],
      });

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.agentId).toBe("rcs_agent_123");
      expect(body.suggestions).toHaveLength(2);
      expect(body.suggestions[0].reply.postbackData).toBe("omw");
      expect(body.suggestions[1].action.url).toBe("https://example.com/menu");
    });

    it("should send a rich card", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse(
          {
            ...mockRcsMessage,
            text: null,
            rcs: { ...mockRcsMessage.rcs, kind: "card" },
          },
          201,
        ),
      );

      const message = await client.messages.send({
        channel: "rcs",
        to: "+15551234567",
        card: {
          title: "Your order has shipped",
          description: "Arriving Thursday",
          mediaUrl: "https://example.com/package.jpg",
          orientation: "horizontal",
          suggestions: [
            {
              action: {
                text: "Track it",
                postbackData: "track",
                url: "https://example.com/track",
              },
            },
          ],
        },
      });

      if (message.channel === "rcs") {
        expect(message.rcs.kind).toBe("card");
        expect(message.text).toBeNull();
      }

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.card.title).toBe("Your order has shipped");
      expect(body.card.orientation).toBe("horizontal");
      expect(body).not.toHaveProperty("text");
    });

    it("should expose the SMS fallback to callers", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse(
          {
            ...mockFallbackMessage,
            rcs: { ...mockFallbackMessage.rcs, suggestionsDropped: true },
          },
          201,
        ),
      );

      const message = await client.messages.send({
        channel: "rcs",
        to: "+15551234567",
        text: "Your table is ready!",
        suggestions: [{ reply: { text: "On my way", postbackData: "omw" } }],
      });

      expect(message.channel).toBe("sms");
      if (message.channel === "sms") {
        expect(message.fellBackTo).toBe("sms");
        expect(message.message_format).toBe("sms");
        expect(message.rcs.requestedChannel).toBe("rcs");
        expect(message.rcs.suggestionsDropped).toBe(true);
      }
    });

    it("should pass fallbackToSms: false through", async () => {
      fetchMock.mockResolvedValue(mockFetchResponse(mockRcsMessage, 201));

      await client.messages.send({
        channel: "rcs",
        to: "+15551234567",
        text: "Your table is ready!",
        fallbackToSms: false,
      });

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.fallbackToSms).toBe(false);
    });

    it("should require exactly one of text or card", async () => {
      await expect(
        client.messages.send({
          channel: "rcs",
          to: "+15551234567",
        }),
      ).rejects.toThrow("Provide exactly one of 'text' or 'card'");

      await expect(
        client.messages.send({
          channel: "rcs",
          to: "+15551234567",
          text: "Hello",
          card: { title: "Hi", description: "There" },
        }),
      ).rejects.toThrow("Provide exactly one of 'text' or 'card'");

      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("should surface rcs_not_supported_for_recipient on 422", async () => {
      const noRetryClient = new Sendly({
        apiKey: "sk_live_v1_valid_key",
        maxRetries: 0,
      });
      fetchMock.mockResolvedValue(
        mockFetchResponse(
          {
            error: "rcs_not_supported_for_recipient",
            message: "This recipient's device or network doesn't support RCS.",
          },
          422,
        ),
      );

      try {
        await noRetryClient.messages.send({
          channel: "rcs",
          to: "+15551234567",
          text: "Hello",
          fallbackToSms: false,
        });
        expect.fail("should have thrown");
      } catch (error) {
        expect((error as SendlyError).code).toBe(
          "rcs_not_supported_for_recipient",
        );
        expect((error as SendlyError).statusCode).toBe(422);
      }
    });
  });
});
