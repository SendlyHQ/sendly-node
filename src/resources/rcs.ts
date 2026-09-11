/**
 * RCS Resource — Register your brand and agent, discover agents,
 * pre-flight recipient capability
 *
 * @packageDocumentation
 *
 * RCS is a first-class Sendly channel: rich cards, suggestion chips, and
 * branded, verified-sender messaging on Android, sent via
 * `sendly.messages.send({ channel: 'rcs', ... })`.
 *
 * Sending as your brand requires an RCS agent — the verified sender
 * identity recipients see. Registration is self-serve, from the dashboard
 * or this API, and follows one path:
 *
 * 1. **Brand** — draft your business identity with
 *    {@link RcsBrandsResource.create} ({@link RcsDossierResource.get}
 *    prefills it from details already on file). US businesses only for now.
 * 2. **Agent** — draft the sender identity under that brand with
 *    {@link RcsAgentsResource.create}: name, use case, description, logo,
 *    hero, colour, and policy links.
 * 3. **Submit** — {@link RcsAgentsResource.submit} sends brand and agent
 *    to Sendly for review, then to the carrier network. Poll
 *    {@link RcsAgentsResource.get} or {@link RcsRegistrationResource.get}
 *    for the `customerStage` as it moves through review.
 * 4. **Test** — once the stage is `testing`, invite your own devices with
 *    {@link RcsAgentsResource.setTestDevices} and fill in the campaign
 *    (messaging examples, consent) with {@link RcsAgentsResource.update}.
 * 5. **Launch** — {@link RcsAgentsResource.requestLaunch} asks Sendly to
 *    launch the agent with the carrier network. Once the agent is
 *    `sendable`, no other setup is needed.
 *
 * Logo, hero, and call-to-action media must already be public `https://`
 * URLs; uploading assets is dashboard-only. Reads need the `rcs:read`
 * scope and writes `rcs:write`. Writes accept an optional
 * {@link IdempotentRequestOptions | idempotency key}; POST requests get
 * one automatically.
 *
 * Not every recipient can receive RCS. Text messages fall back to SMS
 * automatically by default (the send response discloses it via
 * `channel: 'sms'` and `fellBackTo: 'sms'`); use
 * {@link RcsResource.capability} to check a recipient ahead of time.
 * Sending and capability checks require a live API key — delivery is
 * never sandbox-simulated.
 *
 * @see https://sendly.live/docs/rcs
 */

import type { HttpClient } from "../utils/http";
import type { IdempotentRequestOptions } from "../types";
import { validatePhoneNumber } from "../utils/validation";

/**
 * Lifecycle status of an RCS agent.
 *
 * - `draft` — being set up; not sendable
 * - `submitted` — in carrier review; not sendable
 * - `testing` — approved for invited test devices
 * - `approved` — approved; can reach every RCS-capable recipient
 * - `suspended` — sending is currently suspended for this agent
 */
export type RcsAgentStatus =
  | "draft"
  | "submitted"
  | "testing"
  | "approved"
  | "suspended";

/**
 * Where a registration sits, in customer terms. Reported on brands and
 * agents as `customerStage` and on {@link RcsRegistration} as `stage`.
 *
 * - `draft` — being filled in; nothing submitted yet
 * - `in_review` — submitted; Sendly is reviewing it
 * - `changes_requested` — Sendly asked for changes; edit and resubmit
 * - `rejected` — Sendly declined the registration
 * - `brand_verification` — approved by Sendly; the carrier network is verifying the brand
 * - `agent_review` — brand verified; the carrier network is reviewing the agent
 * - `testing` — approved for invited test devices; fill in the campaign, then request launch
 * - `launch_review` — launch requested; Sendly is reviewing it
 * - `launching` — Sendly asked the carrier network to launch the agent
 * - `launch_rejected` — the carrier network declined the launch; see `rejectionReason`
 * - `live` — launched; the agent can reach every RCS-capable recipient
 * - `suspended` — sending is currently suspended
 * - `failed` — registration failed; see `rejectionReason`
 */
export type RcsCustomerStage =
  | "draft"
  | "in_review"
  | "changes_requested"
  | "rejected"
  | "brand_verification"
  | "agent_review"
  | "testing"
  | "launch_review"
  | "launching"
  | "launch_rejected"
  | "live"
  | "suspended"
  | "failed";

/**
 * Review status of a brand or agent, as Sendly tracks it.
 *
 * - `draft` — editable; not submitted
 * - `awaiting_review` — submitted; locked while Sendly reviews it
 * - `changes_requested` — editable again; see `reviewNote`
 * - `approved_for_carrier` — approved by Sendly and sent to the carrier network
 * - `rejected` — declined by Sendly; see `reviewNote`
 * - `launch_requested` — launch requested; locked while Sendly reviews it
 * - `launch_submitted` — launch sent to the carrier network
 * - `launch_rejected` — launch declined by the carrier network; see `rejectionReason`
 * - `failed` — registration failed; see `rejectionReason`
 */
export type RcsReviewStatus =
  | "draft"
  | "awaiting_review"
  | "changes_requested"
  | "approved_for_carrier"
  | "rejected"
  | "launch_requested"
  | "launch_submitted"
  | "launch_rejected"
  | "failed";

/**
 * Legal structure of the registering business.
 */
export type RcsLegalEntityType =
  | "LIMITED_LIABILITY_COMPANY"
  | "SOLE_PROPRIETORSHIP"
  | "PARTNERSHIP"
  | "CORPORATION"
  | "S_CORPORATION";

