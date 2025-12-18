/**
 * Sendly Node.js SDK Types
 * @packageDocumentation
 */

// ============================================================================
// Configuration
// ============================================================================

/**
 * Configuration options for the Sendly client
 */
export interface SendlyConfig {
  /**
   * Your Sendly API key (sk_test_v1_xxx or sk_live_v1_xxx)
   */
  apiKey: string;

  /**
   * Base URL for the Sendly API
   * @default "https://sendly.live/api"
   */
  baseUrl?: string;

  /**
   * Request timeout in milliseconds
   * @default 30000
   */
  timeout?: number;

  /**
   * Maximum number of retry attempts for failed requests
   * @default 3
   */
  maxRetries?: number;
}

// ============================================================================
// Messages
// ============================================================================

/**
 * Request payload for sending an SMS message
 */
export interface SendMessageRequest {
  /**
   * Destination phone number in E.164 format (e.g., +15551234567)
   */
  to: string;

  /**
   * Message content (max 160 chars per segment)
   */
  text: string;

  /**
   * Sender ID or phone number (optional, uses default if not provided)
   * For international: 2-11 alphanumeric characters
   * For US/Canada: Your verified toll-free number
   */
  from?: string;
}

/**
 * Message status values
 */
export type MessageStatus =
  | "queued"
  | "sending"
  | "sent"
  | "delivered"
  | "failed";

/**
 * A sent or received SMS message
 */
export interface Message {
  /**
   * Unique message identifier
   */
  id: string;

  /**
   * Destination phone number
   */
  to: string;

  /**
   * Sender ID or phone number
   */
  from: string;

  /**
   * Message content
   */
  text: string;

  /**
   * Current delivery status
   */
  status: MessageStatus;

  /**
   * Error message if status is "failed"
   */
  error?: string | null;

  /**
   * Number of SMS segments (1 per 160 chars)
   */
  segments: number;

  /**
   * Credits charged for this message
   */
  creditsUsed: number;

  /**
   * Whether this message was sent in sandbox mode
   */
  isSandbox: boolean;

  /**
   * ISO 8601 timestamp when the message was created
   */
  createdAt: string;

  /**
   * ISO 8601 timestamp when the message was delivered (if applicable)
   */
  deliveredAt?: string | null;
}

/**
 * Options for listing messages
 */
export interface ListMessagesOptions {
  /**
   * Maximum number of messages to return (1-100)
   * @default 50
   */
  limit?: number;

  /**
   * Number of messages to skip for pagination
   * @default 0
   */
  offset?: number;

  /**
   * Filter by message status
   */
  status?: MessageStatus;
}

/**
 * Response from listing messages
 */
export interface MessageListResponse {
  /**
   * Array of messages
   */
  data: Message[];

  /**
   * Total count of messages returned
   */
  count: number;
}

// ============================================================================
// Scheduled Messages
// ============================================================================

/**
 * Request payload for scheduling an SMS message
 */
export interface ScheduleMessageRequest {
  /**
   * Destination phone number in E.164 format (e.g., +15551234567)
   */
  to: string;

  /**
   * Message content (max 160 chars per segment)
   */
  text: string;

  /**
   * When to send the message (ISO 8601 format, must be > 1 minute in future)
   */
  scheduledAt: string;

  /**
   * Sender ID (optional, for international destinations only)
   * For US/Canada: This is ignored - toll-free number pool is used
   */
  from?: string;
}

/**
 * Scheduled message status values
 */
export type ScheduledMessageStatus =
  | "scheduled"
  | "sent"
  | "cancelled"
  | "failed";

/**
 * A scheduled SMS message
 */
export interface ScheduledMessage {
  /**
   * Unique message identifier
   */
  id: string;

  /**
   * Destination phone number
   */
  to: string;

  /**
   * Sender ID (if specified, for international messages)
   */
  from?: string | null;

  /**
   * Message content
   */
  text: string;

  /**
   * Current status
   */
  status: ScheduledMessageStatus;

