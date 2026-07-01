/**
 * 10DLC Resource — Local-Number Texting Registration
 *
 * @packageDocumentation
 *
 * Register your business for carrier review so you can text from local
 * (10-digit) US numbers. The flow has three steps:
 *
 * 1. **Brand** — register your business identity. Starts `pending`; poll
 *    {@link TenDlcResource.getBrand} until it becomes `verified` (or
 *    `failed`, with `failureReasons` explaining why).
 * 2. **Campaign** — describe your messaging use case under a verified
 *    brand and submit it for carrier review. Starts `pending`; poll
 *    {@link TenDlcResource.getCampaign} until it becomes `active`.
 *    {@link TenDlcResource.qualify} pre-checks a use case before you
 *    create the campaign.
 * 3. **Assign** — attach a number you own to the active campaign with
 *    {@link TenDlcResource.assignNumber}. Once the assignment is
 *    `Active`, the number can send.
 *
 * Brand, campaign, and number-assignment writes require a live API key
 * (`sk_live_v1_xxx`) with the `tendlc:write` scope.
 *
 * @see https://sendly.live/docs/10dlc
 */

import type { HttpClient } from "../utils/http";

/**
 * Carrier-review status of a brand.
 *
 * - `pending` — submitted, awaiting carrier review.
 * - `verified` — approved; campaigns can be created under this brand.
 * - `failed` — rejected; see `failureReasons`.
 */
export type TenDlcBrandStatus = "pending" | "verified" | "failed";

/**
 * A business identity registered for carrier review.
 */
export interface TenDlcBrand {
  /** Unique brand identifier */
  id: string;
  /** Legal business name */
  legalName: string;
  /** "Doing business as" name, if different from the legal name */
  dba: string | null;
  /** Business entity type (e.g. "PRIVATE_PROFIT", "SOLE_PROPRIETOR") */
  entityType: string;
  /** Business registration number (e.g. EIN) */
  ein: string | null;
  /** Industry vertical */
  vertical: string | null;
  /** Business website URL */
  website: string | null;
  /** Carrier-review status */
  status: TenDlcBrandStatus;
  /** Identity-verification detail from the carrier review, when available */
  identityStatus: string | null;
  /** Why the review failed, when `status` is "failed" */
  failureReasons: string[] | null;
  /** When the brand was created (ISO 8601) */
  createdAt: string;
  /** When the brand was last updated (ISO 8601) */
  updatedAt: string;
}

/**
 * Response from {@link TenDlcResource.listBrands}.
 */
export interface TenDlcBrandListResponse {
  data: TenDlcBrand[];
}

/**
 * Response from {@link TenDlcResource.createBrand} and
 * {@link TenDlcResource.getBrand}.
 */
export interface TenDlcBrandResponse {
  data: TenDlcBrand;
}

/**
 * Request body for {@link TenDlcResource.createBrand}.
 */
export interface CreateTenDlcBrandRequest {
  /** Legal business name (required) */
  legalName: string;
  /** "Doing business as" name, if different from the legal name */
  dba?: string;
  /** Business registration number (e.g. EIN) */
  ein?: string;
  /** Business entity type (e.g. "PRIVATE_PROFIT", "SOLE_PROPRIETOR"); defaults to "PRIVATE_PROFIT" */
  entityType?: string;
  /** Industry vertical */
  vertical?: string;
  /** Business website URL */
  website?: string;
  /** Business contact email */
  email?: string;
  /** Business phone number */
  phone?: string;
  /** Business mobile phone number */
  mobilePhone?: string;
  /** Street address */
  street?: string;
  /** City */
  city?: string;
  /** State or region */
  state?: string;
  /** Postal code */
  postalCode?: string;
  /** ISO 3166-1 alpha-2 country code; defaults to "US" */
  country?: string;
  /** Existing Sendly verification to prefill business details from */
  verificationId?: string;
}

/**
 * Messaging throughput granted by the carrier network.
 */
export type TenDlcThroughputTier = "High volume" | "Standard" | "Low volume";

/**
 * Throughput detail for a campaign or use-case qualification.
 */
export interface TenDlcThroughput {
  /** Throughput tier granted by the carrier network */
  tier: TenDlcThroughputTier;
  /** How many carriers have accepted the campaign so far */
  carriersReady: number;
}

