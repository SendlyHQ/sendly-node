/**
 * Short Codes Resource — apply for a US short code and track the application
 *
 * @packageDocumentation
 *
 * A short code is a 5 or 6 digit US sender. Getting one is an application,
 * not a purchase: you fill it in, Sendly reviews it, the carrier forms are
 * signed, Sendly files it, and each carrier certifies the code separately.
 *
 * The application lives at {@link ShortCodeApplicationResource}; leased codes
 * are listed with {@link ShortCodesResource.list}.
 */
import type { HttpClient } from "../utils/http";
import type {
  ShortCode,
  ShortCodeApplicationInput,
  ShortCodeApplicationView,
  ShortCodePreflight,
} from "../types";

class ShortCodeApplicationResource {
  private readonly http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  /**
   * Fetch the workspace's short code application, with the documents it needs
   * and the quoted monthly lease.
   *
   * Requires the `short_codes:read` scope.
   *
   * @returns The application, whether it is still editable, and why not when it isn't
   *
   * @example
   * ```typescript
   * const view = await sendly.shortCodes.application.get();
   * if (!view.editable) console.log(view.lockMessage);
   * ```
   *
   * @throws {SendlyError} `short_codes_not_enabled` (404) when short codes aren't enabled for the account
   */
  async get(): Promise<ShortCodeApplicationView> {
    return this.http.request<ShortCodeApplicationView>({
      method: "GET",
      path: "/short_codes/application",
    });
  }

  /**
   * Save answers on the application, creating it on the first call.
   *
   * Fields Sendly or the carriers own — the digits, the status, the review
   * state — are ignored and named back in `ignoredFields`.
   *
   * Requires the `short_codes:write` scope.
   *
   * @param application - The answers to save
   * @returns The saved application
   *
   * @example
   * ```typescript
   * await sendly.shortCodes.application.update({
   *   useCase: 'Delivery alerts for Acme orders',
   *   messageFrequency: '4 messages per month',
   * });
   * ```
   *
   * @throws {SendlyError} `short_code_locked` (409) once the application is with Sendly or the carriers
   */
  async update(
    application: ShortCodeApplicationInput,
  ): Promise<ShortCodeApplicationView> {
    return this.http.request<ShortCodeApplicationView>({
      method: "PUT",
      path: "/short_codes/application",
      body: application,
    });
  }

  /**
   * Check the application against the carrier rules without changing anything.
   *
   * Unsaved answers can be passed in and are checked on top of what is saved.
   *
   * Requires the `short_codes:read` scope.
   *
   * @param application - Optional unsaved answers to check as well
   * @returns `ok`, every issue found, and the documents still outstanding
   *
   * @example
   * ```typescript
   * const { ok, issues } = await sendly.shortCodes.application.check();
   * for (const issue of issues) console.log(issue.path, issue.message);
   * ```
   */
  async check(
    application: ShortCodeApplicationInput = {},
  ): Promise<ShortCodePreflight> {
    return this.http.request<ShortCodePreflight>({
      method: "POST",
      path: "/short_codes/application/preflight",
      body: application,
    });
  }

  /**
   * Submit the application to Sendly for review.
   *
   * Submitting twice is safe: the second call reports `alreadySubmitted`.
   *
   * Requires the `short_codes:write` scope.
   *
   * @param application - Optional final answers, saved before the check
   * @returns The submitted application
   *
   * @example
   * ```typescript
   * const result = await sendly.shortCodes.application.submit();
   * console.log(result.application.reviewStatus); // 'awaiting_review'
   * ```
   *
   * @throws {SendlyError} `short_code_invalid_application` (422) with an `errors` array naming every field
   */
  async submit(
    application: ShortCodeApplicationInput = {},
  ): Promise<ShortCodeApplicationView> {
    return this.http.request<ShortCodeApplicationView>({
      method: "POST",
      path: "/short_codes/application/submit",
      body: application,
    });
  }
}

export class ShortCodesResource {
  private readonly http: HttpClient;

  /** The workspace's short code application. */
  public readonly application: ShortCodeApplicationResource;

  constructor(http: HttpClient) {
    this.http = http;
    this.application = new ShortCodeApplicationResource(http);
  }

  /**
   * List the short codes leased to the workspace.
   *
   * Requires the `short_codes:read` scope.
   *
   * @returns Every code, including ones still being certified
   *
   * @example
   * ```typescript
   * const { shortCodes } = await sendly.shortCodes.list();
   * const sendable = shortCodes.filter((code) => code.status === 'active');
   * ```
   */
  async list(): Promise<{ shortCodes: ShortCode[] }> {
    return this.http.request<{ shortCodes: ShortCode[] }>({
      method: "GET",
      path: "/short_codes",
    });
  }
}
