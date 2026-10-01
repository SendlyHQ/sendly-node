/**
 * Tests for the Short Codes resource against the bodies the API sends
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Sendly } from "../src/client";
import type { ShortCode, ShortCodeApplicationView } from "../src/types";
import { mockFetchResponse } from "./fixtures/responses";

const application = {
  useCase: "Order and delivery alerts",
  optInFlow: "Customers text JOIN to the code after checkout.",
  expectedMonthlyVolume: "50000",
  expectedDailyVolume: "2000",
  helpResponse: null,
  stopConfirmation: null,
  optInConfirmation: null,
  privacyPolicyUrl: "https://acme.example/privacy",
  termsUrl: "https://acme.example/terms",
  messageFrequency: "Up to 4 messages per order",
  campaignKeyword: "JOIN",
  requestedDigits: null,
  losingProvider: null,
  brandContactName: "Ada Lovelace",
  brandContactEmail: "ada@acme.example",
  brandContactPhone: "+15125550100",
  contentProviderLegalName: null,
  contentProviderEin: null,
  contentProviderContactName: null,
  contentProviderContactEmail: null,
  contentProviderContactPhone: null,
  id: "sc_1",
  shortCode: null,
  countryCode: "US",
  status: "requested",
  reviewStatus: "approved",
  reviewNote: null,
  orderType: "new",
  codeType: "random",
  contentProviderSameAsBrand: true,
  sampleMessages: ["Acme: your order shipped. Reply STOP to opt out."],
  brandRegistrationStatus: "registered",
  contentProviderRegistrationStatus: "not_started",
  submittedAt: "2026-09-01T10:00:00.000Z",
  reviewedAt: "2026-09-03T10:00:00.000Z",
  filedAt: null,
  activatedAt: null,
  registryRevettingDueAt: null,
  createdAt: "2026-08-30T10:00:00.000Z",
  updatedAt: "2026-09-03T10:00:00.000Z",
};

const view = {
  enabled: true,
  application,
  prefill: { source: "none" },
  editable: false,
  lockMessage: "Sendly approved this application and is filing it with the carriers.",
  canStartNewApplication: false,
  generatedDefaults: null,
  requiredDocuments: ["loa"],
  missingDocuments: [],
  documents: [
    {
      kind: "loa",
      templateReady: true,
      signedAt: "2026-09-02T10:00:00.000Z",
      signedByName: "Ada Lovelace",
      awaitingSignature: false,
    },
  ],
  quote: {
    codeType: "random",
    monthlyUsd: 1000,
    setupUsd: 999,
    currency: "USD",
    autoBilled: false,
  },
  verification: { verified: true, state: "verified", href: "/verify" },
  carriers: {
    approved: 1,
    total: 4,
    overall: "in_progress",
    byCarrier: [
      { carrier: "ATT", label: "AT&T", status: "approved", updatedAt: "2026-09-10T10:00:00.000Z" },
      { carrier: "TMOBILE", label: "T-Mobile", status: "in_review", updatedAt: null },
      { carrier: "VERIZON", label: "Verizon", status: "submitted", updatedAt: null },
      { carrier: "US_CELLULAR", label: "US Cellular", status: "not_submitted", updatedAt: null },
    ],
  },
};

describe("Short codes resource", () => {
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

  it("application.get() carries the setup fee, review dates and carrier breakdown", async () => {
    fetchMock.mockResolvedValue(mockFetchResponse(view));

    const result: ShortCodeApplicationView = await client.shortCodes.application.get();

    expect(result.quote.setupUsd).toBe(999);
    expect(result.quote.monthlyUsd).toBe(1000);
    expect(result.application.reviewedAt).toBe("2026-09-03T10:00:00.000Z");
    expect(result.application.registryRevettingDueAt).toBeNull();
    expect(result.verification?.state).toBe("verified");
    expect(result.carriers.byCarrier?.[1]).toEqual({
      carrier: "TMOBILE",
      label: "T-Mobile",
      status: "in_review",
      updatedAt: null,
    });
  });

  it("list() carries each code's review status", async () => {
    const code = {
      id: "sc_1",
      shortCode: "55123",
      countryCode: "US",
      status: "active",
      reviewStatus: "approved",
      useCase: "Order and delivery alerts",
      createdAt: "2026-08-30T10:00:00.000Z",
    };
    fetchMock.mockResolvedValue(mockFetchResponse({ shortCodes: [code] }));

    const { shortCodes } = await client.shortCodes.list();
    const first: ShortCode = shortCodes[0];

    expect(first.reviewStatus).toBe("approved");
    expect(first.shortCode).toBe("55123");
  });
});
