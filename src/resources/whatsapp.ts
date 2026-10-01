/**
 * WhatsApp Resource — Connect senders, manage templates, check windows
 *
 * @packageDocumentation
 *
 * WhatsApp is a first-class Sendly channel: connect a number you own,
 * create Meta-reviewed message templates, and send via
 * `sendly.messages.send({ channel: 'whatsapp', ... })`.
 *
 * Connecting a number is a one-time $19 setup (no monthly fee) and always
 * ends with a human step: {@link WhatsAppSignupResource.create} returns a
 * `connectUrl` that a person must open in a browser and log in with
 * Facebook to link their WhatsApp Business Account. Hand the URL to your
 * user — that connection cannot be completed programmatically. Once an
 * account is connected, more numbers can join it by code, without the
 * Facebook step: pass `businessAccountId` to
 * {@link WhatsAppSignupResource.create}, then submit the code with
 * {@link WhatsAppSignupResource.verify}.
 *
 * Two ways to reach a recipient:
 *
 * - **Inside a 24-hour window** (the recipient messaged you in the last
 *   24h): free-form text and media are allowed. Check with
 *   {@link WhatsAppResource.window}.
 * - **Anytime**: an approved template. Templates are reviewed by Meta
 *   (typically 24–48h) and categorized as authentication, utility, or
 *   marketing — pricing follows the category and destination country.
 *   Note: Meta has paused marketing template delivery to US (+1) numbers.
 *
 * Pricing: free-form text or media inside the 24-hour window costs 1 credit
 * each for the first 1,000 per sending number per calendar month (UTC), then
 * the destination's utility template price; countries without a listed price
 * use the default utility price of 12 credits. Templates are priced by
 * category and destination country; countries without a listed price use 33
 * (marketing), 12 (utility) and 12 (authentication) credits. A failed send
 * gives its slot back.
 *
 * Scopes and keys: sends go through `messages.send` with
 * `channel: 'whatsapp'` and need `sms:send`, not `whatsapp:write`, and a live
 * key. Reads (signup status, templates, the window, senders, sender profiles
 * and conversational components) need `whatsapp:read` and accept test keys.
 * Signup (with verify and resend), template create/edit/delete and sender
 * edits (profile, photo, conversational components, calling) need
 * `whatsapp:write` and a live key (otherwise 403
 * `whatsapp_requires_live_key`). In a team workspace, connecting and sender
 * edits need an owner or admin (`settings:write`), and
 * template writes need an owner, admin or member (`templates:write`); a
 * missing role returns 403 `insufficient_permissions`.
 *
 * WhatsApp is enabled per person: the user who owns the API key, not the
 * workspace. While it is off, sends return 403 `whatsapp_not_enabled` and
 * every method on this resource gets 404 `not_found`.
 *
 * @see https://sendly.live/docs/whatsapp
 */

import type { HttpClient } from "../utils/http";
import { ValidationError } from "../errors";
import { validatePhoneNumber } from "../utils/validation";

/**
 * Lifecycle status of a WhatsApp signup.
 *
 * - `initiated` — created; waiting for a human to complete the connect URL
 * - `registering` — the business account is linked; WhatsApp is activating
 *   the number. Activation usually takes a few minutes but can take hours.
 *   If it hasn't finished about 6 hours after the session began, the
 *   session fails with `registration_timeout` and the fee is refunded.
 * - `verifying`: a number being added to an already-connected WhatsApp
 *   Business Account is waiting for the code WhatsApp sent it; submit it
 *   with {@link WhatsAppSignupResource.verify}
 * - `active` — connected; the number can send and receive on WhatsApp
 * - `failed` — the connection failed (see `failureReasons`)
 * - `expired` — kept for compatibility; the API does not send it. A connect
 *   URL that lapses before the Facebook step ends as `failed` with
 *   `signup_abandoned`.
 */
export type WhatsAppSignupStatus =
  | "initiated"
  | "registering"
  | "verifying"
  | "active"
  | "failed"
  | "expired"
  | (string & {});

/**
 * How WhatsApp delivers the verification code when a number is added to an
 * already-connected account: a text (`sms`) or a voice call (`voice`).
 */
export type WhatsAppVerificationMethod = "sms" | "voice" | (string & {});

/**
 * Request body for {@link WhatsAppSignupResource.create}.
 */
export interface StartWhatsAppSignupRequest {
  /**
   * The number to connect, in E.164 format. Must be an active number in
   * your workspace (provisioned, purchased, or fully ported into Sendly).
   */
  phoneNumber: string;
}

/**
 * Request body for {@link WhatsAppSignupResource.create} that adds a number
 * to a WhatsApp Business Account this workspace has already connected,
 * without the Facebook step.
 */
export interface AddWhatsAppNumberRequest {
  /**
   * The number to add, in E.164 format. The same numbers are eligible as
   * for a Facebook connection.
   */
  phoneNumber: string;
  /**
   * The connected account's id, as `businessAccountId` on a sender from
   * {@link WhatsAppSendersResource.list} or on an active signup. The account
   * must have at least one active number in this workspace.
   */
  businessAccountId: string;
  /** How WhatsApp sends the code: `sms` (the default) or `voice` */
  verificationMethod?: WhatsAppVerificationMethod;
  /**
   * The name WhatsApp shows for the number (max 512 characters). Defaults
   * to the account's existing sender display name, else its business name.
   */
  displayName?: string;
}

/**
 * Response from {@link WhatsAppSignupResource.create}.
 *
 * Hand `connectUrl` to a human — they open it in a browser and log in with
 * Facebook to link their WhatsApp Business Account. Poll
 * {@link WhatsAppSignupResource.get} with `id` until the status is `active`.
 */
export interface WhatsAppSignupSession {
  /** Unique signup identifier — use with {@link WhatsAppSignupResource.get} */
  id: string;
  /** Hosted connect page URL. A person must open this in a browser. */
  connectUrl: string;
  /** Current signup status */
  status: WhatsAppSignupStatus;
}

/**
 * Response from {@link WhatsAppSignupResource.get}.
 */
