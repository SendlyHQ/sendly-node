import { describe, it, expect, beforeEach, vi } from "vitest";
import { Sendly } from "../src/client";
import { SendlyError } from "../src/errors";
import type { SendlyErrorCode } from "../src/types";
import { mockFetchResponse } from "./fixtures/responses";

describe("LinksResource", () => {
  let client: Sendly;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    client = new Sendly({ apiKey: "sk_live_v1_valid_key", maxRetries: 2 });
    fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it("pages with limit and offset", async () => {
    fetchMock.mockResolvedValue(mockFetchResponse({ links: [], total: 120 }));
    const page = await client.links.list({ limit: 50, offset: 100 });
    expect(page.total).toBe(120);
    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.pathname).toBe("/api/v1/links");
    expect(url.searchParams.get("limit")).toBe("50");
    expect(url.searchParams.get("offset")).toBe("100");
  });

  it("keeps the verification link on a refusal", async () => {
    fetchMock.mockResolvedValue(
      mockFetchResponse(
        {
          error: "business_verification_required",
          message: "Short links need an approved business verification for this workspace.",
          verificationUrl: "/verify",
        },
        403,
      ),
    );
    const err = (await client.links.create({ url: "https://shop.example/sale" }).catch((e) => e)) as SendlyError;
    expect(err).toBeInstanceOf(SendlyError);
    expect(err.code).toBe("business_verification_required");
    expect(err.response?.verificationUrl).toBe("/verify");
  });

  it("does not retry the daily link limit", async () => {
    fetchMock.mockResolvedValue(
      mockFetchResponse(
        {
          error: "daily_link_limit_reached",
          message: "This workspace has created 1,000 short links today, the daily limit.",
          limit: 1000,
          resetsAt: "2026-10-09T00:00:00.000Z",
          retryAfter: 3600,
        },
        429,
        { "Retry-After": "3600" },
      ),
    );
    const err = (await client.links.create({ url: "https://shop.example/sale" }).catch((e) => e)) as SendlyError;
    expect(err.code).toBe("daily_link_limit_reached");
    expect(err.response?.resetsAt).toBe("2026-10-09T00:00:00.000Z");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("names the refused destination's reason", async () => {
    fetchMock.mockResolvedValue(
      mockFetchResponse(
        { error: "link_destination_not_allowed", message: "Use the full destination URL.", reason: "public_shortener" },
        400,
      ),
    );
    const err = (await client.links.create({ url: "https://bit.ly/x" }).catch((e) => e)) as SendlyError;
    expect(err.code).toBe("link_destination_not_allowed");
    expect(err.response?.reason).toBe("public_shortener");
  });

  it("types the link error codes", () => {
    const codes: SendlyErrorCode[] = [
      "business_verification_required",
      "daily_link_limit_reached",
      "link_destination_not_allowed",
      "destination_too_long",
      "invalid_url",
      "already_short",
      "link_disabled_by_sendly",
      "link_not_found",
      "short_links_disabled",
      "workspace_required",
      "live_key_required",
    ];
    expect(codes).toHaveLength(11);
  });
});