  /**
   * When the message is scheduled to send (ISO 8601)
   */
  scheduledAt: string;

  /**
   * Credits reserved for this message
   */
  creditsReserved: number;

  /**
   * Error message if status is "failed"
   */
  error?: string | null;

  /**
   * ISO 8601 timestamp when scheduled
   */
  createdAt: string;

  /**
   * ISO 8601 timestamp when cancelled (if applicable)
   */
  cancelledAt?: string | null;

  /**
   * ISO 8601 timestamp when sent (if applicable)
   */
  sentAt?: string | null;
}

/**
 * Options for listing scheduled messages
 */
export interface ListScheduledMessagesOptions {
  /**
   * Maximum number of messages to return (1-100)
   * @default 50
   */
  limit?: number;

  /**
   * Number of messages to skip for pagination
   * @default 0
   */
  offset?: number;

  /**
   * Filter by status
   */
  status?: ScheduledMessageStatus;
}

/**
 * Response from listing scheduled messages
 */
export interface ScheduledMessageListResponse {
  /**
   * Array of scheduled messages
   */
  data: ScheduledMessage[];

  /**
   * Total count of scheduled messages matching the filter
   */
  count: number;
}

/**
 * Response from cancelling a scheduled message
 */
export interface CancelledMessageResponse {
  /**
   * Message ID
   */
  id: string;

  /**
   * Status (always "cancelled")
   */
  status: "cancelled";

  /**
   * Credits refunded
   */
  creditsRefunded: number;

  /**
   * When the message was cancelled
   */
  cancelledAt: string;
}

// ============================================================================
// Batch Messages
// ============================================================================

/**
 * A single message in a batch request
 */
export interface BatchMessageItem {
  /**
   * Destination phone number in E.164 format
   */
  to: string;

  /**
   * Message content
   */
  text: string;
}

/**
 * Request payload for sending batch messages
 */
export interface BatchMessageRequest {
  /**
   * Array of messages to send (max 1000)
   */
  messages: BatchMessageItem[];

  /**
   * Sender ID (optional, for international destinations only)
   * For US/Canada destinations: This is ignored - toll-free number pool is used
   */
  from?: string;
}

/**
 * Result for a single message in a batch
 */
export interface BatchMessageResult {
  /**
   * Message ID (if successful)
   */
  id?: string;

  /**
   * Destination phone number
   */
  to: string;

  /**
   * Status of this message
   */
  status: "queued" | "failed";

  /**
   * Error message (if failed)
   */
  error?: string;
}

/**
 * Batch status values
 */
export type BatchStatus = "processing" | "completed" | "partial_failure";

/**
 * Response from sending batch messages
 */
export interface BatchMessageResponse {
  /**
   * Unique batch identifier
   */
  batchId: string;

  /**
   * Current batch status
   */
  status: BatchStatus;

  /**
   * Total number of messages in batch
   */
  total: number;

  /**
   * Number of messages queued successfully
   */
  queued: number;

  /**
   * Number of messages sent
   */
  sent: number;

  /**
   * Number of messages that failed
   */
  failed: number;

  /**
   * Total credits used
   */
  creditsUsed: number;

  /**
   * Individual message results
   */
  messages: BatchMessageResult[];

  /**
   * When the batch was created
   */
  createdAt: string;

  /**
   * When the batch completed (if applicable)
   */
  completedAt?: string | null;
}

/**
 * Options for listing batches
 */
export interface ListBatchesOptions {
  /**
   * Maximum number of batches to return (1-100)
   * @default 50
   */
  limit?: number;

  /**
   * Number of batches to skip for pagination
   * @default 0
   */
  offset?: number;

  /**
   * Filter by status
   */
  status?: BatchStatus;
}

/**
 * Response from listing batches
 */
export interface BatchListResponse {
  /**
   * Array of batches
   */
  data: BatchMessageResponse[];

  /**
   * Total count of batches
   */
  count: number;
}

// ============================================================================
// Errors
// ============================================================================

/**
 * Error codes returned by the Sendly API
 */
