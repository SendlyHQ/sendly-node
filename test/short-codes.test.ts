/**
 * Tests for the Short Codes resource against the bodies the API sends
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Sendly } from "../src/client";
import { SendlyError } from "../src/errors";
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

  it("application.get() carries the quote in cents and where the setup fee and lease stand", async () => {
    const billing = {
      setupFee: {
        amountCents: 99900,
        status: "paid",
        chargedAt: "submit",
        paidAt: "2026-09-01T10:00:00.000Z",
        refundedCents: 0,
        refundedAt: null,
      },
      lease: {
        monthlyCents: 115000,
        minimumTermMonths: 3,
        startsAt: "go_live",
        state: "past_due",
        billingEnabled: true,
        startedAt: "2026-10-05T08:00:00.000Z",
        nextChargeAt: "2026-11-05T08:00:00.000Z",
        paidThrough: null,
        termEndsAt: "2027-01-05T08:00:00.000Z",
        endsAt: null,
        cancelRequestedAt: null,
        pastDue: {
          chargeId: "charge_1",
          amountCents: 115000,
          status: "failed",
          periodStart: "2026-10-05T08:00:00.000Z",
          periodEnd: "2026-11-05T08:00:00.000Z",
          firstFailedAt: "2026-10-05T08:00:00.000Z",
          pauseAt: "2026-10-12T08:00:00.000Z",
          noticeStage: "failed",
        },
        dueMonths: 0,
        dueCents: 0,
      },
      terms: { version: "2026-10-06", acceptedVersion: "2026-10-06", acceptedAt: "2026-09-01T10:00:00.000Z" },
      refundPolicy: "full_refund_before_filing",
      exempt: null,
      charges: [],
    };
    fetchMock.mockResolvedValue(
      mockFetchResponse({
        ...view,
        quote: {
          ...view.quote,
          setupCents: 99900,
          monthlyCents: 115000,
          minimumTermMonths: 3,
          setupChargedAt: "submit",
          leaseStartsAt: "go_live",
        },
        billing,
      }),
    );

    const result: ShortCodeApplicationView = await client.shortCodes.application.get();

    expect(result.quote.monthlyCents).toBe(115000);
    expect(result.quote.setupChargedAt).toBe("submit");
    expect(result.billing?.setupFee.status).toBe("paid");
    expect(result.billing?.lease.state).toBe("past_due");
    expect(result.billing?.lease.pastDue?.pauseAt).toBe("2026-10-12T08:00:00.000Z");
  });

  it("submit() sends acceptTerms with the answers", async () => {
    fetchMock.mockResolvedValue(
      mockFetchResponse({ ...view, submitted: true, alreadySubmitted: false, payment: { status: "paid", charged: true } }),
    );

    const result = await client.shortCodes.application.submit({ acceptTerms: true, useCase: "Order alerts" });

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/short_codes\/application\/submit$/);
    expect(JSON.parse(init.body)).toEqual({ acceptTerms: true, useCase: "Order alerts" });
    expect(result.payment).toEqual({ status: "paid", charged: true });
  });

  it("submit() throws the payment error with the secure payment page when the bank wants it confirmed", async () => {
    fetchMock.mockResolvedValue(
      mockFetchResponse(
        {
          error: "payment_requires_authentication",
          message: "Your bank needs you to confirm the $999 setup fee.",
          nextStep: "complete_payment",
          feature: "short_code_setup",
          amountCents: 99900,
          actionUrl: "/billing",
          checkoutUrl: "https://checkout.stripe.com/c/pay/cs_test_1",
        },
        402,
      ),
    );

    const error = await client.shortCodes.application
      .submit({ acceptTerms: true })
      .catch((e: SendlyError) => e);

    expect(error).toBeInstanceOf(SendlyError);
    expect((error as SendlyError).code).toBe("payment_requires_authentication");
    expect((error as SendlyError).statusCode).toBe(402);
    expect((error as SendlyError).response?.checkoutUrl).toBe("https://checkout.stripe.com/c/pay/cs_test_1");
    expect((error as SendlyError).response?.nextStep).toBe("complete_payment");
    expect((error as SendlyError).response?.amountCents).toBe(99900);
  });

  it("list() carries each code's billing", async () => {
    fetchMock.mockResolvedValue(
      mockFetchResponse({
        shortCodes: [
          {
            id: "sc_1",
            shortCode: "55123",
            countryCode: "US",
            status: "active",
            reviewStatus: "filed",
            useCase: "Order and delivery alerts",
            createdAt: "2026-08-30T10:00:00.000Z",
            billing: {
              setupFee: { status: "paid", amountCents: 99900 },
              lease: {
                monthlyCents: 115000,
                minimumTermMonths: 3,
                state: "running",
                billingEnabled: true,
                startedAt: "2026-10-05T08:00:00.000Z",
                nextChargeAt: "2026-11-05T08:00:00.000Z",
                paidThrough: "2026-11-05T08:00:00.000Z",
                termEndsAt: "2027-01-05T08:00:00.000Z",
                endsAt: null,
                cancelRequestedAt: null,
                pastDue: null,
                dueMonths: 0,
                dueCents: 0,
              },
            },
          },
        ],
      }),
    );

    const { shortCodes } = await client.shortCodes.list();
    const first: ShortCode = shortCodes[0];

    expect(first.billing?.setupFee.status).toBe("paid");
    expect(first.billing?.lease.paidThrough).toBe("2026-11-05T08:00:00.000Z");
  });
});