/**
 * Organization type of the registering business.
 */
export type RcsOrganizationType =
  | "PRIVATE_PROFIT"
  | "PUBLIC_PROFIT"
  | "NON_PROFIT"
  | "GOVERNMENT"
  | "UNKNOWN";

/**
 * Declared messaging use case of an agent.
 */
export type RcsAgentUseCase = "MULTI_USE" | "PROMOTIONAL" | "TRANSACTIONAL" | "OTP";

/**
 * Kind of conversation an agent has with recipients.
 */
export type RcsInteractionType =
  | "TRANSACTIONAL_UPDATES"
  | "CUSTOMER_SUPPORT"
  | "LOYALTY_OR_REWARD"
  | "MARKETING_OR_PROMOTIONAL"
  | "ACCOUNT_ALERTS"
  | "TWO_WAY_CONVERSATION"
  | "OTHER";

/**
 * How recipients opt in to messages from an agent.
 */
export type RcsOptInMethodType =
  | "SMS"
  | "WEBSITE"
  | "MOBILE_APP"
  | "QR_CODE"
  | "SALE_POINT"
  | "OTHER";

/**
 * An RCS agent — the verified sender identity recipients see.
 */
export interface RcsAgent {
  /** Unique agent identifier — pass as `agentId` on sends */
  id: string;
  /** The agent name recipients see */
  name: string;
  /** Lifecycle status */
  status: RcsAgentStatus;
  /** Declared messaging use case, or null when not set */
  useCase: string | null;
  /**
   * True when the agent can send right now (status `testing` or
   * `approved`, and fully provisioned)
   */
  sendable: boolean;
  /** Where the registration sits, in customer terms */
  stage?: RcsCustomerStage;
  /** ISO 8601 timestamp when the agent was registered */
  createdAt: string;
}

/**
 * Response from {@link RcsAgentsResource.list}.
 */
export interface RcsAgentListResponse {
  agents: RcsAgent[];
}

/**
 * Options for {@link RcsResource.capability}.
 */
export interface RcsCapabilityOptions {
  /** The recipient's number, in E.164 format */
  to: string;
  /**
   * The agent to check as. Optional when your workspace has exactly one
   * agent; required when it has several.
   */
  agentId?: string;
}

/**
 * Response from {@link RcsResource.capability}.
 */
export interface RcsCapability {
  /** The recipient that was checked, in E.164 format */
  to: string;
  /** The agent the check ran as */
  agentId: string;
  /** True when the recipient can receive RCS from this agent */
  capable: boolean;
  /** RCS features the recipient supports (empty when not capable) */
  features: string[];
}

/**
 * Registered business address on a brand draft. `countryCode` must be
 * `"US"` — RCS registration is available to US businesses for now.
 */
export interface RcsBrandAddressInput {
  /** Street address, first line */
  line1?: string | null;
  /** Street address, second line */
  line2?: string | null;
  /** City */
  city?: string | null;
  /** State (two-letter code) */
  state?: string | null;
  /** ZIP / postal code */
  postalCode?: string | null;
  /** ISO 3166-1 alpha-2 country code; must be "US" */
  countryCode?: string | null;
}

/**
 * Business contact on a brand draft — who the carrier network can reach
 * about the registration.
 */
export interface RcsBrandContactInput {
  /** Contact's first name */
  firstName?: string | null;
  /** Contact's last name */
  lastName?: string | null;
  /** Contact's job title */
  title?: string | null;
  /** Contact's email address */
  email?: string | null;
  /** Contact's phone number in E.164 format */
  phoneNumber?: string | null;
}

/**
 * Brand fields for {@link RcsBrandsResource.create} and
 * {@link RcsBrandsResource.update}.
 *
 * Every field is optional while drafting — required-field checks run at
 * {@link RcsAgentsResource.submit}, which reports each gap as a
 * `brand.<field>` entry in `errors`. On update, only the keys you send are
 * changed; `null` clears a field, and `address` / `contact` may be partial.
 */
export interface RcsBrandInput {
  /** The brand name recipients see */
  displayName?: string | null;
  /** Legal business name */
  legalName?: string | null;
  /** Legal structure of the business */
  legalEntityType?: RcsLegalEntityType | null;
  /** Organization type */
  organizationType?: RcsOrganizationType | null;
  /** Business website (https) */
  websiteUrl?: string | null;
  /** Employer Identification Number ("123456789" or "12-3456789") */
  ein?: string | null;
  /** Stock symbol as "EXCHANGE:TICKER", for publicly traded businesses */
  stockSymbol?: string | null;
  /** Registered business address; `countryCode` must be "US" */
  address?: RcsBrandAddressInput | null;
  /** Business contact */
  contact?: RcsBrandContactInput | null;
}

/**
 * Phone contact shown on the agent's info sheet.
 */
export interface RcsAgentPhoneContactInput {
  /** Phone number in E.164 format */
  number?: string | null;
  /** Label recipients see, e.g. "Call support" */
  label?: string | null;
}

/**
 * Website link shown on the agent's info sheet.
 */
export interface RcsAgentWebsiteContactInput {
  /** Website URL (https) */
  url?: string | null;
  /** Label recipients see, e.g. "Visit our site" */
  label?: string | null;
}

/**
 * Email contact shown on the agent's info sheet.
 */
export interface RcsAgentEmailContactInput {
  /** Email address */
  address?: string | null;
  /** Label recipients see, e.g. "Email us" */
  label?: string | null;
}