export interface WhatsAppSignup {
  /** Unique signup identifier */
  id: string;
  /** Current signup status */
  status: WhatsAppSignupStatus;
  /** The number being connected, in E.164 format */
  phoneNumber: string;
  /**
   * The customer's WhatsApp Business Account id, once linked (and while a
   * number added by code is `verifying`); null before the human completes
   * the connect step
   */
  businessAccountId: string | null;
  /**
   * Why the signup failed, when status is `failed`; null otherwise. Holds
   * one code: `setup_fee_payment_failed`, `signup_abandoned`,
   * `meta_exchange_failed`, `registration_failed`, `waba_already_connected`,
   * `waba_mismatch` (the WhatsApp Business Account chosen in the Facebook
   * step doesn't hold the verified number), `registration_timeout`
   * (activation hadn't finished about 6 hours after the session began),
   * `phone_number_mismatch`, or for a number added by code
   * `verification_start_failed` (WhatsApp wouldn't send the code),
   * `verification_failed` (too many wrong codes) or `verification_expired`
   * (no correct code was entered before it expired). If the connection
   * fails, the $19 fee is refunded automatically.
   */
  failureReasons: string[] | null;
  /**
   * How the code is delivered, `sms` or `voice`. Only while `verifying`.
   */
  verificationMethod?: WhatsAppVerificationMethod;
  /**
   * Wrong codes that can still be submitted before the signup fails. Only
   * while `verifying`.
   */
  verificationAttemptsRemaining?: number;
  /**
   * The code WhatsApp texted to the number, read from the number's inbound
   * messages, or null when none has arrived. Only on
   * {@link WhatsAppSignupResource.get} while `verifying`. Until a code has
   * been submitted it is the newest code that has arrived since the signup
   * started, so after a resend it still shows the earlier code until the
   * new one arrives. Once WhatsApp has checked a code, only a code that
   * arrived after the last submission or resend is returned. A submission
   * answered with 502 `whatsapp_verification_unavailable` is not counted,
   * so the same unchecked code can come back, and submitting it again is
   * safe.
   */
  verificationCode?: string | null;
  /** ISO 8601 timestamp of the last status change */
  updatedAt: string;
}

/**
 * Connection status of a WhatsApp sender.
 *
 * - `pending` — the connection is still in progress; not sendable yet
 * - `active` — connected; the number can send and receive on WhatsApp
 * - `suspended` — sending is currently suspended for this number
 */
export type WhatsAppSenderStatus = "pending" | "active" | "suspended" | (string & {});

/**
 * A number connected (or connecting) to WhatsApp.
 */
export interface WhatsAppSender {
  /** The sender, in E.164 format */
  phoneNumber: string;
  /**
   * The name recipients see — chosen during the connect flow and reviewed
   * by Meta; null until set
   */
  displayName: string | null;
  /** Connection status */
  status: WhatsAppSenderStatus;
  /** Meta quality rating (e.g. "GREEN"), or null before first rating */
  qualityRating: string | null;
  /**
   * The WhatsApp Business Account the number belongs to; pass it to
   * {@link WhatsAppSignupResource.create} to add another number to the
   * same account. Null while the sender is `pending`.
   */
  businessAccountId?: string | null;
  /**
   * The account's business name; null while the sender is `pending`, or
   * when the account has no business name on file
   */
  businessName?: string | null;
  /**
   * Whether WhatsApp calling is on for the number
   * ({@link WhatsAppSendersResource.setCalling})
   */
  callingEnabled?: boolean;
  /**
   * Whether WhatsApp lets the business place calls from this number. False
   * for every +1 number (the US, Canada and the rest of the North American
   * numbering plan), and for Egyptian (+20), Vietnamese (+84) and Nigerian
   * (+234) numbers; customers can still call them on WhatsApp.
   */
  outboundCallingAllowed?: boolean;
  /** ISO 8601 timestamp when the sender was connected */
  createdAt: string;
}

/**
 * Options for {@link WhatsAppSendersResource.uploadProfilePhoto}.
 */
export interface WhatsAppProfilePhotoOptions {
  /**
   * Content type sent with the file: `image/jpeg` or `image/png`. Defaults
   * to a Blob's own type, else `image/jpeg`.
   */
  contentType?: string;
  /** File name sent with the file; defaults to `profile.jpg` or `profile.png` */
  filename?: string;
}

/**
 * A command shown when a customer types "/" in a chat with the business.
 */
export interface WhatsAppCommand {
  /**
   * Letters, digits or underscores, 1 to 32 characters; a leading "/" is
   * stripped
   */
  command: string;
  /** What the command does, 1 to 256 characters */
  description: string;
}

/**
 * A sender's conversational components.
 */
export interface WhatsAppConversationalComponents {
  /** The sender, in E.164 format */
  phoneNumber: string;
  /**
   * Up to 4 tappable suggestions shown when someone opens a chat with the
   * business for the first time
   */
  iceBreakers: string[];
  /** Up to 30 commands shown when the customer types "/" */
  commands: WhatsAppCommand[];
}

/**
 * Request body for
 * {@link WhatsAppSendersResource.updateConversationalComponents}. Give at
 * least one list. Each list given replaces the stored one; `[]` clears it.
 */
export interface UpdateWhatsAppConversationalComponentsRequest {
  /**
   * At most 4, each 1 to 80 characters after trimming, no two the same
   * (ignoring case)
   */
  iceBreakers?: string[];
  /** At most 30, with no command listed twice */
  commands?: WhatsAppCommand[];
}

/**
 * Request body for {@link WhatsAppSendersResource.setCalling}.
 */
export interface UpdateWhatsAppCallingRequest {
  /** True to switch WhatsApp calling on, false to switch it off */
  enabled: boolean;
}

/**
 * Response from {@link WhatsAppSendersResource.setCalling}.
 */
export interface WhatsAppCallingSettings {
  /** The sender, in E.164 format */
  phoneNumber: string;
  /** Whether WhatsApp calling is now on */
  callingEnabled: boolean;
  /**
   * Whether WhatsApp lets the business place calls from this number (false
   * for +1, +20, +84 and +234 numbers)
   */
  outboundCallingAllowed: boolean;
}

/**
 * Response from {@link WhatsAppSendersResource.list}.
 */
export interface WhatsAppSendersList {
  senders: WhatsAppSender[];
}

/**
 * A WhatsApp sender's business profile — what recipients see when they
 * open your business in WhatsApp.
 */
export interface WhatsAppSenderProfile {
  /** The sender, in E.164 format */
  phoneNumber: string;
  /** The business name recipients see; null until set */
  displayName: string | null;
  /** Profile photo URL; null when none is set */
  profilePhotoUrl: string | null;
  /** Business category (e.g. "Restaurant"); null when none is set */
  category: string | null;
  /** Short profile line (max 139 chars); null when none is set */
  about: string | null;
  /** Longer business description (max 512 chars); null when none is set */
  description: string | null;
  /** Contact email shown on the profile; null when none is set */
  email: string | null;
  /** Website shown on the profile; null when none is set */
  website: string | null;
  /** Business address shown on the profile; null when none is set */
  address: string | null;
}

