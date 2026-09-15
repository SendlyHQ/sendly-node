/**
 * Tests for Voice Resource - numbers, agents, voices
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { Sendly } from "../src/client";
import {
  AuthenticationError,
  SendlyError,
  ValidationError,
} from "../src/errors";
import { mockFetchResponse } from "./fixtures/responses";
import type {
  DeletedVoiceAgent,
  Voice,
  VoiceAgent,
  VoiceAgentListResponse,
  VoiceListResponse,
  VoiceNumber,
  VoiceNumberListResponse,
} from "../src/resources/voice";

function urlOfCall(fetchMock: ReturnType<typeof vi.fn>, index: number): URL {
  return new URL(fetchMock.mock.calls[index][0] as string);
}

function methodOfCall(fetchMock: ReturnType<typeof vi.fn>, index: number) {
  return fetchMock.mock.calls[index][1].method as string;
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
  const raw = fetchMock.mock.calls[index][1].body;
  return raw === undefined ? undefined : JSON.parse(raw);
}

describe("Voice Resource", () => {
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

  const numberId = "5f0c1c2e-2a44-4d4b-9d51-0a9b0f6f4a11";
  const phoneNumber = "+15555550188";
  const agentId = "3c4d5e6f-7081-4293-a4b5-c6d7e8f90a1b";

  const mockNumber: VoiceNumber = {
    id: numberId,
    object: "voice_number",
    phoneNumber,
    phoneNumberType: "local",
    countryCode: "US",
    isDefault: true,
    voiceEnabled: true,
    voiceMode: "agent",
    agentId,
    emergencyAddress: {
      status: "active",
      address: {
        street: "500 Example Ave",
        unit: "Suite 2",
        city: "Austin",
        state: "TX",
        zip: "78701",
        country: "US",
      },
    },
    ratePerMinute: { inbound: 2, outbound: 2, agent: 10 },
  };

  const mockAgent: VoiceAgent = {
    id: agentId,
    object: "voice_agent",
    name: "Front desk",
    enabled: true,
    voice: "ashley",
    voiceLabel: "Ashley (US, warm)",
    language: "en-US",
    greeting: "Thanks for calling Acme, how can I help?",
    instructions: "Answer questions about opening hours.",
    tools: { sendSms: false, transferTo: null },
    canSendSms: true,
    callsHandled: 12,
    avgDurationSecs: 74,
    createdAt: "2026-09-14T17:00:00.000Z",
    updatedAt: "2026-09-14T17:05:00.000Z",
  };

  it("should expose numbers, agents and voices under client.voice", () => {
    expect(typeof client.voice.numbers.list).toBe("function");
    expect(typeof client.voice.numbers.registerEmergencyAddress).toBe(
      "function",
    );
    expect(typeof client.voice.agents.delete).toBe("function");
    expect(typeof client.voice.voices.list).toBe("function");
  });

  describe("numbers.list()", () => {
    it("should GET /voice/numbers and return the data array", async () => {
      const list: VoiceNumberListResponse = {
        data: [mockNumber, { ...mockNumber, id: "n2", voiceEnabled: false, voiceMode: "none", emergencyAddress: null }],
      };
      fetchMock.mockResolvedValue(mockFetchResponse(list));

      const result = await client.voice.numbers.list();

      expect(result).toEqual(list);
      expect(result.data).toHaveLength(2);
      expect(result.data[1].emergencyAddress).toBeNull();
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/v1\/voice\/numbers$/),
        expect.objectContaining({ method: "GET" }),
      );
      expect(urlOfCall(fetchMock, 0).search).toBe("");
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
        await client.voice.numbers.list();
        expect.fail("should have thrown");
      } catch (error) {
        expect((error as SendlyError).code).toBe("voice_not_enabled");
        expect((error as SendlyError).statusCode).toBe(404);
      }
      expect(fetchMock).toHaveBeenCalledTimes(1);
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

      await expect(client.voice.numbers.list()).rejects.toThrow(
        AuthenticationError,
      );
    });
  });

  describe("numbers.get()", () => {
    it("should percent-encode an E.164 number", async () => {
      fetchMock.mockResolvedValue(mockFetchResponse(mockNumber));

      const result = await client.voice.numbers.get(phoneNumber);

      expect(result).toEqual(mockNumber);
      expect(urlOfCall(fetchMock, 0).pathname).toMatch(
        /\/v1\/voice\/numbers\/%2B15555550188$/,
      );
      expect(methodOfCall(fetchMock, 0)).toBe("GET");
    });

    it("should accept a number id", async () => {
      fetchMock.mockResolvedValue(mockFetchResponse(mockNumber));

      await client.voice.numbers.get(numberId);

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(new RegExp(`/v1/voice/numbers/${numberId}$`)),
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("should reject a missing number locally", async () => {
      await expect(client.voice.numbers.get("")).rejects.toThrow(
        ValidationError,
      );
      await expect(client.voice.numbers.get("   ")).rejects.toThrow(
        "A 'number' is required",
      );
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("should surface number_not_found on 404", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse(
          {
            error: "number_not_found",
            message: "This number isn't in your workspace.",
          },
          404,
        ),
      );

      try {
        await client.voice.numbers.get(phoneNumber);
        expect.fail("should have thrown");
      } catch (error) {
        expect((error as SendlyError).code).toBe("number_not_found");
        expect((error as SendlyError).statusCode).toBe(404);
      }
    });
  });

  describe("numbers.update()", () => {
    it("should PATCH camelCase wire keys with agentId", async () => {
      fetchMock.mockResolvedValue(mockFetchResponse(mockNumber));

      const result = await client.voice.numbers.update(phoneNumber, {
        voiceEnabled: true,
        voiceMode: "agent",
        agentId,
      });

      expect(result).toEqual(mockNumber);
      expect(methodOfCall(fetchMock, 0)).toBe("PATCH");
      expect(urlOfCall(fetchMock, 0).pathname).toMatch(
        /\/v1\/voice\/numbers\/%2B15555550188$/,
      );
      const body = bodyOfCall(fetchMock, 0);
      expect(body).toEqual({ voiceEnabled: true, voiceMode: "agent", agentId });
      expect(body).not.toHaveProperty("voiceAgentId");
    });

    it("should send only the keys that were given, including a null agentId", async () => {
      fetchMock.mockResolvedValue(mockFetchResponse(mockNumber));

      await client.voice.numbers.update(numberId, { voiceMode: "none" });
      await client.voice.numbers.update(numberId, { agentId: null });

      expect(bodyOfCall(fetchMock, 0)).toEqual({ voiceMode: "none" });
      expect(bodyOfCall(fetchMock, 1)).toEqual({ agentId: null });
    });

    it("should not add an automatic idempotency key on PATCH but send a caller key", async () => {
      fetchMock.mockResolvedValue(mockFetchResponse(mockNumber));

      await client.voice.numbers.update(numberId, { voiceEnabled: false });
      await client.voice.numbers.update(
        numberId,
        { voiceEnabled: false },
        { idempotencyKey: "voice-off-0188" },
      );

      expect(keyOfCall(fetchMock, 0)).toBeUndefined();
      expect(keyOfCall(fetchMock, 1)).toBe("voice-off-0188");
    });

    it("should not validate the voice mode locally", async () => {
      fetchMock.mockResolvedValue(mockFetchResponse(mockNumber));

      await client.voice.numbers.update(numberId, {
        voiceMode: "voicemail" as unknown as "agent",
      });

      expect(bodyOfCall(fetchMock, 0)).toEqual({ voiceMode: "voicemail" });
    });

    it("should reject a missing number locally", async () => {
      await expect(
        client.voice.numbers.update("", { voiceEnabled: true }),
      ).rejects.toThrow(ValidationError);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("should surface agent_required on 400", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse(
          {
            error: "agent_required",
            message: "Choose an agent to answer this number.",
          },
          400,
        ),
      );

      try {
        await client.voice.numbers.update(numberId, { voiceMode: "agent" });
        expect.fail("should have thrown");
      } catch (error) {
        expect((error as SendlyError).code).toBe("agent_required");
        expect((error as SendlyError).statusCode).toBe(400);
      }
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("numbers.registerEmergencyAddress()", () => {
    const address = {
      street: "500 Example Ave",
      unit: "Suite 2",
      city: "Austin",
      state: "TX",
      zip: "78701",
      country: "US",
    };

    it("should POST the address to the encoded emergency-address path", async () => {
      fetchMock.mockResolvedValue(mockFetchResponse(mockNumber));

      const result = await client.voice.numbers.registerEmergencyAddress(
        phoneNumber,
        address,
      );

      expect(result.emergencyAddress?.status).toBe("active");
      expect(methodOfCall(fetchMock, 0)).toBe("POST");
      expect(urlOfCall(fetchMock, 0).pathname).toMatch(
        /\/v1\/voice\/numbers\/%2B15555550188\/emergency-address$/,
      );
      expect(bodyOfCall(fetchMock, 0)).toEqual(address);
    });

    it("should omit unit and country when not given", async () => {
      fetchMock.mockResolvedValue(mockFetchResponse(mockNumber));

      await client.voice.numbers.registerEmergencyAddress(numberId, {
        street: "500 Example Ave",
        city: "Austin",
        state: "TX",
        zip: "78701",
      });

      expect(bodyOfCall(fetchMock, 0)).toEqual({
        street: "500 Example Ave",
        city: "Austin",
        state: "TX",
        zip: "78701",
      });
    });

    it("should attach an automatic idempotency key and honour a caller key", async () => {
      fetchMock.mockResolvedValue(mockFetchResponse(mockNumber));

      await client.voice.numbers.registerEmergencyAddress(numberId, address);
      await client.voice.numbers.registerEmergencyAddress(numberId, address, {
        idempotencyKey: "e911-0188",
      });

      expect(keyOfCall(fetchMock, 0)).toMatch(/^sendly-node-retry-/);
      expect(keyOfCall(fetchMock, 1)).toBe("e911-0188");
    });

    it("should reject missing address fields locally", async () => {
      for (const field of ["street", "city", "state", "zip"] as const) {
        await expect(
          client.voice.numbers.registerEmergencyAddress(numberId, {
            ...address,
            [field]: " ",
          }),
        ).rejects.toThrow(`An emergency address '${field}' is required`);
      }
      await expect(
        client.voice.numbers.registerEmergencyAddress(
          numberId,
          undefined as unknown as typeof address,
        ),
      ).rejects.toThrow(ValidationError);
      await expect(
        client.voice.numbers.registerEmergencyAddress("", address),
      ).rejects.toThrow(ValidationError);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("should surface invalid_address on 422 with the suggested address", async () => {
      const suggested = {
        street: "500 Example Avenue",
        city: "Austin",
        state: "TX",
        zip: "78701",
      };
      fetchMock.mockResolvedValue(
        mockFetchResponse(
          {
            error: "invalid_address",
            message: "The address couldn't be validated.",
            suggested,
          },
          422,
        ),
      );

      try {
        await noRetryClient.voice.numbers.registerEmergencyAddress(
          numberId,
          address,
        );
        expect.fail("should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(SendlyError);
        expect((error as SendlyError).code).toBe("invalid_address");
        expect((error as SendlyError).statusCode).toBe(422);
        expect((error as SendlyError).response?.suggested).toEqual(suggested);
      }
    });
  });

  describe("agents.list()", () => {
    it("should GET /voice/agents and return the data array", async () => {
      const list: VoiceAgentListResponse = { data: [mockAgent] };
      fetchMock.mockResolvedValue(mockFetchResponse(list));

      const result = await client.voice.agents.list();

      expect(result.data).toEqual([mockAgent]);
      expect(result.data[0]).not.toHaveProperty("llmModel");
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/v1\/voice\/agents$/),
        expect.objectContaining({ method: "GET" }),
      );
      expect(keyOfCall(fetchMock, 0)).toBeUndefined();
    });
  });

  describe("agents.create()", () => {
    const request = {
      name: "Front desk",
      enabled: true,
      voice: "ashley",
      language: "en-US",
      greeting: "Thanks for calling Acme, how can I help?",
      instructions: "Answer questions about opening hours.",
      tools: { sendSms: false, transferTo: null },
    };

    it("should POST the agent and return it", async () => {
      fetchMock.mockResolvedValue(mockFetchResponse(mockAgent, 201));

      const result = await client.voice.agents.create(request);

      expect(result).toEqual(mockAgent);
      expect(methodOfCall(fetchMock, 0)).toBe("POST");
      expect(urlOfCall(fetchMock, 0).pathname).toMatch(/\/v1\/voice\/agents$/);
      expect(bodyOfCall(fetchMock, 0)).toEqual(request);
    });

    it("should send only the wire keys that were given", async () => {
      fetchMock.mockResolvedValue(mockFetchResponse(mockAgent, 201));

      await client.voice.agents.create({ name: "Front desk" });

      expect(bodyOfCall(fetchMock, 0)).toEqual({ name: "Front desk" });
    });

    it("should attach an automatic idempotency key and honour a caller key", async () => {
      fetchMock.mockResolvedValue(mockFetchResponse(mockAgent, 201));

      await client.voice.agents.create(request);
      await client.voice.agents.create(request, {
        idempotencyKey: "agent-front-desk",
      });

      expect(keyOfCall(fetchMock, 0)).toMatch(/^sendly-node-retry-/);
      expect(keyOfCall(fetchMock, 1)).toBe("agent-front-desk");
    });

    it("should reject a missing name locally", async () => {
      await expect(client.voice.agents.create({ name: "" })).rejects.toThrow(
        ValidationError,
      );
      await expect(
        client.voice.agents.create({ name: "   " }),
      ).rejects.toThrow("An agent 'name' is required");
      await expect(
        client.voice.agents.create(
          undefined as unknown as { name: string },
        ),
      ).rejects.toThrow(ValidationError);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("should surface agent_limit on 409", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse(
          {
            error: "agent_limit",
            message: "You've reached the agent limit for this workspace.",
          },
          409,
        ),
      );

      try {
        await noRetryClient.voice.agents.create(request);
        expect.fail("should have thrown");
      } catch (error) {
        expect((error as SendlyError).code).toBe("agent_limit");
        expect((error as SendlyError).statusCode).toBe(409);
      }
    });

    it("should map 400 invalid_request to ValidationError", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse(
          { error: "invalid_request", message: "enabled must be true or false." },
          400,
        ),
      );

      await expect(client.voice.agents.create(request)).rejects.toThrow(
        ValidationError,
      );
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("agents.get()", () => {
    it("should GET the agent by id", async () => {
      fetchMock.mockResolvedValue(mockFetchResponse(mockAgent));

      const result = await client.voice.agents.get(agentId);

      expect(result).toEqual(mockAgent);
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(new RegExp(`/v1/voice/agents/${agentId}$`)),
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("should percent-encode the id", async () => {
      fetchMock.mockResolvedValue(mockFetchResponse(mockAgent));

      await client.voice.agents.get("agent/with spaces");

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/v1/voice/agents/agent%2Fwith%20spaces"),
        expect.anything(),
      );
    });

    it("should reject a missing id locally", async () => {
      await expect(client.voice.agents.get("")).rejects.toThrow(
        "An agent 'id' is required",
      );
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("should surface agent_not_found on 404", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse(
          { error: "agent_not_found", message: "That agent no longer exists." },
          404,
        ),
      );

      try {
        await client.voice.agents.get(agentId);
        expect.fail("should have thrown");
      } catch (error) {
        expect((error as SendlyError).code).toBe("agent_not_found");
      }
    });
  });

  describe("agents.update()", () => {
    it("should PATCH only the given keys", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse({ ...mockAgent, enabled: false }),
      );

      const result = await client.voice.agents.update(agentId, {
        enabled: false,
        tools: { sendSms: true },
      });

      expect(result.enabled).toBe(false);
      expect(methodOfCall(fetchMock, 0)).toBe("PATCH");
      expect(urlOfCall(fetchMock, 0).pathname).toMatch(
        new RegExp(`/v1/voice/agents/${agentId}$`),
      );
      expect(bodyOfCall(fetchMock, 0)).toEqual({
        enabled: false,
        tools: { sendSms: true },
      });
      expect(keyOfCall(fetchMock, 0)).toBeUndefined();
    });

    it("should send a caller-supplied idempotency key", async () => {
      fetchMock.mockResolvedValue(mockFetchResponse(mockAgent));

      await client.voice.agents.update(
        agentId,
        { greeting: "" },
        { idempotencyKey: "agent-greeting-clear" },
      );

      expect(bodyOfCall(fetchMock, 0)).toEqual({ greeting: "" });
      expect(keyOfCall(fetchMock, 0)).toBe("agent-greeting-clear");
    });

    it("should reject a missing id locally", async () => {
      await expect(
        client.voice.agents.update("", { name: "Front desk" }),
      ).rejects.toThrow(ValidationError);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("agents.delete()", () => {
    it("should DELETE the agent and return the confirmation", async () => {
      const deleted: DeletedVoiceAgent = {
        id: agentId,
        object: "voice_agent",
        deleted: true,
      };
      fetchMock.mockResolvedValue(mockFetchResponse(deleted));

      const result = await client.voice.agents.delete(agentId);

      expect(result).toEqual(deleted);
      expect(methodOfCall(fetchMock, 0)).toBe("DELETE");
      expect(urlOfCall(fetchMock, 0).pathname).toMatch(
        new RegExp(`/v1/voice/agents/${agentId}$`),
      );
      expect(bodyOfCall(fetchMock, 0)).toBeUndefined();
      expect(keyOfCall(fetchMock, 0)).toBeUndefined();
    });

    it("should reject a missing id locally", async () => {
      await expect(client.voice.agents.delete("")).rejects.toThrow(
        ValidationError,
      );
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("should surface agent_in_use on 409 with the numbers", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse(
          {
            error: "agent_in_use",
            message:
              "This agent answers 1 number. Point it elsewhere first.",
            numbers: [phoneNumber],
          },
          409,
        ),
      );

      try {
        await noRetryClient.voice.agents.delete(agentId);
        expect.fail("should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(SendlyError);
        expect((error as SendlyError).code).toBe("agent_in_use");
        expect((error as SendlyError).statusCode).toBe(409);
        expect((error as SendlyError).response?.numbers).toEqual([
          phoneNumber,
        ]);
      }
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("should surface live_key_required on 403 for a test key", async () => {
      const testClient = new Sendly("sk_test_v1_valid_key");
      fetchMock.mockResolvedValue(
        mockFetchResponse(
          {
            error: "live_key_required",
            message: "Voice configuration needs a live API key.",
          },
          403,
        ),
      );

      try {
        await testClient.voice.agents.delete(agentId);
        expect.fail("should have thrown");
      } catch (error) {
        expect((error as SendlyError).code).toBe("live_key_required");
        expect((error as SendlyError).statusCode).toBe(403);
      }
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("voices.list()", () => {
    it("should GET /voice/voices and return id, label and language only", async () => {
      const voices: Voice[] = [
        { id: "ashley", label: "Ashley (US, warm)", language: "en" },
        { id: "diego", label: "Diego (Spanish, MX)", language: "es" },
      ];
      const list: VoiceListResponse = { data: voices };
      fetchMock.mockResolvedValue(mockFetchResponse(list));

      const result = await client.voice.voices.list();

      expect(result.data).toEqual(voices);
      for (const voice of result.data) {
        expect(Object.keys(voice).sort()).toEqual(["id", "label", "language"]);
      }
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/v1\/voice\/voices$/),
        expect.objectContaining({ method: "GET" }),
      );
    });
  });
});
