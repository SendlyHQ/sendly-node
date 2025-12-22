/**
 * Webhook utilities for Sendly
 * Provides signature verification and event parsing
 * @packageDocumentation
 */

import * as crypto from "node:crypto";

// ============================================================================
// Types - Aligned with server's shared/webhook-types.ts
// ============================================================================

/**
 * Webhook event types
 */
export type WebhookEventType =
  | "message.sent"
  | "message.delivered"
  | "message.failed"
  | "message.bounced";

/**
 * Message status in webhook events
 */
export type WebhookMessageStatus = "queued" | "sent" | "delivered" | "failed";

/**
 * Message object within webhook payload
 * Matches the structure sent by Sendly servers
 */
export interface WebhookMessageObject {
  /** Message ID (msg_xxx) */
  id: string;
  /** Recipient phone number (E.164 format) */
  to: string;
  /** Sender phone number or ID */
  from: string;
  /** Message text content */
  text: string;
  /** Current message status */
  status: WebhookMessageStatus;
  /** Message direction */
  direction: "outbound" | "inbound";
  /** Number of SMS segments */
  segments: number;
  /** Credits charged for this message */
  credits_used: number;
  /** Unix timestamp when message was created */
  created_at: number;
  /** Unix timestamp when message was delivered (if applicable) */
  delivered_at?: number;
  /** Error message if status is 'failed' */
  error?: string;
  /** Custom metadata attached to the message */
  metadata?: Record<string, unknown>;
}

/**
 * Webhook event payload from Sendly
 * This is the exact structure sent to your webhook endpoints
 *
 * @example
 * ```json
 * {
 *   "id": "evt_abc123",
 *   "type": "message.delivered",
 *   "api_version": "2024-01",
 *   "created": 1702000000,
 *   "livemode": true,
 *   "data": {
 *     "object": {
 *       "id": "msg_xyz789",
 *       "to": "+15551234567",
 *       "from": "+15559876543",
 *       "text": "Hello!",
 *       "status": "delivered",
 *       "direction": "outbound",
 *       "segments": 1,
 *       "credits_used": 1,
 *       "created_at": 1702000000,
 *       "delivered_at": 1702000005
 *     }
 *   }
 * }
 * ```
 */
export interface WebhookEvent {
  /** Unique event identifier (evt_xxx) for idempotency */
  id: string;
  /** Event type */
  type: WebhookEventType;
  /** API version that generated this event */
  api_version: string;
  /** Unix timestamp (seconds) when event was created */
  created: number;
  /** Whether this event is from live mode (true) or sandbox (false) */
  livemode: boolean;
  /** Event data containing the message object */
  data: {
    /** The message object that triggered this event */
    object: WebhookMessageObject;
  };
}

/**
 * Webhook test event payload
 */
