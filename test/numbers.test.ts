/**
 * Tests for Numbers Resource - listCountries, listAvailable, list, buy
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { Sendly } from "../src/client";
import {
  AuthenticationError,
  RateLimitError,
  NotFoundError,
} from "../src/errors";
import { mockFetchResponse } from "./fixtures/responses";
import type {
  ListNumberCountriesResponse,
  ListAvailableNumbersResponse,
  ListNumbersResponse,
  BuyNumberResponse,
} from "../src/resources/numbers";

describe("Numbers Resource", () => {
  let client: Sendly;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    client = new Sendly("sk_test_v1_valid_key");
    fetchMock = vi.fn();
    global.fetch = fetchMock;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("listCountries()", () => {
    const mockCountries: ListNumberCountriesResponse = {
      countries: [
        { code: "GB", name: "United Kingdom", numberTypes: ["mobile", "local"] },
        { code: "US", name: "United States", numberTypes: ["local", "toll_free"] },
      ],
    };

    it("should list countries", async () => {
      fetchMock.mockResolvedValue(mockFetchResponse(mockCountries));

      const result = await client.numbers.listCountries();

      expect(result).toEqual(mockCountries);
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/v1/numbers/countries"),
        expect.objectContaining({
          method: "GET",
          headers: expect.objectContaining({
            Authorization: "Bearer sk_test_v1_valid_key",
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

      await expect(client.numbers.listCountries()).rejects.toThrow(
        AuthenticationError,
      );
    });
  });

  describe("listAvailable()", () => {
    const mockAvailable: ListAvailableNumbersResponse = {
      numbers: [
        {
          phoneNumber: "+447700900123",
          country: "GB",
          numberType: "mobile",
          monthlyCost: "1.50",
          currency: "USD",
        },
      ],
    };

    it("should list available numbers with country and type", async () => {
      fetchMock.mockResolvedValue(mockFetchResponse(mockAvailable));

      const result = await client.numbers.listAvailable({
        country: "GB",
        type: "mobile",
      });

      expect(result).toEqual(mockAvailable);
      const url = fetchMock.mock.calls[0][0];
      expect(url).toContain("/v1/numbers/available");
      expect(url).toContain("country=GB");
      expect(url).toContain("type=mobile");
      expect(fetchMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("should include the contains filter when provided", async () => {
      fetchMock.mockResolvedValue(mockFetchResponse(mockAvailable));

      await client.numbers.listAvailable({
        country: "GB",
        type: "mobile",
        contains: "7700",
      });

      const url = fetchMock.mock.calls[0][0];
      expect(url).toContain("contains=7700");
    });

    it("should omit the contains filter when not provided", async () => {
      fetchMock.mockResolvedValue(mockFetchResponse(mockAvailable));

      await client.numbers.listAvailable({ country: "GB", type: "mobile" });

      const url = fetchMock.mock.calls[0][0];
      expect(url).not.toContain("contains=");
    });

    it("should throw RateLimitError on 429", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse(
          { error: "rate_limit_exceeded", message: "Rate limit exceeded", retryAfter: 60 },
          429,
        ),
      );

      await expect(
        client.numbers.listAvailable({ country: "GB", type: "mobile" }),
      ).rejects.toThrow(RateLimitError);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("list()", () => {
    const mockOwned: ListNumbersResponse = {
      numbers: [
        {
          id: "num_abc123",
          phoneNumber: "+447700900123",
          status: "active",
          source: "purchased",
          countryCode: "GB",
          phoneNumberType: "mobile",
          monthlyCostCents: 150,
        },
      ],
    };

    it("should list owned numbers", async () => {
      fetchMock.mockResolvedValue(mockFetchResponse(mockOwned));

      const result = await client.numbers.list();

      expect(result).toEqual(mockOwned);
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/v1/numbers"),
        expect.objectContaining({ method: "GET" }),
      );
    });
  });

  describe("buy()", () => {
    const buyBody = {
      phoneNumber: "+447700900123",
      countryCode: "GB",
      phoneNumberType: "mobile",
      monthlyCost: "1.50",
    };

    it("should return provisioning status", async () => {
      const mockResponse: BuyNumberResponse = {
        status: "provisioning",
        number: {
          id: "num_abc123",
          phoneNumber: "+447700900123",
          status: "provisioning",
        },
      };
      fetchMock.mockResolvedValue(mockFetchResponse(mockResponse, 202));

      const result = await client.numbers.buy(buyBody);

      expect(result).toEqual(mockResponse);
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/v1/numbers/buy"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(buyBody),
        }),
      );
    });

    it("should return the action hand-off on documents_required", async () => {
      const mockResponse: BuyNumberResponse = {
        status: "documents_required",
        requirements: [
          { type: "identity_document", description: "Government-issued ID" },
        ],
        action: {
          url: "https://sendly.live/cli-action/a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6",
          actionCode: "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6",
          code: "ABCD2345",
          expiresAt: 1780000000000,
        },
      };
      fetchMock.mockResolvedValue(mockFetchResponse(mockResponse, 202));

      const result = await client.numbers.buy(buyBody);

      expect(result.status).toBe("documents_required");
      expect(result.action?.actionCode).toBe(
        "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6",
      );
      expect(result.action?.code).toBe("ABCD2345");
      expect(result.action?.actionCode).not.toBe(result.action?.code);
      expect(result.action?.url).toContain(result.action?.actionCode ?? "");
      expect(Array.isArray(result.requirements)).toBe(true);
    });

    it("should return the action hand-off on payment_required", async () => {
      const mockResponse: BuyNumberResponse = {
        status: "payment_required",
        action: {
          url: "https://sendly.live/cli-action/f6e5d4c3b2a1f6e5d4c3b2a1f6e5d4c3",
          actionCode: "f6e5d4c3b2a1f6e5d4c3b2a1f6e5d4c3",
          code: "PAYX2345",
          expiresAt: 1780000000000,
        },
      };
      fetchMock.mockResolvedValue(mockFetchResponse(mockResponse, 202));

      const result = await client.numbers.buy(buyBody);

      expect(result.status).toBe("payment_required");
      expect(result.action?.actionCode).toBe(
        "f6e5d4c3b2a1f6e5d4c3b2a1f6e5d4c3",
      );
      expect(result.action?.code).toBe("PAYX2345");
    });

    it("should send the 32-hex actionCode when provided on re-call", async () => {
      const mockResponse: BuyNumberResponse = { status: "provisioning" };
      fetchMock.mockResolvedValue(mockFetchResponse(mockResponse, 202));

      await client.numbers.buy({
        ...buyBody,
        actionCode: "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6",
      });

      const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(callBody.actionCode).toBe("a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6");
    });

    it("should not send actionCode when omitted", async () => {
      const mockResponse: BuyNumberResponse = { status: "provisioning" };
      fetchMock.mockResolvedValue(mockFetchResponse(mockResponse, 202));

      await client.numbers.buy(buyBody);

      const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(callBody).not.toHaveProperty("actionCode");
    });

    it("should throw NotFoundError on 404", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse(
          { error: "not_found", message: "Number not found" },
          404,
        ),
      );

      await expect(client.numbers.buy(buyBody)).rejects.toThrow(NotFoundError);
    });
  });
});