/**
 * Request body for {@link WhatsAppSendersResource.updateProfile}. Supply
 * only the fields to change; omitted fields keep their current value.
 */
export interface UpdateWhatsAppSenderProfileRequest {
  /** The business name recipients see */
  displayName?: string;
  /** Short profile line (max 139 chars) */
  about?: string;
  /** Longer business description (max 512 chars) */
  description?: string;
  /** Business category (e.g. "Restaurant") */
  category?: string;
  /** Contact email shown on the profile */
  email?: string;
  /** Website shown on the profile */
  website?: string;
  /** Business address shown on the profile */
  address?: string;
}

/**
 * Template category. Meta reviews every template and may reclassify it —
 * the category on the record is authoritative and drives per-message
 * pricing. The server uppercases it. There is no default: a create without
 * a category returns 400 `template_category_invalid`, and an update can't
 * change it.
 */
export type WhatsAppTemplateCategory =
  | "AUTHENTICATION"
  | "UTILITY"
  | "MARKETING"
  | (string & {});

/**
 * Review status of a template.
 *
 * - `PENDING` — submitted; Meta review usually takes 24–48h
 * - `APPROVED` — usable in template sends
 * - `REJECTED` — not usable; edit it with
 *   {@link WhatsAppTemplatesResource.update} to resubmit (template names
 *   are locked for ~30 days after deletion, so editing is the way out)
 * - `PAUSED` / `DISABLED` — quality-suspended by Meta
 *
 * Meta may report other statuses; the API passes them through in uppercase.
 */
export type WhatsAppTemplateStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "PAUSED"
  | "DISABLED"
  | (string & {});

/**
 * A button on a template.
 *
 * - `url` — link button; `url` is required and may contain a `{{1}}`
 *   placeholder (supply `example` values for review)
 * - `quick_reply` — tap-to-reply button (e.g. a "Stop promotions" opt-out,
 *   recommended on marketing templates)
 * - `otp` — copy-code button; required on AUTHENTICATION templates
 */
export interface WhatsAppTemplateButton {
  /** Button type */
  type: "url" | "quick_reply" | "otp";
  /** Button label */
  text: string;
  /** Link target (url buttons only); may contain a `{{1}}` placeholder */
  url?: string;
  /** Example values for a url placeholder, for Meta review */
  example?: string[];
}

/**
 * Request body for {@link WhatsAppTemplatesResource.create}.
 */
export interface CreateWhatsAppTemplateRequest {
  /**
   * The WhatsApp-connected sending number this template belongs to, in
   * E.164 format
   */
  sender: string;
  /**
   * Template name: lowercase letters, digits, and underscores (e.g.
   * "order_shipped")
   */
  name: string;
  /** Template language code (e.g. "en_US") */
  language: string;
  /**
   * Template category: `UTILITY`, `AUTHENTICATION` or `MARKETING`. Required,
   * with no default (leaving it out returns 400 `template_category_invalid`).
   * It drives Meta review rules and pricing, and can't be changed later.
   */
  category: WhatsAppTemplateCategory;
  /**
   * Body text. Use `{{1}}`, `{{2}}`, … for variables; every placeholder
   * needs an example value in `examples`.
   */
  body: string;
  /** Optional footer line */
  footer?: string;
  /**
   * Optional text header. It is fixed text: a header containing `{{n}}` is
   * refused with `template_header_variable_unsupported`, because sends fill
   * only body and button variables.
   */
  header?: string;
  /** Optional buttons */
  buttons?: WhatsAppTemplateButton[];
  /**
   * Example values for body placeholders, keyed by placeholder number:
   * { "1": "Acme Inc", "2": "#4821" }. Required when the body has
   * variables — Meta reviews templates with these examples filled in.
   */
  examples?: Record<string, string>;
}

/**
 * Request body for {@link WhatsAppTemplatesResource.update}. Supply only
 * the fields to change; omitted fields keep their current value.
 */
export interface UpdateWhatsAppTemplateRequest {
  /** Replacement body text */
  body?: string;
  /** Replacement footer */
  footer?: string;
  /**
   * Replacement text header. It can't contain `{{n}}` variables
   * (`template_header_variable_unsupported`).
   */
  header?: string;
  /** Replacement buttons */
  buttons?: WhatsAppTemplateButton[];
  /** Replacement example values for body placeholders */
  examples?: Record<string, string>;
}

/**
 * A WhatsApp message template.
 */
export interface WhatsAppTemplate {
  /** Unique template identifier */
  id: string;
  /** Template name */
  name: string;
  /** Template language code */
  language: string;
  /** Category (Meta may reclassify; this value drives pricing) */
  category: WhatsAppTemplateCategory;
  /** Review status */
  status: WhatsAppTemplateStatus;
  /** Meta quality rating (e.g. "GREEN"), or null before first rating */
  qualityRating: string | null;
  /** Why Meta rejected the template, when status is `REJECTED` */
  rejectionReason: string | null;
  /** ISO 8601 timestamp when the template was created */
  createdAt: string;
  /** ISO 8601 timestamp when the template was last updated */
  updatedAt: string;
  /**
   * Non-blocking submission warnings (e.g. an unapproved display name, or
   * a marketing template without an opt-out button). Present on create
   * responses when applicable.
   */
  warnings?: string[];
}

/**
 * Response from {@link WhatsAppTemplatesResource.list}.
 */
export interface WhatsAppTemplateListResponse {
  templates: WhatsAppTemplate[];
}

/**
 * Response from {@link WhatsAppTemplatesResource.delete}.
 */
export interface WhatsAppTemplateDeletedResponse {
  /** The deleted template's id */
  id: string;
  /** Always true */
  deleted: true;
}

/**
 * Options for {@link WhatsAppResource.window}.
 */
export interface WhatsAppWindowOptions {
  /** Your WhatsApp-connected sending number, in E.164 format */
  from: string;
  /** The recipient's number, in E.164 format */
  to: string;
}

/**
 * Response from {@link WhatsAppResource.window}.
 */
export interface WhatsAppWindow {
  /** True when a 24-hour customer-service window is currently open */
  open: boolean;
  /**
   * When the window closes (ISO 8601). After it closes this is the past
   * expiry, with `open` false. Null when Sendly has no window on record for
   * the pair; a free-form send may still go through then if WhatsApp
   * reports an open window, and otherwise fails with
   * `whatsapp_window_closed`.
   */
  expiresAt: string | null;
}

