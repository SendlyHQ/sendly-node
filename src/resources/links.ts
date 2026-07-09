/**
 * Links Resource — Branded URL Shortening
 *
 * @packageDocumentation
 *
 * Mint branded short links for a destination URL, list the links your
 * workspace has created (with click analytics), and enable or disable an
 * individual link (a per-link kill switch).
 *
 * Branded, owned-domain short links improve deliverability — carriers filter
 * public shorteners — and give you click data for analytics. Shortening is
 * gated behind the `url_shortener` rollout flag; calls return `not_enabled`
 * until the flag is on for your account.
 *
 * @see https://sendly.live/docs/links
 */

import type { HttpClient } from "../utils/http";
import type {
  CreateShortLinkRequest,
  ShortLink,
  ListShortLinksOptions,
  ShortLinkListResponse,
  ShortLinkDisabledResponse,
} from "../types";

/**
 * Links resource — create, list, and disable branded short links.
 *
 * @example
 * ```typescript
 * // Shorten a URL
 * const link = await sendly.links.create({
 *   url: "https://example.com/spring-sale?utm_source=sms",
 * });
 * console.log(link.shortUrl); // https://sendly.live/l/Ab3xY7
 *
 * // List your links with click counts
 * const { links, total } = await sendly.links.list({ limit: 20 });
 *
 * // Kill a link
 * await sendly.links.disable(link.code);
 * ```
 */
export class LinksResource {
  private readonly http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  /**
   * Mint a branded short link for a destination URL. Uses your workspace's
   * brand slug when one is configured.
   *
   * @param request - The destination URL to shorten
   * @returns The short link (`code`, `shortUrl`, `destinationUrl`)
   *
   * @example
   * ```typescript
   * const link = await sendly.links.create({
   *   url: "https://example.com/welcome",
   * });
   * console.log(link.code);     // "Ab3xY7"
   * console.log(link.shortUrl); // "https://sendly.live/l/Ab3xY7"
   * ```
   *
   * @throws {ValidationError} If `url` is missing or not an http/https URL
   * @throws {AuthenticationError} If the API key is invalid
   */
  async create(request: CreateShortLinkRequest): Promise<ShortLink> {
    if (!request || typeof request.url !== "string" || !request.url.trim()) {
      throw new Error("A destination 'url' is required");
    }

    return this.http.request<ShortLink>({
      method: "POST",
      path: "/links",
      body: { url: request.url },
    });
  }

  /**
   * List the short links your workspace has created, newest first, with click
   * counts and a 14-day daily click histogram.
   *
   * @param options - Pagination options (`limit` 1-200, `offset`)
   * @returns The links and a total count
   *
   * @example
   * ```typescript
   * const { links, total } = await sendly.links.list({ limit: 50 });
   * for (const link of links) {
   *   console.log(`${link.shortUrl} -> ${link.destinationUrl} (${link.clickCount} clicks)`);
   * }
   * ```
   *
   * @throws {AuthenticationError} If the API key is invalid
   */
  async list(
    options: ListShortLinksOptions = {},
  ): Promise<ShortLinkListResponse> {
    return this.http.request<ShortLinkListResponse>({
      method: "GET",
      path: "/links",
      query: {
        limit: options.limit,
        offset: options.offset,
      },
    });
  }

  /**
   * Enable or disable a short link. A disabled link's redirect returns 404
   * until it is re-enabled.
   *
   * @param code - The short link code
   * @param disabled - `true` to disable, `false` to re-enable
   * @returns The link's code and new disabled state
   *
   * @example
   * ```typescript
   * await sendly.links.setDisabled("Ab3xY7", true);  // disable
   * await sendly.links.setDisabled("Ab3xY7", false); // re-enable
   * ```
   *
   * @throws {NotFoundError} If no such link exists in your workspace
   * @throws {AuthenticationError} If the API key is invalid
   */
  async setDisabled(
    code: string,
    disabled: boolean,
  ): Promise<ShortLinkDisabledResponse> {
    if (!code || typeof code !== "string") {
      throw new Error("A link 'code' is required");
    }

    return this.http.request<ShortLinkDisabledResponse>({
      method: "PATCH",
      path: `/links/${encodeURIComponent(code)}`,
      body: { disabled },
    });
  }

  /**
   * Disable a short link (its redirect returns 404 until re-enabled).
   * Convenience wrapper over {@link LinksResource.setDisabled}.
   *
   * @param code - The short link code
   * @returns The link's code and new disabled state
   *
   * @example
   * ```typescript
   * await sendly.links.disable("Ab3xY7");
   * ```
   */
  async disable(code: string): Promise<ShortLinkDisabledResponse> {
    return this.setDisabled(code, true);
  }

  /**
   * Re-enable a previously disabled short link. Convenience wrapper over
   * {@link LinksResource.setDisabled}.
   *
   * @param code - The short link code
   * @returns The link's code and new disabled state
   *
   * @example
   * ```typescript
   * await sendly.links.enable("Ab3xY7");
   * ```
   */
  async enable(code: string): Promise<ShortLinkDisabledResponse> {
    return this.setDisabled(code, false);
  }
}