/**
 * Agent identity — what recipients see when they open the agent.
 *
 * `logoUrl` and `heroUrl` must be public `https://` URLs; uploading
 * assets is dashboard-only.
 */
export interface RcsAgentBasicsInput {
  /** The agent name recipients see */
  displayName?: string | null;
  /** Declared messaging use case */
  useCase?: RcsAgentUseCase | null;
  /** What the agent is for, shown on its info sheet */
  description?: string | null;
  /** Public https:// URL of the agent's logo */
  logoUrl?: string | null;
  /** Public https:// URL of the agent's hero image */
  heroUrl?: string | null;
  /** Brand colour as "#RGB" or "#RRGGBB" */
  brandColor?: string | null;
  /** Privacy policy URL (https) */
  privacyPolicyUrl?: string | null;
  /** Terms and conditions URL (https) */
  termsAndConditionsUrl?: string | null;
  /** Phone contact on the info sheet */
  phoneNumber?: RcsAgentPhoneContactInput | null;
  /** Website link on the info sheet */
  website?: RcsAgentWebsiteContactInput | null;
  /** Email contact on the info sheet */
  email?: RcsAgentEmailContactInput | null;
}

/**
 * One kind of conversation the agent has with recipients.
 */
export interface RcsInteractionInput {
  /** Kind of interaction */
  interactionType?: RcsInteractionType | null;
  /** What that interaction looks like for your recipients */
  description?: string | null;
}

/**
 * One way recipients opt in to the agent's messages.
 */
export interface RcsOptInMethodInput {
  /** Opt-in channel */
  methodType?: RcsOptInMethodType | null;
  /** How the opt-in works on that channel */
  description?: string | null;
}

/**
 * How recipients consent to messages, and the standard replies.
 *
 * `callToActionMediaUrl` must be a public `https://` URL; uploading
 * assets is dashboard-only.
 */
export interface RcsConsentSettingsInput {
  /** Ways recipients opt in */
  optInMethods?: RcsOptInMethodInput[] | null;
  /** The call to action recipients see when opting in */
  callToAction?: string | null;
  /** Where the opt-in call to action lives (https) */
  callToActionUrl?: string | null;
  /** Public https:// URL of a screenshot or image of the opt-in */
  callToActionMediaUrl?: string | null;
  /** Whether recipients confirm their opt-in a second time */
  doubleOptIn?: boolean | null;
  /** The confirmation message, when `doubleOptIn` is true */
  doubleOptInMessage?: string | null;
  /** Message sent when a recipient opts in */
  optInMessage?: string | null;
  /** Reply to a HELP request */
  helpResponse?: string | null;
  /** Reply to a STOP request */
  optOutResponse?: string | null;
}

/**
 * Campaign section of an agent — what it sends and how recipients agreed
 * to it. Optional while drafting; required before
 * {@link RcsAgentsResource.requestLaunch} (at least one interaction, at
 * least three message examples, and consent settings).
 */
export interface RcsCampaignInput {
  /** What your business does */
  companyOverview?: string | null;
  /** What the agent sends and why */
  agentOverview?: string | null;
  /** Anything else reviewers should know */
  additionalInformation?: string | null;
  /** Kinds of conversations the agent has */
  interactions?: RcsInteractionInput[] | null;
  /** Example messages the agent sends (at least three at launch) */
  messageExamples?: string[] | null;
  /** How recipients consent, and the standard replies */
  consentSettings?: RcsConsentSettingsInput | null;
}

/**
 * Testing section of an agent — how reviewers can see the agent in
 * action before launch.
 */
export interface RcsTestingInput {
  /** URL where reviewers can trigger a test message (required at launch) */
  testUrl?: string | null;
  /** Identifier of a message sent to an invited test device */
  messageId?: string | null;
  /** Anything else reviewers should know about testing */
  additionalInformation?: string | null;
}

/**
 * Request body for {@link RcsAgentsResource.create}.
 */
export interface CreateRcsAgentRequest {
  /** The brand this agent belongs to (required) */
  brandId: string;
  /** The agent name recipients see; overrides `basics.displayName` */
  displayName?: string | null;
  /** Declared messaging use case; overrides `basics.useCase` */
  useCase?: RcsAgentUseCase | null;
  /** Agent identity */
  basics?: RcsAgentBasicsInput;
  /** Campaign section; can be filled in later with {@link RcsAgentsResource.update} */
  campaign?: RcsCampaignInput | null;
  /** Testing section; can be filled in later with {@link RcsAgentsResource.update} */
  testing?: RcsTestingInput | null;
}

/**
 * Request body for {@link RcsAgentsResource.update}. Only the sections
 * you send are changed: `displayName`, `useCase`, and `basics` merge into
 * the agent identity; `campaign` and `testing` merge section-wise, and
 * `campaign: null` / `testing: null` clear that section.
 */
export interface UpdateRcsAgentRequest {
  /** The agent name recipients see */
  displayName?: string | null;
  /** Declared messaging use case */
  useCase?: RcsAgentUseCase | null;
  /** Agent identity fields to merge */
  basics?: RcsAgentBasicsInput;
  /** Campaign fields to merge, or null to clear the section */
  campaign?: RcsCampaignInput | null;
  /** Testing fields to merge, or null to clear the section */
  testing?: RcsTestingInput | null;
}

/**
 * A device to invite for {@link RcsAgentsResource.setTestDevices}.
 */
