/**
 * Sendly Node.js SDK Types
 * @packageDocumentation
 */
/**
 * Configuration options for the Sendly client
 */
interface SendlyConfig {
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
/**
 * Request payload for sending an SMS message
 */
interface SendMessageRequest {
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
type MessageStatus = "queued" | "sending" | "sent" | "delivered" | "failed";
/**
 * A sent or received SMS message
 */
interface Message {
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
interface ListMessagesOptions {
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
interface MessageListResponse {
    /**
     * Array of messages
     */
    data: Message[];
    /**
     * Total count of messages returned
     */
    count: number;
}
/**
 * Request payload for scheduling an SMS message
 */
interface ScheduleMessageRequest {
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
type ScheduledMessageStatus = "scheduled" | "sent" | "cancelled" | "failed";
/**
 * A scheduled SMS message
 */
interface ScheduledMessage {
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
interface ListScheduledMessagesOptions {
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
interface ScheduledMessageListResponse {
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
interface CancelledMessageResponse {
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
/**
 * A single message in a batch request
 */
interface BatchMessageItem {
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
interface BatchMessageRequest {
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
interface BatchMessageResult {
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
type BatchStatus = "processing" | "completed" | "partial_failure";
/**
 * Response from sending batch messages
 */
interface BatchMessageResponse {
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
interface ListBatchesOptions {
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
interface BatchListResponse {
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
 * Error codes returned by the Sendly API
 */
type SendlyErrorCode = "invalid_request" | "unauthorized" | "invalid_auth_format" | "invalid_key_format" | "invalid_api_key" | "key_revoked" | "key_expired" | "insufficient_permissions" | "insufficient_credits" | "unsupported_destination" | "not_found" | "rate_limit_exceeded" | "internal_error";
/**
 * Error response from the Sendly API
 */
interface ApiErrorResponse {
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
/**
 * HTTP request options
 */
interface RequestOptions {
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
interface RateLimitInfo {
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
/**
 * Pricing tier for SMS destinations
 */
type PricingTier = "domestic" | "tier1" | "tier2" | "tier3";
/**
 * Credits required per SMS segment by tier
 */
declare const CREDITS_PER_SMS: Record<PricingTier, number>;
/**
 * Supported country codes organized by pricing tier
 */
declare const SUPPORTED_COUNTRIES: Record<PricingTier, string[]>;
/**
 * All supported country codes
 */
declare const ALL_SUPPORTED_COUNTRIES: string[];
/**
 * Test phone numbers for sandbox mode
 */
declare const SANDBOX_TEST_NUMBERS: {
    /** Always succeeds instantly */
    readonly SUCCESS: "+15550001234";
    /** Succeeds after 10 second delay */
    readonly DELAYED: "+15550001010";
    /** Fails with invalid_number error */
    readonly INVALID: "+15550001001";
    /** Fails with carrier_rejected error after 2 seconds */
    readonly REJECTED: "+15550001002";
    /** Fails with rate_limit_exceeded error */
    readonly RATE_LIMITED: "+15550001003";
};

/**
 * HTTP Client Utility
 * @packageDocumentation
 */

interface HttpClientConfig {
    apiKey: string;
    baseUrl: string;
    timeout: number;
    maxRetries: number;
}
/**
 * HTTP client for making API requests
 */
declare class HttpClient {
    private readonly config;
    private rateLimitInfo?;
    constructor(config: Partial<HttpClientConfig> & {
        apiKey: string;
    });
    /**
     * Validate API key format
     */
    private isValidApiKey;
    /**
     * Get current rate limit info
     */
    getRateLimitInfo(): RateLimitInfo | undefined;
    /**
     * Check if we're using a test key
     */
    isTestMode(): boolean;
    /**
     * Make an HTTP request to the API
     */
    request<T>(options: RequestOptions): Promise<T>;
    /**
     * Execute the HTTP request
     */
    private executeRequest;
    /**
     * Parse the response body
     */
    private parseResponse;
    /**
     * Build the full URL with query parameters
     */
    private buildUrl;
    /**
     * Build request headers
     */
    private buildHeaders;
    /**
     * Update rate limit info from response headers
     */
    private updateRateLimitInfo;
    /**
     * Calculate exponential backoff time
     */
    private calculateBackoff;
    /**
     * Sleep for a given number of milliseconds
     */
    private sleep;
}

/**
 * Messages Resource
 * @packageDocumentation
 */

/**
 * Messages API resource
 *
 * @example
 * ```typescript
 * // Send a message
 * const message = await sendly.messages.send({
 *   to: '+15551234567',
 *   text: 'Hello from Sendly!'
 * });
 *
 * // List recent messages
 * const { data: messages } = await sendly.messages.list({ limit: 10 });
 *
 * // Get a specific message
 * const message = await sendly.messages.get('msg_xxx');
 * ```
 */
declare class MessagesResource {
    private readonly http;
    constructor(http: HttpClient);
    /**
     * Send an SMS message
     *
     * @param request - Message details
     * @returns The created message
     *
     * @example
     * ```typescript
     * const message = await sendly.messages.send({
     *   to: '+15551234567',
     *   text: 'Your verification code is: 123456'
     * });
     *
     * console.log(message.id);        // msg_xxx
     * console.log(message.status);    // 'queued'
     * console.log(message.segments);  // 1
     * ```
     *
     * @throws {ValidationError} If the request is invalid
     * @throws {InsufficientCreditsError} If credit balance is too low
     * @throws {AuthenticationError} If the API key is invalid
     * @throws {RateLimitError} If rate limit is exceeded
     */
    send(request: SendMessageRequest): Promise<Message>;
    /**
     * List sent messages
     *
     * @param options - List options
     * @returns Paginated list of messages
     *
     * @example
     * ```typescript
     * // Get last 50 messages (default)
     * const { data: messages, count } = await sendly.messages.list();
     *
     * // Get last 10 messages
     * const { data: messages } = await sendly.messages.list({ limit: 10 });
     *
     * // Iterate through messages
     * for (const msg of messages) {
     *   console.log(`${msg.to}: ${msg.status}`);
     * }
     * ```
     *
     * @throws {AuthenticationError} If the API key is invalid
     * @throws {RateLimitError} If rate limit is exceeded
     */
    list(options?: ListMessagesOptions): Promise<MessageListResponse>;
    /**
     * Get a specific message by ID
     *
     * @param id - Message ID
     * @returns The message details
     *
     * @example
     * ```typescript
     * const message = await sendly.messages.get('msg_xxx');
     *
     * console.log(message.status);      // 'delivered'
     * console.log(message.deliveredAt); // '2025-01-15T10:30:00Z'
     * ```
     *
     * @throws {NotFoundError} If the message doesn't exist
     * @throws {AuthenticationError} If the API key is invalid
     * @throws {RateLimitError} If rate limit is exceeded
     */
    get(id: string): Promise<Message>;
    /**
     * Iterate through all messages with automatic pagination
     *
     * @param options - List options (limit is used as batch size)
     * @yields Message objects one at a time
     *
     * @example
     * ```typescript
     * // Iterate through all messages
     * for await (const message of sendly.messages.listAll()) {
     *   console.log(`${message.id}: ${message.status}`);
     * }
     *
     * // With custom batch size
     * for await (const message of sendly.messages.listAll({ limit: 100 })) {
     *   console.log(message.to);
     * }
     * ```
     *
     * @throws {AuthenticationError} If the API key is invalid
     * @throws {RateLimitError} If rate limit is exceeded
     */
    listAll(options?: ListMessagesOptions): AsyncGenerator<Message>;
    /**
     * Schedule an SMS message for future delivery
     *
     * @param request - Schedule request details
     * @returns The scheduled message
     *
     * @example
     * ```typescript
     * const scheduled = await sendly.messages.schedule({
     *   to: '+15551234567',
     *   text: 'Your appointment reminder!',
     *   scheduledAt: '2025-01-20T10:00:00Z'
     * });
     *
     * console.log(scheduled.id);           // msg_xxx
     * console.log(scheduled.status);       // 'scheduled'
     * console.log(scheduled.scheduledAt);  // '2025-01-20T10:00:00Z'
     * ```
     *
     * @throws {ValidationError} If the request is invalid
     * @throws {InsufficientCreditsError} If credit balance is too low
     * @throws {AuthenticationError} If the API key is invalid
     */
    schedule(request: ScheduleMessageRequest): Promise<ScheduledMessage>;
    /**
     * List scheduled messages
     *
     * @param options - List options
     * @returns Paginated list of scheduled messages
     *
     * @example
     * ```typescript
     * const { data: scheduled } = await sendly.messages.listScheduled();
     *
     * for (const msg of scheduled) {
     *   console.log(`${msg.to}: ${msg.scheduledAt}`);
     * }
     * ```
     */
    listScheduled(options?: ListScheduledMessagesOptions): Promise<ScheduledMessageListResponse>;
    /**
     * Get a specific scheduled message by ID
     *
     * @param id - Message ID
     * @returns The scheduled message details
     *
     * @example
     * ```typescript
     * const scheduled = await sendly.messages.getScheduled('msg_xxx');
     * console.log(scheduled.scheduledAt);
     * ```
     */
    getScheduled(id: string): Promise<ScheduledMessage>;
    /**
     * Cancel a scheduled message
     *
     * @param id - Message ID to cancel
     * @returns Cancellation confirmation with refunded credits
     *
     * @example
     * ```typescript
     * const result = await sendly.messages.cancelScheduled('msg_xxx');
     *
     * console.log(result.status);          // 'cancelled'
     * console.log(result.creditsRefunded); // 1
     * ```
     *
     * @throws {NotFoundError} If the message doesn't exist
     * @throws {ValidationError} If the message is not cancellable
     */
    cancelScheduled(id: string): Promise<CancelledMessageResponse>;
    /**
     * Send multiple SMS messages in a single batch
     *
     * @param request - Batch request with array of messages
     * @returns Batch response with individual message results
     *
     * @example
     * ```typescript
     * const batch = await sendly.messages.sendBatch({
     *   messages: [
     *     { to: '+15551234567', text: 'Hello User 1!' },
     *     { to: '+15559876543', text: 'Hello User 2!' }
     *   ]
     * });
     *
     * console.log(batch.batchId);     // batch_xxx
     * console.log(batch.queued);      // 2
     * console.log(batch.creditsUsed); // 2
     * ```
     *
     * @throws {ValidationError} If any message is invalid
     * @throws {InsufficientCreditsError} If credit balance is too low
     */
    sendBatch(request: BatchMessageRequest): Promise<BatchMessageResponse>;
    /**
     * Get batch status and results
     *
     * @param batchId - Batch ID
     * @returns Batch details with message results
     *
     * @example
     * ```typescript
     * const batch = await sendly.messages.getBatch('batch_xxx');
     *
     * console.log(batch.status);  // 'completed'
     * console.log(batch.sent);    // 2
     * console.log(batch.failed);  // 0
     * ```
     */
    getBatch(batchId: string): Promise<BatchMessageResponse>;
    /**
     * List message batches
     *
     * @param options - List options
     * @returns Paginated list of batches
     *
     * @example
     * ```typescript
     * const { data: batches } = await sendly.messages.listBatches();
     *
     * for (const batch of batches) {
     *   console.log(`${batch.batchId}: ${batch.status}`);
     * }
     * ```
     */
    listBatches(options?: ListBatchesOptions): Promise<BatchListResponse>;
}

/**
 * Sendly Client
 * @packageDocumentation
 */

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
declare class Sendly {
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
    readonly messages: MessagesResource;
    private readonly http;
    private readonly config;
    /**
     * Create a new Sendly client
     *
     * @param configOrApiKey - API key string or configuration object
     */
    constructor(configOrApiKey: string | SendlyConfig);
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
    isTestMode(): boolean;
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
    getRateLimitInfo(): RateLimitInfo | undefined;
    /**
     * Get the configured base URL
     */
    getBaseUrl(): string;
}

/**
 * Sendly SDK Error Classes
 * @packageDocumentation
 */

/**
 * Base error class for all Sendly SDK errors
 */
declare class SendlyError extends Error {
    /**
     * Machine-readable error code
     */
    readonly code: SendlyErrorCode;
    /**
     * HTTP status code (if applicable)
     */
    readonly statusCode?: number;
    /**
     * Raw API response (if applicable)
     */
    readonly response?: ApiErrorResponse;
    constructor(message: string, code: SendlyErrorCode, statusCode?: number, response?: ApiErrorResponse);
    /**
     * Create a SendlyError from an API response
     */
    static fromResponse(statusCode: number, response: ApiErrorResponse): SendlyError;
}
/**
 * Thrown when authentication fails
 */
declare class AuthenticationError extends SendlyError {
    constructor(message: string, code?: SendlyErrorCode, statusCode?: number, response?: ApiErrorResponse);
}
/**
 * Thrown when rate limit is exceeded
 */
declare class RateLimitError extends SendlyError {
    /**
     * Seconds to wait before retrying
     */
    readonly retryAfter: number;
    constructor(message: string, retryAfter: number, statusCode?: number, response?: ApiErrorResponse);
}
/**
 * Thrown when credit balance is insufficient
 */
declare class InsufficientCreditsError extends SendlyError {
    /**
     * Credits needed for the operation
     */
    readonly creditsNeeded: number;
    /**
     * Current credit balance
     */
    readonly currentBalance: number;
    constructor(message: string, creditsNeeded: number, currentBalance: number, statusCode?: number, response?: ApiErrorResponse);
}
/**
 * Thrown when request validation fails
 */
declare class ValidationError extends SendlyError {
    constructor(message: string, code?: SendlyErrorCode, statusCode?: number, response?: ApiErrorResponse);
}
/**
 * Thrown when a resource is not found
 */
declare class NotFoundError extends SendlyError {
    constructor(message: string, statusCode?: number, response?: ApiErrorResponse);
}
/**
 * Thrown when a network or connection error occurs
 */
declare class NetworkError extends SendlyError {
    constructor(message: string, cause?: Error);
}
/**
 * Thrown when a request times out
 */
declare class TimeoutError extends SendlyError {
    constructor(message?: string);
}

/**
 * Input Validation Utilities
 * @packageDocumentation
 */
/**
 * Validate phone number format (E.164)
 */
declare function validatePhoneNumber(phone: string): void;
/**
 * Validate message text
 */
declare function validateMessageText(text: string): void;
/**
 * Validate sender ID
 */
declare function validateSenderId(from: string): void;
/**
 * Get country code from phone number
 */
declare function getCountryFromPhone(phone: string): string | null;
/**
 * Check if a country is supported
 */
declare function isCountrySupported(countryCode: string): boolean;
/**
 * Calculate number of SMS segments for a message
 */
declare function calculateSegments(text: string): number;

/**
 * Webhook utilities for Sendly
 * Provides signature verification and event parsing
 * @packageDocumentation
 */
/**
 * Webhook event types
 */
type WebhookEventType = "message.queued" | "message.sent" | "message.delivered" | "message.failed" | "message.undelivered";
/**
 * Message status in webhook events
 */
type WebhookMessageStatus = "queued" | "sent" | "delivered" | "failed" | "undelivered";
/**
 * Webhook message data payload
 */
interface WebhookMessageData {
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
interface WebhookEvent {
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
declare class WebhookSignatureError extends Error {
    constructor(message?: string);
}
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
declare function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean;
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
declare function parseWebhookEvent(payload: string, signature: string, secret: string): WebhookEvent;
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
declare function generateWebhookSignature(payload: string, secret: string): string;
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
declare class Webhooks {
    private readonly secret;
    /**
     * Create a new Webhooks instance
     * @param secret - Your webhook secret from the Sendly dashboard
     */
    constructor(secret: string);
    /**
     * Verify a webhook signature
     * @param payload - Raw request body
     * @param signature - X-Sendly-Signature header
     */
    verify(payload: string, signature: string): boolean;
    /**
     * Parse and verify a webhook event
     * @param payload - Raw request body
     * @param signature - X-Sendly-Signature header
     */
    parse(payload: string, signature: string): WebhookEvent;
    /**
     * Generate a signature for testing
     * @param payload - Payload to sign
     */
    sign(payload: string): string;
}

export { ALL_SUPPORTED_COUNTRIES, type ApiErrorResponse, AuthenticationError, CREDITS_PER_SMS, InsufficientCreditsError, type ListMessagesOptions, type Message, type MessageListResponse, type MessageStatus, NetworkError, NotFoundError, type PricingTier, RateLimitError, type RateLimitInfo, SANDBOX_TEST_NUMBERS, SUPPORTED_COUNTRIES, type SendMessageRequest, Sendly, type SendlyConfig, SendlyError, type SendlyErrorCode, TimeoutError, ValidationError, type WebhookEvent, type WebhookEventType, type WebhookMessageData, type WebhookMessageStatus, WebhookSignatureError, Webhooks, calculateSegments, Sendly as default, generateWebhookSignature, getCountryFromPhone, isCountrySupported, parseWebhookEvent, validateMessageText, validatePhoneNumber, validateSenderId, verifyWebhookSignature };