/**
 * Result of a use-case qualification pre-check.
 */
export interface TenDlcQualifyResult {
  /** The use-case code that was checked (e.g. "MIXED", "MARKETING") */
  useCase: string;
  /** Whether the use case qualifies for this brand */
  qualified: boolean;
  /** Why the use case does not qualify, when `qualified` is false */
  reason: string | null;
  /** Expected throughput, when the carrier network reports it */
  throughput: TenDlcThroughput | null;
}

/**
 * Response from {@link TenDlcResource.qualify}.
 */
export interface TenDlcQualifyResponse {
  data: TenDlcQualifyResult;
}

/**
 * Carrier-review status of a campaign.
 *
 * - `pending` — submitted, awaiting carrier review.
 * - `active` — approved; numbers can be assigned.
 * - `failed` — rejected; see `failureReasons`.
 * - `suspended` — paused by the carrier network.
 * - `expired` — no longer active.
 */
export type TenDlcCampaignStatus =
  | "pending"
  | "active"
  | "failed"
  | "suspended"
  | "expired";

/**
 * A messaging campaign registered for carrier review.
 */
export interface TenDlcCampaign {
  /** Unique campaign identifier */
  id: string;
  /** The brand this campaign belongs to */
  brandId: string;
  /** Primary use-case code (e.g. "MIXED", "MARKETING") */
  useCase: string;
  /** Sub-use-case codes */
  subUseCases: string[];
  /** What the campaign sends and why */
  description: string | null;
  /** Carrier-review status */
  status: TenDlcCampaignStatus;
  /** Example messages the campaign sends */
  sampleMessages: string[];
  /** Granted throughput, once carriers approve */
  throughput: TenDlcThroughput | null;
  /** Why the review failed, when `status` is "failed" */
  failureReasons: string[] | null;
  /** When the campaign was created (ISO 8601) */
  createdAt: string;
  /** When the campaign was last updated (ISO 8601) */
  updatedAt: string;
}

/**
 * Response from {@link TenDlcResource.listCampaigns}.
 */
export interface TenDlcCampaignListResponse {
  data: TenDlcCampaign[];
}

/**
 * Response from {@link TenDlcResource.createCampaign} and
 * {@link TenDlcResource.getCampaign}.
 */
export interface TenDlcCampaignResponse {
  data: TenDlcCampaign;
}

/**
 * Request body for {@link TenDlcResource.createCampaign}.
 */
export interface CreateTenDlcCampaignRequest {
  /** The verified brand to create the campaign under (required) */
  brandId: string;
  /** Primary use-case code (required, e.g. "MIXED", "MARKETING") */
  useCase: string;
  /** What the campaign sends and why (required) */
  description: string;
  /** How recipients opt in to receive messages (required) */
  messageFlow: string;
  /** Example messages the campaign sends (required; the first 5 are used) */
  sampleMessages: string[];
  /** Sub-use-case codes */
  subUseCases?: string[];
  /** Comma-separated keywords that opt a recipient in */
  optInKeywords?: string;
  /** Comma-separated keywords that opt a recipient out */
  optOutKeywords?: string;
  /** Comma-separated keywords that request help */
  helpKeywords?: string;
  /** Auto-reply sent on opt-in */
  optInMessage?: string;
  /** Auto-reply sent on opt-out */
  optOutMessage?: string;
  /** Auto-reply sent on a help request */
  helpMessage?: string;
  /** Whether messages may contain links; defaults to true */
  embeddedLink?: boolean;
  /** Whether messages may contain phone numbers; defaults to false */
  embeddedPhone?: boolean;
}

/**
 * Review status of a number-to-campaign assignment.
 */
export type TenDlcAssignmentStatus = "Active" | "Under review" | "Action needed";

/**
 * A phone number assigned to a campaign.
 */
export interface TenDlcAssignment {
  /** Unique assignment identifier */
  id: string;
  /** The campaign the number is assigned to */
  campaignId: string;
  /** The assigned phone number in E.164 format */
  phoneNumber: string;
  /** Assignment status; the number can send once "Active" */
  status: TenDlcAssignmentStatus;
  /** When the assignment completed (ISO 8601), or null while in progress */
  assignedAt: string | null;
}

/**
 * Response from {@link TenDlcResource.assignNumber}.
 */