export interface RcsTestDeviceInput {
  /** Device phone number in E.164 format (a formatted 10-digit US number is also accepted) */
  phoneNumber: string;
  /** Friendly label, e.g. "Sam's Pixel" */
  label?: string | null;
}

/**
 * Request body for {@link RcsAgentsResource.requestLaunch}. Both fields
 * are optional; when present they are saved to the agent's testing
 * section before the launch request is recorded.
 */
export interface RcsRequestLaunchRequest {
  /** URL where reviewers can trigger a test message */
  testUrl?: string;
  /** Anything else reviewers should know about testing */
  testingAdditionalInformation?: string;
}

/**
 * Registered business address on a brand.
 */
export interface RcsBrandAddress {
  /** Street address, first line ("" while unset) */
  line1: string;
  /** Street address, second line */
  line2: string | null;
  /** City ("" while unset) */
  city: string;
  /** State ("" while unset) */
  state: string;
  /** ZIP / postal code ("" while unset) */
  postalCode: string;
  /** ISO 3166-1 alpha-2 country code ("US") */
  countryCode: string;
}

/**
 * Business contact on a brand.
 */
export interface RcsBrandContact {
  /** Contact's first name ("" while unset) */
  firstName: string;
  /** Contact's last name ("" while unset) */
  lastName: string;
  /** Contact's job title */
  title: string | null;
  /** Contact's email address ("" while unset) */
  email: string;
  /** Contact's phone number in E.164 format ("" while unset) */
  phoneNumber: string;
}

/**
 * A brand — the business identity an agent is registered under.
 */
export interface RcsBrand {
  /** Unique brand identifier */
  id: string;
  /** Review status, as Sendly tracks it */
  reviewStatus: RcsReviewStatus;
  /** Where the brand sits, in customer terms */
  customerStage: RcsCustomerStage;
  /** The brand name recipients see ("" while unset) */
  displayName: string;
  /** Legal business name ("" while unset) */
  legalName: string;
  /** Legal structure of the business ("" while unset) */
  legalEntityType: RcsLegalEntityType | "";
  /** Organization type ("" while unset) */
  organizationType: RcsOrganizationType | "";
  /** Stock symbol as "EXCHANGE:TICKER", for publicly traded businesses */
  stockSymbol: string | null;
  /** Business website ("" while unset) */
  websiteUrl: string;
  /** Employer Identification Number ("" while unset) */
  ein: string;
  /** Registered business address */
  address: RcsBrandAddress;
  /** Business contact */
  contact: RcsBrandContact;
  /** Sendly's note from review, when changes were requested or the brand was declined */
  reviewNote: string | null;
  /** Why the carrier network declined the brand, when it did */
  rejectionReason: string | null;
  /** When the brand was submitted for review (ISO 8601), or null */
  submittedForReviewAt: string | null;
  /** When the brand was sent to the carrier network (ISO 8601), or null */
  sentToCarrierAt: string | null;
  /** When the carrier network verified the brand (ISO 8601), or null */
  verifiedAt: string | null;
  /** When the brand was created (ISO 8601) */
  createdAt: string;
  /** When the brand was last updated (ISO 8601) */
  updatedAt: string;
}

/**
 * A device invited to test an agent before launch.
 */
export interface RcsTestDevice {
  /** Unique device identifier */
  id: string;
  /** Device phone number in E.164 format */
  phoneNumber: string;
  /** Friendly label */
  label: string | null;
  /** Invite state reported by the carrier network (e.g. "PENDING"), or null until invited */
  inviteStatus: string | null;
  /** When the device was added (ISO 8601) */
  createdAt: string;
}

/**
 * Agent identity as stored — {@link RcsAgentBasicsInput} with the
 * server-owned fields filled in. Optional keys are absent until set.
 */
export interface RcsAgentBasics
  extends Omit<RcsAgentBasicsInput, "displayName" | "useCase"> {
  /** The agent name recipients see ("" while unset) */
  displayName: string;
  /** Declared messaging use case, or null when not set */
  useCase: string | null;
  /** Hosting region chosen by Sendly, or null until provisioned */
  hostingRegion: string | null;
}

/**
 * The full agent record — identity, campaign, testing, review state, and
 * invited devices. {@link RcsAgent} is the lighter shape returned by
 * {@link RcsAgentsResource.list}.
 */
export interface RcsAgentDetail {
  /** Unique agent identifier — pass as `agentId` on sends */
  id: string;
  /** The brand this agent belongs to */
  brandId: string | null;
  /** Lifecycle (send) status */
  status: RcsAgentStatus;
  /** Review status, as Sendly tracks it */
  reviewStatus: RcsReviewStatus;
  /** Where the registration sits, in customer terms */
  customerStage: RcsCustomerStage;
  /** The agent name recipients see ("" while unset) */
  displayName: string;
  /** Declared messaging use case, or null when not set */
  useCase: string | null;
  /** Hosting region chosen by Sendly, or null until provisioned */
  hostingRegion: string | null;
  /** Agent identity */
  basics: RcsAgentBasics;
  /** Campaign section, or null until filled in */
  campaign: RcsCampaignInput | null;
  /** Testing section, or null until filled in */
  testing: RcsTestingInput | null;
  /** Sendly's note from review, when changes were requested or the agent was declined */
  reviewNote: string | null;
  /** Why the carrier network declined the agent or its launch, when it did */
  rejectionReason: string | null;
  /** Devices invited to test the agent */
  testDevices: RcsTestDevice[];
  /** When the agent was submitted for review (ISO 8601), or null */
  submittedForReviewAt: string | null;
  /** When the agent identity was sent to the carrier network (ISO 8601), or null */
  basicsSubmittedAt: string | null;
  /** When the launch was sent to the carrier network (ISO 8601), or null */
  launchSubmittedAt: string | null;
  /** When the agent went live (ISO 8601), or null */
  liveAt: string | null;
  /** When the agent was created (ISO 8601) */
  createdAt: string;
  /** When the agent was last updated (ISO 8601) */
  updatedAt: string;
}

