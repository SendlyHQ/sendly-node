/**
 * Webhook utilities for Sendly
 * Provides signature verification and event parsing
 * @packageDocumentation
 */

import * as crypto from "node:crypto";

// ============================================================================
// Types
// ============================================================================

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
 * Webhook message data payload
 */
export interface WebhookMessageData {
  /** Unique message identifier */
  messageId: string;
  /** Current message status */
  status: WebhookMessageStatus;
  /** Destination phone number */
  to: string;
  /** Sender ID or phone number */
  from: string;
  /** Error message if failed */
  error?: string;
  /** Error code if failed */
  errorCode?: string;
  /** ISO 8601 timestamp when delivered */
  deliveredAt?: string;
  /** ISO 8601 timestamp when failed */
  failedAt?: string;
  /** Number of SMS segments */
  segments: number;
  /** Credits charged */
  creditsUsed: number;
}

/**
 * Webhook event structure
 */
export interface WebhookEvent {
  /** Unique event identifier */
  id: string;
  /** Event type */
  type: WebhookEventType;
  /** Event data payload */
  data: WebhookMessageData;
  /** ISO 8601 timestamp when event was created */
  createdAt: string;
  /** API version that generated this event */
  apiVersion: string;
}

/**
 * Error thrown when webhook signature verification fails
 */
export class WebhookSignatureError extends Error {
  constructor(message = "Invalid webhook signature") {
    super(message);
    this.name = "WebhookSignatureError";
  }
}

// ============================================================================
// Webhook Utilities
// ============================================================================

/**
 * Verify a webhook signature from Sendly
 *
 * @param payload - Raw request body as string
 * @param signature - X-Sendly-Signature header value
 * @param secret - Your webhook secret from dashboard
 * @returns true if signature is valid
 *
 * @example
 * ```typescript
 * import { verifyWebhookSignature } from '@sendly/node';
 *
 * const isValid = verifyWebhookSignature(
 *   req.body, // raw body string
 *   req.headers['x-sendly-signature'],
 *   process.env.WEBHOOK_SECRET
 * );
 *
 * if (!isValid) {
 *   return res.status(401).send('Invalid signature');
 * }
 * ```
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  if (!payload || !signature || !secret) {
    return false;
  }

  const expectedSignature = generateWebhookSignature(payload, secret);

  // Timing-safe comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    // Lengths don't match
    return false;
  }
}

/**
 * Parse and verify a webhook event
 *
 * @param payload - Raw request body as string
 * @param signature - X-Sendly-Signature header value
 * @param secret - Your webhook secret from dashboard
 * @returns Parsed webhook event
 * @throws {WebhookSignatureError} If signature is invalid
 *
 * @example
 * ```typescript
 * import { parseWebhookEvent } from '@sendly/node';
 *
 * try {
 *   const event = parseWebhookEvent(
 *     req.body,
 *     req.headers['x-sendly-signature'],
 *     process.env.WEBHOOK_SECRET
 *   );
 *
 *   switch (event.type) {
 *     case 'message.delivered':
 *       console.log(`Message ${event.data.messageId} delivered!`);
 *       break;
 *     case 'message.failed':
 *       console.log(`Message failed: ${event.data.error}`);
 *       break;
 *   }
 * } catch (err) {
 *   if (err instanceof WebhookSignatureError) {
 *     return res.status(401).send('Invalid signature');
 *   }
 *   throw err;
 * }
 * ```
 */
export function parseWebhookEvent(
  payload: string,
  signature: string,
  secret: string
): WebhookEvent {
  if (!verifyWebhookSignature(payload, signature, secret)) {
    throw new WebhookSignatureError();
  }

  let event: WebhookEvent;
  try {
    event = JSON.parse(payload);
  } catch {
    throw new Error("Failed to parse webhook payload");
  }

  // Basic validation
  if (!event.id || !event.type || !event.createdAt) {
    throw new Error("Invalid webhook event structure");
  }

  return event;
}

/**
 * Generate a webhook signature for testing purposes
 *
 * @param payload - The payload to sign
 * @param secret - The secret to use for signing
 * @returns Signature in format "sha256=..."
 *
 * @example
 * ```typescript
 * import { generateWebhookSignature } from '@sendly/node';
 *
 * // For testing your webhook handler
 * const testPayload = JSON.stringify({
 *   id: 'evt_test',
 *   type: 'message.delivered',
 *   data: { messageId: 'msg_123', status: 'delivered' },
 *   createdAt: new Date().toISOString(),
 *   apiVersion: '2025-01-01'
 * });
 *
 * const signature = generateWebhookSignature(testPayload, 'test_secret');
 * ```
 */
export function generateWebhookSignature(
  payload: string,
  secret: string
): string {
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(payload);
  return "sha256=" + hmac.digest("hex");
}

/**
 * Webhook utilities class (alternative API)
 *
 * @example
 * ```typescript
 * import { Webhooks } from '@sendly/node';
 *
 * const webhooks = new Webhooks('your_webhook_secret');
 *
 * // Verify signature
 * const isValid = webhooks.verify(payload, signature);
 *
 * // Parse event
 * const event = webhooks.parse(payload, signature);
 * ```
 */
export class Webhooks {
  private readonly secret: string;

  /**
   * Create a new Webhooks instance
   * @param secret - Your webhook secret from the Sendly dashboard
   */
  constructor(secret: string) {
    if (!secret) {
      throw new Error("Webhook secret is required");
    }
    this.secret = secret;
  }

  /**
   * Verify a webhook signature
   * @param payload - Raw request body
   * @param signature - X-Sendly-Signature header
   */
  verify(payload: string, signature: string): boolean {
    return verifyWebhookSignature(payload, signature, this.secret);
  }

  /**
   * Parse and verify a webhook event
   * @param payload - Raw request body
   * @param signature - X-Sendly-Signature header
   */
  parse(payload: string, signature: string): WebhookEvent {
    return parseWebhookEvent(payload, signature, this.secret);
  }

  /**
   * Generate a signature for testing
   * @param payload - Payload to sign
   */
  sign(payload: string): string {
    return generateWebhookSignature(payload, this.secret);
  }
}
