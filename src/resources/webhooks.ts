/**
 * Webhooks Resource
 * @packageDocumentation
 */

import type { HttpClient } from "../utils/http";
import { transformKeys } from "../utils/transform";
import type {
  Webhook,
  WebhookCreatedResponse,
  CreateWebhookOptions,
  UpdateWebhookOptions,
  WebhookDelivery,
  WebhookTestResult,
  WebhookSecretRotation,
  WebhookEventType,
} from "../types";

/**
 * Webhooks API resource
 *
 * Manage webhook endpoints for receiving real-time message status updates.
 *
 * @example
 * ```typescript
 * // Create a webhook
 * const webhook = await sendly.webhooks.create({
 *   url: 'https://example.com/webhooks/sendly',
 *   events: ['message.delivered', 'message.failed']
 * });
 *
 * // IMPORTANT: Save the secret - it's only shown once!
 * console.log('Secret:', webhook.secret);
 *
 * // List webhooks
 * const webhooks = await sendly.webhooks.list();
 *
 * // Test a webhook
 * const result = await sendly.webhooks.test(webhook.id);
 * ```
 */
export class WebhooksResource {
  private readonly http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  /**
   * Create a new webhook endpoint
   *
   * @param options - Webhook configuration
   * @returns The created webhook with signing secret (shown only once!)
   *
   * @example
   * ```typescript
   * const webhook = await sendly.webhooks.create({
   *   url: 'https://example.com/webhooks/sendly',
   *   events: ['message.delivered', 'message.failed'],
   *   description: 'Production webhook'
   * });
   *
   * // IMPORTANT: Save this secret securely - it's only shown once!
   * console.log('Webhook secret:', webhook.secret);
   * ```
   *
   * @throws {ValidationError} If the URL is invalid or events are empty
   * @throws {AuthenticationError} If the API key is invalid
   */
  async create(options: CreateWebhookOptions): Promise<WebhookCreatedResponse> {
    // Basic validation
    if (!options.url || !options.url.startsWith("https://")) {
      throw new Error("Webhook URL must be HTTPS");
    }

    if (!options.events || options.events.length === 0) {
      throw new Error("At least one event type is required");
    }

    const response = await this.http.request<unknown>({
      method: "POST",
      path: "/webhooks",
      body: {
        url: options.url,
        events: options.events,
        ...(options.description && { description: options.description }),
        ...(options.mode && { mode: options.mode }),
        ...(options.metadata && { metadata: options.metadata }),
      },
    });

    // Transform snake_case API response to camelCase SDK types
    return transformKeys<WebhookCreatedResponse>(response);
  }

  /**
   * List all webhooks
   *
   * @returns Array of webhook configurations
   *
   * @example
   * ```typescript
   * const webhooks = await sendly.webhooks.list();
   *
   * for (const webhook of webhooks) {
   *   console.log(`${webhook.id}: ${webhook.url} (${webhook.isActive ? 'active' : 'inactive'})`);
   * }
   * ```
   */
  async list(): Promise<Webhook[]> {
    const response = await this.http.request<unknown[]>({
      method: "GET",
      path: "/webhooks",
    });

    // Transform snake_case API response to camelCase SDK types
    return response.map((item) => transformKeys<Webhook>(item));
  }

  /**
   * Get a specific webhook by ID
   *
   * @param id - Webhook ID (whk_xxx)
   * @returns The webhook details
   *
   * @example
   * ```typescript
   * const webhook = await sendly.webhooks.get('whk_xxx');
   * console.log(`Success rate: ${webhook.successRate}%`);
   * ```
   *
   * @throws {NotFoundError} If the webhook doesn't exist
   */
  async get(id: string): Promise<Webhook> {
    if (!id || !id.startsWith("whk_")) {
      throw new Error("Invalid webhook ID format");
    }

    const response = await this.http.request<unknown>({
      method: "GET",
      path: `/webhooks/${encodeURIComponent(id)}`,
    });

    // Transform snake_case API response to camelCase SDK types
    return transformKeys<Webhook>(response);
  }

  /**
   * Update a webhook configuration
   *
   * @param id - Webhook ID
   * @param options - Fields to update
   * @returns The updated webhook
   *
   * @example
   * ```typescript
   * // Update URL
   * await sendly.webhooks.update('whk_xxx', {
   *   url: 'https://new-endpoint.example.com/webhooks'
   * });
   *
   * // Disable webhook
   * await sendly.webhooks.update('whk_xxx', { isActive: false });
   *
   * // Change event subscriptions
   * await sendly.webhooks.update('whk_xxx', {
   *   events: ['message.delivered']
   * });
   * ```
   */
  async update(id: string, options: UpdateWebhookOptions): Promise<Webhook> {
    if (!id || !id.startsWith("whk_")) {
      throw new Error("Invalid webhook ID format");
    }

    if (options.url && !options.url.startsWith("https://")) {
      throw new Error("Webhook URL must be HTTPS");
    }

    const response = await this.http.request<unknown>({
      method: "PATCH",
      path: `/webhooks/${encodeURIComponent(id)}`,
      body: {
        ...(options.url !== undefined && { url: options.url }),
        ...(options.events !== undefined && { events: options.events }),
        ...(options.description !== undefined && {
          description: options.description,
        }),
        ...(options.isActive !== undefined && { is_active: options.isActive }),
        ...(options.mode !== undefined && { mode: options.mode }),
        ...(options.metadata !== undefined && { metadata: options.metadata }),
      },
    });

    // Transform snake_case API response to camelCase SDK types
    return transformKeys<Webhook>(response);
  }