class WhatsAppSignupResource {
  private readonly http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  /**
   * Start connecting a number to WhatsApp.
   *
   * Charges a one-time $19 setup fee (no monthly fee) and returns a
   * `connectUrl`. Completing the connection requires a human: hand the
   * URL to your user — they open it in a browser and log in with Facebook
   * to link their WhatsApp Business Account. Then poll
   * {@link WhatsAppSignupResource.get} until the status is `active`.
   *
   * Calling again for a number with an in-flight signup returns the
   * existing signup (same `connectUrl`) without charging again. Requires
   * a live API key with the `whatsapp:write` scope and, in a team
   * workspace, an owner or admin (`settings:write`). After the Facebook
   * step the signup stays `registering` while WhatsApp activates the
   * number. Activation usually takes a few minutes but can take hours. If
   * it hasn't finished about 6 hours after the session began, the session
   * fails with `registration_timeout` and the fee is refunded. If the
   * connection fails, the $19 fee is refunded automatically; once the
   * number has connected there is no refund, and a later disconnect gets
   * nothing back.
   *
   * @param request - The number to connect
   * @returns The signup with its `connectUrl`
   *
   * @example
   * ```typescript
   * const signup = await sendly.whatsapp.signup.create({
   *   phoneNumber: '+15559876543',
   * });
   *
   * // A person must finish this step in a browser:
   * console.log(`Open ${signup.connectUrl} and log in with Facebook`);
   * ```
   *
   * @throws {ValidationError} If the number is not E.164, not in your workspace, or not eligible
   * @throws {AuthenticationError} If the API key is invalid or a test key, lacks the `whatsapp:write` scope, or the workspace role isn't owner or admin (`insufficient_permissions`)
   * @throws {SendlyError} `whatsapp_requires_live_key` (403) with a test key
   * @throws {SendlyError} `whatsapp_unavailable` (503) while WhatsApp connections are unavailable; nothing is charged. Only signup returns it, with `retryAfter: 3600` in the body and a `Retry-After: 3600` header. The SDK retries it like any 5xx before throwing.
   * @throws {SendlyError} `whatsapp_signup_limit_reached` (429) after 5 failed, charged signups in 24 hours. Not retried; try again the next day.
   * @throws {SendlyError} `whatsapp_verification_in_progress` (409) when the number is being added to a connected account by code; `error.response.id` is that signup
   */
  create(
    request: StartWhatsAppSignupRequest & { businessAccountId?: undefined },
  ): Promise<WhatsAppSignupSession>;
  /**
   * Add a number to a WhatsApp Business Account this workspace has already
   * connected, without the Facebook step: pass `businessAccountId`.
   *
   * Charges the same one-time $19 fee as a Facebook connection (refunded
   * automatically if the connection fails), then WhatsApp sends the number
   * a 6-digit code by text or voice call. The signup comes back
   * `verifying`, with no `connectUrl`. Submit the code with
   * {@link WhatsAppSignupResource.verify}; {@link WhatsAppSignupResource.get}
   * returns it as `verificationCode` once the text reaches the number.
   * Calling again for a number that is already verifying returns that
   * signup without a second charge or a second code, with two exceptions:
   * if the first call stopped before the code was requested, the repeat
   * requests it (201); and a verifying signup more than 3 hours old is
   * failed and refunded, and a new charged one is started. The same
   * scopes, key and role rules apply as for a Facebook connection.
   *
   * A 5xx, a timeout or a network error is thrown at once, never retried:
   * each attempt can start a new signup that is charged and, when it fails,
   * refunded. Only a 429 the API never ran is retried.
   *
   * @param request - The number, the connected account's id, and optionally the code method and display name
   * @returns The `verifying` signup
   *
   * @example
   * ```typescript
   * const { senders } = await sendly.whatsapp.senders.list();
   * const account = senders.find((s) => s.status === 'active' && s.businessAccountId);
   * const signup = await sendly.whatsapp.signup.create({
   *   phoneNumber: '+14155550123',
   *   businessAccountId: account!.businessAccountId!,
   * });
   * // Enter the 6-digit code WhatsApp sent to the number
   * await sendly.whatsapp.signup.verify(signup.id, '123456');
   * ```
   *
   * @throws {ValidationError} If `businessAccountId` is empty, or `verificationMethod` or `displayName` is given without it; nothing is sent
   * @throws {SendlyError} `whatsapp_business_account_not_found` (404) if the account isn't connected in this workspace with an active number
   * @throws {SendlyError} `display_name_required` (400) if no display name was given and the account has none to reuse
   * @throws {SendlyError} `whatsapp_signup_in_progress` (409) while a Facebook connection for the number is in flight (`error.response.id` is that signup), or `whatsapp_already_enabled` (409) if it is already connected
   * @throws {SendlyError} `whatsapp_verification_start_failed`: 422 when WhatsApp refused to send a code (final), or 502 when it couldn't be reached. Either way the signup failed and the fee is refunded; start again. Not retried automatically.
   */
  create(request: AddWhatsAppNumberRequest): Promise<WhatsAppSignup>;
  create(request: StartWhatsAppSignupRequest): Promise<WhatsAppSignupSession>;
  async create(
    request: StartWhatsAppSignupRequest | AddWhatsAppNumberRequest,
  ): Promise<WhatsAppSignupSession | WhatsAppSignup> {
    validatePhoneNumber(request.phoneNumber);
    const addition = request as Partial<AddWhatsAppNumberRequest>;

    if (addition.businessAccountId === undefined) {
      if (
        addition.verificationMethod !== undefined ||
        addition.displayName !== undefined
      ) {
        throw new ValidationError(
          "verificationMethod and displayName need a businessAccountId",
        );
      }
      return this.http.request<WhatsAppSignupSession>({
        method: "POST",
        path: "/whatsapp/signup",
        body: { phoneNumber: request.phoneNumber },
      });
    }

    if (
      typeof addition.businessAccountId !== "string" ||
      !addition.businessAccountId.trim()
    ) {
      throw new ValidationError("businessAccountId must be a non-empty string");
    }

    return this.http.request<WhatsAppSignup>({
      method: "POST",
      path: "/whatsapp/signup",
      retryUnsentOnly: true,
      body: {
        phoneNumber: request.phoneNumber,
        businessAccountId: addition.businessAccountId,
        ...(addition.verificationMethod !== undefined && {
          verificationMethod: addition.verificationMethod,
        }),
        ...(addition.displayName !== undefined && {
          displayName: addition.displayName,
        }),
      },
    });
  }

