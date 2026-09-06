/**
 * Tests for RCS registration - registration, dossier, brands, and the
 * agent draft/submit/test/launch operations
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
  RcsAgentDetail,
  RcsAgentListResponse,
  RcsBrand,
  RcsDossier,
  RcsRegistration,
  RcsTestDevice,
} from "../src/resources/rcs";

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

describe("RCS registration", () => {
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

  const mockBrand: RcsBrand = {
    id: "rcs_brand_123",
    reviewStatus: "draft",
    customerStage: "draft",
    displayName: "Acme Coffee",
    legalName: "Acme Coffee LLC",
    legalEntityType: "LIMITED_LIABILITY_COMPANY",
    organizationType: "PRIVATE_PROFIT",
    stockSymbol: null,
    websiteUrl: "https://acme.example",
    ein: "12-3456789",
    address: {
      line1: "100 Main St",
      line2: null,
      city: "Chicago",
      state: "IL",
      postalCode: "60601",
      countryCode: "US",
    },
    contact: {
      firstName: "Sam",
      lastName: "Lee",
      title: null,
      email: "sam@acme.example",
      phoneNumber: "+13125550100",
    },
    reviewNote: null,
    rejectionReason: null,
    submittedForReviewAt: null,
    sentToCarrierAt: null,
    verifiedAt: null,
    createdAt: "2026-09-01T10:00:00Z",
    updatedAt: "2026-09-01T10:00:00Z",
  };

  const mockDevice: RcsTestDevice = {
    id: "rcs_device_123",
    phoneNumber: "+13125550100",
    label: "Sam's Pixel",
    inviteStatus: null,
    createdAt: "2026-09-01T12:00:00Z",
  };

  const mockAgent: RcsAgentDetail = {
    id: "rcs_agent_123",
    brandId: "rcs_brand_123",
    status: "draft",
    reviewStatus: "draft",
    customerStage: "draft",
    displayName: "Acme Coffee",
    useCase: "MULTI_USE",
    hostingRegion: null,
    basics: {
      displayName: "Acme Coffee",
      useCase: "MULTI_USE",
      hostingRegion: null,
      description: "Order updates and support for Acme Coffee customers",
      logoUrl: "https://acme.example/rcs/logo.png",
    },
    campaign: null,
    testing: null,
    reviewNote: null,
    rejectionReason: null,
    testDevices: [],
    submittedForReviewAt: null,
    basicsSubmittedAt: null,
    launchSubmittedAt: null,
    liveAt: null,
    createdAt: "2026-09-01T11:00:00Z",
    updatedAt: "2026-09-01T11:00:00Z",
  };

  describe("registration.get()", () => {
    it("should fetch the registration at a glance", async () => {
      const mockResponse: RcsRegistration = {
        brand: mockBrand,
        agent: { ...mockAgent, testDevices: [mockDevice] },
        devices: [mockDevice],
        stage: "draft",
        usEligible: true,
      };
      fetchMock.mockResolvedValue(mockFetchResponse(mockResponse));

      const result = await client.rcs.registration.get();

      expect(result).toEqual(mockResponse);
      expect(result.agent?.testDevices[0].phoneNumber).toBe("+13125550100");
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/v1\/rcs\/registration$/),
        expect.objectContaining({
          method: "GET",
          headers: expect.objectContaining({
            Authorization: "Bearer sk_live_v1_valid_key",
          }),
        }),
      );
      expect(keyOfCall(fetchMock, 0)).toBeUndefined();
    });

    it("should return nulls when nothing is registered yet", async () => {
      const mockResponse: RcsRegistration = {
        brand: null,
        agent: null,
        devices: [],
        stage: "draft",
        usEligible: true,
      };
      fetchMock.mockResolvedValue(mockFetchResponse(mockResponse));

      const result = await client.rcs.registration.get();

      expect(result.brand).toBeNull();
      expect(result.agent).toBeNull();
      expect(result.stage).toBe("draft");
    });
  });

  describe("dossier.get()", () => {
    it("should fetch prefilled brand details", async () => {
      const mockResponse: RcsDossier = {
        brand: {
          legalName: "Acme Coffee LLC",
          ein: "12-3456789",
          organizationType: "PRIVATE_PROFIT",
          address: { line1: "100 Main St", city: "Chicago", countryCode: "US" },
        },
        usEligible: true,
        source: "tendlc",
      };
      fetchMock.mockResolvedValue(mockFetchResponse(mockResponse));

      const result = await client.rcs.dossier.get();

      expect(result).toEqual(mockResponse);
      expect(result.source).toBe("tendlc");
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/v1\/rcs\/dossier$/),
        expect.objectContaining({ method: "GET" }),
      );
    });
  });

  describe("brands.create()", () => {
    const request = {
      displayName: "Acme Coffee",
      legalName: "Acme Coffee LLC",
      legalEntityType: "LIMITED_LIABILITY_COMPANY" as const,
      ein: "12-3456789",
      address: {
        line1: "100 Main St",
        city: "Chicago",
        state: "IL",
        postalCode: "60601",
        countryCode: "US",
      },
      contact: { firstName: "Sam", lastName: "Lee" },
    };

    it("should create a brand draft", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse({ brand: mockBrand }, 201),
      );

      const result = await client.rcs.brands.create(request);

      expect(result.brand).toEqual(mockBrand);
      expect(result.brand.reviewStatus).toBe("draft");
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/v1\/rcs\/brands$/),
        expect.objectContaining({ method: "POST" }),
      );
      expect(bodyOfCall(fetchMock, 0)).toEqual(request);
    });

    it("should attach an automatic idempotency key", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse({ brand: mockBrand }, 201),
      );

      await client.rcs.brands.create(request);

      expect(keyOfCall(fetchMock, 0)).toMatch(/^sendly-node-retry-/);
    });

    it("should send a caller-supplied idempotency key", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse({ brand: mockBrand }, 201),
      );

      await client.rcs.brands.create(request, {
        idempotencyKey: "rcs-brand-acme",
      });

      expect(keyOfCall(fetchMock, 0)).toBe("rcs-brand-acme");
    });

    it("should reject an invalid idempotency key locally", async () => {
      await expect(
        client.rcs.brands.create(request, { idempotencyKey: "a".repeat(256) }),
      ).rejects.toThrow(ValidationError);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("should surface rcs_us_only on 422", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse(
          {
            error: "rcs_us_only",
            message: "RCS registration is available to US businesses for now.",
          },
          422,
        ),
      );

      try {
        await noRetryClient.rcs.brands.create({
          ...request,
          address: { ...request.address, countryCode: "GB" },
        });
        expect.fail("should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(SendlyError);
        expect((error as SendlyError).code).toBe("rcs_us_only");
        expect((error as SendlyError).statusCode).toBe(422);
      }
    });
  });

  describe("brands.update()", () => {
    it("should patch a brand and pass nulls through", async () => {
      const updated = { ...mockBrand, websiteUrl: "https://acme.example/new" };
      fetchMock.mockResolvedValue(mockFetchResponse({ brand: updated }));

      const result = await client.rcs.brands.update("rcs_brand_123", {
        websiteUrl: "https://acme.example/new",
        stockSymbol: null,
        contact: { title: "Head of Support" },
      });

      expect(result.brand.websiteUrl).toBe("https://acme.example/new");
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/v1\/rcs\/brands\/rcs_brand_123$/),
        expect.objectContaining({ method: "PATCH" }),
      );
      expect(bodyOfCall(fetchMock, 0)).toEqual({
        websiteUrl: "https://acme.example/new",
        stockSymbol: null,
        contact: { title: "Head of Support" },
      });
      expect(keyOfCall(fetchMock, 0)).toBeUndefined();
    });

    it("should send a caller-supplied idempotency key on PATCH", async () => {
      fetchMock.mockResolvedValue(mockFetchResponse({ brand: mockBrand }));

      await client.rcs.brands.update(
        "rcs_brand_123",
        { websiteUrl: "https://acme.example" },
        { idempotencyKey: "rcs-brand-update-1" },
      );

      expect(keyOfCall(fetchMock, 0)).toBe("rcs-brand-update-1");
    });

    it("should surface rcs_field_locked on 409", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse(
          {
            error: "rcs_field_locked",
            message:
              "This registration is being reviewed; we will email you if changes are needed.",
          },
          409,
        ),
      );

      try {
        await noRetryClient.rcs.brands.update("rcs_brand_123", {
          websiteUrl: "https://acme.example",
        });
        expect.fail("should have thrown");
      } catch (error) {
        expect((error as SendlyError).code).toBe("rcs_field_locked");
        expect((error as SendlyError).statusCode).toBe(409);
      }
    });

    it("should surface rcs_not_found on 404", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse(
          { error: "rcs_not_found", message: "Brand not found" },
          404,
        ),
      );

      try {
        await client.rcs.brands.update("rcs_brand_missing", {
          websiteUrl: "https://acme.example",
        });
        expect.fail("should have thrown");
      } catch (error) {
        expect((error as SendlyError).code).toBe("rcs_not_found");
        expect((error as SendlyError).statusCode).toBe(404);
      }
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("agents.create()", () => {
    const request = {
      brandId: "rcs_brand_123",
      displayName: "Acme Coffee",
      useCase: "MULTI_USE" as const,
      basics: {
        description: "Order updates and support for Acme Coffee customers",
        logoUrl: "https://acme.example/rcs/logo.png",
        website: { url: "https://acme.example", label: "Visit our site" },
      },
    };

    it("should create an agent draft under a brand", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse({ agent: mockAgent }, 201),
      );

      const result = await client.rcs.agents.create(request);

      expect(result.agent).toEqual(mockAgent);
      expect(result.agent.brandId).toBe("rcs_brand_123");
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/v1\/rcs\/agents$/),
        expect.objectContaining({ method: "POST" }),
      );
      expect(bodyOfCall(fetchMock, 0)).toEqual(request);
      expect(keyOfCall(fetchMock, 0)).toMatch(/^sendly-node-retry-/);
    });

    it("should surface rcs_invalid_content with field errors", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse(
          {
            error: "rcs_invalid_content",
            message:
              "Assets can't be uploaded over the API. Logo, hero, and call-to-action media must be public https:// URLs.",
            errors: [
              { path: "basics.logoUrl", message: "Must be a public https:// URL" },
            ],
          },
          422,
        ),
      );

      try {
        await noRetryClient.rcs.agents.create({
          ...request,
          basics: { ...request.basics, logoUrl: "http://acme.example/logo.png" },
        });
        expect.fail("should have thrown");
      } catch (error) {
        const err = error as SendlyError;
        expect(err.code).toBe("rcs_invalid_content");
        expect(err.statusCode).toBe(422);
        expect(err.response?.errors).toEqual([
          { path: "basics.logoUrl", message: "Must be a public https:// URL" },
        ]);
      }
    });
  });

  describe("agents.get()", () => {
    it("should fetch an agent with devices and stage", async () => {
      const mockResponse = {
        agent: {
          ...mockAgent,
          reviewStatus: "approved_for_carrier" as const,
          customerStage: "testing" as const,
          testDevices: [{ ...mockDevice, inviteStatus: "PENDING" }],
        },
        devices: [{ ...mockDevice, inviteStatus: "PENDING" }],
        stage: "testing" as const,
      };
      fetchMock.mockResolvedValue(mockFetchResponse(mockResponse));

      const result = await client.rcs.agents.get("rcs_agent_123");

      expect(result).toEqual(mockResponse);
      expect(result.stage).toBe("testing");
      expect(result.devices[0].inviteStatus).toBe("PENDING");
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/v1\/rcs\/agents\/rcs_agent_123$/),
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("should surface rcs_not_found on 404 without retrying", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse(
          { error: "rcs_not_found", message: "Agent not found" },
          404,
        ),
      );

      try {
        await client.rcs.agents.get("rcs_agent_missing");
        expect.fail("should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(SendlyError);
        expect((error as SendlyError).code).toBe("rcs_not_found");
        expect((error as SendlyError).statusCode).toBe(404);
      }
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("agents.update()", () => {
    it("should patch the campaign section", async () => {
      const campaign = {
        agentOverview: "Order confirmations and pickup alerts",
        interactions: [
          {
            interactionType: "TRANSACTIONAL_UPDATES" as const,
            description: "Order status",
          },
        ],
        messageExamples: ["One", "Two", "Three"],
      };
      fetchMock.mockResolvedValue(
        mockFetchResponse({ agent: { ...mockAgent, campaign } }),
      );

      const result = await client.rcs.agents.update("rcs_agent_123", {
        campaign,
      });

      expect(result.agent.campaign?.messageExamples).toHaveLength(3);
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/v1\/rcs\/agents\/rcs_agent_123$/),
        expect.objectContaining({ method: "PATCH" }),
      );
      expect(bodyOfCall(fetchMock, 0)).toEqual({ campaign });
      expect(keyOfCall(fetchMock, 0)).toBeUndefined();
    });

    it("should send null to clear a section", async () => {
      fetchMock.mockResolvedValue(mockFetchResponse({ agent: mockAgent }));

      await client.rcs.agents.update(
        "rcs_agent_123",
        { displayName: "Acme Coffee Co", testing: null },
        { idempotencyKey: "rcs-agent-update-1" },
      );

      expect(bodyOfCall(fetchMock, 0)).toEqual({
        displayName: "Acme Coffee Co",
        testing: null,
      });
      expect(keyOfCall(fetchMock, 0)).toBe("rcs-agent-update-1");
    });
  });

  describe("agents.setTestDevices()", () => {
    it("should replace the device list", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse({
          devices: [mockDevice, { ...mockDevice, id: "rcs_device_456", phoneNumber: "+13125550101", label: null }],
        }),
      );

      const result = await client.rcs.agents.setTestDevices("rcs_agent_123", [
        { phoneNumber: "+13125550100", label: "Sam's Pixel" },
        { phoneNumber: "+13125550101" },
      ]);

      expect(result.devices).toHaveLength(2);
      expect(result.devices[1].label).toBeNull();
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/v1\/rcs\/agents\/rcs_agent_123\/test-devices$/),
        expect.objectContaining({ method: "PUT" }),
      );
      expect(bodyOfCall(fetchMock, 0)).toEqual({
        devices: [
          { phoneNumber: "+13125550100", label: "Sam's Pixel" },
          { phoneNumber: "+13125550101" },
        ],
      });
      expect(keyOfCall(fetchMock, 0)).toBeUndefined();
    });

    it("should surface a bad device number as rcs_invalid_content", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse(
          {
            error: "rcs_invalid_content",
            message: "Invalid content",
            errors: [
              {
                path: "devices.0.phoneNumber",
                message:
                  "Enter the device's phone number in E.164 format, like +13125550100",
              },
            ],
          },
          422,
        ),
      );

      try {
        await noRetryClient.rcs.agents.setTestDevices("rcs_agent_123", [
          { phoneNumber: "not-a-number" },
        ]);
        expect.fail("should have thrown");
      } catch (error) {
        const err = error as SendlyError;
        expect(err.code).toBe("rcs_invalid_content");
        expect(err.response?.errors?.[0].path).toBe("devices.0.phoneNumber");
      }
    });
  });

  describe("agents.submit()", () => {
    it("should submit for review with an empty JSON body", async () => {
      const submitted = {
        ...mockAgent,
        reviewStatus: "awaiting_review" as const,
        customerStage: "in_review" as const,
        submittedForReviewAt: "2026-09-02T09:00:00Z",
      };
      fetchMock.mockResolvedValue(
        mockFetchResponse({ agent: submitted, stage: "in_review" }),
      );

      const result = await client.rcs.agents.submit("rcs_agent_123", {
        idempotencyKey: "rcs-submit-rcs_agent_123",
      });

      expect(result.stage).toBe("in_review");
      expect(result.agent.reviewStatus).toBe("awaiting_review");
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/v1\/rcs\/agents\/rcs_agent_123\/submit$/),
        expect.objectContaining({ method: "POST", body: "{}" }),
      );
      expect(keyOfCall(fetchMock, 0)).toBe("rcs-submit-rcs_agent_123");
    });

    it("should attach an automatic idempotency key when none is given", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse({ agent: mockAgent, stage: "in_review" }),
      );

      await client.rcs.agents.submit("rcs_agent_123");

      expect(keyOfCall(fetchMock, 0)).toMatch(/^sendly-node-retry-/);
    });

    it("should surface missing fields as rcs_invalid_content", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse(
          {
            error: "rcs_invalid_content",
            message: "Finish the brand and agent before submitting",
            errors: [
              { path: "brand.ein", message: "Enter a 9-digit EIN" },
              { path: "agent.logoUrl", message: "Must be a public https:// URL" },
            ],
          },
          422,
        ),
      );

      try {
        await noRetryClient.rcs.agents.submit("rcs_agent_123");
        expect.fail("should have thrown");
      } catch (error) {
        const err = error as SendlyError;
        expect(err.code).toBe("rcs_invalid_content");
        expect(err.response?.errors?.map((e) => e.path)).toEqual([
          "brand.ein",
          "agent.logoUrl",
        ]);
      }
    });

    it("should surface rcs_brand_not_verified on 409", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse(
          {
            error: "rcs_brand_not_verified",
            message: "This brand did not pass carrier verification.",
          },
          409,
        ),
      );

      try {
        await noRetryClient.rcs.agents.submit("rcs_agent_123");
        expect.fail("should have thrown");
      } catch (error) {
        expect((error as SendlyError).code).toBe("rcs_brand_not_verified");
      }
    });
  });

  describe("agents.requestLaunch()", () => {
    it("should request launch with testing details", async () => {
      const launching = {
        ...mockAgent,
        reviewStatus: "launch_requested" as const,
        customerStage: "launch_review" as const,
      };
      fetchMock.mockResolvedValue(
        mockFetchResponse({ agent: launching, stage: "launch_review" }),
      );

      const result = await client.rcs.agents.requestLaunch("rcs_agent_123", {
        testUrl: "https://acme.example/rcs-test",
        testingAdditionalInformation: "Tap 'Order' on the test page",
      });

      expect(result.stage).toBe("launch_review");
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/v1\/rcs\/agents\/rcs_agent_123\/request-launch$/),
        expect.objectContaining({ method: "POST" }),
      );
      expect(bodyOfCall(fetchMock, 0)).toEqual({
        testUrl: "https://acme.example/rcs-test",
        testingAdditionalInformation: "Tap 'Order' on the test page",
      });
      expect(keyOfCall(fetchMock, 0)).toMatch(/^sendly-node-retry-/);
    });

    it("should send an empty JSON body when no details are given", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse({ agent: mockAgent, stage: "launch_review" }),
      );

      await client.rcs.agents.requestLaunch("rcs_agent_123", undefined, {
        idempotencyKey: "rcs-launch-1",
      });

      expect(fetchMock.mock.calls[0][1].body).toBe("{}");
      expect(keyOfCall(fetchMock, 0)).toBe("rcs-launch-1");
    });

    it("should surface rcs_launch_not_ready on 409", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse(
          {
            error: "rcs_launch_not_ready",
            message:
              "This agent isn't ready to launch yet. Finish testing on an invited device first.",
          },
          409,
        ),
      );

      try {
        await noRetryClient.rcs.agents.requestLaunch("rcs_agent_123");
        expect.fail("should have thrown");
      } catch (error) {
        expect((error as SendlyError).code).toBe("rcs_launch_not_ready");
        expect((error as SendlyError).statusCode).toBe(409);
      }
    });
  });

  describe("agents.list() stage", () => {
    it("should expose the customer stage on list items", async () => {
      const mockList: RcsAgentListResponse = {
        agents: [
          {
            id: "rcs_agent_123",
            name: "Acme Coffee",
            status: "testing",
            useCase: "MULTI_USE",
            sendable: true,
            stage: "testing",
            createdAt: "2026-09-01T11:00:00Z",
          },
        ],
      };
      fetchMock.mockResolvedValue(mockFetchResponse(mockList));

      const result = await client.rcs.agents.list();

      expect(result.agents[0].stage).toBe("testing");
    });
  });

  describe("while RCS registration is not enabled", () => {
    const darkBody = {
      error: "rcs_not_enabled",
      message: "RCS registration isn't enabled for this account yet.",
    };

    it("should surface rcs_not_enabled on a read", async () => {
      fetchMock.mockResolvedValue(mockFetchResponse(darkBody, 404));

      try {
        await client.rcs.registration.get();
        expect.fail("should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(SendlyError);
        expect(error).not.toBeInstanceOf(NotFoundError);
        expect((error as SendlyError).code).toBe("rcs_not_enabled");
        expect((error as SendlyError).statusCode).toBe(404);
        expect((error as SendlyError).message).toBe(darkBody.message);
      }
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("should surface rcs_not_enabled on a write without retrying", async () => {
      fetchMock.mockResolvedValue(mockFetchResponse(darkBody, 404));

      try {
        await client.rcs.agents.submit("rcs_agent_123");
        expect.fail("should have thrown");
      } catch (error) {
        expect((error as SendlyError).code).toBe("rcs_not_enabled");
        expect((error as SendlyError).statusCode).toBe(404);
      }
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("scopes", () => {
    it("should throw AuthenticationError when the key lacks rcs:write", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse(
          {
            error: "insufficient_permissions",
            message: "This API key lacks the rcs:write scope",
          },
          403,
        ),
      );

      await expect(
        client.rcs.brands.create({ displayName: "Acme Coffee" }),
      ).rejects.toThrow(AuthenticationError);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("should surface forbidden when the workspace role lacks access", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse(
          { error: "forbidden", message: "You don't have access to this" },
          403,
        ),
      );

      try {
        await client.rcs.registration.get();
        expect.fail("should have thrown");
      } catch (error) {
        expect((error as SendlyError).code).toBe("forbidden");
        expect((error as SendlyError).statusCode).toBe(403);
      }
    });
  });
});