export type SendlyErrorCode =
  | "invalid_request"
  | "unauthorized"
  | "invalid_auth_format"
  | "invalid_key_format"
  | "invalid_api_key"
  | "key_revoked"
  | "key_expired"
  | "insufficient_permissions"
  | "insufficient_credits"
  | "unsupported_destination"
  | "not_found"
  | "rate_limit_exceeded"
  | "internal_error";

/**
 * Error response from the Sendly API
 */
export interface ApiErrorResponse {
  /**
   * Machine-readable error code
   */
  error: SendlyErrorCode;

  /**
   * Human-readable error message
   */
  message: string;

  /**
   * Credits needed (for insufficient_credits errors)
   */
  creditsNeeded?: number;

  /**
   * Current credit balance (for insufficient_credits errors)
   */
  currentBalance?: number;

  /**
   * Seconds to wait before retrying (for rate_limit_exceeded errors)
   */
  retryAfter?: number;

  /**
   * Additional error context
   */
  [key: string]: unknown;
}

// ============================================================================
// HTTP
// ============================================================================

/**
 * HTTP request options
 */
export interface RequestOptions {
  /**
   * HTTP method
   */
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

  /**
   * Request path (without base URL)
   */
  path: string;

  /**
   * Request body (will be JSON serialized)
   */
  body?: Record<string, unknown>;

  /**
   * Query parameters
   */
  query?: Record<string, string | number | boolean | undefined>;

  /**
   * Additional headers
   */
  headers?: Record<string, string>;
}

/**
 * Rate limit information from response headers
 */
export interface RateLimitInfo {
  /**
   * Maximum requests allowed per window
   */
  limit: number;

  /**
   * Remaining requests in current window
   */
  remaining: number;

  /**
   * Seconds until the rate limit resets
   */
  reset: number;
}

// ============================================================================
// Pricing & Countries
// ============================================================================

/**
 * Pricing tier for SMS destinations
 */
export type PricingTier = "domestic" | "tier1" | "tier2" | "tier3";

/**
 * Credits required per SMS segment by tier
 */
export const CREDITS_PER_SMS: Record<PricingTier, number> = {
  domestic: 1,
  tier1: 8,
  tier2: 12,
  tier3: 16,
};

/**
 * Supported country codes organized by pricing tier
 */
export const SUPPORTED_COUNTRIES: Record<PricingTier, string[]> = {
  domestic: ["US", "CA"],
  tier1: [
    "GB",
    "PL",
    "PT",
    "RO",
    "CZ",
    "HU",
    "CN",
    "KR",
    "IN",
    "PH",
    "TH",
    "VN",
  ],
  tier2: [
    "FR",
    "ES",
    "SE",
    "NO",
    "DK",
    "FI",
    "IE",
    "JP",
    "AU",
    "NZ",
    "SG",
    "HK",
    "MY",
    "ID",
    "BR",
    "AR",
    "CL",
    "CO",
    "ZA",
    "GR",
  ],
  tier3: [
    "DE",
    "IT",
    "NL",
    "BE",
    "AT",
    "CH",
    "MX",
    "IL",
    "AE",
    "SA",
    "EG",
    "NG",
    "KE",
    "TW",
    "PK",
    "TR",
  ],
};

/**
 * All supported country codes
 */
export const ALL_SUPPORTED_COUNTRIES: string[] =
  Object.values(SUPPORTED_COUNTRIES).flat();

// ============================================================================
// Sandbox
// ============================================================================

/**
 * Test phone numbers for sandbox mode
 */
export const SANDBOX_TEST_NUMBERS = {
  /** Always succeeds instantly */
  SUCCESS: "+15550001234",
  /** Succeeds after 10 second delay */
  DELAYED: "+15550001010",
  /** Fails with invalid_number error */
  INVALID: "+15550001001",
  /** Fails with carrier_rejected error after 2 seconds */
  REJECTED: "+15550001002",
  /** Fails with rate_limit_exceeded error */
  RATE_LIMITED: "+15550001003",
} as const;