  /**
   * Delete a webhook
   *
   * @param id - Webhook ID
   *
   * @example
   * ```typescript
   * await sendly.webhooks.delete('whk_xxx');
   * ```
   *
   * @throws {NotFoundError} If the webhook doesn't exist
   */
  async delete(id: string): Promise<void> {
    if (!id || !id.startsWith("whk_")) {
      throw new Error("Invalid webhook ID format");
    }

    await this.http.request<void>({
      method: "DELETE",
      path: `/webhooks/${encodeURIComponent(id)}`,
    });
  }

  /**
   * Send a test event to a webhook endpoint
   *
   * @param id - Webhook ID
   * @returns Test result with response details
   *
   * @example
   * ```typescript
   * const result = await sendly.webhooks.test('whk_xxx');
   *
   * if (result.success) {
   *   console.log(`Test passed! Response time: ${result.responseTimeMs}ms`);
   * } else {
   *   console.log(`Test failed: ${result.error}`);
   * }
   * ```
   */
  async test(id: string): Promise<WebhookTestResult> {
    if (!id || !id.startsWith("whk_")) {
      throw new Error("Invalid webhook ID format");
    }

    const response = await this.http.request<unknown>({
      method: "POST",
      path: `/webhooks/${encodeURIComponent(id)}/test`,
    });

    // Transform snake_case API response to camelCase SDK types
    return transformKeys<WebhookTestResult>(response);
  }

  /**
   * Rotate the webhook signing secret
   *
   * The old secret remains valid for 24 hours to allow for graceful migration.
   *
   * @param id - Webhook ID
   * @returns New secret and expiration info
   *
   * @example
   * ```typescript
   * const rotation = await sendly.webhooks.rotateSecret('whk_xxx');
   *
   * // Update your webhook handler with the new secret
   * console.log('New secret:', rotation.newSecret);
   * console.log('Old secret expires:', rotation.oldSecretExpiresAt);
   * ```
   */
  async rotateSecret(id: string): Promise<WebhookSecretRotation> {
    if (!id || !id.startsWith("whk_")) {
      throw new Error("Invalid webhook ID format");
    }

    const response = await this.http.request<unknown>({
      method: "POST",
      path: `/webhooks/${encodeURIComponent(id)}/rotate-secret`,
    });

    // Transform snake_case API response to camelCase SDK types
    return transformKeys<WebhookSecretRotation>(response);
  }

  /**
   * Get delivery history for a webhook
   *
   * @param id - Webhook ID
   * @returns Array of delivery attempts
   *
   * @example
   * ```typescript
   * const deliveries = await sendly.webhooks.getDeliveries('whk_xxx');
   *
   * for (const delivery of deliveries) {
   *   console.log(`${delivery.eventType}: ${delivery.status} (${delivery.responseTimeMs}ms)`);
   * }
   * ```
   */
  async getDeliveries(id: string): Promise<WebhookDelivery[]> {
    if (!id || !id.startsWith("whk_")) {
      throw new Error("Invalid webhook ID format");
    }

    const response = await this.http.request<unknown[]>({
      method: "GET",
      path: `/webhooks/${encodeURIComponent(id)}/deliveries`,
    });

    // Transform snake_case API response to camelCase SDK types
    return response.map((item) => transformKeys<WebhookDelivery>(item));
  }

  /**
   * Retry a failed delivery
   *
   * @param webhookId - Webhook ID
   * @param deliveryId - Delivery ID
   *
   * @example
   * ```typescript
   * await sendly.webhooks.retryDelivery('whk_xxx', 'del_yyy');
   * ```
   */
  async retryDelivery(webhookId: string, deliveryId: string): Promise<void> {
    if (!webhookId || !webhookId.startsWith("whk_")) {
      throw new Error("Invalid webhook ID format");
    }

    if (!deliveryId || !deliveryId.startsWith("del_")) {
      throw new Error("Invalid delivery ID format");
    }

    await this.http.request<void>({
      method: "POST",
      path: `/webhooks/${encodeURIComponent(webhookId)}/deliveries/${encodeURIComponent(deliveryId)}/retry`,
    });
  }

  /**
   * List available event types
   *
   * @returns Array of event type strings
   *
   * @example
   * ```typescript
   * const eventTypes = await sendly.webhooks.listEventTypes();
   * console.log('Available events:', eventTypes);
   * // ['message.sent', 'message.delivered', 'message.failed', 'message.bounced']
   * ```
   */
  async listEventTypes(): Promise<WebhookEventType[]> {
    const eventTypes = await this.http.request<WebhookEventType[]>({
      method: "GET",
      path: "/webhooks/event-types",
    });

    return eventTypes;
  }
}