/**
 * Response from {@link RcsRegistrationResource.get} — the workspace's
 * current registration at a glance.
 */
export interface RcsRegistration {
  /** The newest agent's brand, else the newest brand, or null when none exists */
  brand: RcsBrand | null;
  /** The newest agent, or null when none exists */
  agent: RcsAgentDetail | null;
  /** Devices invited to test that agent (empty when there is no agent) */
  devices: RcsTestDevice[];
  /** Where the registration sits, in customer terms (`draft` when nothing exists) */
  stage: RcsCustomerStage;
  /** False when something on file names a non-US country */
  usEligible: boolean;
}

/**
 * Where {@link RcsDossier} details were prefilled from.
 *
 * - `tendlc` — the workspace's newest 10DLC brand
 * - `verification` — the workspace's active toll-free verification
 * - `none` — nothing on file; `brand` is empty
 */
export type RcsDossierSource = "tendlc" | "verification" | "none";

/**
 * Response from {@link RcsDossierResource.get} — business details already
 * on file, shaped as a {@link RcsBrandInput} you can pass straight to
 * {@link RcsBrandsResource.create}.
 */
export interface RcsDossier {
  /** Prefilled brand fields (only the keys that have a value) */
  brand: RcsBrandInput;
  /** False when something on file names a non-US country */
  usEligible: boolean;
  /** Where the details came from */
  source: RcsDossierSource;
}

/**
 * Response from {@link RcsBrandsResource.create} and
 * {@link RcsBrandsResource.update}.
 */
export interface RcsBrandResponse {
  brand: RcsBrand;
}

/**
 * Response from {@link RcsAgentsResource.create} and
 * {@link RcsAgentsResource.update}.
 */
export interface RcsAgentResponse {
  agent: RcsAgentDetail;
}

/**
 * Response from {@link RcsAgentsResource.get}.
 */
export interface RcsAgentDetailResponse {
  /** The agent */
  agent: RcsAgentDetail;
  /** Devices invited to test the agent (same as `agent.testDevices`) */
  devices: RcsTestDevice[];
  /** Where the registration sits (same as `agent.customerStage`) */
  stage: RcsCustomerStage;
}

/**
 * Response from {@link RcsAgentsResource.setTestDevices}.
 */
export interface RcsTestDeviceListResponse {
  /** The full device list after the change */
  devices: RcsTestDevice[];
}

/**
 * Response from {@link RcsAgentsResource.submit} and
 * {@link RcsAgentsResource.requestLaunch}.
 */
export interface RcsAgentReviewResponse {
  /** The agent, with its new review status */
  agent: RcsAgentDetail;
  /** Where the registration sits now */
  stage: RcsCustomerStage;
}

class RcsRegistrationResource {
  private readonly http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  /**
   * Fetch the workspace's registration at a glance: the newest agent, its
   * brand and test devices, and the overall `stage`.
   *
   * Requires the `rcs:read` scope.
   *
   * @returns The current brand, agent, devices, and stage
   *
   * @example
   * ```typescript
   * const { stage, agent } = await sendly.rcs.registration.get();
   * if (stage === 'testing') {
   *   console.log(`${agent?.displayName} is ready to test`);
   * }
   * ```
   *
   * @throws {SendlyError} `rcs_not_enabled` (404) when RCS registration isn't enabled for the account
   */
  async get(): Promise<RcsRegistration> {
    return this.http.request<RcsRegistration>({
      method: "GET",
      path: "/rcs/registration",
    });
  }
}

class RcsDossierResource {
  private readonly http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  /**
   * Fetch business details already on file (from 10DLC or toll-free
   * verification), shaped for {@link RcsBrandsResource.create}.
   *
   * Requires the `rcs:read` scope.
   *
   * @returns Prefilled brand fields, where they came from, and US eligibility
   *
   * @example
   * ```typescript
   * const dossier = await sendly.rcs.dossier.get();
   * const { brand } = await sendly.rcs.brands.create({
   *   ...dossier.brand,
   *   displayName: 'Acme Coffee',
   * });
   * ```
   */
  async get(): Promise<RcsDossier> {
    return this.http.request<RcsDossier>({
      method: "GET",
      path: "/rcs/dossier",
    });
  }
}

