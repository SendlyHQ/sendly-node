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
   * @default "https://sendly.live/api/v1"
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
 * Message type for compliance classification
 */
export type MessageType = "marketing" | "transactional";

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

  /**
   * Message type for compliance (default: "marketing")
   * - "marketing": Promotional content, subject to quiet hours (8am-9pm recipient time)
   * - "transactional": OTPs, confirmations, alerts - bypasses quiet hours (24/7)
   */
  messageType?: MessageType;
}

/**
 * Message status values
 * Note: "sending" was removed as it doesn't exist in the database
 */
export type MessageStatus = "queued" | "sent" | "delivered" | "failed";

/**
 * How the message was sent
 */
export type SenderType = "number_pool" | "alphanumeric" | "sandbox";

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
   * Message direction
   */
  direction: "outbound" | "inbound";

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
   * How the message was sent
   * - "number_pool": Sent from toll-free number pool (US/CA)
   * - "alphanumeric": Sent with alphanumeric sender ID (international)
   * - "sandbox": Sent in sandbox/test mode
   */
  senderType?: SenderType;

  /**
   * Telnyx message ID for tracking
   */
  telnyxMessageId?: string | null;

  /**
   * Warning message (e.g., when "from" is ignored for domestic messages)
   */
  warning?: string;

  /**
   * Note about sender behavior (e.g., toll-free number pool explanation)
   */
  senderNote?: string;

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
   * When to send the message (ISO 8601 format, must be 5 min - 5 days in future)
   */
  scheduledAt: string;

  /**
   * Sender ID (optional, for international destinations only)
   * For US/Canada: This is ignored - toll-free number pool is used
   */
  from?: string;

  /**
   * Message type for compliance (default: "marketing")
   * - "marketing": Promotional content, subject to quiet hours (8am-9pm recipient time)
   * - "transactional": OTPs, confirmations, alerts - bypasses quiet hours (24/7)
   */
  messageType?: MessageType;
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

  /**
   * Message type for compliance (default: "marketing")
   * - "marketing": Promotional content, subject to quiet hours (8am-9pm recipient time)
   * - "transactional": OTPs, confirmations, alerts - bypasses quiet hours (24/7)
   */
  messageType?: MessageType;
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
export type BatchStatus =
  | "processing"
  | "completed"
  | "partial_failure"
  | "failed";

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

/**
 * Preview result for a single message in a batch
 */
export interface BatchPreviewItem {
  /**
   * Destination phone number
   */
  to: string;

  /**
   * Whether this message will be sent
   */
  willSend: boolean;

  /**
   * Number of SMS segments
   */
  segments: number;

  /**
   * Credits required for this message
   */
  creditsNeeded: number;

  /**
   * Warning message (e.g., quiet hours)
   */
  warning?: string;

  /**
   * Block reason if willSend is false
   */
  blockReason?: string;
}

/**
 * Response from previewing a batch (dry run)
 */
export interface BatchPreviewResponse {
  /**
   * Whether the batch can be sent
   */
  canSend: boolean;

  /**
   * Total number of messages
   */
  totalMessages: number;

  /**
   * Number of messages that will be sent
   */
  willSend: number;

  /**
   * Number of messages that will be blocked
   */
  blocked: number;

  /**
   * Total credits required
   */
  creditsNeeded: number;

  /**
   * Current credit balance
   */
  currentBalance: number;

  /**
   * Whether user has enough credits
   */
  hasEnoughCredits: boolean;

  /**
   * Per-message preview details
   */
  messages: BatchPreviewItem[];