  /**
   * Submit the 6-digit code WhatsApp sent to a number being added to a
   * connected account. Spaces and dashes are ignored, so `123-456` works.
   *
   * A correct code connects the number: the signup comes back `active`
   * and `whatsapp_account.connected` fires. A signup that is already
   * active comes back as it is. Requires a live API key with the
   * `whatsapp:write` scope and, in a team workspace, an owner or admin
   * (`settings:write`).
   *
   * A 5xx, a timeout or a network error is thrown at once, never retried:
   * every submission uses one of the 5 attempts, and a 502
   * `whatsapp_activation_pending` means WhatsApp already accepted the code.
   * Only a 429 the API never ran is retried.
   *
   * @param id - The signup's id
   * @param code - The code WhatsApp sent
   * @returns The `active` signup
   *
   * @example
   * ```typescript
   * try {
   *   await sendly.whatsapp.signup.verify(signup.id, '123-456');
   * } catch (err) {
   *   if (err instanceof SendlyError && err.code === 'whatsapp_verification_code_invalid') {
   *     console.log(`${err.response?.attemptsRemaining} tries left`);
   *   }
   * }
   * ```
   *
   * @throws {SendlyError} `invalid_verification_code` (400) if the code isn't 6 digits
   * @throws {SendlyError} `whatsapp_verification_code_invalid` (422) for a wrong code; `error.response.attemptsRemaining` says how many tries are left
   * @throws {SendlyError} `whatsapp_verification_failed` (409) after 5 wrong codes: the signup failed and the fee is refunded
   * @throws {SendlyError} `whatsapp_verification_busy` (409) while another code for the number is being checked; try again in a moment
   * @throws {SendlyError} `signup_not_active` (409) if the signup isn't waiting for a code, or is more than 3 hours old
   * @throws {SendlyError} `whatsapp_verification_unavailable` (502) when WhatsApp couldn't check the code; the attempt isn't counted. `whatsapp_activation_pending` (502) when the code was accepted but the connection didn't finish; Sendly is alerted, so check back with {@link WhatsAppSignupResource.get}. Neither is retried automatically.
   * @throws {SendlyError} `signup_not_found` (404) if no such signup exists in your workspace
   */
  async verify(id: string, code: string): Promise<WhatsAppSignup> {
    if (!id) {
      throw new Error("A signup 'id' is required");
    }

    return this.http.request<WhatsAppSignup>({
      method: "POST",
      path: `/whatsapp/signup/${encodeURIComponent(id)}/verify`,
      body: { code },
      retryUnsentOnly: true,
    });
  }

  /**
   * Ask WhatsApp to send a number being added by code a new code.
   *
   * Leaving out `verificationMethod` sends it by text (`sms`), whichever
   * method the signup used before. Codes are at least 30 seconds apart,
   * counted from the signup's last change, a code submission included. A
   * signup that is already active comes back as it is. Requires a live API
   * key with the `whatsapp:write` scope and, in a team workspace, an owner
   * or admin (`settings:write`).
   *
   * @param id - The signup's id
   * @param verificationMethod - `sms` (the default) or `voice`
   * @returns The `verifying` signup
   *
   * @example
   * ```typescript
   * await sendly.whatsapp.signup.resend(signup.id, 'voice');
   * ```
   *
   * @throws {SendlyError} `whatsapp_verification_resend_too_soon` (429) within 30 seconds of the last change; `error.response.retryAfter` is the wait in seconds. Not retried.
   * @throws {SendlyError} `whatsapp_verification_resend_failed`: 422 when WhatsApp wouldn't send another code yet, 502 when it couldn't be reached
   * @throws {SendlyError} `signup_not_active` (409) if the signup isn't waiting for a code, or is more than 3 hours old
   * @throws {SendlyError} `signup_not_found` (404) if no such signup exists in your workspace
   */
  async resend(
    id: string,
    verificationMethod?: WhatsAppVerificationMethod,
  ): Promise<WhatsAppSignup> {
    if (!id) {
      throw new Error("A signup 'id' is required");
    }

    return this.http.request<WhatsAppSignup>({
      method: "POST",
      path: `/whatsapp/signup/${encodeURIComponent(id)}/resend`,
      body: {
        ...(verificationMethod !== undefined && { verificationMethod }),
      },
    });
  }

  /**
   * Get the status of a WhatsApp signup. Needs the `whatsapp:read` scope;
   * test keys work.
   *
   * @param id - The signup's id
   * @returns The signup status
   *
   * @example
   * ```typescript
   * const signup = await sendly.whatsapp.signup.get('was_xxx');
   *
   * if (signup.status === 'active') {
   *   console.log(`${signup.phoneNumber} is connected to WhatsApp`);
   * } else if (signup.status === 'failed') {
   *   console.log(signup.failureReasons);
   * }
   * ```
   *
   * @throws {NotFoundError} If no such signup exists in your workspace
   */
  async get(id: string): Promise<WhatsAppSignup> {
    if (!id) {
      throw new Error("A signup 'id' is required");
    }

    return this.http.request<WhatsAppSignup>({
      method: "GET",
      path: `/whatsapp/signup/${encodeURIComponent(id)}`,
    });
  }
}

class WhatsAppSendersResource {
  private readonly http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  /**
   * List your WhatsApp senders.
   *
   * Returns the numbers connected (or connecting) to WhatsApp on your
   * workspace, newest first. An empty list means no number is connected
   * yet — start one with {@link WhatsAppSignupResource.create}. Needs the
   * `whatsapp:read` scope; test keys work.
   *
   * @returns Your senders with connection status and quality rating
   *
   * @example
   * ```typescript
   * const { senders } = await sendly.whatsapp.senders.list();
   * for (const s of senders) {
   *   console.log(`${s.phoneNumber} (${s.displayName ?? 'no name yet'}) — ${s.status}`);
   * }
   * ```
   */
  async list(): Promise<WhatsAppSendersList> {
    return this.http.request<WhatsAppSendersList>({
      method: "GET",
      path: "/whatsapp/senders",
    });
  }

  /**
   * Get a WhatsApp sender's business profile.
   *
   * Returns what recipients see when they open your business in
   * WhatsApp. The sender must have an active WhatsApp connection. Needs
   * the `whatsapp:read` scope; test keys work.
   *
   * @param phoneNumber - Your WhatsApp-connected sending number, in E.164 format
   * @returns The sender's business profile
   *
   * @example
   * ```typescript
   * const profile = await sendly.whatsapp.senders.getProfile('+15559876543');
   *
   * console.log(profile.displayName);  // 'Acme Coffee'
   * console.log(profile.about);        // 'Fresh roasts daily'
   * ```
   *
   * @throws {NotFoundError} If the number isn't connected to WhatsApp
   */
  async getProfile(phoneNumber: string): Promise<WhatsAppSenderProfile> {
    validatePhoneNumber(phoneNumber);

    return this.http.request<WhatsAppSenderProfile>({
      method: "GET",
      path: `/whatsapp/senders/${encodeURIComponent(phoneNumber)}/profile`,
    });
  }

