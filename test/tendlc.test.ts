/**
 * Tests for 10DLC Resource - brands, qualify, campaigns, assignments
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { Sendly } from "../src/client";
import {
  AuthenticationError,
  RateLimitError,
  NotFoundError,
  SendlyError,
} from "../src/errors";
import { mockFetchResponse } from "./fixtures/responses";
import type {
  TenDlcBrand,
  TenDlcBrandListResponse,
  TenDlcBrandResponse,
  TenDlcQualifyResponse,
  TenDlcCampaign,
  TenDlcCampaignListResponse,
  TenDlcCampaignResponse,
  TenDlcAssignment,
  TenDlcAssignmentResponse,
  TenDlcAssignmentListResponse,
} from "../src/resources/tendlc";

describe("10DLC Resource", () => {
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

  const mockBrand: TenDlcBrand = {
    id: "brd_abc123",
    legalName: "Acme Holdings LLC",
    dba: "Acme",
    entityType: "PRIVATE_PROFIT",
    ein: "12-3456789",
    vertical: "TECHNOLOGY",
    website: "https://acme.example",
    status: "pending",
    identityStatus: null,
    failureReasons: null,
    createdAt: "2026-06-30T10:00:00Z",
    updatedAt: "2026-06-30T10:00:00Z",
  };

  const mockCampaign: TenDlcCampaign = {
    id: "cmp_abc123",
    brandId: "brd_abc123",
    useCase: "MIXED",
    subUseCases: [],
    description: "Order updates and support replies",
    status: "pending",
    sampleMessages: ["Your order #123 has shipped!"],
    throughput: null,
    failureReasons: null,
    createdAt: "2026-06-30T11:00:00Z",
    updatedAt: "2026-06-30T11:00:00Z",
  };

  const mockAssignment: TenDlcAssignment = {
    id: "pnc_abc123",
    campaignId: "cmp_abc123",
    phoneNumber: "+15551234567",
    status: "Under review",
    assignedAt: null,
  };

  describe("listBrands()", () => {
    const mockList: TenDlcBrandListResponse = { data: [mockBrand] };

    it("should list brands", async () => {
      fetchMock.mockResolvedValue(mockFetchResponse(mockList));

      const result = await client.tenDlc.listBrands();

      expect(result).toEqual(mockList);
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/v1/tendlc/brands"),
        expect.objectContaining({
          method: "GET",
          headers: expect.objectContaining({
            Authorization: "Bearer sk_live_v1_valid_key",
          }),
        }),
      );
    });

    it("should throw AuthenticationError on 401", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse(
          { error: "unauthorized", message: "Unauthorized" },
          401,
        ),
      );

      await expect(client.tenDlc.listBrands()).rejects.toThrow(
        AuthenticationError,
      );
    });

    it("should throw NotFoundError when the feature is not enabled", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse({ error: "not_found" }, 404),
      );

      await expect(client.tenDlc.listBrands()).rejects.toThrow(NotFoundError);
    });
  });

  describe("createBrand()", () => {
    it("should create a brand", async () => {
      const mockResponse: TenDlcBrandResponse = { data: mockBrand };
      fetchMock.mockResolvedValue(mockFetchResponse(mockResponse, 201));

      const result = await client.tenDlc.createBrand({
        legalName: "Acme Holdings LLC",
        ein: "12-3456789",
        entityType: "PRIVATE_PROFIT",
        website: "https://acme.example",
      });

      expect(result).toEqual(mockResponse);
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/v1/tendlc/brands"),
        expect.objectContaining({ method: "POST" }),
      );
      const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(callBody.legalName).toBe("Acme Holdings LLC");
      expect(callBody.ein).toBe("12-3456789");
    });

    it("should not send optional fields when omitted", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse({ data: mockBrand }, 201),
      );

      await client.tenDlc.createBrand({ legalName: "Acme Holdings LLC" });

      const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(callBody).toEqual({ legalName: "Acme Holdings LLC" });
    });

    it("should throw SendlyError when legalName is missing", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse({ error: "legalName is required" }, 400),
      );

      await expect(
        client.tenDlc.createBrand({ legalName: "" }),
      ).rejects.toThrow(SendlyError);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("should surface live_key_required on 403", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse(
          {
            error: "live_key_required",
            message: "Brand registration requires a live API key.",
          },
          403,
        ),
      );

      await expect(
        client.tenDlc.createBrand({ legalName: "Acme Holdings LLC" }),
      ).rejects.toThrow(SendlyError);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("getBrand()", () => {
    it("should fetch a brand by id", async () => {
      const mockResponse: TenDlcBrandResponse = {
        data: { ...mockBrand, status: "verified" },
      };
      fetchMock.mockResolvedValue(mockFetchResponse(mockResponse));

      const result = await client.tenDlc.getBrand("brd_abc123");

      expect(result.data.status).toBe("verified");
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/v1/tendlc/brands/brd_abc123"),
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("should throw NotFoundError on 404", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse({ error: "not_found" }, 404),
      );

      await expect(client.tenDlc.getBrand("brd_missing")).rejects.toThrow(
        NotFoundError,
      );
    });
  });

  describe("qualify()", () => {
    it("should return a qualified use case with throughput", async () => {
      const mockResponse: TenDlcQualifyResponse = {
        data: {
          useCase: "MIXED",
          qualified: true,
          reason: null,
          throughput: { tier: "Standard", carriersReady: 3 },
        },
      };
      fetchMock.mockResolvedValue(mockFetchResponse(mockResponse));

      const result = await client.tenDlc.qualify("brd_abc123", "MIXED");

      expect(result).toEqual(mockResponse);
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/v1/tendlc/brands/brd_abc123/qualify/MIXED"),
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("should return the scrubbed reason when not qualified", async () => {
      const mockResponse: TenDlcQualifyResponse = {
        data: {
          useCase: "MARKETING",
          qualified: false,
          reason:
            "This use case is not currently accepted on the carrier network",
          throughput: null,
        },
      };
      fetchMock.mockResolvedValue(mockFetchResponse(mockResponse));

      const result = await client.tenDlc.qualify("brd_abc123", "MARKETING");

      expect(result.data.qualified).toBe(false);
      expect(result.data.reason).toContain("carrier network");
    });
  });

  describe("listCampaigns()", () => {
    it("should list campaigns", async () => {
      const mockList: TenDlcCampaignListResponse = { data: [mockCampaign] };
      fetchMock.mockResolvedValue(mockFetchResponse(mockList));

      const result = await client.tenDlc.listCampaigns();

      expect(result).toEqual(mockList);
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/v1/tendlc/campaigns"),
        expect.objectContaining({ method: "GET" }),
      );
    });
  });

  describe("createCampaign()", () => {
    const createBody = {
      brandId: "brd_abc123",
      useCase: "MIXED",
      description: "Order updates and support replies",
      messageFlow: "Customers opt in at checkout on acme.example",
      sampleMessages: ["Your order #123 has shipped!"],
    };

    it("should create a campaign", async () => {
      const mockResponse: TenDlcCampaignResponse = { data: mockCampaign };
      fetchMock.mockResolvedValue(mockFetchResponse(mockResponse, 201));

      const result = await client.tenDlc.createCampaign(createBody);

      expect(result).toEqual(mockResponse);
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/v1/tendlc/campaigns"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(createBody),
        }),
      );
    });

    it("should send optional keyword fields when provided", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse({ data: mockCampaign }, 201),
      );

      await client.tenDlc.createCampaign({
        ...createBody,
        optOutKeywords: "STOP",
        embeddedLink: false,
      });

      const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(callBody.optOutKeywords).toBe("STOP");
      expect(callBody.embeddedLink).toBe(false);
    });

    it("should surface brand_not_verified on 400", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse(
          {
            error: "brand_not_verified",
            message: "Brand must be verified before creating a campaign",
          },
          400,
        ),
      );

      await expect(
        client.tenDlc.createCampaign(createBody),
      ).rejects.toThrow(SendlyError);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("getCampaign()", () => {
    it("should fetch a campaign with throughput once active", async () => {
      const mockResponse: TenDlcCampaignResponse = {
        data: {
          ...mockCampaign,
          status: "active",
          throughput: { tier: "Standard", carriersReady: 4 },
        },
      };
      fetchMock.mockResolvedValue(mockFetchResponse(mockResponse));

      const result = await client.tenDlc.getCampaign("cmp_abc123");

      expect(result.data.status).toBe("active");
      expect(result.data.throughput?.tier).toBe("Standard");
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/v1/tendlc/campaigns/cmp_abc123"),
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("should throw NotFoundError on 404", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse({ error: "not_found" }, 404),
      );

      await expect(client.tenDlc.getCampaign("cmp_missing")).rejects.toThrow(
        NotFoundError,
      );
    });
  });

  describe("assignNumber()", () => {
    it("should assign a number to a campaign", async () => {
      const mockResponse: TenDlcAssignmentResponse = { data: mockAssignment };
      fetchMock.mockResolvedValue(mockFetchResponse(mockResponse, 201));

      const result = await client.tenDlc.assignNumber(
        "cmp_abc123",
        "+15551234567",
      );

      expect(result).toEqual(mockResponse);
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/v1/tendlc/campaigns/cmp_abc123/assign"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ phoneNumber: "+15551234567" }),
        }),
      );
    });

    it("should surface number_not_found on 404", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse({ error: "number_not_found" }, 404),
      );

      await expect(
        client.tenDlc.assignNumber("cmp_abc123", "+15550000000"),
      ).rejects.toThrow(SendlyError);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("should surface campaign_not_active on 400", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse(
          {
            error: "campaign_not_active",
            message: "Campaign must be active before assigning numbers",
          },
          400,
        ),
      );

      await expect(
        client.tenDlc.assignNumber("cmp_abc123", "+15551234567"),
      ).rejects.toThrow(SendlyError);
    });

    it("should surface number_already_assigned on 409", async () => {
      const noRetryClient = new Sendly({
        apiKey: "sk_live_v1_valid_key",
        maxRetries: 0,
      });
      fetchMock.mockResolvedValue(
        mockFetchResponse(
          {
            error: "number_already_assigned",
            message: "This number is already assigned to another campaign",
          },
          409,
        ),
      );

      await expect(
        noRetryClient.tenDlc.assignNumber("cmp_abc123", "+15551234567"),
      ).rejects.toThrow(SendlyError);
    });

    it("should throw RateLimitError on 429", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse(
          {
            error: "rate_limit_exceeded",
            message: "Rate limit exceeded",
            retryAfter: 60,
          },
          429,
        ),
      );

      await expect(
        client.tenDlc.assignNumber("cmp_abc123", "+15551234567"),
      ).rejects.toThrow(RateLimitError);
    });
  });

  describe("listAssignments()", () => {
    it("should list assignments", async () => {
      const mockList: TenDlcAssignmentListResponse = {
        data: [
          {
            ...mockAssignment,
            status: "Active",
            assignedAt: "2026-06-30T12:00:00Z",
          },
        ],
      };
      fetchMock.mockResolvedValue(mockFetchResponse(mockList));

      const result = await client.tenDlc.listAssignments();

      expect(result).toEqual(mockList);
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/v1/tendlc/assignments"),
        expect.objectContaining({ method: "GET" }),
      );
    });
  });
});
