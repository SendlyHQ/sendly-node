/**
 * Sendly Webhook Helpers
 *
 * Utilities for verifying and parsing webhook events from Sendly.
 *
 * @example
 * ```typescript
 * import { Webhooks } from '@sendly/node';
 *
 * // In your webhook handler (e.g., Express)
 * app.post('/webhooks/sendly', (req, res) => {
 *   const signature = req.headers['x-sendly-signature'] as string;
 *   const payload = req.body; // raw body as string
 *
 *   try {
 *     const event = Webhooks.parseEvent(payload, signature, process.env.WEBHOOK_SECRET!);
 *     console.log('Received event:', event.type);
 *
 *     switch (event.type) {
 *       case 'message.delivered':
 *         console.log(`Message ${event.data.message_id} delivered!`);
 *         break;
 *       case 'message.failed':
 *         console.log(`Message ${event.data.message_id} failed: ${event.data.error}`);
 *         break;
 *     }
 *
 *     res.status(200).send('OK');
 *   } catch (error) {
 *     console.error('Invalid webhook signature');
 *     res.status(401).send('Invalid signature');
 *   }
 * });
 * ```
 */

import crypto from "crypto";

/**
 * Webhook event types
 */
export type WebhookEventType =
  | "message.queued"
  | "message.sent"
  | "message.delivered"
  | "message.failed"
  | "message.undelivered";

/**
 * Message status in webhook events
 */
export type WebhookMessageStatus =
  | "queued"
  | "sent"
  | "delivered"
  | "failed"
  | "undelivered";

/**
 * Data payload for message webhook events
 */
export interface WebhookMessageData {
  /** The message ID */
  message_id: string;
  /** Current message status */
  status: WebhookMessageStatus;
  /** Recipient phone number */
  to: string;
  /** Sender ID or phone number */
  from: string;
  /** Error message if status is 'failed' or 'undelivered' */
  error?: string;
  /** Error code if available */
  error_code?: string;
  /** When the message was delivered (ISO 8601) */
  delivered_at?: string;
  /** When the message failed (ISO 8601) */
  failed_at?: string;
  /** Number of SMS segments */
  segments: number;
  /** Credits charged */
  credits_used: number;
}

/**
 * Webhook event from Sendly
 */
export interface WebhookEvent {
  /** Unique event ID */
  id: string;
  /** Event type */
  type: WebhookEventType;
  /** Event data */
  data: WebhookMessageData;
  /** When the event was created (ISO 8601) */
  created_at: string;
  /** API version */
  api_version: string;
}

/**
 * Error thrown when webhook signature verification fails
 */
export class WebhookSignatureError extends Error {
  constructor(message: string = "Invalid webhook signature") {
    super(message);
    this.name = "WebhookSignatureError";
  }
}

/**
 * Webhook utilities for verifying and parsing Sendly webhook events
 */
export class Webhooks {
  /**
   * Verify webhook signature from Sendly
   *
   * @param payload - Raw request body as string
   * @param signature - X-Sendly-Signature header value
   * @param secret - Your webhook secret from dashboard
   * @returns true if signature is valid, false otherwise
   *
   * @example
   * ```typescript
   * const isValid = Webhooks.verifySignature(
   *   rawBody,
   *   req.headers['x-sendly-signature'],
   *   process.env.WEBHOOK_SECRET
   * );
   * ```
   */
  static verifySignature(
    payload: string,
    signature: string,
    secret: string
  ): boolean {
    if (!payload || !signature || !secret) {
      return false;
    }

    try {
      const expected = crypto
        .createHmac("sha256", secret)
        .update(payload, "utf8")
        .digest("hex");

      const expectedSignature = `sha256=${expected}`;

      // Use timing-safe comparison to prevent timing attacks
      if (signature.length !== expectedSignature.length) {
        return false;
      }

      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
    } catch {
      return false;
    }
  }

  /**
   * Parse and validate a webhook event
   *
   * @param payload - Raw request body as string
   * @param signature - X-Sendly-Signature header value
   * @param secret - Your webhook secret from dashboard
   * @returns Parsed and validated WebhookEvent
   * @throws {WebhookSignatureError} if signature is invalid
   *
   * @example
   * ```typescript
   * try {
   *   const event = Webhooks.parseEvent(rawBody, signature, secret);
   *   console.log('Event type:', event.type);
   *   console.log('Message ID:', event.data.message_id);
   * } catch (error) {
   *   if (error instanceof WebhookSignatureError) {
   *     console.error('Invalid signature');
   *   }
   * }
   * ```
   */
  static parseEvent(
    payload: string,
    signature: string,
    secret: string
  ): WebhookEvent {
    if (!this.verifySignature(payload, signature, secret)) {
      throw new WebhookSignatureError();
    }

    try {
      const event = JSON.parse(payload) as WebhookEvent;

      // Basic validation
      if (!event.id || !event.type || !event.data || !event.created_at) {
        throw new Error("Invalid event structure");
      }

      return event;
    } catch (error) {
      if (error instanceof WebhookSignatureError) {
        throw error;
      }
      throw new WebhookSignatureError(
        `Failed to parse webhook payload: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Generate a webhook signature for testing purposes
   *
   * @param payload - The payload to sign
   * @param secret - The secret to use for signing
   * @returns The signature in the format "sha256=..."
   *
   * @example
   * ```typescript
   * // For testing your webhook handler
   * const testPayload = JSON.stringify({
   *   id: 'evt_test',
   *   type: 'message.delivered',
   *   data: { message_id: 'msg_test', status: 'delivered' },
   *   created_at: new Date().toISOString()
   * });
   * const signature = Webhooks.generateSignature(testPayload, 'test_secret');
   * ```
   */
  static generateSignature(payload: string, secret: string): string {
    const hash = crypto
      .createHmac("sha256", secret)
      .update(payload, "utf8")
      .digest("hex");
    return `sha256=${hash}`;
  }
}
