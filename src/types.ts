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

  organizationId?: string;
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

  /**
   * Custom JSON metadata to attach to the message (max 4KB).
   * Stored on the message record and included in webhook event payloads.
   */
  metadata?: Record<string, any>;

  /**
   * URLs of media files to include as MMS attachments.
   * Must be publicly accessible HTTPS URLs. Max 10 per message.
   */
  mediaUrls?: string[];
}

/**
 * Message status values
 * Note: "sending" was removed as it doesn't exist in the database
 */
export type MessageStatus =
  | "queued"
  | "sent"
  | "delivered"
  | "failed"
  | "bounced"
  | "retrying";

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
   * Structured error code (e.g., "E001" for invalid number)
   */
  errorCode?: string | null;

  /**
   * Number of retry attempts made
   */
  retryCount?: number;

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
   * Carrier message ID for tracking
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

  /**
   * Custom JSON metadata attached to the message
   */
  metadata?: Record<string, any>;

  /**
   * AI classification metadata (inbound messages only, when AI classification is enabled)
   */
  aiMetadata?: {
    intent: string;
    intentConfidence: number;
    sentiment: string;
    sentimentConfidence: number;
    classifiedAt: string;
    model: string;
  } | null;
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
// Conversations
// ============================================================================

export type ConversationStatus = "active" | "closed";

