/**
 * Tests for the business upgrade resource against the bodies the API sends
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Sendly } from "../src/client";
import type { StartUpgradeResponse } from "../src/resources/businessUpgrade";
import { mockFetchResponse } from "./fixtures/responses";

describe("Business upgrade resource", () => {
  let client: Sendly;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    client = new Sendly({ apiKey: "sk_live_v1_valid_key", maxRetries: 0 });
    fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("start() returns the pending upgrade the 202 describes", async () => {
    const accepted: StartUpgradeResponse = {
      success: true,
      pendingVerificationId: "bv_new",
      status: "provisioning",
      message:
        "Your business entity upgrade is being provisioned. Your current number stays active until the new one is approved (typically 1-2 weeks).",
    };
    fetchMock.mockResolvedValue(mockFetchResponse(accepted, 202));

    const result: StartUpgradeResponse = await client.businessUpgrade.start("org_1", {
      businessName: "Acme LLC",
      brn: "12-3456789",
      brnType: "EIN",
      brnCountry: "US",
      entityType: "PRIVATE_PROFIT",
    });

    expect(result.success).toBe(true);
    expect(result.pendingVerificationId).toBe("bv_new");
    expect(result.status).toBe("provisioning");
    const number: string | undefined = result.tollFreeNumber;
    expect(number).toBeUndefined();
    expect(fetchMock.mock.calls[0][0]).toContain("/v1/workspaces/org_1/upgrade");
  });
});
