/**
 * Messages Resource
 * @packageDocumentation
 */

import type { HttpClient } from "../utils/http";
import type {
  SendMessageRequest,
  Message,
  ListMessagesOptions,
  MessageListResponse,
  ScheduleMessageRequest,
  ScheduledMessage,
  ListScheduledMessagesOptions,
  ScheduledMessageListResponse,
  CancelledMessageResponse,
  BatchMessageRequest,
  BatchMessageResponse,
  ListBatchesOptions,
  BatchListResponse,
} from "../types";
import {
  validatePhoneNumber,
  validateMessageText,
  validateSenderId,
  validateLimit,
  validateMessageId,
} from "../utils/validation";

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
export class MessagesResource {
  private readonly http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

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
  async send(request: SendMessageRequest): Promise<Message> {
    // Validate request
    validatePhoneNumber(request.to);
    validateMessageText(request.text);
    if (request.from) {
      validateSenderId(request.from);
    }

    // Make API request
    const message = await this.http.request<Message>({
      method: "POST",
      path: "/v1/messages",
      body: {
        to: request.to,
        text: request.text,
        ...(request.from && { from: request.from }),
      },
    });

    return message;
  }

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
  async list(options: ListMessagesOptions = {}): Promise<MessageListResponse> {
    // Validate options
    validateLimit(options.limit);

    // Make API request
    const response = await this.http.request<MessageListResponse>({
      method: "GET",
      path: "/v1/messages",
      query: {
        limit: options.limit,
        offset: options.offset,
        status: options.status,
      },
    });

    return response;
  }

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
  async get(id: string): Promise<Message> {
    // Validate ID
    validateMessageId(id);

    // Make API request
    const message = await this.http.request<Message>({
      method: "GET",
      path: `/v1/messages/${encodeURIComponent(id)}`,
    });

    return message;
  }

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
  async *listAll(options: ListMessagesOptions = {}): AsyncGenerator<Message> {
    const batchSize = Math.min(options.limit || 100, 100);
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const response = await this.http.request<MessageListResponse>({
        method: "GET",
        path: "/v1/messages",
        query: {
          limit: batchSize,
          offset,
        },
      });

      for (const message of response.data) {
        yield message;
      }

      // Check if there are more messages
      if (response.data.length < batchSize) {
        hasMore = false;
      } else {
        offset += batchSize;
      }
    }
  }

  // ==========================================================================
  // Scheduled Messages
  // ==========================================================================

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
  async schedule(request: ScheduleMessageRequest): Promise<ScheduledMessage> {
    // Validate request
    validatePhoneNumber(request.to);
    validateMessageText(request.text);
    if (request.from) {
      validateSenderId(request.from);
    }

    // Validate scheduledAt is in the future
    const scheduledTime = new Date(request.scheduledAt);
    const now = new Date();
    const oneMinuteFromNow = new Date(now.getTime() + 60 * 1000);

    if (isNaN(scheduledTime.getTime())) {
      throw new Error("Invalid scheduledAt format. Use ISO 8601 format.");
    }

    if (scheduledTime <= oneMinuteFromNow) {
      throw new Error("scheduledAt must be at least 1 minute in the future.");
    }

    const scheduled = await this.http.request<ScheduledMessage>({
      method: "POST",
      path: "/v1/messages/schedule",
      body: {
        to: request.to,
        text: request.text,
        scheduledAt: request.scheduledAt,
        ...(request.from && { from: request.from }),
      },
    });

    return scheduled;
  }

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
  async listScheduled(
    options: ListScheduledMessagesOptions = {},
  ): Promise<ScheduledMessageListResponse> {
    validateLimit(options.limit);

    const response = await this.http.request<ScheduledMessageListResponse>({
      method: "GET",
      path: "/v1/messages/scheduled",
      query: {
        limit: options.limit,
        offset: options.offset,
        status: options.status,
      },
    });

    return response;
  }

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
  async getScheduled(id: string): Promise<ScheduledMessage> {
    validateMessageId(id);

    const scheduled = await this.http.request<ScheduledMessage>({
      method: "GET",
      path: `/v1/messages/scheduled/${encodeURIComponent(id)}`,
    });

    return scheduled;
  }

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
  async cancelScheduled(id: string): Promise<CancelledMessageResponse> {
    validateMessageId(id);

    const result = await this.http.request<CancelledMessageResponse>({
      method: "DELETE",
      path: `/v1/messages/scheduled/${encodeURIComponent(id)}`,
    });

    return result;
  }

  // ==========================================================================
  // Batch Messages
  // ==========================================================================

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
  async sendBatch(request: BatchMessageRequest): Promise<BatchMessageResponse> {
    // Validate all messages
    if (
      !request.messages ||
      !Array.isArray(request.messages) ||
      request.messages.length === 0
    ) {
      throw new Error("messages must be a non-empty array");
    }

    if (request.messages.length > 1000) {
      throw new Error("Maximum 1000 messages per batch");
    }

    for (const msg of request.messages) {
      validatePhoneNumber(msg.to);
      validateMessageText(msg.text);
    }

    if (request.from) {
      validateSenderId(request.from);
    }

    const batch = await this.http.request<BatchMessageResponse>({
      method: "POST",
      path: "/v1/messages/batch",
      body: {
        messages: request.messages,
        ...(request.from && { from: request.from }),
      },
    });

    return batch;
  }

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
  async getBatch(batchId: string): Promise<BatchMessageResponse> {
    if (!batchId || !batchId.startsWith("batch_")) {
      throw new Error("Invalid batch ID format");
    }

    const batch = await this.http.request<BatchMessageResponse>({
      method: "GET",
      path: `/v1/messages/batch/${encodeURIComponent(batchId)}`,
    });

    return batch;
  }

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
  async listBatches(
    options: ListBatchesOptions = {},
  ): Promise<BatchListResponse> {
    validateLimit(options.limit);

    const response = await this.http.request<BatchListResponse>({
      method: "GET",
      path: "/v1/messages/batches",
      query: {
        limit: options.limit,
        offset: options.offset,
        status: options.status,
      },
    });

    return response;
  }
}