export interface Conversation {
  id: string;
  phoneNumber: string;
  status: ConversationStatus;
  unreadCount: number;
  messageCount: number;
  lastMessageText: string | null;
  lastMessageAt: string | null;
  lastMessageDirection: "inbound" | "outbound" | null;
  metadata: Record<string, any>;
  tags: string[];
  contactId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ListConversationsOptions {
  limit?: number;
  offset?: number;
  status?: ConversationStatus;
}

export interface ConversationListResponse {
  data: Conversation[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export interface ConversationWithMessages extends Conversation {
  messages?: {
    data: Message[];
    pagination: {
      total: number;
      limit: number;
      offset: number;
      hasMore: boolean;
    };
  };
}

export interface GetConversationOptions {
  includeMessages?: boolean;
  messageLimit?: number;
  messageOffset?: number;
}

export interface UpdateConversationRequest {
  metadata?: Record<string, any>;
  tags?: string[];
}

export interface ReplyToConversationRequest {
  text: string;
  messageType?: MessageType;
  metadata?: Record<string, any>;
  mediaUrls?: string[];
}

export interface SuggestedReply {
  text: string;
  tone: "professional" | "friendly" | "concise";
}

export interface SuggestRepliesResponse {
  suggestions: SuggestedReply[];
  basedOnMessageId?: string;
  model?: string;
}

export interface ConversationContext {
  context: string;
  conversation: {
    id: string;
    phoneNumber: string;
    status: string;
    messageCount: number;
    unreadCount: number;
  };
  tokenEstimate: number;
  business?: {
    name: string;
    useCase?: string;
  };
}

// ============================================================================
// Auto-Label Rules
// ============================================================================

export interface AutoLabelRule {
  id: string;
  name: string;
  conditions: {
    intent?: string | string[];
    sentiment?: string | string[];
    intentConfidenceMin?: number;
    sentimentConfidenceMin?: number;
  };
  actions: {
    addLabels: string[];
    closeConversation?: boolean;
  };
  enabled: boolean;
  priority: number;
  createdAt: string;
  updatedAt: string;
}

export interface AutoLabelRuleListResponse {
  data: AutoLabelRule[];
}

export interface CreateAutoLabelRuleRequest {
  name: string;
  conditions: AutoLabelRule["conditions"];
  actions: AutoLabelRule["actions"];
  priority?: number;
}

export interface UpdateAutoLabelRuleRequest {
  name?: string;
  conditions?: AutoLabelRule["conditions"];
  actions?: AutoLabelRule["actions"];
  enabled?: boolean;
  priority?: number;
}

// ============================================================================
// Template Generation
// ============================================================================

export interface GenerateTemplateRequest {
  description: string;
  category?: string;
}

export interface GeneratedTemplate {
  name: string;
  text: string;
  variables: string[];
  category: string;
}

// ============================================================================
// Labels
// ============================================================================

export interface Label {
  id: string;
  name: string;
  color: string;
  description?: string | null;
  createdAt: string;
}

export interface LabelListResponse {
  data: Label[];
}

export interface CreateLabelRequest {
  name: string;
  color?: string;
  description?: string;
}

export interface AddLabelsRequest {
  labelIds: string[];
}

// ============================================================================
// Drafts
// ============================================================================

export type DraftStatus = "pending" | "approved" | "rejected" | "sent" | "failed";

export interface MessageDraft {
  id: string;
  conversationId: string;
  text: string;
  mediaUrls?: string[];
  metadata?: Record<string, any>;
  status: DraftStatus;
  source?: string;
  createdBy?: string;
  reviewedBy?: string;
  reviewedAt?: string | null;
  rejectionReason?: string | null;
  messageId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDraftRequest {
  conversationId: string;
  text: string;
  mediaUrls?: string[];
  metadata?: Record<string, any>;
  source?: string;
}

export interface UpdateDraftRequest {
  text?: string;
  mediaUrls?: string[];
  metadata?: Record<string, any>;
}

export interface DraftListResponse {
  data: MessageDraft[];
  pagination: { total: number };
}

export interface ListDraftsOptions {
  conversationId?: string;
  status?: DraftStatus;
  limit?: number;
  offset?: number;
}

// ============================================================================
// Media
// ============================================================================

/**
 * An uploaded media file for MMS
 */
export interface MediaFile {
  /**
   * Unique media file identifier
   */
  id: string;

  /**
   * Publicly accessible URL for the media file
   */
  url: string;

  /**
   * MIME type of the file (e.g., "image/jpeg")
   */
  contentType: string;

  /**
   * File size in bytes
   */
  sizeBytes: number;
}

/**
 * Options for uploading a media file
 */
export interface MediaUploadOptions {
  /**
   * Filename for the upload
   * @default "upload.jpg"
   */
  filename?: string;

  /**
   * MIME content type
   * @default "image/jpeg"
   */
  contentType?: string;
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

  /**
   * Custom JSON metadata to attach to the message (max 4KB).
   * Stored on the message record and included in webhook event payloads.
   */
  metadata?: Record<string, any>;
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

  /**
   * Custom JSON metadata for this message (max 4KB).
   * Merged with batch-level metadata, with per-message metadata taking priority.
   */
  metadata?: Record<string, any>;
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

  /**
   * Custom JSON metadata to attach to all messages in the batch (max 4KB).
   * Stored on each message record and included in webhook event payloads.
   */
  metadata?: Record<string, any>;
}

/**
 * Result for a single message in a batch
 */
export interface BatchMessageResult {
  /**
   * Message ID
   */
  id: string;

  /**
   * Destination phone number
   */
  to: string;

  /**
   * Current message status
   */
  status: string;

  /**
   * Error message (if failed)
   */
  error?: string | null;

  /**
   * When the message was created
   */
  createdAt?: string;

  /**
   * When the message was delivered (if applicable)
   */
  deliveredAt?: string | null;
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
  domestic: 2,
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
  | "message.retrying"
  | "message.queued"
  | "message.received"
  | "message.opt_out"
  | "message.opt_in"
  | "verification.created"
  | "verification.delivered"
  | "verification.verified"
  | "verification.expired"
  | "verification.failed"
  | "verification.resent"
  | "verification.delivery_failed";

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
  organization_id?: string | null;
  text?: string;
  direction?: "outbound" | "inbound";
  created_at?: number | string;
  retry_count?: number;
  metadata?: Record<string, any>;
  message_format?: "sms" | "mms";
  media_urls?: string[];
  batch_id?: string | null;
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

export interface TransferCreditsResponse {
  success: boolean;
  amount: number;
  sourceBalance: number;
  targetBalance: number;
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

// ============================================================================
// Campaigns
// ============================================================================

/**
 * Campaign status values
 */
export type CampaignStatus =
  | "draft"
  | "scheduled"
  | "sending"
  | "sent"
  | "paused"
  | "cancelled"
  | "failed";

/**
 * A bulk SMS campaign
 */
export interface Campaign {
  /** Unique campaign identifier */
  id: string;
  /** Campaign name */
  name: string;
  /** Message text with optional {{variables}} */
  text: string;
  /** Template ID if using a template */
  templateId?: string | null;
  /** Contact list IDs to send to */
  contactListIds: string[];
  /** Current status */
  status: CampaignStatus;
  /** Total recipients */
  recipientCount: number;
  /** Messages sent so far */
  sentCount: number;
  /** Messages delivered */
  deliveredCount: number;
  /** Messages failed */
  failedCount: number;
  /** Estimated credits needed */
  estimatedCredits: number;
  /** Credits actually used */
  creditsUsed: number;
  /** Scheduled send time (ISO string) */
  scheduledAt?: string | null;
  /** Timezone for scheduled send */
  timezone?: string | null;
  /** When campaign started sending */
  startedAt?: string | null;
  /** When campaign finished */
  completedAt?: string | null;
  /** Creation timestamp */
  createdAt: string;
  /** Last update timestamp */
  updatedAt: string;
}

/**
 * Request to create a new campaign
 */
export interface CreateCampaignRequest {
  /** Campaign name */
  name: string;
  /** Message text with optional {{variables}} */
  text: string;
  /** Template ID to use (optional) */
  templateId?: string;
  /** Contact list IDs to send to */
  contactListIds: string[];
}

/**
 * Request to update a campaign
 */
export interface UpdateCampaignRequest {
  /** Campaign name */
  name?: string;
  /** Message text */
  text?: string;
  /** Template ID */
  templateId?: string | null;
  /** Contact list IDs */
  contactListIds?: string[];
}

/**
 * Request to schedule a campaign
 */
export interface ScheduleCampaignRequest {
  /** When to send (ISO 8601 string) */
  scheduledAt: string;
  /** Timezone (e.g., "America/New_York") */
  timezone?: string;
}

/**
 * Campaign preview with recipient count and cost estimate
 */
export interface CampaignPreview {
  /** Campaign ID */
  id: string;
  /** Total recipients */
  recipientCount: number;
  /** Estimated segments (based on message length) */
  estimatedSegments: number;
  /** Estimated credits needed */
  estimatedCredits: number;
  /** Current credit balance */
  currentBalance: number;
  /** Whether user has enough credits */
  hasEnoughCredits: boolean;
  /** Breakdown by country/pricing tier */
  breakdown?: Array<{
    country: string;
    count: number;
    creditsPerMessage: number;
    totalCredits: number;
  }>;
  /** Number of recipients blocked due to destination restrictions */
  blockedCount?: number;
  /** Number of recipients that can be reached */
  sendableCount?: number;
  /** Per-country breakdown with access info */
  byCountry?: Record<
    string,
    {
      count: number;
      credits: number;
      allowed: boolean;
      blockedReason?: string;
    }
  >;
  /** Validation warnings */
  warnings?: string[];
  /** User's messaging profile access info */
  messagingProfile?: {
    canSendDomestic: boolean;
    canSendInternational: boolean;
    verificationType: string | null;
    verificationStatus: string | null;
  };
}

/**
 * Options for listing campaigns
 */
export interface ListCampaignsOptions {
  /** Maximum campaigns to return */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
  /** Filter by status */
  status?: CampaignStatus;
}

/**
 * Response from listing campaigns
 */
export interface CampaignListResponse {
  /** List of campaigns */
  campaigns: Campaign[];
  /** Total count (for pagination) */
  total: number;
  /** Current limit */
  limit: number;
  /** Current offset */
  offset: number;
}

// ============================================================================
// Contacts
// ============================================================================

/**
 * A contact in your address book
 */
export interface Contact {
  /**
   * Unique contact identifier
   */
  id: string;

  /**
   * Phone number in E.164 format
   */
  phoneNumber: string;

  /**
   * Contact name
   */
  name?: string | null;

  /**
   * Contact email
   */
  email?: string | null;

  /**
   * Custom metadata (key-value pairs)
   */
  metadata?: Record<string, any>;

  /**
   * Whether the contact has opted out
   */
  optedOut?: boolean;

  /**
   * Carrier-reported line type for this number. One of: `mobile`, `voip`,
   * `toll free`, `fixed line`, `fixed line or mobile`, `pager`, `voicemail`,
   * `shared cost`, `premium rate`, `uan`, `personal number`, `unknown`.
   * Populated after a carrier lookup (either automatic or via checkNumbers).
   */
  lineType?: string | null;

  /**
   * Carrier name reported by the lookup (e.g., "AT&T", "Verizon").
   */
  carrierName?: string | null;

  /**
   * When the carrier lookup last ran for this contact.
   */
  lineTypeCheckedAt?: string | null;

  /**
   * Reason this contact is excluded from future campaigns. One of:
   * `landline`, `invalid_number`, `non_sms_capable`. Set automatically
   * after terminal send failures or by a carrier lookup. Clear it with
   * `contacts.markValid(id)`.
   */
  invalidReason?: string | null;

  /**
   * When the invalid flag was set.
   */
  invalidatedAt?: string | null;

  /**
   * When the contact was created
   */
  createdAt: string;

  /**
   * When the contact was last updated
   */
  updatedAt?: string;

  /**
   * Lists the contact belongs to (when fetching a single contact)
   */
  lists?: Array<{ id: string; name: string }>;
}

/**
 * Response from triggering a bulk carrier lookup via `contacts.checkNumbers()`.
 */
export interface CheckNumbersResponse {
  success: boolean;
  message?: string;
}

/**
 * Request to create a contact
 */
export interface CreateContactRequest {
  /**
   * Phone number in E.164 format (e.g., +15551234567)
   */
  phoneNumber: string;

  /**
   * Contact name
   */
  name?: string;

  /**
   * Contact email
   */
  email?: string;

  /**
   * Custom metadata
   */
  metadata?: Record<string, any>;
}

/**
 * Request to update a contact
 */
export interface UpdateContactRequest {
  /**
   * Contact name
   */
  name?: string;

  /**
   * Contact email
   */
  email?: string;

  /**
   * Custom metadata
   */
  metadata?: Record<string, any>;
}

/**
 * Options for listing contacts
 */
export interface ListContactsOptions {
  /**
   * Max contacts to return (default 50, max 100)
   */
  limit?: number;

  /**
   * Offset for pagination
   */
  offset?: number;

  /**
   * Search query (searches name, phone, email)
   */
  search?: string;

  /**
   * Filter by contact list ID
   */
  listId?: string;
}

/**
 * Response from listing contacts
 */
export interface ContactListResponse {
  contacts: Contact[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * A contact list for organizing contacts
 */
export interface ContactList {
  /**
   * Unique list identifier
   */
  id: string;

  /**
   * List name
   */
  name: string;

  /**
   * List description
   */
  description?: string | null;

  /**
   * Number of contacts in the list
   */
  contactCount: number;

  /**
   * When the list was created
   */
  createdAt: string;

  /**
   * When the list was last updated
   */
  updatedAt?: string;

  /**
   * Contacts in the list (when fetching a single list with members)
   */
  contacts?: Array<{
    id: string;
    phoneNumber: string;
    name?: string | null;
    email?: string | null;
  }>;

  /**
   * Total contacts in the list (for pagination)
   */
  contactsTotal?: number;
}

/**
 * Request to create a contact list
 */
export interface CreateContactListRequest {
  /**
   * List name
   */
  name: string;

  /**
   * List description
   */
  description?: string;
}

/**
 * Request to update a contact list
 */
export interface UpdateContactListRequest {
  /**
   * List name
   */
  name?: string;

  /**
   * List description
   */
  description?: string;
}

/**
 * Response from listing contact lists
 */
export interface ContactListsResponse {
  lists: ContactList[];
}

export interface ImportContactItem {
  phone: string;
  name?: string;
  email?: string;
  optedInAt?: string;
}

export interface ImportContactsRequest {
  contacts: ImportContactItem[];
  listId?: string;
  optedInAt?: string;
}

export interface ImportContactsError {
  index: number;
  phone: string;
  error: string;
}

export interface ImportContactsResponse {
  imported: number;
  skippedDuplicates: number;
  errors: ImportContactsError[];
  totalErrors: number;
}

// ============================================================================
// Enterprise
// ============================================================================

export interface EnterpriseAccount {
  id: string;
  maxWorkspaces: number;
  workspaceCount: number;
  workspaces: EnterpriseWorkspaceSummary[];
  metadata: Record<string, unknown>;
}

export interface EnterpriseWorkspaceSummary {
  id: string;
  name: string;
  slug: string;
  verificationStatus: string | null;
  verificationType: string | null;
  tollFreeNumber: string | null;
  creditBalance: number;
}

export interface EnterpriseWorkspace {
  id: string;
  name: string;
  slug: string;
  verificationStatus: string | null;
  verificationType: string | null;
  tollFreeNumber: string | null;
  creditBalance: number;
  keyCount: number;
  messages30d: number;
  delivered30d: number;
  failed30d: number;
  createdAt: string;
}

export interface EnterpriseWorkspaceDetail {
  id: string;
  name: string;
  slug: string;
  verificationStatus: string | null;
  tollFreeNumber: string | null;
  businessName: string | null;
  creditBalance: number;
  keys: Array<{
    id: string;
    name: string;
    keyPrefix: string;
    createdAt: string;
    lastUsedAt: string | null;
  }>;
  messages30d: number;
  delivered30d: number;
  failed30d: number;
  deliveryRate: number;
}

export interface CreateWorkspaceOptions {
  name: string;
  description?: string;
}

export interface ProvisionWorkspaceOptions {
  name: string;
  sourceWorkspaceId?: string;
  inheritWithNewNumber?: boolean;
  verification?: {
    businessName: string;
    website: string;
    address: {
      street: string;
      city: string;
      state: string;
      zip: string;
      country?: string;
    };
    contact: {
      firstName: string;
      lastName: string;
      email: string;
      phone: string;
    };
    brn?: string;
    brnType?: string;
    brnCountry?: string;
    useCase: string;
    useCaseSummary: string;
    sampleMessages: string;
    optInWorkflow: string;
    optInImageUrls?: string;
    monthlyVolume?: string;
  };
  creditAmount?: number;
  creditSourceWorkspaceId?: string;
  keyName?: string;
  keyType?: "test" | "live";
  webhookUrl?: string;
  generateOptInPage?: boolean;
  generateBusinessPage?: boolean;
}

export interface ProvisionWorkspaceResult {
  workspace: {
    id: string;
    name: string;
    slug: string;
  };
  verification?: {
    id: string;
    status: string;
    type: string;
    tollFreeNumber: string | null;
    inherited?: boolean;
    newNumber?: boolean;
  };
  credits?: {
    balance: number;
    transferred?: number;
  };
  key?: {
    id: string;
    name: string;
    key: string;
    keyPrefix: string;
    type: string;
  };
  optInPage?: {
    url: string;
    slug: string;
    pageId: string;
  };
  legalPages?: {
    privacyUrl?: string;
    termsUrl?: string;
  };
  webhook?: {
    id: string;
    url: string;
  };
  apiBaseUrl?: string;
  dashboardUrl?: string;
}

export interface TransferCreditsOptions {
  sourceWorkspaceId: string;
  amount: number;
}

export interface TransferCreditsResult {
  success: boolean;
  sourceBalance: number;
  targetBalance: number;
}

export interface CreateKeyOptions {
  name?: string;
  type?: "live" | "test";
}

export interface CreatedApiKey {
  id: string;
  name: string;
  key: string;
  keyPrefix: string;
  createdAt: string;
}

export interface WorkspaceCredits {
  balance: number;
  lifetimeCredits: number;
}

export interface EnterpriseWebhook {
  url: string;
}

export interface EnterpriseWebhookTestResult {
  success: boolean;
  statusCode?: number;
  statusText?: string;
  error?: string;
}

export interface AnalyticsOverview {
  totalMessages: number;
  deliveredMessages: number;
  failedMessages: number;
  deliveryRate: number;
  totalCreditsUsed: number;
  activeWorkspaces: number;
}

export interface MessageAnalyticsDataPoint {
  date: string;
  sent: number;
  delivered: number;
  failed: number;
}

export interface MessageAnalytics {
  period: string;
  data: MessageAnalyticsDataPoint[];
}

export interface DeliveryAnalyticsItem {
  workspaceId: string;
  name: string;
  sent: number;
  delivered: number;
  failed: number;
  rate: number;
}

export interface CreditAnalyticsDataPoint {
  date: string;
  used: number;
  transferred: number;
  purchased: number;
}

export interface CreditAnalytics {
  period: string;
  data: CreditAnalyticsDataPoint[];
}

export type AnalyticsPeriod = "7d" | "30d" | "90d";

export interface OptInPage {
  id: string;
  slug: string;
  url: string;
  businessName: string;
  useCase: string | null;
  isActive: boolean;
  viewCount: number;
  logoUrl: string | null;
  headerColor: string | null;
  buttonColor: string | null;
  customHeadline: string | null;
  createdAt: string;
}

export interface CreateOptInPageOptions {
  businessName: string;
  useCase?: string;
  useCaseSummary?: string;
  sampleMessages?: string;
}

export interface CreateOptInPageResult {
  id: string;
  slug: string;
  url: string;
  businessName: string;
}

export interface UpdateOptInPageOptions {
  logoUrl?: string;
  headerColor?: string;
  buttonColor?: string;
  customHeadline?: string;
  customBenefits?: string[];
}

export interface WorkspaceWebhook {
  id: string;
  url: string;
  events: string[];
  isActive: boolean;
  createdAt: string;
}

export interface SetWorkspaceWebhookOptions {
  url: string;
  events?: string[];
  description?: string;
}

export interface SetWorkspaceWebhookResult {
  id: string;
  url: string;
  events: string[];
  secret?: string;
  created?: boolean;
  updated?: boolean;
}

export interface SuspendWorkspaceOptions {
  reason?: string;
}

export interface SuspendWorkspaceResult {
  id: string;
  status: string;
  suspendedAt: string;
}

export interface ResumeWorkspaceResult {
  id: string;
  status: string;
}

export interface AutoTopUpSettings {
  enabled: boolean;
  threshold: number;
  amount: number;
  sourceWorkspaceId: string | null;
}

export interface UpdateAutoTopUpOptions {
  enabled: boolean;
  threshold: number;
  amount: number;
  sourceWorkspaceId?: string | null;
}

export interface BillingBreakdownOptions {
  period?: AnalyticsPeriod;
  page?: number;
  limit?: number;
}

export interface WorkspaceBillingItem {
  id: string;
  name: string;
  creditsUsed: number;
  creditsPurchased: number;
  creditsTransferredIn: number;
  creditsTransferredOut: number;
  messagesSent: number;
  messagesDelivered: number;
  workspaceFee: number;
  allocatedPlatformFee: number;
  totalCost: number;
}

export interface BillingBreakdown {
  period: string;
  summary: {
    platformFee: number;
    totalWorkspaceFees: number;
    totalCreditsUsed: number;
    totalCost: number;
  };
  workspaces: WorkspaceBillingItem[];
}

export interface BulkProvisionWorkspace {
  name: string;
  sourceWorkspaceId?: string;
  creditAmount?: number;
  creditSourceWorkspaceId?: string;
}

export interface BulkProvisionResultItem {
  name: string;
  status: "success" | "partial" | "failed";
  workspaceId?: string;
  slug?: string;
  warning?: string;
  error?: string;
}

export interface BulkProvisionResult {
  results: BulkProvisionResultItem[];
  summary: {
    total: number;
    succeeded: number;
    failed: number;
  };
}

export interface DnsRecord {
  type: string;
  name: string;
  value: string;
}

export interface SetCustomDomainResult {
  domain: string;
  verified: boolean;
  dnsInstructions: {
    cname: DnsRecord;
    txt: DnsRecord;
  };
}

export interface SendInvitationOptions {
  email: string;
  role: "admin" | "member" | "viewer";
}

export interface Invitation {
  id: string;
  email: string;
  role: string;
  status: string;
  expiresAt: string;
}

export interface QuotaSettings {
  monthlyMessageQuota: number | null;
  messagesThisMonth: number;
  quotaResetAt: string | null;
}

export interface UpdateQuotaOptions {
  monthlyMessageQuota: number | null;
}

export interface GenerateBusinessPageOptions {
  businessName: string;
  useCase?: string;
  useCaseSummary?: string;
  contactEmail?: string;
  contactPhone?: string;
  businessAddress?: string;
  socialUrl?: string;
}

export interface GenerateBusinessPageResponse {
  slug: string;
  url: string;
  pageId: string;
}

export interface UploadVerificationDocumentOptions {
  workspaceId?: string;
  verificationId?: string;
  filename?: string;
}

export interface UploadVerificationDocumentResponse {
  url: string;
  id: string;
}
