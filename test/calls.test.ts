/**
 * Tests for Calls Resource - create, list, get, hangup, recording
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { Sendly } from "../src/client";
import {
  AuthenticationError,
  InsufficientCreditsError,
  RateLimitError,
  SendlyError,
  ValidationError,
} from "../src/errors";
import { mockFetchResponse } from "./fixtures/responses";
import type {
  Call,
  CallListResponse,
  CallRecording,
} from "../src/resources/calls";

function urlOfCall(fetchMock: ReturnType<typeof vi.fn>, index: number): URL {
  return new URL(fetchMock.mock.calls[index][0] as string);
}

function keyOfCall(
  fetchMock: ReturnType<typeof vi.fn>,
  index: number,
): string | undefined {
  const headers = fetchMock.mock.calls[index][1].headers as Record<
    string,
    string
  >;
  return headers["Idempotency-Key"];
}

function bodyOfCall(fetchMock: ReturnType<typeof vi.fn>, index: number) {
  return JSON.parse(fetchMock.mock.calls[index][1].body);
}

describe("Calls Resource", () => {
  let client: Sendly;
  let noRetryClient: Sendly;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    client = new Sendly("sk_live_v1_valid_key");
    noRetryClient = new Sendly({
      apiKey: "sk_live_v1_valid_key",
      maxRetries: 0,
    });
    fetchMock = vi.fn();
    global.fetch = fetchMock;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const callId = "6f1c2d3e-4a5b-4c6d-8e9f-0a1b2c3d4e5f";
  const agentId = "3c4d5e6f-7081-4293-a4b5-c6d7e8f90a1b";

  const mockRingingCall: Call = {
    id: callId,
    object: "call",
    kind: "pstn",
    direction: "outbound",
    status: "ringing",
    handledBy: "agent",
    agentId,
    from: "+15555550188",
    to: "+15555550123",
    callerName: "Front Desk",
    calleeName: "+15555550123",
    startedAt: "2026-09-12T14:03:11.000Z",
    answeredAt: null,
    endedAt: null,
    durationSecs: 0,
    creditsCharged: 0,
    billing: "metered",
    hangupClass: null,
    recordingStatus: null,
    metadata: { crmId: "lead_8812" },
  };

  const mockCompletedCall: Call = {
    ...mockRingingCall,
    status: "completed",
    answeredAt: "2026-09-12T14:03:19.000Z",
    endedAt: "2026-09-12T14:05:02.000Z",
    durationSecs: 103,
    creditsCharged: 20,
    billing: "settled",
    hangupClass: "normal",
    recordingStatus: "ready",
  };

  describe("create()", () => {
    const request = {
      to: "+15555550123",
      agentId,
      from: "+15555550188",
      context: "You are calling Jordan to confirm the 3pm appointment.",
      metadata: { crmId: "lead_8812" },
    };

    it("should place a call and return the ringing row", async () => {
      fetchMock.mockResolvedValue(mockFetchResponse(mockRingingCall, 201));

      const result = await client.calls.create(request);

      expect(result).toEqual(mockRingingCall);
      expect(result.status).toBe("ringing");
      expect(result.handledBy).toBe("agent");
      expect(result.metadata).toEqual({ crmId: "lead_8812" });
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/v1\/calls$/),
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bearer sk_live_v1_valid_key",
          }),
        }),
      );
      expect(bodyOfCall(fetchMock, 0)).toEqual({
        to: "+15555550123",
        agentId,
        from: "+15555550188",
        context: "You are calling Jordan to confirm the 3pm appointment.",
        metadata: { crmId: "lead_8812" },
      });
    });

    it("should send only the wire keys that were given", async () => {
      fetchMock.mockResolvedValue(mockFetchResponse(mockRingingCall, 201));

      await client.calls.create({ to: "+15555550123", agentId });

      expect(bodyOfCall(fetchMock, 0)).toEqual({ to: "+15555550123", agentId });
    });

    it("should attach an automatic idempotency key", async () => {
      fetchMock.mockResolvedValue(mockFetchResponse(mockRingingCall, 201));

      await client.calls.create(request);

      expect(keyOfCall(fetchMock, 0)).toMatch(/^sendly-node-retry-/);
    });

    it("should send a caller-supplied idempotency key", async () => {
      fetchMock.mockResolvedValue(mockFetchResponse(mockRingingCall, 201));

      await client.calls.create(request, { idempotencyKey: "call-lead-8812" });

      expect(keyOfCall(fetchMock, 0)).toBe("call-lead-8812");
    });

    it("should reject a missing 'to' locally", async () => {
      await expect(
        client.calls.create({ to: "", agentId }),
      ).rejects.toThrow(ValidationError);
      await expect(
        client.calls.create({ to: "   ", agentId }),
      ).rejects.toThrow("A destination 'to' is required");
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("should reject a missing 'agentId' locally", async () => {
      await expect(
        client.calls.create({ to: "+15555550123", agentId: "" }),
      ).rejects.toThrow(ValidationError);
      await expect(
        client.calls.create({
          to: "+15555550123",
        } as unknown as { to: string; agentId: string }),
      ).rejects.toThrow("An 'agentId' is required");
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("should not validate the phone number format locally", async () => {
      fetchMock.mockResolvedValue(mockFetchResponse(mockRingingCall, 201));

      await client.calls.create({ to: "5555550123", agentId });

      expect(bodyOfCall(fetchMock, 0).to).toBe("5555550123");
    });

    it("should map 402 insufficient_credits to InsufficientCreditsError", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse(
          {
            error: "insufficient_credits",
            message: "Calls cost 10 credits a minute. Current balance: 4.",
            creditsNeeded: 10,
            currentBalance: 4,
          },
          402,
        ),
      );

      try {
        await noRetryClient.calls.create(request);
        expect.fail("should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(InsufficientCreditsError);
        const err = error as InsufficientCreditsError;
        expect(err.creditsNeeded).toBe(10);
        expect(err.currentBalance).toBe(4);
        expect(err.statusCode).toBe(402);
      }
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("should surface e911_required on 428", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse(
          {
            error: "e911_required",
            message:
              "Register an emergency address for this number before placing calls. It's required by US law.",
          },
          428,
        ),
      );

      try {
        await noRetryClient.calls.create(request);
        expect.fail("should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(SendlyError);
        expect((error as SendlyError).code).toBe("e911_required");
        expect((error as SendlyError).statusCode).toBe(428);
      }
    });

    it("should surface agent_disabled on 409", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse(
          {
            error: "agent_disabled",
            message: "Switch the agent on before calling it.",
          },
          409,
        ),
      );

      try {
        await noRetryClient.calls.create(request);
        expect.fail("should have thrown");
      } catch (error) {
        expect((error as SendlyError).code).toBe("agent_disabled");
        expect((error as SendlyError).statusCode).toBe(409);
      }
    });

    it("should surface from_number_required on 400 without retrying", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse(
          {
            error: "from_number_required",
            message: "Choose which number to call from.",
          },
          400,
        ),
      );

      try {
        await client.calls.create({ to: "+15555550123", agentId });
        expect.fail("should have thrown");
      } catch (error) {
        expect((error as SendlyError).code).toBe("from_number_required");
        expect((error as SendlyError).statusCode).toBe(400);
      }
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("should surface live_key_required on 403 for a test key", async () => {
      const testClient = new Sendly("sk_test_v1_valid_key");
      fetchMock.mockResolvedValue(
        mockFetchResponse(
          {
            error: "live_key_required",
            message: "Phone calls need a live API key.",
          },
          403,
        ),
      );

      try {
        await testClient.calls.create(request);
        expect.fail("should have thrown");
      } catch (error) {
        expect((error as SendlyError).code).toBe("live_key_required");
        expect((error as SendlyError).statusCode).toBe(403);
      }
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("should throw RateLimitError on 429", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse(
          {
            error: "rate_limit_exceeded",
            message: "Too many calls placed. Try again shortly.",
            retryAfter: 30,
          },
          429,
        ),
      );

      try {
        await client.calls.create(request);
        expect.fail("should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(RateLimitError);
        expect((error as RateLimitError).retryAfter).toBe(30);
      }
    });
  });

  describe("list()", () => {
    const mockList: CallListResponse = {
      data: [mockCompletedCall, mockRingingCall],
      pagination: { total: 132, limit: 50, offset: 0, hasMore: true },
    };

    it("should list calls with default options", async () => {
      fetchMock.mockResolvedValue(mockFetchResponse(mockList));

      const result = await client.calls.list();

      expect(result).toEqual(mockList);
      expect(result.pagination.hasMore).toBe(true);
      expect(result.data[0].billing).toBe("settled");
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/v1\/calls$/),
        expect.objectContaining({ method: "GET" }),
      );
      expect(urlOfCall(fetchMock, 0).search).toBe("");
    });

    it("should encode every filter as a camelCase query key", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse({
          data: [],
          pagination: { total: 0, limit: 10, offset: 20, hasMore: false },
        }),
      );

      const result = await client.calls.list({
        limit: 10,
        offset: 20,
        status: "completed",
        direction: "outbound",
        kind: "pstn",
        agentId,
        to: "+15555550123",
        from: "+15555550188",
      });

      expect(result.pagination.hasMore).toBe(false);
      const params = urlOfCall(fetchMock, 0).searchParams;
      expect(params.get("limit")).toBe("10");
      expect(params.get("offset")).toBe("20");
      expect(params.get("status")).toBe("completed");
      expect(params.get("direction")).toBe("outbound");
      expect(params.get("kind")).toBe("pstn");
      expect(params.get("agentId")).toBe(agentId);
      expect(params.get("to")).toBe("+15555550123");
      expect(params.get("from")).toBe("+15555550188");
      expect(urlOfCall(fetchMock, 0).search).toContain("to=%2B15555550123");
    });

    it("should not send an Idempotency-Key on GET", async () => {
      fetchMock.mockResolvedValue(mockFetchResponse(mockList));

      await client.calls.list({ status: "active" });

      expect(keyOfCall(fetchMock, 0)).toBeUndefined();
    });

    it("should surface voice_not_enabled on 404", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse(
          {
            error: "voice_not_enabled",
            message: "Voice is not enabled for your account.",
          },
          404,
        ),
      );

      try {
        await client.calls.list();
        expect.fail("should have thrown");
      } catch (error) {
        expect((error as SendlyError).code).toBe("voice_not_enabled");
        expect((error as SendlyError).statusCode).toBe(404);
      }
    });

    it("should throw AuthenticationError on 403 insufficient_permissions", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse(
          {
            error: "insufficient_permissions",
            message: "This API key does not have the calls:read scope",
          },
          403,
        ),
      );

      await expect(client.calls.list()).rejects.toThrow(AuthenticationError);
    });
  });

  describe("get()", () => {
    it("should retrieve an agent call with its transcript", async () => {
      const withTranscript: Call = {
        ...mockCompletedCall,
        transcript: [
          { speaker: "agent", text: "Hi Jordan, this is the front desk.", atMs: 800 },
          { speaker: "caller", text: "Yes, 3pm works.", atMs: 4200 },
        ],
      };
      fetchMock.mockResolvedValue(mockFetchResponse(withTranscript));

      const result = await client.calls.get(callId);

      expect(result).toEqual(withTranscript);
      expect(result.transcript).toHaveLength(2);
      expect(result.transcript?.[1].speaker).toBe("caller");
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(new RegExp(`/v1/calls/${callId}$`)),
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("should return the body untouched when the server sends no transcript", async () => {
      const dashboardCall: Call = {
        ...mockCompletedCall,
        handledBy: "dashboard",
        agentId: null,
        direction: "inbound",
      };
      fetchMock.mockResolvedValue(mockFetchResponse(dashboardCall));

      const result = await client.calls.get(callId);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(new RegExp(`/v1/calls/${callId}$`)),
        expect.objectContaining({ method: "GET" }),
      );
      expect(result).toEqual(dashboardCall);
      expect(Object.keys(result).sort()).toEqual(Object.keys(dashboardCall).sort());
      expect("transcript" in result).toBe(false);
    });

    it("should percent-encode the id", async () => {
      fetchMock.mockResolvedValue(mockFetchResponse(mockCompletedCall));

      await client.calls.get("call/with spaces");

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/v1/calls/call%2Fwith%20spaces"),
        expect.anything(),
      );
    });

    it("should reject a missing id locally", async () => {
      await expect(client.calls.get("")).rejects.toThrow(ValidationError);
      await expect(client.calls.get("")).rejects.toThrow(
        "A call 'id' is required",
      );
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("should surface call_not_found on 404", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse(
          {
            error: "call_not_found",
            message: "No call with that id is in this workspace.",
          },
          404,
        ),
      );

      try {
        await client.calls.get(callId);
        expect.fail("should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(SendlyError);
        expect((error as SendlyError).code).toBe("call_not_found");
        expect((error as SendlyError).statusCode).toBe(404);
      }
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("hangup()", () => {
    it("should cancel a ringing call", async () => {
      const cancelled: Call = {
        ...mockRingingCall,
        status: "cancelled",
        endedAt: "2026-09-12T14:03:30.000Z",
        billing: "settled",
        hangupClass: "caller_cancelled",
      };
      fetchMock.mockResolvedValue(mockFetchResponse(cancelled));

      const result = await client.calls.hangup(callId);

      expect(result.status).toBe("cancelled");
      expect(result.hangupClass).toBe("caller_cancelled");
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(new RegExp(`/v1/calls/${callId}/hangup$`)),
        expect.objectContaining({ method: "POST" }),
      );
      expect(bodyOfCall(fetchMock, 0)).toEqual({});
    });

    it("should complete an active call", async () => {
      fetchMock.mockResolvedValue(mockFetchResponse(mockCompletedCall));

      const result = await client.calls.hangup(callId);

      expect(result.status).toBe("completed");
      expect(result.hangupClass).toBe("normal");
    });

    it("should attach an automatic idempotency key", async () => {
      fetchMock.mockResolvedValue(mockFetchResponse(mockCompletedCall));

      await client.calls.hangup(callId);

      expect(keyOfCall(fetchMock, 0)).toMatch(/^sendly-node-retry-/);
    });

    it("should send a caller-supplied idempotency key", async () => {
      fetchMock.mockResolvedValue(mockFetchResponse(mockCompletedCall));

      await client.calls.hangup(callId, { idempotencyKey: `hangup-${callId}` });

      expect(keyOfCall(fetchMock, 0)).toBe(`hangup-${callId}`);
    });

    it("should percent-encode the id", async () => {
      fetchMock.mockResolvedValue(mockFetchResponse(mockCompletedCall));

      await client.calls.hangup("call/1");

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/v1/calls/call%2F1/hangup"),
        expect.anything(),
      );
    });

    it("should reject a missing id locally", async () => {
      await expect(client.calls.hangup("")).rejects.toThrow(ValidationError);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("should surface call_not_found on 404", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse(
          {
            error: "call_not_found",
            message: "No call with that id is in this workspace.",
          },
          404,
        ),
      );

      try {
        await client.calls.hangup(callId);
        expect.fail("should have thrown");
      } catch (error) {
        expect((error as SendlyError).code).toBe("call_not_found");
      }
    });
  });

  describe("recording()", () => {
    it("should return a signed URL when ready", async () => {
      const ready: CallRecording = {
        callId,
        status: "ready",
        url: "https://media.sendly.live/recordings/abc?sig=xyz",
        expiresAt: "2026-09-12T14:10:00.000Z",
        contentType: "audio/ogg",
      };
      fetchMock.mockResolvedValue(mockFetchResponse(ready));

      const result = await client.calls.recording(callId);

      expect(result).toEqual(ready);
      expect(result.contentType).toBe("audio/ogg");
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(new RegExp(`/v1/calls/${callId}/recording$`)),
        expect.objectContaining({ method: "GET" }),
      );
      expect(keyOfCall(fetchMock, 0)).toBeUndefined();
    });

    it("should return null url and expiresAt when not ready", async () => {
      const pending: CallRecording = {
        callId,
        status: "recording",
        url: null,
        expiresAt: null,
        contentType: null,
      };
      fetchMock.mockResolvedValue(mockFetchResponse(pending));

      const result = await client.calls.recording(callId);

      expect(result.status).toBe("recording");
      expect(result.url).toBeNull();
      expect(result.expiresAt).toBeNull();
      expect(result.contentType).toBeNull();
    });

    it("should return status none for an unrecorded call", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse({
          callId,
          status: "none",
          url: null,
          expiresAt: null,
          contentType: null,
        }),
      );

      const result = await client.calls.recording(callId);

      expect(result.status).toBe("none");
      expect(result.url).toBeNull();
    });

    it("should percent-encode the id", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse({
          callId: "call/1",
          status: "none",
          url: null,
          expiresAt: null,
          contentType: null,
        }),
      );

      await client.calls.recording("call/1");

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/v1/calls/call%2F1/recording"),
        expect.anything(),
      );
    });

    it("should reject a missing id locally", async () => {
      await expect(client.calls.recording("")).rejects.toThrow(
        ValidationError,
      );
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("should surface call_not_found on 404", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse(
          {
            error: "call_not_found",
            message: "No call with that id is in this workspace.",
          },
          404,
        ),
      );

      try {
        await client.calls.recording(callId);
        expect.fail("should have thrown");
      } catch (error) {
        expect((error as SendlyError).code).toBe("call_not_found");
        expect((error as SendlyError).statusCode).toBe(404);
      }
    });
  });
});