class RcsBrandsResource {
  private readonly http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  /**
   * Draft a brand — step 1 of registering for RCS. Requires the
   * `rcs:write` scope.
   *
   * Every field is optional while drafting; required-field checks run at
   * {@link RcsAgentsResource.submit}. `address.countryCode` must be
   * `"US"` — RCS registration is available to US businesses for now.
   *
   * @param request - Business identity details
   * @param options - Optional idempotency key
   * @returns The created brand (`reviewStatus` "draft")
   *
   * @example
   * ```typescript
   * const { brand } = await sendly.rcs.brands.create({
   *   displayName: 'Acme Coffee',
   *   legalName: 'Acme Coffee LLC',
   *   legalEntityType: 'LIMITED_LIABILITY_COMPANY',
   *   organizationType: 'PRIVATE_PROFIT',
   *   websiteUrl: 'https://acme.example',
   *   ein: '12-3456789',
   *   address: {
   *     line1: '100 Main St',
   *     city: 'Chicago',
   *     state: 'IL',
   *     postalCode: '60601',
   *     countryCode: 'US',
   *   },
   *   contact: {
   *     firstName: 'Sam',
   *     lastName: 'Lee',
   *     email: 'sam@acme.example',
   *     phoneNumber: '+13125550100',
   *   },
   * });
   * ```
   *
   * @throws {SendlyError} `rcs_us_only` (422) when the address is outside the US
   */
  async create(
    request: RcsBrandInput,
    options?: IdempotentRequestOptions,
  ): Promise<RcsBrandResponse> {
    return this.http.request<RcsBrandResponse>({
      method: "POST",
      path: "/rcs/brands",
      idempotencyKey: options?.idempotencyKey,
      body: { ...request },
    });
  }

  /**
   * Update a brand draft. Requires the `rcs:write` scope.
   *
   * Only the keys you send are changed; `null` clears a field, and
   * `address` / `contact` may be partial. A brand is locked while Sendly
   * is reviewing it (`awaiting_review`, `launch_requested`) and once the
   * carrier network has registered it.
   *
   * @param id - Brand identifier
   * @param request - Fields to change
   * @param options - Optional idempotency key
   * @returns The updated brand
   *
   * @example
   * ```typescript
   * const { brand } = await sendly.rcs.brands.update('brd_xxx', {
   *   websiteUrl: 'https://acme.example',
   *   contact: { title: 'Head of Support' },
   * });
   * ```
   *
   * @throws {SendlyError} `rcs_not_found` (404) when the brand isn't in this workspace
   * @throws {SendlyError} `rcs_field_locked` (409) while the brand is under review
   * @throws {SendlyError} `rcs_invalid_content` (422) with `response.errors` listing each field
   */
  async update(
    id: string,
    request: RcsBrandInput,
    options?: IdempotentRequestOptions,
  ): Promise<RcsBrandResponse> {
    return this.http.request<RcsBrandResponse>({
      method: "PATCH",
      path: `/rcs/brands/${encodeURIComponent(id)}`,
      idempotencyKey: options?.idempotencyKey,
      body: { ...request },
    });
  }
}

class RcsAgentsResource {
  private readonly http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  /**
   * List your RCS agents.
   *
   * Returns the agents registered on your workspace, newest first. An
   * empty list means no agent is registered yet — draft one with
   * {@link RcsAgentsResource.create} or from the dashboard.
   *
   * @returns Your agents with status and sendability
   *
   * @example
   * ```typescript
   * const { agents } = await sendly.rcs.agents.list();
   * for (const a of agents) {
   *   console.log(`${a.name} — ${a.status}${a.sendable ? ' (sendable)' : ''}`);
   * }
   * ```
   */
  async list(): Promise<RcsAgentListResponse> {
    return this.http.request<RcsAgentListResponse>({
      method: "GET",
      path: "/rcs/agents",
    });
  }

  /**
   * Draft an agent under a brand — step 2 of registering for RCS.
   * Requires the `rcs:write` scope.
   *
   * `logoUrl`, `heroUrl`, and `callToActionMediaUrl` must be public
   * `https://` URLs; uploading assets is dashboard-only. The campaign and
   * testing sections can be filled in later with {@link update}.
   *
   * @param request - The brand to register under, plus the agent identity
   * @param options - Optional idempotency key
   * @returns The created agent (`reviewStatus` "draft")
   *
   * @example
   * ```typescript
   * const { agent } = await sendly.rcs.agents.create({
   *   brandId: brand.id,
   *   displayName: 'Acme Coffee',
   *   useCase: 'MULTI_USE',
   *   basics: {
   *     description: 'Order updates and support for Acme Coffee customers',
   *     logoUrl: 'https://acme.example/rcs/logo.png',
   *     heroUrl: 'https://acme.example/rcs/hero.png',
   *     brandColor: '#0B6E4F',
   *     privacyPolicyUrl: 'https://acme.example/privacy',
   *     termsAndConditionsUrl: 'https://acme.example/terms',
   *     website: { url: 'https://acme.example', label: 'Visit our site' },
   *   },
   * });
   * ```
   *
   * @throws {SendlyError} `rcs_not_found` (404) when the brand isn't in this workspace
   * @throws {SendlyError} `rcs_invalid_content` (422) when `brandId` is missing or a media URL isn't https
   */
  async create(
    request: CreateRcsAgentRequest,
    options?: IdempotentRequestOptions,
  ): Promise<RcsAgentResponse> {
    return this.http.request<RcsAgentResponse>({
      method: "POST",
      path: "/rcs/agents",
      idempotencyKey: options?.idempotencyKey,
      body: { ...request },
    });
  }

  /**
   * Fetch one agent with its review state and invited devices. Poll this
   * to follow `customerStage` through review, testing, and launch.
   *
   * Requires the `rcs:read` scope.
   *
   * @param id - Agent identifier
   * @returns The agent, its devices, and where the registration sits
   *
   * @example
   * ```typescript
   * const { agent, stage } = await sendly.rcs.agents.get('rcs_agent_xxx');
   * if (stage === 'changes_requested') {
   *   console.log(agent.reviewNote);
   * }
   * ```
   *
   * @throws {SendlyError} `rcs_not_found` (404) when the agent isn't in this workspace
   */
  async get(id: string): Promise<RcsAgentDetailResponse> {
    return this.http.request<RcsAgentDetailResponse>({
      method: "GET",
      path: `/rcs/agents/${encodeURIComponent(id)}`,
    });
  }