  /**
   * Update a WhatsApp sender's business profile.
   *
   * Supply only the fields to change — omitted fields keep their current
   * value. `about` is capped at 139 characters and `description` at 512.
   * Requires a live API key with the `whatsapp:write` scope and, in a team
   * workspace, an owner or admin (`settings:write`).
   *
   * @param phoneNumber - Your WhatsApp-connected sending number, in E.164 format
   * @param request - The profile fields to change (at least one)
   * @returns The updated business profile
   *
   * @example
   * ```typescript
   * const profile = await sendly.whatsapp.senders.updateProfile('+15559876543', {
   *   about: 'Fresh roasts daily',
   *   website: 'https://acme.example.com',
   * });
   * ```
   *
   * @throws {ValidationError} If a field is unknown, not a string, or too long
   * @throws {NotFoundError} If the number isn't connected to WhatsApp
   * @throws {AuthenticationError} If the API key is invalid or a test key (`whatsapp_requires_live_key`), or the workspace role isn't owner or admin (`insufficient_permissions`)
   */
  async updateProfile(
    phoneNumber: string,
    request: UpdateWhatsAppSenderProfileRequest,
  ): Promise<WhatsAppSenderProfile> {
    validatePhoneNumber(phoneNumber);

    return this.http.request<WhatsAppSenderProfile>({
      method: "PATCH",
      path: `/whatsapp/senders/${encodeURIComponent(phoneNumber)}/profile`,
      body: {
        ...(request.displayName !== undefined && {
          displayName: request.displayName,
        }),
        ...(request.about !== undefined && { about: request.about }),
        ...(request.description !== undefined && {
          description: request.description,
        }),
        ...(request.category !== undefined && { category: request.category }),
        ...(request.email !== undefined && { email: request.email }),
        ...(request.website !== undefined && { website: request.website }),
        ...(request.address !== undefined && { address: request.address }),
      },
    });
  }

  /**
   * Upload a sender's profile photo.
   *
   * Send a JPEG or PNG of at most 5 MB; the API checks the file's bytes,
   * not its name or content type. WhatsApp wants a square image at least
   * 192 pixels wide (640 recommended). Requires a live API key with the
   * `whatsapp:write` scope and, in a team workspace, an owner or admin
   * (`settings:write`).
   *
   * @param phoneNumber - Your WhatsApp-connected sending number, in E.164 format
   * @param file - The image, as a Buffer, Uint8Array or Blob
   * @param options - Content type and file name to send with it
   * @returns The updated business profile
   *
   * @example
   * ```typescript
   * const profile = await sendly.whatsapp.senders.uploadProfilePhoto(
   *   '+14155550123',
   *   fs.readFileSync('logo.png'),
   *   { contentType: 'image/png' },
   * );
   * console.log(profile.profilePhotoUrl);
   * ```
   *
   * @throws {SendlyError} `file_required` (400) for an empty file, `whatsapp_profile_photo_invalid` (400) if it isn't a JPEG or PNG, or `whatsapp_profile_photo_too_large` (413) over 5 MB
   * @throws {SendlyError} `whatsapp_sender_not_connected` (404) if the number isn't connected to WhatsApp
   * @throws {SendlyError} `whatsapp_profile_update_failed` (502) when WhatsApp refused the photo or couldn't be reached; check the image is square and at least 192 pixels wide. A 5xx, a timeout or a network error is thrown at once, not retried automatically.
   */
  async uploadProfilePhoto(
    phoneNumber: string,
    file: Buffer | Uint8Array | Blob,
    options?: WhatsAppProfilePhotoOptions,
  ): Promise<WhatsAppSenderProfile> {
    validatePhoneNumber(phoneNumber);

    const contentType =
      options?.contentType ||
      (file instanceof Blob && file.type) ||
      "image/jpeg";
    const filename =
      options?.filename ||
      (contentType === "image/png" ? "profile.png" : "profile.jpg");

    const form = new FormData();
    form.append("file", new Blob([file], { type: contentType }), filename);

    return this.http.requestFormData<WhatsAppSenderProfile>(
      `/whatsapp/senders/${encodeURIComponent(phoneNumber)}/profile/photo`,
      form,
      {},
      { retryUnsentOnly: true },
    );
  }

  /**
   * Remove a sender's profile photo. Requires a live API key with the
   * `whatsapp:write` scope and, in a team workspace, an owner or admin
   * (`settings:write`).
   *
   * @param phoneNumber - Your WhatsApp-connected sending number, in E.164 format
   * @returns The updated business profile
   *
   * @example
   * ```typescript
   * await sendly.whatsapp.senders.deleteProfilePhoto('+14155550123');
   * ```
   *
   * @throws {SendlyError} `whatsapp_sender_not_connected` (404) if the number isn't connected to WhatsApp
   * @throws {SendlyError} `whatsapp_profile_update_failed` (502) when WhatsApp couldn't remove it; the SDK retries a 5xx before throwing
   */
  async deleteProfilePhoto(phoneNumber: string): Promise<WhatsAppSenderProfile> {
    validatePhoneNumber(phoneNumber);

    return this.http.request<WhatsAppSenderProfile>({
      method: "DELETE",
      path: `/whatsapp/senders/${encodeURIComponent(phoneNumber)}/profile/photo`,
    });
  }

  /**
   * Get a sender's conversational components: the ice breakers shown when
   * someone opens a chat with the business for the first time, and the
   * commands shown when they type "/". Needs the `whatsapp:read` scope;
   * test keys work.
   *
   * @param phoneNumber - Your WhatsApp-connected sending number, in E.164 format
   * @returns The ice breakers and commands
   *
   * @example
   * ```typescript
   * const { iceBreakers, commands } =
   *   await sendly.whatsapp.senders.getConversationalComponents('+14155550123');
   * ```
   *
   * @throws {SendlyError} `whatsapp_sender_not_connected` (404) if the number isn't connected to WhatsApp
   * @throws {SendlyError} `whatsapp_conversational_components_fetch_failed` (502) when WhatsApp couldn't be reached; the SDK retries a 5xx before throwing
   */
  async getConversationalComponents(
    phoneNumber: string,
  ): Promise<WhatsAppConversationalComponents> {
    validatePhoneNumber(phoneNumber);

    return this.http.request<WhatsAppConversationalComponents>({
      method: "GET",
      path: `/whatsapp/senders/${encodeURIComponent(phoneNumber)}/conversational_components`,
    });
  }

