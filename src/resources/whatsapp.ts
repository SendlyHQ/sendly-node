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
 * user — the connection cannot be completed programmatically.
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
 * @see https://sendly.live/docs/whatsapp
 */

import type { HttpClient } from "../utils/http";
import { validatePhoneNumber } from "../utils/validation";

/**
 * Lifecycle status of a WhatsApp signup.
 *
 * - `initiated` — created; waiting for a human to complete the connect URL
 * - `registering` — the business account is linked; activation in progress
 * - `active` — connected; the number can send and receive on WhatsApp
 * - `failed` — the connection failed (see `failureReasons`)
 * - `expired` — the connect URL expired before it was completed
 */
export type WhatsAppSignupStatus =
  | "initiated"
  | "registering"
  | "active"
  | "failed"
  | "expired";

/**
 * Request body for {@link WhatsAppSignupResource.create}.
 */
export interface StartWhatsAppSignupRequest {
  /**
   * The number to connect, in E.164 format. Must be an active number in
   * your workspace (provisioned, purchased, or ported into Sendly).
   */
  phoneNumber: string;
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
   * The customer's WhatsApp Business Account id, once linked; null before
   * the human completes the connect step
   */
  businessAccountId: string | null;
  /** Why the signup failed, when status is `failed`; null otherwise */
  failureReasons: string[] | null;
  /** ISO 8601 timestamp of the last status change */
  updatedAt: string;
}

/**
 * Template category. Meta reviews every template and may reclassify it —
 * the category on the record is authoritative and drives per-message
 * pricing.
 */
export type WhatsAppTemplateCategory =
  | "AUTHENTICATION"
  | "UTILITY"
  | "MARKETING";

/**
 * Review status of a template.
 *
 * - `PENDING` — submitted; Meta review usually takes 24–48h
 * - `APPROVED` — usable in template sends
 * - `REJECTED` — not usable; edit it with
 *   {@link WhatsAppTemplatesResource.update} to resubmit (template names
 *   are locked for ~30 days after deletion, so editing is the way out)
 * - `PAUSED` / `DISABLED` — quality-suspended by Meta
 */
export type WhatsAppTemplateStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "PAUSED"
  | "DISABLED";

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
  /** Template category — drives Meta review rules and pricing */
  category: WhatsAppTemplateCategory;
  /**
   * Body text. Use `{{1}}`, `{{2}}`, … for variables; every placeholder
   * needs an example value in `examples`.
   */
  body: string;
  /** Optional footer line */
  footer?: string;
  /** Optional text header */
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
  /** Replacement text header */
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
  /** When the window closes (ISO 8601), or null when no window is open */
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
   * a live API key.
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
   * @throws {AuthenticationError} If the API key is invalid or a test key
   */
  async create(
    request: StartWhatsAppSignupRequest,
  ): Promise<WhatsAppSignupSession> {
    validatePhoneNumber(request.phoneNumber);

    return this.http.request<WhatsAppSignupSession>({
      method: "POST",
      path: "/whatsapp/signup",
      body: { phoneNumber: request.phoneNumber },
    });
  }

  /**
   * Get the status of a WhatsApp signup.
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

class WhatsAppTemplatesResource {
  private readonly http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  /**
   * List your WhatsApp templates.
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
   * is `APPROVED`. Requires a live API key.
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
   * @throws {ValidationError} If the template fails pre-flight checks (bad name, missing examples, …)
   * @throws {NotFoundError} If the sender isn't connected to WhatsApp
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
   * template goes back to `PENDING` review. Requires a live API key.
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
   * @throws {ValidationError} If the edited template fails pre-flight checks, or the template is not APPROVED/REJECTED
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
   * Requires a live API key.
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
   * a human must complete in a browser.
   */
  public readonly signup: WhatsAppSignupResource;

  /**
   * Manage Meta-reviewed message templates.
   */
  public readonly templates: WhatsAppTemplatesResource;

  constructor(http: HttpClient) {
    this.http = http;
    this.signup = new WhatsAppSignupResource(http);
    this.templates = new WhatsAppTemplatesResource(http);
  }

  /**
   * Check whether a 24-hour customer-service window is open between one
   * of your WhatsApp senders and a recipient.
   *
   * Free-form text and media only deliver while a window is open (it
   * opens when the recipient messages you and lasts 24h from their last
   * inbound message). Outside a window, send an approved template.
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