  /**
   * Summary of why messages are blocked (if any)
   */
  blockReasons?: Record<string, number>;
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
  | "api_key_required"
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
// Webhooks
// ============================================================================

/**
 * Webhook event types
 */
export type WebhookEventType =
  | "message.sent"
  | "message.delivered"
  | "message.failed"
  | "message.bounced"
  | "message.queued";

/**
 * Webhook mode - filters which events are delivered
 * - "all": Receives all events (sandbox + production)
 * - "test": Only sandbox/test events (livemode: false)
 * - "live": Only production events (livemode: true) - requires verification
 */
export type WebhookMode = "all" | "test" | "live";

/**
 * Webhook event data (legacy flat format for backwards compatibility)
 */
export interface WebhookEventData {
  /** Message ID */
  message_id: string;
  /** Message status */
  status: string;
  /** Recipient phone number */
  to: string;
  /** Sender phone number or ID */
  from: string;
  /** Error message if failed */
  error?: string;
  /** Error code if failed */
  error_code?: string;
  /** When delivered (ISO 8601) */
  delivered_at?: string;
  /** When failed (ISO 8601) */
  failed_at?: string;
  /** Number of SMS segments */
  segments: number;
  /** Credits used */
  credits_used: number;
}

/**
 * Webhook event payload from Sendly
 */
export interface WebhookEvent {
  /** Unique event identifier (evt_xxx) */
  id: string;
  /** Event type */
  type: WebhookEventType | string;
  /** Event data */
  data: WebhookEventData;
  /** When event was created (ISO 8601) */
  created_at: string;
  /** API version */
  api_version: string;
}

/**
 * Circuit breaker state for webhook delivery
 */
export type CircuitState = "closed" | "open" | "half_open";

/**
 * Webhook delivery status
 */
export type DeliveryStatus = "pending" | "delivered" | "failed" | "cancelled";

/**
 * A configured webhook endpoint
 */
export interface Webhook {
  /** Unique webhook identifier (whk_xxx) */
  id: string;
  /** HTTPS endpoint URL */
  url: string;
  /** Event types this webhook subscribes to */
  events: WebhookEventType[];
  /** Optional description */
  description?: string;
  /** Event mode filter */
  mode: WebhookMode;
  /** Whether the webhook is active */
  isActive: boolean;
  /** Number of consecutive failures */
  failureCount: number;
  /** Last failure timestamp (ISO 8601) */
  lastFailureAt?: string | null;
  /** Circuit breaker state */
  circuitState: CircuitState;
  /** When circuit was opened (ISO 8601) */
  circuitOpenedAt?: string | null;
  /** API version for payloads */
  apiVersion: string;
  /** Custom metadata */
  metadata: Record<string, unknown>;
  /** When webhook was created (ISO 8601) */
  createdAt: string;
  /** When webhook was last updated (ISO 8601) */
  updatedAt: string;
  /** Total delivery attempts */
  totalDeliveries: number;
  /** Successful deliveries */
  successfulDeliveries: number;
  /** Success rate (0-100) */
  successRate: number;
  /** Last successful delivery (ISO 8601) */
  lastDeliveryAt?: string | null;
}

/**
 * Response when creating a webhook (includes secret once)
 */
export interface WebhookCreatedResponse extends Webhook {
  /** Webhook signing secret - only shown once at creation */
  secret: string;
}

/**
 * Options for creating a webhook
 */
export interface CreateWebhookOptions {
  /** HTTPS endpoint URL */
  url: string;
  /** Event types to subscribe to */
  events: WebhookEventType[];
  /** Optional description */
  description?: string;
  /** Event mode filter (defaults to "all") */
  mode?: WebhookMode;
  /** Custom metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Options for updating a webhook
 */
export interface UpdateWebhookOptions {
  /** New URL */
  url?: string;
  /** New event subscriptions */
  events?: WebhookEventType[];
  /** New description */
  description?: string;
  /** Event mode filter */
  mode?: WebhookMode;
  /** Enable/disable webhook */
  isActive?: boolean;
  /** Custom metadata */
  metadata?: Record<string, unknown>;
}

/**
 * A webhook delivery attempt
 */
export interface WebhookDelivery {
  /** Unique delivery identifier (del_xxx) */
  id: string;
  /** Webhook ID this delivery belongs to */
  webhookId: string;
  /** Event ID for idempotency */
  eventId: string;
  /** Event type */
  eventType: WebhookEventType;
  /** Attempt number (1-6) */
  attemptNumber: number;
  /** Maximum attempts allowed */
  maxAttempts: number;
  /** Delivery status */
  status: DeliveryStatus;
  /** HTTP response status code */
  responseStatusCode?: number;
  /** Response time in milliseconds */
  responseTimeMs?: number;
  /** Error message if failed */
  errorMessage?: string;
  /** Error code if failed */
  errorCode?: string;
  /** Next retry time (ISO 8601) */
  nextRetryAt?: string;
  /** When delivery was created (ISO 8601) */
  createdAt: string;
  /** When delivery succeeded (ISO 8601) */
  deliveredAt?: string;
}

/**
 * Response from testing a webhook
 */
export interface WebhookTestResult {
  /** Whether test was successful */
  success: boolean;
  /** HTTP status code from endpoint */
  statusCode?: number;
  /** Response time in milliseconds */
  responseTimeMs?: number;
  /** Error message if failed */
  error?: string;
}

/**
 * Response from rotating webhook secret
 */
export interface WebhookSecretRotation {
  /** The webhook */
  webhook: Webhook;
  /** New signing secret */
  newSecret: string;
  /** When old secret expires (ISO 8601) */
  oldSecretExpiresAt: string;
  /** Message about grace period */
  message: string;
}

// ============================================================================
// Account & Credits
// ============================================================================

/**
 * Account information
 */
export interface Account {
  /** User ID */
  id: string;
  /** Email address */
  email: string;
  /** Display name */
  name?: string;
  /** Account creation date (ISO 8601) */
  createdAt: string;
}

/**
 * Credit balance information
 */
export interface Credits {
  /** Available credit balance */
  balance: number;
  /** Credits reserved for scheduled messages */
  reservedBalance: number;
  /** Total usable credits (balance - reserved) */
  availableBalance: number;
}

/**
 * A credit transaction record
 */
export interface CreditTransaction {
  /** Transaction ID */
  id: string;
  /** Transaction type */
  type: "purchase" | "usage" | "refund" | "adjustment" | "bonus";
  /** Amount (positive for credits in, negative for credits out) */
  amount: number;
  /** Balance after transaction */
  balanceAfter: number;
  /** Transaction description */
  description: string;
  /** Related message ID (for usage transactions) */
  messageId?: string;
  /** When transaction occurred (ISO 8601) */
  createdAt: string;
}

/**
 * An API key
 */
export interface ApiKey {
  /** Key ID */
  id: string;
  /** Key name/label */
  name: string;
  /** Key type */
  type: "test" | "live";
  /** Key prefix (for identification) */
  prefix: string;
  /** Last 4 characters of key */
  lastFour: string;
  /** Permissions granted */
  permissions: string[];
  /** When key was created (ISO 8601) */
  createdAt: string;
  /** When key was last used (ISO 8601) */
  lastUsedAt?: string | null;
  /** When key expires (ISO 8601) */
  expiresAt?: string | null;
  /** Whether key is revoked */
  isRevoked: boolean;
}

// ============================================================================
// Sandbox
// ============================================================================

/**
 * Test phone numbers for sandbox mode.
 * Use these with test API keys (sk_test_*) to simulate different scenarios.
 */
export const SANDBOX_TEST_NUMBERS = {
  /** Always succeeds - any number not in error list succeeds */
  SUCCESS: "+15005550000",
  /** Fails with invalid_number error */
  INVALID: "+15005550001",
  /** Fails with unroutable destination error */
  UNROUTABLE: "+15005550002",
  /** Fails with queue_full error */
  QUEUE_FULL: "+15005550003",
  /** Fails with rate_limit_exceeded error */
  RATE_LIMITED: "+15005550004",
  /** Fails with carrier_violation error */
  CARRIER_VIOLATION: "+15005550006",
} as const;

// ============================================================================
// Verify (OTP)
// ============================================================================

/**
 * Verification status
 */
export type VerificationStatus =
  | "pending"
  | "verified"
  | "invalid"
  | "expired"
  | "failed";

/**
 * Verification delivery status
 */
export type VerificationDeliveryStatus =
  | "queued"
  | "sent"
  | "delivered"
  | "failed";

/**
 * Request to send a verification code
 */
export interface SendVerificationRequest {
  /** Destination phone number in E.164 format */
  to: string;
  /** Template ID to use (defaults to preset OTP template) */
  templateId?: string;
  /** Verify profile ID for custom settings */
  profileId?: string;
  /** App name to display in message (defaults to business name) */
  appName?: string;
  /** Code validity in seconds (60-3600, default: 300) */
  timeoutSecs?: number;
  /** OTP code length (4-10, default: 6) */
  codeLength?: number;
}

/**
 * Response from sending a verification
 */
export interface SendVerificationResponse {
  /** Verification ID */
  id: string;
  /** Status (always "pending" initially) */
  status: VerificationStatus;
  /** Phone number */
  phone: string;
  /** When the code expires (ISO 8601) */
  expiresAt: string;
  /** Whether sent in sandbox mode */
  sandbox: boolean;
  /** OTP code (only in sandbox mode for testing) */
  sandboxCode?: string;
  /** Message about sandbox mode */
  message?: string;
}

/**
 * Request to check a verification code
 */
export interface CheckVerificationRequest {
  /** The OTP code entered by the user */
  code: string;
}

/**
 * Response from checking a verification
 */
export interface CheckVerificationResponse {
  /** Verification ID */
  id: string;
  /** Status after check */
  status: VerificationStatus;
  /** Phone number */
  phone: string;
  /** When verified (ISO 8601) */
  verifiedAt?: string;
  /** Remaining attempts (if invalid) */
  remainingAttempts?: number;
}

/**
 * A verification record
 */
export interface Verification {
  /** Verification ID */
  id: string;
  /** Status */
  status: VerificationStatus;
  /** Phone number */
  phone: string;
  /** Delivery status */
  deliveryStatus: VerificationDeliveryStatus;
  /** Number of check attempts */
  attempts: number;
  /** Maximum attempts allowed */
  maxAttempts: number;
  /** When the code expires (ISO 8601) */
  expiresAt: string;
  /** When verified (ISO 8601) */
  verifiedAt?: string | null;
  /** When created (ISO 8601) */
  createdAt: string;
  /** Whether sandbox mode */
  sandbox: boolean;
  /** App name used */
  appName?: string;
  /** Template ID used */
  templateId?: string;
  /** Profile ID used */
  profileId?: string;
}

/**
 * Options for listing verifications
 */
export interface ListVerificationsOptions {
  /** Maximum number to return (1-100, default: 20) */
  limit?: number;
  /** Filter by status */
  status?: VerificationStatus;
}

/**
 * Response from listing verifications
 */
export interface VerificationListResponse {
  /** Array of verifications */
  verifications: Verification[];
  /** Pagination info */
  pagination: {
    limit: number;
    hasMore: boolean;
  };
}

// ============================================================================
// Templates
// ============================================================================

/**
 * Template variable definition
 */
export interface TemplateVariable {
  /** Variable key (e.g., "code", "app_name") */
  key: string;
  /** Variable type */
  type: "string" | "number";
  /** Default fallback value */
  fallback?: string;
}

/**
 * Template status
 */
export type TemplateStatus = "draft" | "published";

/**
 * An SMS template
 */
export interface Template {
  /** Template ID */
  id: string;
  /** Template name */
  name: string;
  /** Message text with {{variables}} */
  text: string;
  /** Variables detected in the template */
  variables: TemplateVariable[];
  /** Whether this is a preset template */
  isPreset: boolean;
  /** Preset slug (e.g., "otp", "2fa") */
  presetSlug?: string | null;
  /** Template status */
  status: TemplateStatus;
  /** Version number */
  version: number;
  /** When published (ISO 8601) */
  publishedAt?: string | null;
  /** When created (ISO 8601) */
  createdAt: string;
  /** When updated (ISO 8601) */
  updatedAt: string;
}

/**
 * Request to create a template
 */
export interface CreateTemplateRequest {
  /** Template name */
  name: string;
  /** Message text (use {{code}} and {{app_name}} variables) */
  text: string;
}

/**
 * Request to update a template
 */
export interface UpdateTemplateRequest {
  /** New template name */
  name?: string;
  /** New message text */
  text?: string;
}

/**
 * Response from listing templates
 */
export interface TemplateListResponse {
  /** Array of templates */
  templates: Template[];
}

/**
 * Template preview with interpolated text
 */
export interface TemplatePreview {
  /** Template ID */
  id: string;
  /** Template name */
  name: string;
  /** Original text with variables */
  originalText: string;
  /** Interpolated text with sample values */
  previewText: string;
  /** Variables detected */
  variables: TemplateVariable[];
}

// ============================================================================
// Verify Sessions (Hosted Verification Flow)
// ============================================================================

export type VerifySessionStatus =
  | "pending"
  | "phone_submitted"
  | "code_sent"
  | "verified"
  | "expired"
  | "cancelled";

export interface CreateVerifySessionRequest {
  successUrl: string;
  cancelUrl?: string;
  brandName?: string;
  brandColor?: string;
  metadata?: Record<string, unknown>;
}

export interface VerifySession {
  id: string;
  url: string;
  status: VerifySessionStatus;
  successUrl: string;
  cancelUrl?: string;
  brandName?: string;
  brandColor?: string;
  phone?: string;
  verificationId?: string;
  token?: string;
  metadata?: Record<string, unknown>;
  expiresAt: string;
  createdAt: string;
}

export interface ValidateSessionTokenRequest {
  token: string;
}

export interface ValidateSessionTokenResponse {
  valid: boolean;
  sessionId?: string;
  phone?: string;
  verifiedAt?: string;
  metadata?: Record<string, unknown>;
}
