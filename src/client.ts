/**
 * Sendly Client
 * @packageDocumentation
 */

import type { SendlyConfig, RateLimitInfo } from "./types";
import { HttpClient } from "./utils/http";
import { MessagesResource } from "./resources/messages";
import { WebhooksResource } from "./resources/webhooks";
import { AccountResource } from "./resources/account";

const DEFAULT_BASE_URL = "https://sendly.live/api/v1";
const DEFAULT_TIMEOUT = 30000;
const DEFAULT_MAX_RETRIES = 3;

/**
 * Sendly API Client
 *
 * The main entry point for interacting with the Sendly SMS API.
 *
 * @example
 * ```typescript
 * import Sendly from '@sendly/node';
 *
 * // Initialize with API key
 * const sendly = new Sendly('sk_live_v1_your_api_key');
 *
 * // Send an SMS
 * const message = await sendly.messages.send({
 *   to: '+15551234567',
 *   text: 'Hello from Sendly!'
 * });
 *
 * console.log(message.id);
 * ```
 *
 * @example
 * ```typescript
 * // Initialize with custom configuration
 * const sendly = new Sendly({
 *   apiKey: 'sk_live_v1_your_api_key',
 *   timeout: 60000,
 *   maxRetries: 5
 * });
 * ```
 */
export class Sendly {
  /**
   * Messages API resource
   *
   * @example
   * ```typescript
   * // Send a message
   * await sendly.messages.send({ to: '+1555...', text: 'Hello!' });
   *
   * // List messages
   * const { data } = await sendly.messages.list({ limit: 10 });
   *
   * // Get a message
   * const msg = await sendly.messages.get('msg_xxx');
   * ```
   */
  public readonly messages: MessagesResource;

  /**
   * Webhooks API resource
   *
   * @example
   * ```typescript
   * // Create a webhook
   * const webhook = await sendly.webhooks.create({
   *   url: 'https://example.com/webhooks',
   *   events: ['message.delivered', 'message.failed']
   * });
   *
   * // List webhooks
   * const webhooks = await sendly.webhooks.list();
   *
   * // Test a webhook
   * await sendly.webhooks.test('whk_xxx');
   * ```
   */
  public readonly webhooks: WebhooksResource;

  /**
   * Account API resource
   *
   * @example
   * ```typescript
   * // Get credit balance
   * const credits = await sendly.account.getCredits();
   *
   * // Get transaction history
   * const transactions = await sendly.account.getCreditTransactions();
   *
   * // List API keys
   * const keys = await sendly.account.listApiKeys();
   * ```
   */
  public readonly account: AccountResource;

  private readonly http: HttpClient;
  private readonly config: Required<SendlyConfig>;

  /**
   * Create a new Sendly client
   *
   * @param configOrApiKey - API key string or configuration object
   */
  constructor(configOrApiKey: string | SendlyConfig) {
    // Parse configuration
    if (typeof configOrApiKey === "string") {
      this.config = {
        apiKey: configOrApiKey,
        baseUrl: DEFAULT_BASE_URL,
        timeout: DEFAULT_TIMEOUT,
        maxRetries: DEFAULT_MAX_RETRIES,
      };
    } else {
      this.config = {
        apiKey: configOrApiKey.apiKey,
        baseUrl: configOrApiKey.baseUrl || DEFAULT_BASE_URL,
        timeout: configOrApiKey.timeout || DEFAULT_TIMEOUT,
        maxRetries: configOrApiKey.maxRetries ?? DEFAULT_MAX_RETRIES,
      };
    }

    // Initialize HTTP client
    this.http = new HttpClient({
      apiKey: this.config.apiKey,
      baseUrl: this.config.baseUrl,
      timeout: this.config.timeout,
      maxRetries: this.config.maxRetries,
    });

    // Initialize resources
    this.messages = new MessagesResource(this.http);
    this.webhooks = new WebhooksResource(this.http);
    this.account = new AccountResource(this.http);
  }

  /**
   * Check if the client is using a test API key
   *
   * @returns true if using a test key (sk_test_v1_xxx)
   *
   * @example
   * ```typescript
   * if (sendly.isTestMode()) {
   *   console.log('Running in test mode');
   * }
   * ```
   */
  isTestMode(): boolean {
    return this.http.isTestMode();
  }

  /**
   * Get current rate limit information
   *
   * Returns the rate limit info from the most recent API request.
   *
   * @returns Rate limit info or undefined if no requests have been made
   *
   * @example
   * ```typescript
   * await sendly.messages.send({ to: '+1555...', text: 'Hello!' });
   *
   * const rateLimit = sendly.getRateLimitInfo();
   * if (rateLimit) {
   *   console.log(`${rateLimit.remaining}/${rateLimit.limit} requests remaining`);
   *   console.log(`Resets in ${rateLimit.reset} seconds`);
   * }
   * ```
   */
  getRateLimitInfo(): RateLimitInfo | undefined {
    return this.http.getRateLimitInfo();
  }

  /**
   * Get the configured base URL
   */
  getBaseUrl(): string {
    return this.config.baseUrl;
  }
}

// Default export
export default Sendly;