export interface TenDlcAssignmentResponse {
  data: TenDlcAssignment;
}

/**
 * Response from {@link TenDlcResource.listAssignments}.
 */
export interface TenDlcAssignmentListResponse {
  data: TenDlcAssignment[];
}

/**
 * 10DLC resource — register your business for carrier review and text
 * from local US numbers.
 *
 * @example
 * ```typescript
 * // 1. Register a brand and poll until it's verified
 * const { data: brand } = await sendly.tenDlc.createBrand({
 *   legalName: "Acme Holdings LLC",
 *   ein: "12-3456789",
 *   website: "https://acme.example",
 *   email: "ops@acme.example",
 * });
 * // ...poll sendly.tenDlc.getBrand(brand.id) until status === "verified"
 *
 * // 2. Pre-check the use case, then create a campaign
 * const { data: check } = await sendly.tenDlc.qualify(brand.id, "MIXED");
 * if (check.qualified) {
 *   const { data: campaign } = await sendly.tenDlc.createCampaign({
 *     brandId: brand.id,
 *     useCase: "MIXED",
 *     description: "Order updates and support replies for Acme customers",
 *     messageFlow: "Customers opt in at checkout on acme.example",
 *     sampleMessages: ["Your order #123 has shipped!"],
 *   });
 *   // ...poll sendly.tenDlc.getCampaign(campaign.id) until status === "active"
 *
 *   // 3. Assign a number you own
 *   await sendly.tenDlc.assignNumber(campaign.id, "+15551234567");
 * }
 * ```
 */
export class TenDlcResource {
  private readonly http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  /**
   * List the brands registered for carrier review.
   *
   * @returns Your brands and their review status
   *
   * @example
   * ```typescript
   * const { data: brands } = await sendly.tenDlc.listBrands();
   * for (const b of brands) {
   *   console.log(`${b.legalName} — ${b.status}`);
   * }
   * ```
   */
  async listBrands(): Promise<TenDlcBrandListResponse> {
    return this.http.request<TenDlcBrandListResponse>({
      method: "GET",
      path: "/tendlc/brands",
    });
  }

  /**
   * Register a brand for carrier review — step 1 of enabling
   * local-number texting. Requires a live API key.
   *
   * The brand starts `pending`. Poll {@link getBrand} until it becomes
   * `verified` before creating a campaign.
   *
   * @param request - Business identity details (`legalName` is required)
   * @returns The created brand
   *
   * @example
   * ```typescript
   * const { data: brand } = await sendly.tenDlc.createBrand({
   *   legalName: "Acme Holdings LLC",
   *   ein: "12-3456789",
   *   entityType: "PRIVATE_PROFIT",
   *   website: "https://acme.example",
   *   email: "ops@acme.example",
   * });
   * ```
   */
  async createBrand(
    request: CreateTenDlcBrandRequest,
  ): Promise<TenDlcBrandResponse> {
    return this.http.request<TenDlcBrandResponse>({
      method: "POST",
      path: "/tendlc/brands",
      body: { ...request },
    });
  }

  /**
   * Fetch one brand. Also refreshes its carrier-review status, so
   * polling this method shows progress (`pending` → `verified`/`failed`).
   *
   * @param id - Brand identifier
   * @returns The brand with its current review status
   *
   * @example
   * ```typescript
   * const { data: brand } = await sendly.tenDlc.getBrand("brd_xxx");
   * if (brand.status === "verified") {
   *   console.log("Ready to create a campaign");
   * }
   * ```
   */
  async getBrand(id: string): Promise<TenDlcBrandResponse> {
    return this.http.request<TenDlcBrandResponse>({
      method: "GET",
      path: `/tendlc/brands/${id}`,
    });
  }

  /**
   * Pre-check whether a use case qualifies for a brand on the carrier
   * network before creating a campaign.
   *
   * @param brandId - Brand identifier
   * @param useCase - Use-case code (e.g. "MIXED", "MARKETING", "ACCOUNT_NOTIFICATION", "2FA")
   * @returns Whether the use case qualifies, and the expected throughput
   *
   * @example
   * ```typescript
   * const { data } = await sendly.tenDlc.qualify("brd_xxx", "MARKETING");
   * if (!data.qualified) {
   *   console.log(`Not accepted: ${data.reason}`);
   * }
   * ```
   */
  async qualify(
    brandId: string,
    useCase: string,
  ): Promise<TenDlcQualifyResponse> {
    return this.http.request<TenDlcQualifyResponse>({
      method: "GET",
      path: `/tendlc/brands/${brandId}/qualify/${useCase}`,
    });
  }