export interface WebhookTestEvent {
  id: string;
  type: "webhook.test";
  api_version: string;
  created: number;
  livemode: false;
  data: {
    object: {
      webhook_id: string;
      message: string;
      timestamp: number;
    };
  };
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
// Webhook Signature Utilities
// ============================================================================

/**
 * Verify a webhook signature from Sendly
 *
 * Sendly signs webhooks using HMAC-SHA256. The signature format is:
 * `sha256=<hex_digest>`
 *
 * The signed payload is: `<timestamp>.<json_body>`
 *
 * @param payload - Raw request body as string (JSON)
 * @param signature - X-Sendly-Signature header value
 * @param secret - Your webhook secret from dashboard
 * @param timestamp - X-Sendly-Timestamp header value (optional, for enhanced verification)
 * @param toleranceSeconds - Maximum age of webhook in seconds (default: 300 = 5 minutes)
 * @returns true if signature is valid
 *
 * @example
 * ```typescript
 * import { verifyWebhookSignature } from '@sendly/node';
 *
 * // Basic verification
 * const isValid = verifyWebhookSignature(
 *   req.body, // raw body string
 *   req.headers['x-sendly-signature'],
 *   process.env.WEBHOOK_SECRET
 * );
 *
 * // With timestamp verification (recommended)
 * const isValid = verifyWebhookSignature(
 *   req.body,
 *   req.headers['x-sendly-signature'],
 *   process.env.WEBHOOK_SECRET,
 *   req.headers['x-sendly-timestamp']
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
  secret: string,
  timestamp?: string,
  toleranceSeconds: number = 300,
): boolean {
  if (!payload || !signature || !secret) {
    return false;
  }

  // If timestamp provided, verify it's within tolerance
  if (timestamp) {
    const timestampNum = parseInt(timestamp, 10);
    if (isNaN(timestampNum)) {
      return false;
    }

    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - timestampNum) > toleranceSeconds) {
      return false; // Timestamp too old or in future
    }
  }

  // Generate expected signature
  // Sendly signs: timestamp.payload (if timestamp provided) or just payload
  const signedPayload = timestamp ? `${timestamp}.${payload}` : payload;
  const expectedSignature = generateWebhookSignature(signedPayload, secret);

  // Timing-safe comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature),
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
 * @param timestamp - X-Sendly-Timestamp header value (optional)
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
 *     process.env.WEBHOOK_SECRET,
 *     req.headers['x-sendly-timestamp']
 *   );
 *
 *   switch (event.type) {
 *     case 'message.delivered':
 *       console.log(`Message ${event.data.object.id} delivered!`);
 *       break;
 *     case 'message.failed':
 *       console.log(`Message failed: ${event.data.object.error}`);
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
  secret: string,
  timestamp?: string,
): WebhookEvent {
  if (!verifyWebhookSignature(payload, signature, secret, timestamp)) {
    throw new WebhookSignatureError();
  }

  let event: WebhookEvent;
  try {
    event = JSON.parse(payload);
  } catch {
    throw new Error("Failed to parse webhook payload");
  }

  // Basic validation
  if (!event.id || !event.type || !event.created || !event.data?.object) {
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
 * const timestamp = Math.floor(Date.now() / 1000);
 * const testPayload = JSON.stringify({
 *   id: 'evt_test',
 *   type: 'message.delivered',
 *   api_version: '2024-01',
 *   created: timestamp,
 *   livemode: false,
 *   data: {
 *     object: {
 *       id: 'msg_123',
 *       to: '+15551234567',
 *       from: '+15559876543',
 *       text: 'Test message',
 *       status: 'delivered',
 *       direction: 'outbound',
 *       segments: 1,
 *       credits_used: 1,
 *       created_at: timestamp,
 *       delivered_at: timestamp
 *     }
 *   }
 * });
 *
 * const signedPayload = `${timestamp}.${testPayload}`;
 * const signature = generateWebhookSignature(signedPayload, 'test_secret');
 * ```
 */
export function generateWebhookSignature(
  payload: string,
  secret: string,
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
 * // In your Express/Fastify/etc handler:
 * app.post('/webhooks/sendly', (req, res) => {
 *   try {
 *     const event = webhooks.parse(
 *       req.body,
 *       req.headers['x-sendly-signature'],
 *       req.headers['x-sendly-timestamp']
 *     );
 *
 *     // Handle the event
 *     if (event.type === 'message.delivered') {
 *       console.log(`Message ${event.data.object.id} delivered!`);
 *     }
 *
 *     res.status(200).send('OK');
 *   } catch (err) {
 *     res.status(401).send('Invalid signature');
 *   }
 * });
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
   * @param timestamp - X-Sendly-Timestamp header (optional)
   */
  verify(payload: string, signature: string, timestamp?: string): boolean {
    return verifyWebhookSignature(payload, signature, this.secret, timestamp);
  }

  /**
   * Parse and verify a webhook event
   * @param payload - Raw request body
   * @param signature - X-Sendly-Signature header
   * @param timestamp - X-Sendly-Timestamp header (optional)
   */
  parse(payload: string, signature: string, timestamp?: string): WebhookEvent {
    return parseWebhookEvent(payload, signature, this.secret, timestamp);
  }

  /**
   * Generate a signature for testing
   * @param payload - Payload to sign (should include timestamp prefix if using timestamps)
   */
  sign(payload: string): string {
    return generateWebhookSignature(payload, this.secret);
  }
}

// ============================================================================
// Legacy exports for backwards compatibility
// These types match the old naming but point to the correct structure
// ============================================================================

/**
 * @deprecated Use WebhookMessageObject instead
 */
export type WebhookMessageData = WebhookMessageObject;