  /**
   * Replace a sender's ice breakers, commands, or both.
   *
   * Each list you give replaces the stored one, and `[]` clears it; a list
   * you leave out is kept. Ice breakers: at most 4, each 1 to 80
   * characters after trimming, no two the same ignoring case. Commands: at
   * most 30; `command` is letters, digits or underscores, 1 to 32
   * characters (a leading "/" is stripped), `description` 1 to 256
   * characters, and no command listed twice. Requires a live API key with
   * the `whatsapp:write` scope and, in a team workspace, an owner or admin
   * (`settings:write`).
   *
   * @param phoneNumber - Your WhatsApp-connected sending number, in E.164 format
   * @param request - The lists to replace (at least one)
   * @returns The ice breakers and commands now stored
   *
   * @example
   * ```typescript
   * await sendly.whatsapp.senders.updateConversationalComponents('+14155550123', {
   *   iceBreakers: ['What are your hours?', 'Book a table'],
   *   commands: [{ command: 'menu', description: "See today's menu" }],
   * });
   * ```
   *
   * @throws {ValidationError} `invalid_request` (400) with a message naming the problem
   * @throws {SendlyError} `whatsapp_sender_not_connected` (404) if the number isn't connected to WhatsApp
   * @throws {SendlyError} `whatsapp_conversational_components_update_failed` (502) when WhatsApp couldn't save them; the SDK retries a 5xx before throwing
   */
  async updateConversationalComponents(
    phoneNumber: string,
    request: UpdateWhatsAppConversationalComponentsRequest,
  ): Promise<WhatsAppConversationalComponents> {
    validatePhoneNumber(phoneNumber);

    return this.http.request<WhatsAppConversationalComponents>({
      method: "PATCH",
      path: `/whatsapp/senders/${encodeURIComponent(phoneNumber)}/conversational_components`,
      body: {
        ...(request.iceBreakers !== undefined && {
          iceBreakers: request.iceBreakers,
        }),
        ...(request.commands !== undefined && { commands: request.commands }),
      },
    });
  }

  /**
   * Switch WhatsApp calling on or off for a sender.
   *
   * With calling on, a WhatsApp user calling the number rings exactly like
   * a phone call (the dashboard or the AI agent, per the number's voice
   * settings) and is billed at the normal inbound rate. Turning it on needs
   * calls switched on for the number first. There is no API for placing
   * WhatsApp calls. Requires a live API key with the `whatsapp:write` scope
   * and, in a team workspace, an owner or admin (`settings:write`).
   *
   * @param phoneNumber - Your WhatsApp-connected sending number, in E.164 format
   * @param request - `{ enabled: true }` to switch calling on, `{ enabled: false }` to switch it off
   * @returns Whether calling is on, and whether WhatsApp lets the business call out from the number
   *
   * @example
   * ```typescript
   * const { callingEnabled } = await sendly.whatsapp.senders.setCalling(
   *   '+14155550123',
   *   { enabled: true },
   * );
   * ```
   *
   * @throws {SendlyError} `voice_not_enabled` (409) when turning calling on for a number whose calls are off
   * @throws {SendlyError} `whatsapp_calling_unavailable` (422) when WhatsApp refused: it only allows calling once the account may message at least 2,000 people a day and the display name is approved
   * @throws {SendlyError} `whatsapp_sender_not_connected` (404) if the number isn't connected to WhatsApp
   * @throws {SendlyError} `whatsapp_calling_update_failed` (502) when WhatsApp couldn't be reached; the SDK retries a 5xx before throwing
   */
  async setCalling(
    phoneNumber: string,
    request: UpdateWhatsAppCallingRequest,
  ): Promise<WhatsAppCallingSettings> {
    validatePhoneNumber(phoneNumber);

    return this.http.request<WhatsAppCallingSettings>({
      method: "PATCH",
      path: `/whatsapp/senders/${encodeURIComponent(phoneNumber)}/calling`,
      body: { enabled: request.enabled },
    });
  }
}

class WhatsAppTemplatesResource {
  private readonly http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  /**
   * List your WhatsApp templates. Needs the `whatsapp:read` scope; test
   * keys work.
   *
   * @returns Your templates with review status and quality rating
   *
   * @example
   * ```typescript
   * const { templates } = await sendly.whatsapp.templates.list();
   * for (const t of templates) {
   *   console.log(`${t.name} (${t.language}) — ${t.status}`);
   * }
   * ```
   */
  async list(): Promise<WhatsAppTemplateListResponse> {
    return this.http.request<WhatsAppTemplateListResponse>({
      method: "GET",
      path: "/whatsapp/templates",
    });
  }

  /**
   * Create a template and submit it to Meta for review.
   *
   * Review usually takes 24–48h; the template is usable once its status
   * is `APPROVED`. Requires a live API key with the `whatsapp:write` scope
   * and, in a team workspace, an owner, admin or member (`templates:write`).
   * `category` is required (`UTILITY`, `AUTHENTICATION` or `MARKETING`);
   * there is no default. A marketing template without an opt-out button is
   * still accepted, with a warning.
   *
   * @param request - The template definition
   * @returns The created template (status `PENDING`), with any submission warnings
   *
   * @example
   * ```typescript
   * const template = await sendly.whatsapp.templates.create({
   *   sender: '+15559876543',
   *   name: 'order_shipped',
   *   language: 'en_US',
   *   category: 'UTILITY',
   *   body: 'Hi {{1}}, your order {{2}} has shipped!',
   *   examples: { '1': 'Sam', '2': '#4821' },
   * });
   *
   * console.log(template.status); // 'PENDING'
   * ```
   *
   * @throws {NotFoundError} `whatsapp_sender_not_connected` (404) if the sender isn't connected to WhatsApp; this is checked first
   * @throws {SendlyError} With a `template_*` code (400) and a readable `message` if the template fails pre-flight checks: `template_category_invalid` (category missing or not one of the three), `template_authentication_otp_button_required`, `template_authentication_no_links` (a link in the body or a URL button on an authentication template), `template_header_variable_unsupported` (a header containing `{{n}}`), a bad name or missing examples
   */
  async create(
    request: CreateWhatsAppTemplateRequest,
  ): Promise<WhatsAppTemplate> {
    validatePhoneNumber(request.sender);

    return this.http.request<WhatsAppTemplate>({
      method: "POST",
      path: "/whatsapp/templates",
      body: {
        sender: request.sender,
        name: request.name,
        language: request.language,
        category: request.category,
        body: request.body,
        ...(request.footer !== undefined && { footer: request.footer }),
        ...(request.header !== undefined && { header: request.header }),
        ...(request.buttons && { buttons: request.buttons }),
        ...(request.examples && { examples: request.examples }),
      },
    });
  }