  /**
   * List your messaging campaigns.
   *
   * @returns Your campaigns and their review status
   *
   * @example
   * ```typescript
   * const { data: campaigns } = await sendly.tenDlc.listCampaigns();
   * for (const c of campaigns) {
   *   console.log(`${c.useCase} — ${c.status}`);
   * }
   * ```
   */
  async listCampaigns(): Promise<TenDlcCampaignListResponse> {
    return this.http.request<TenDlcCampaignListResponse>({
      method: "GET",
      path: "/tendlc/campaigns",
    });
  }

  /**
   * Create a messaging campaign under a verified brand and submit it
   * for carrier review. Requires a live API key.
   *
   * The campaign starts `pending`. Poll {@link getCampaign} until it
   * becomes `active` before assigning numbers.
   *
   * @param request - Campaign details (`brandId`, `useCase`, `description`,
   *   `messageFlow`, and `sampleMessages` are required)
   * @returns The created campaign
   *
   * @example
   * ```typescript
   * const { data: campaign } = await sendly.tenDlc.createCampaign({
   *   brandId: "brd_xxx",
   *   useCase: "MIXED",
   *   description: "Order updates and support replies for Acme customers",
   *   messageFlow: "Customers opt in at checkout on acme.example",
   *   sampleMessages: ["Your order #123 has shipped!"],
   *   optOutKeywords: "STOP",
   * });
   * ```
   */
  async createCampaign(
    request: CreateTenDlcCampaignRequest,
  ): Promise<TenDlcCampaignResponse> {
    return this.http.request<TenDlcCampaignResponse>({
      method: "POST",
      path: "/tendlc/campaigns",
      body: { ...request },
    });
  }

  /**
   * Fetch one campaign. Also refreshes its carrier-review status, so
   * polling this method shows progress (`pending` → `active`) including
   * throughput once carriers approve.
   *
   * @param id - Campaign identifier
   * @returns The campaign with its current review status
   *
   * @example
   * ```typescript
   * const { data: campaign } = await sendly.tenDlc.getCampaign("cmp_xxx");
   * if (campaign.status === "active") {
   *   console.log(`Approved — ${campaign.throughput?.tier}`);
   * }
   * ```
   */
  async getCampaign(id: string): Promise<TenDlcCampaignResponse> {
    return this.http.request<TenDlcCampaignResponse>({
      method: "GET",
      path: `/tendlc/campaigns/${id}`,
    });
  }

  /**
   * Assign a phone number you own to an active (carrier-approved)
   * campaign, making the number sendable. Requires a live API key.
   *
   * Idempotent — re-assigning the same number to the same campaign
   * returns the existing assignment.
   *
   * @param campaignId - Campaign identifier
   * @param phoneNumber - E.164 number the workspace already owns
   * @returns The assignment; the number can send once `status` is "Active"
   *
   * @example
   * ```typescript
   * const { data: assignment } = await sendly.tenDlc.assignNumber(
   *   "cmp_xxx",
   *   "+15551234567",
   * );
   * console.log(assignment.status);
   * ```
   */
  async assignNumber(
    campaignId: string,
    phoneNumber: string,
  ): Promise<TenDlcAssignmentResponse> {
    return this.http.request<TenDlcAssignmentResponse>({
      method: "POST",
      path: `/tendlc/campaigns/${campaignId}/assign`,
      body: { phoneNumber },
    });
  }

  /**
   * List your number-to-campaign assignments.
   *
   * @returns Your assignments and their status
   *
   * @example
   * ```typescript
   * const { data: assignments } = await sendly.tenDlc.listAssignments();
   * for (const a of assignments) {
   *   console.log(`${a.phoneNumber} — ${a.status}`);
   * }
   * ```
   */
  async listAssignments(): Promise<TenDlcAssignmentListResponse> {
    return this.http.request<TenDlcAssignmentListResponse>({
      method: "GET",
      path: "/tendlc/assignments",
    });
  }
}