  /**
   * Update an agent draft. Requires the `rcs:write` scope.
   *
   * Only the sections you send are changed: `displayName`, `useCase`,
   * and `basics` merge into the identity; `campaign` and `testing` merge
   * section-wise, and `campaign: null` / `testing: null` clear that
   * section. An agent is locked while Sendly is reviewing it; the
   * identity locks once sent to the carrier network, and the campaign
   * and testing sections lock once the launch is sent (unless it was
   * declined).
   *
   * @param id - Agent identifier
   * @param request - Sections to change
   * @param options - Optional idempotency key
   * @returns The updated agent
   *
   * @example
   * ```typescript
   * const { agent } = await sendly.rcs.agents.update('rcs_agent_xxx', {
   *   campaign: {
   *     agentOverview: 'Order confirmations, pickup alerts, and support replies',
   *     interactions: [
   *       { interactionType: 'TRANSACTIONAL_UPDATES', description: 'Order status' },
   *     ],
   *     messageExamples: [
   *       'Your order #4821 is being roasted.',
   *       'Your order #4821 is ready for pickup!',
   *       'Thanks for visiting — reply HELP for support.',
   *     ],
   *     consentSettings: {
   *       optInMethods: [{ methodType: 'WEBSITE', description: 'Checkout checkbox' }],
   *       callToAction: 'Text me order updates',
   *       callToActionUrl: 'https://acme.example/checkout',
   *       optInMessage: 'Welcome to Acme Coffee updates. Reply STOP to opt out.',
   *       helpResponse: 'Acme Coffee: email help@acme.example for support.',
   *       optOutResponse: 'You have been unsubscribed from Acme Coffee updates.',
   *     },
   *   },
   * });
   * ```
   *
   * @throws {SendlyError} `rcs_not_found` (404) when the agent isn't in this workspace
   * @throws {SendlyError} `rcs_field_locked` (409) while the section is locked
   * @throws {SendlyError} `rcs_invalid_content` (422) with `response.errors` listing each field
   */
  async update(
    id: string,
    request: UpdateRcsAgentRequest,
    options?: IdempotentRequestOptions,
  ): Promise<RcsAgentResponse> {
    return this.http.request<RcsAgentResponse>({
      method: "PATCH",
      path: `/rcs/agents/${encodeURIComponent(id)}`,
      idempotencyKey: options?.idempotencyKey,
      body: { ...request },
    });
  }

  /**
   * Replace the agent's test devices (up to 20). Requires the `rcs:write`
   * scope.
   *
   * The list is authoritative: numbers missing from it are removed, new
   * ones are invited. Devices receive an invite from the carrier network
   * once the agent reaches the `testing` stage.
   *
   * @param id - Agent identifier
   * @param devices - The full list of devices to keep invited
   * @param options - Optional idempotency key
   * @returns The full device list after the change
   *
   * @example
   * ```typescript
   * const { devices } = await sendly.rcs.agents.setTestDevices('rcs_agent_xxx', [
   *   { phoneNumber: '+13125550100', label: "Sam's Pixel" },
   *   { phoneNumber: '+13125550101' },
   * ]);
   * ```
   *
   * @throws {SendlyError} `rcs_invalid_content` (422) with `response.errors` naming the bad `devices.<i>.phoneNumber`
   * @throws {SendlyError} `rcs_not_found` (404) when the agent isn't in this workspace
   * @throws {SendlyError} `rcs_field_locked` (409) while the agent is under review
   */
  async setTestDevices(
    id: string,
    devices: RcsTestDeviceInput[],
    options?: IdempotentRequestOptions,
  ): Promise<RcsTestDeviceListResponse> {
    return this.http.request<RcsTestDeviceListResponse>({
      method: "PUT",
      path: `/rcs/agents/${encodeURIComponent(id)}/test-devices`,
      idempotencyKey: options?.idempotencyKey,
      body: { devices },
    });
  }

  /**
   * Submit the agent and its brand to Sendly for review — step 3 of
   * registering for RCS. Requires the `rcs:write` scope.
   *
   * Required-field checks run here: the brand and the agent identity
   * must be complete, and media URLs must be public `https://`. On
   * success the agent moves to `in_review`; Sendly reviews it, then the
   * carrier network. Poll {@link get} to follow progress. Pass an
   * idempotency key so a retried call returns the original result
   * instead of notifying reviewers again.
   *
   * @param id - Agent identifier
   * @param options - Optional idempotency key
   * @returns The agent with `reviewStatus` "awaiting_review" and the new stage
   *
   * @example
   * ```typescript
   * const { stage } = await sendly.rcs.agents.submit('rcs_agent_xxx', {
   *   idempotencyKey: 'rcs-submit-rcs_agent_xxx',
   * });
   * console.log(stage); // "in_review"
   * ```
   *
   * @throws {SendlyError} `rcs_invalid_content` (422) with `response.errors` listing `brand.<field>` / `agent.<field>` gaps
   * @throws {SendlyError} `rcs_field_locked` (409) when already submitted
   * @throws {SendlyError} `rcs_brand_not_verified` (409) when the carrier network declined the brand
   * @throws {SendlyError} `rcs_not_found` (404) when the agent isn't in this workspace
   */
  async submit(
    id: string,
    options?: IdempotentRequestOptions,
  ): Promise<RcsAgentReviewResponse> {
    return this.http.request<RcsAgentReviewResponse>({
      method: "POST",
      path: `/rcs/agents/${encodeURIComponent(id)}/submit`,
      idempotencyKey: options?.idempotencyKey,
      body: {},
    });
  }