  /**
   * Edit an APPROVED or REJECTED template and resubmit it for review.
   *
   * This is the recovery path for rejections: template names are locked
   * for ~30 days after deletion, so editing a rejected template (rather
   * than deleting and re-creating it) is the way to fix it. The updated
   * template goes back to `PENDING` review. The category can't be
   * changed. Requires a live API key with the `whatsapp:write` scope and,
   * in a team workspace, an owner, admin or member (`templates:write`).
   *
   * @param id - The template's id
   * @param request - The fields to change (omitted fields are kept)
   * @returns The updated template (status `PENDING`)
   *
   * @example
   * ```typescript
   * const template = await sendly.whatsapp.templates.update('wat_xxx', {
   *   body: 'Hi {{1}}, your order {{2}} is on its way!',
   *   examples: { '1': 'Sam', '2': '#4821' },
   * });
   * ```
   *
   * @throws {NotFoundError} If no such template exists
   * @throws {SendlyError} With a `template_*` code and a readable `message` if the edited template fails pre-flight checks (including `template_header_variable_unsupported`), or the template is not APPROVED/REJECTED
   */
  async update(
    id: string,
    request: UpdateWhatsAppTemplateRequest,
  ): Promise<WhatsAppTemplate> {
    if (!id) {
      throw new Error("A template 'id' is required");
    }

    return this.http.request<WhatsAppTemplate>({
      method: "PATCH",
      path: `/whatsapp/templates/${encodeURIComponent(id)}`,
      body: {
        ...(request.body !== undefined && { body: request.body }),
        ...(request.footer !== undefined && { footer: request.footer }),
        ...(request.header !== undefined && { header: request.header }),
        ...(request.buttons !== undefined && { buttons: request.buttons }),
        ...(request.examples !== undefined && { examples: request.examples }),
      },
    });
  }

  /**
   * Delete a template.
   *
   * Meta locks a deleted template's name for ~30 days — re-creating it
   * fails with `template_name_locked` until the lock lifts. To fix a
   * rejected template, prefer {@link WhatsAppTemplatesResource.update}.
   * Requires a live API key with the `whatsapp:write` scope and, in a team
   * workspace, an owner, admin or member (`templates:write`).
   *
   * @param id - The template's id
   * @returns Deletion confirmation
   *
   * @example
   * ```typescript
   * await sendly.whatsapp.templates.delete('wat_xxx');
   * ```
   *
   * @throws {NotFoundError} If no such template exists
   */
  async delete(id: string): Promise<WhatsAppTemplateDeletedResponse> {
    if (!id) {
      throw new Error("A template 'id' is required");
    }

    return this.http.request<WhatsAppTemplateDeletedResponse>({
      method: "DELETE",
      path: `/whatsapp/templates/${encodeURIComponent(id)}`,
    });
  }
}

/**
 * WhatsApp resource — connect senders, manage templates, and check
 * 24-hour windows.
 *
 * @example
 * ```typescript
 * // 1. Connect a number ($19 one-time, no monthly fee). The connect URL
 * //    must be opened by a human — they log in with Facebook in a
 * //    browser to link their WhatsApp Business Account.
 * const signup = await sendly.whatsapp.signup.create({
 *   phoneNumber: '+15559876543',
 * });
 * console.log(`Have your user open: ${signup.connectUrl}`);
 *
 * // 2. Poll until active
 * const status = await sendly.whatsapp.signup.get(signup.id);
 *
 * // 3. Create a template (Meta reviews it, usually 24-48h)
 * await sendly.whatsapp.templates.create({
 *   sender: '+15559876543',
 *   name: 'order_shipped',
 *   language: 'en_US',
 *   category: 'UTILITY',
 *   body: 'Hi {{1}}, your order {{2}} has shipped!',
 *   examples: { '1': 'Sam', '2': '#4821' },
 * });
 *
 * // 4. Send — free-form inside an open 24h window, template anytime
 * const { open } = await sendly.whatsapp.window({
 *   from: '+15559876543',
 *   to: '+15551234567',
 * });
 * ```
 */
export class WhatsAppResource {
  private readonly http: HttpClient;

  /**
   * Connect numbers to WhatsApp. Starting a signup returns a `connectUrl`
   * a human must complete in a browser; adding a number to an account
   * already connected uses a code instead.
   */
  public readonly signup: WhatsAppSignupResource;

  /**
   * List the numbers connected (or connecting) to WhatsApp, read or update
   * their business profiles and photos, set their ice breakers and
   * commands, and switch WhatsApp calling on or off.
   */
  public readonly senders: WhatsAppSendersResource;

  /**
   * Manage Meta-reviewed message templates.
   */
  public readonly templates: WhatsAppTemplatesResource;

  constructor(http: HttpClient) {
    this.http = http;
    this.signup = new WhatsAppSignupResource(http);
    this.senders = new WhatsAppSendersResource(http);
    this.templates = new WhatsAppTemplatesResource(http);
  }

  /**
   * Check whether a 24-hour customer-service window is open between one
   * of your WhatsApp senders and a recipient.
   *
   * Free-form text and media only deliver while a window is open (it
   * opens when the recipient messages you and lasts 24h from their last
   * inbound message). Outside a window, send an approved template. Needs
   * the `whatsapp:read` scope; test keys work.
   *
   * The response is exactly `{ open, expiresAt }`. With no window on
   * record, `open` is false and `expiresAt` is null; after a window has
   * expired, `open` is false and `expiresAt` is the past expiry.
   *
   * @param options - Your sending number and the recipient
   * @returns Whether the window is open and when it closes
   *
   * @example
   * ```typescript
   * const { open, expiresAt } = await sendly.whatsapp.window({
   *   from: '+15559876543',
   *   to: '+15551234567',
   * });
   *
   * if (!open) {
   *   // Use a template send instead of free-form text
   * }
   * ```
   */
  async window(options: WhatsAppWindowOptions): Promise<WhatsAppWindow> {
    validatePhoneNumber(options.from);
    validatePhoneNumber(options.to);

    return this.http.request<WhatsAppWindow>({
      method: "GET",
      path: "/whatsapp/window",
      query: {
        from: options.from,
        to: options.to,
      },
    });
  }
}