  /**
   * Ask Sendly to launch the agent — step 5, once you've tested it on an
   * invited device. Requires the `rcs:write` scope.
   *
   * The campaign section must be complete (an overview, at least one
   * interaction, at least three message examples, consent settings) and
   * the testing section needs a `testUrl`, which you can pass here. On
   * success the agent moves to `launch_review`; Sendly reviews it, then
   * launches it with the carrier network. Poll {@link get} until the
   * stage is `live`.
   *
   * @param id - Agent identifier
   * @param request - Optional testing details saved before the request
   * @param options - Optional idempotency key
   * @returns The agent with `reviewStatus` "launch_requested" and the new stage
   *
   * @example
   * ```typescript
   * const { stage } = await sendly.rcs.agents.requestLaunch('rcs_agent_xxx', {
   *   testUrl: 'https://acme.example/rcs-test',
   * });
   * console.log(stage); // "launch_review"
   * ```
   *
   * @throws {SendlyError} `rcs_launch_not_ready` (409) before the agent reaches testing
   * @throws {SendlyError} `rcs_invalid_content` (422) with `response.errors` listing `campaign.<field>` / `testing.<field>` gaps
   * @throws {SendlyError} `rcs_field_locked` (409) while a request is already under review
   * @throws {SendlyError} `rcs_not_found` (404) when the agent isn't in this workspace
   */
  async requestLaunch(
    id: string,
    request: RcsRequestLaunchRequest = {},
    options?: IdempotentRequestOptions,
  ): Promise<RcsAgentReviewResponse> {
    return this.http.request<RcsAgentReviewResponse>({
      method: "POST",
      path: `/rcs/agents/${encodeURIComponent(id)}/request-launch`,
      idempotencyKey: options?.idempotencyKey,
      body: { ...request },
    });
  }
}

/**
 * RCS resource — register your brand and agent, discover agents, and
 * pre-flight recipient capability.
 *
 * @example
 * ```typescript
 * // Register: brand -> agent -> submit (then test and request launch)
 * const { brand } = await sendly.rcs.brands.create({
 *   displayName: 'Acme Coffee',
 *   legalName: 'Acme Coffee LLC',
 *   ein: '12-3456789',
 *   address: { line1: '100 Main St', city: 'Chicago', state: 'IL', postalCode: '60601', countryCode: 'US' },
 * });
 * const { agent } = await sendly.rcs.agents.create({
 *   brandId: brand.id,
 *   displayName: 'Acme Coffee',
 *   useCase: 'MULTI_USE',
 *   basics: { logoUrl: 'https://acme.example/rcs/logo.png' },
 * });
 * await sendly.rcs.agents.submit(agent.id);
 *
 * // Send once an agent is sendable
 * const { agents } = await sendly.rcs.agents.list();
 * if (agents.some((a) => a.sendable)) {
 *   const { capable } = await sendly.rcs.capability({ to: '+15551234567' });
 *   const message = await sendly.messages.send({
 *     channel: 'rcs',
 *     to: '+15551234567',
 *     text: 'Your table is ready!',
 *   });
 * }
 * ```
 */
export class RcsResource {
  private readonly http: HttpClient;

  /**
   * List, draft, submit, test, and launch RCS agents.
   */
  public readonly agents: RcsAgentsResource;

  /**
   * Draft and update the brand an agent is registered under.
   */
  public readonly brands: RcsBrandsResource;

  /**
   * The workspace's registration at a glance.
   */
  public readonly registration: RcsRegistrationResource;

  /**
   * Business details already on file, ready to prefill a brand.
   */
  public readonly dossier: RcsDossierResource;

  constructor(http: HttpClient) {
    this.http = http;
    this.agents = new RcsAgentsResource(http);
    this.brands = new RcsBrandsResource(http);
    this.registration = new RcsRegistrationResource(http);
    this.dossier = new RcsDossierResource(http);
  }

  /**
   * Check whether a recipient can receive RCS.
   *
   * Runs a live carrier-backed capability probe, so it requires a live
   * API key. You don't have to call this before sending — text sends
   * probe capability themselves and fall back to SMS — but it's useful
   * to decide between a rich card and plain text up front (cards don't
   * fall back).
   *
   * @param options - The recipient, and optionally the agent to check as
   * @returns Whether the recipient is RCS-capable and which features they support
   *
   * @example
   * ```typescript
   * const { capable, features } = await sendly.rcs.capability({
   *   to: '+15551234567',
   * });
   *
   * if (!capable) {
   *   // Send text (falls back to SMS) instead of a rich card
   * }
   * ```
   *
   * @throws {ValidationError} If the number is not E.164
   * @throws {NotFoundError} If RCS isn't enabled or no agent is set up
   */
  async capability(options: RcsCapabilityOptions): Promise<RcsCapability> {
    validatePhoneNumber(options.to);

    return this.http.request<RcsCapability>({
      method: "GET",
      path: "/rcs/capability",
      query: {
        to: options.to,
        ...(options.agentId && { agentId: options.agentId }),
      },
    });
  }
}
