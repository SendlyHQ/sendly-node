/**
 * Messages Resource
 * @packageDocumentation
 */

import type { HttpClient } from "../utils/http";
import type {
  SendMessageRequest,
  SendWhatsAppMessageRequest,
  WhatsAppMessage,
  SendRcsMessageRequest,
  RcsMessage,
  SendGroupMessageRequest,
  GroupMessageResponse,
  GroupRecipient,
  EnhanceMessageRequest,
  EnhanceMessageResponse,
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
  BatchSendResponse,
  BatchSummary,
  BatchPreviewResponse,
  ListBatchesOptions,
  BatchListResponse,
  IdempotentRequestOptions,
} from "../types";
import { MAX_BATCH_MESSAGES } from "../types";
import {
  validatePhoneNumber,
  validateMessageText,
  validateSenderId,
  validateLimit,
  validateMessageId,
} from "../utils/validation";

type WireMessage = Message & {
  message_format?: Message["messageFormat"];
  media_urls?: string[];
  batch_id?: string | null;
};

function toMessage(raw: WireMessage): Message {
  return {
    ...raw,
    ...(raw.messageFormat === undefined &&
      raw.message_format !== undefined && { messageFormat: raw.message_format }),
    ...(raw.mediaUrls === undefined &&
      raw.media_urls !== undefined && { mediaUrls: raw.media_urls }),
    ...(raw.batchId === undefined &&
      raw.batch_id !== undefined && { batchId: raw.batch_id }),
  };
}

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
   * Send a WhatsApp message
   *
   * Requires the `sms:send` scope (not `whatsapp:write`), a live API key
   * and a `from` number with an active WhatsApp connection (see
   * `sendly.whatsapp.signup`). WhatsApp is enabled per person (the user
   * who owns the API key, not the workspace); while it is off the API
   * responds 403 `whatsapp_not_enabled`. Free-form `text` and media
   * only deliver inside an open 24-hour customer-service window — outside
   * it, send an approved `template` instead (check with
   * `sendly.whatsapp.window()`).
   *
   * @param request - WhatsApp message details (`channel: 'whatsapp'`)
   * @returns The created WhatsApp message
   *
   * @example
   * ```typescript
   * // Free-form reply inside an open 24h window
   * const message = await sendly.messages.send({
   *   channel: 'whatsapp',
   *   to: '+15551234567',
   *   from: '+15559876543',
   *   text: 'Your table is ready!'
   * });
   *
   * // Template send — works regardless of the window
   * const message = await sendly.messages.send({
   *   channel: 'whatsapp',
   *   to: '+15551234567',
   *   from: '+15559876543',
   *   template: {
   *     name: 'order_shipped',
   *     language: 'en_US',
   *     variables: { '1': 'Acme Inc', '2': '#4821' }
   *   }
   * });
   *
   * console.log(message.whatsapp.kind);  // 'template'
   * console.log(message.creditsUsed);    // priced by country + category
   * ```
   *
   * @throws {ValidationError} If the request is invalid
   * @throws {InsufficientCreditsError} If credit balance is too low
   * @throws {AuthenticationError} If the API key is invalid
   * @throws {RateLimitError} If rate limit is exceeded
   * @throws {SendlyError} `whatsapp_send_failed`: 422 when WhatsApp refused the message, which is final and not retried (the response is cached under the idempotency key and replayed for 24 hours); 502 when the message provably never reached the carrier, so it was not sent and is safe to send again. A 502 is never cached, so the SDK retries it like any 5xx under the same idempotency key. Either way the message wasn't charged. No send returns 503 `whatsapp_unavailable`.
   * @throws {SendlyError} `whatsapp_send_unconfirmed` (409) when the outcome is unknown: the message was marked failed and refunded, but it may still be delivered, so check before sending it again (it could arrive twice). It is cached under the idempotency key and not retried automatically.
   * @throws {SendlyError} `whatsapp_not_enabled` (403) when WhatsApp isn't enabled for the key's owner, or `whatsapp_requires_live_key` (403) with a test key
   */
  async send(
    request: SendWhatsAppMessageRequest,
    options?: IdempotentRequestOptions,
  ): Promise<WhatsAppMessage>;

  /**
   * Send an RCS message
   *
   * Requires a live API key and a sendable RCS agent on your workspace
   * (see `sendly.rcs.agents`). Provide exactly one of `text` (optionally
   * with `suggestions` chips) or `card` (a rich card). When the recipient
   * doesn't support RCS, text sends fall back to SMS automatically —
   * check `channel` (or `fellBackTo`) on the response to tell which leg
   * delivered. Rich cards have no SMS form and respond 422 for non-RCS
   * recipients.
   *
   * @param request - RCS message details (`channel: 'rcs'`)
   * @returns The created message — sent over RCS, or as SMS when it fell back
   *
   * @example
   * ```typescript
   * // Text with suggestion chips — falls back to SMS (chips dropped)
   * // when the recipient doesn't support RCS
   * const message = await sendly.messages.send({
   *   channel: 'rcs',
   *   to: '+15551234567',
   *   text: 'Your table is ready!',
   *   suggestions: [
   *     { reply: { text: 'On my way', postbackData: 'omw' } },
   *   ],
   * });
   *
   * if (message.channel === 'rcs') {
   *   console.log(message.rcs.agentName);  // delivered over RCS
   * } else {
   *   console.log(message.fellBackTo);     // 'sms'
   * }
   *
   * // Rich card — RCS-capable recipients only
   * const card = await sendly.messages.send({
   *   channel: 'rcs',
   *   to: '+15551234567',
   *   card: {
   *     title: 'Your order has shipped',
   *     description: 'Arriving Thursday',
   *     mediaUrl: 'https://example.com/package.jpg',
   *     suggestions: [
   *       { action: { text: 'Track it', postbackData: 'track', url: 'https://example.com/track' } },
   *     ],
   *   },
   * });
   * ```
   *
   * @throws {ValidationError} If the request is invalid
   * @throws {InsufficientCreditsError} If credit balance is too low
   * @throws {AuthenticationError} If the API key is invalid
   * @throws {RateLimitError} If rate limit is exceeded
   */
  async send(
    request: SendRcsMessageRequest,
    options?: IdempotentRequestOptions,
  ): Promise<RcsMessage>;

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
  async send(
    request: SendMessageRequest,
    options?: IdempotentRequestOptions,
  ): Promise<Message>;

  async send(
    request:
      | SendMessageRequest
      | SendWhatsAppMessageRequest
      | SendRcsMessageRequest,
    options?: IdempotentRequestOptions,
  ): Promise<Message | WhatsAppMessage | RcsMessage> {
    // Validate request
    validatePhoneNumber(request.to);

    if (request.channel === "rcs") {
      const hasText = typeof request.text === "string" && request.text.length > 0;
      const hasCard = !!request.card;
      if (hasText === hasCard) {
        throw new Error("Provide exactly one of 'text' or 'card'");
      }

      const message = await this.http.request<RcsMessage>({
        method: "POST",
        path: "/messages",
        idempotencyKey: options?.idempotencyKey,
        body: {
          channel: "rcs",
          to: request.to,
          ...(request.agentId && { agentId: request.agentId }),
          ...(hasText && { text: request.text }),
          ...(hasCard && { card: request.card }),
          ...(request.suggestions && { suggestions: request.suggestions }),
          ...(request.fallbackToSms !== undefined && {
            fallbackToSms: request.fallbackToSms,
          }),
          ...(request.metadata && { metadata: request.metadata }),
        },
      });

      return message;
    }

    if (request.channel === "whatsapp") {
      validatePhoneNumber(request.from);
      const hasMedia =
        Array.isArray(request.mediaUrls) && request.mediaUrls.length > 0;
      if (!request.text && !hasMedia && !request.template) {
        throw new Error("Provide 'text', 'mediaUrls', or 'template'");
      }

      const message = await this.http.request<WhatsAppMessage>({
        method: "POST",
        path: "/messages",
        idempotencyKey: options?.idempotencyKey,
        body: {
          channel: "whatsapp",
          to: request.to,
          from: request.from,
          ...(request.text !== undefined && { text: request.text }),
          ...(hasMedia && { mediaUrls: request.mediaUrls }),
          ...(request.template && { template: request.template }),
          ...(request.metadata && { metadata: request.metadata }),
        },
      });

      return message;
    }

    validateMessageText(request.text);
    if (request.from) {
      validateSenderId(request.from);
    }

    // Make API request
    const message = await this.http.request<WireMessage>({
      method: "POST",
      path: "/messages",
      idempotencyKey: options?.idempotencyKey,
      body: {
        to: request.to,
        text: request.text,
        ...(request.from && { from: request.from }),
        ...(request.messageType && { messageType: request.messageType }),
        ...(request.metadata && { metadata: request.metadata }),
        ...(request.mediaUrls && { mediaUrls: request.mediaUrls }),
      },
    });

    return toMessage(message);
  }

  /**
   * Send a group MMS to 2-8 recipients (US/Canada only)
   *
   * Creates a multi-party MMS conversation: every recipient sees the others,
   * and replies fan out to all participants. Group messaging is an A2P 10DLC
   * capability — the sending number must be an MMS-enabled, 10DLC-registered
   * number you own. Omit `from` to use your workspace's default sender.
   *
   * @param request - Group message details (2-8 recipients, text and/or media)
   * @returns The created group message, including a `group_message_id`
   *
   * @example
   * ```typescript
   * const group = await sendly.messages.sendGroup({
   *   to: ['+14155551234', '+14155555678'],
   *   text: 'Hey team - quick sync at noon?',
   * });
   *
   * console.log(group.id);                // msg_xxx
   * console.log(group.group_message_id);  // grp_xxx
   * ```
   *
   * @throws {ValidationError} If fewer than 2 / more than 8 recipients, or no body
   * @throws {InsufficientCreditsError} If credit balance is too low (billed per recipient)
   * @throws {AuthenticationError} If the API key is invalid
   */
  async sendGroup(
    request: SendGroupMessageRequest,
    options?: IdempotentRequestOptions,
  ): Promise<GroupMessageResponse> {
    if (!Array.isArray(request.to) || request.to.length < 2) {
      throw new Error("Group messaging requires at least 2 recipients in 'to'");
    }
    if (request.to.length > 8) {
      throw new Error("Group messaging supports at most 8 recipients");
    }
    for (const recipient of request.to) {
      validatePhoneNumber(recipient);
    }
    const hasMedia =
      Array.isArray(request.mediaUrls) && request.mediaUrls.length > 0;
    if (!request.text && !hasMedia) {
      throw new Error("Provide 'text' or 'mediaUrls'");
    }
    if (request.from) {
      validateSenderId(request.from);
    }

    const response = await this.http.request<
      Omit<GroupMessageResponse, "to"> & { to: Array<string | GroupRecipient> }
    >({
      method: "POST",
      path: "/messages/group",
      idempotencyKey: options?.idempotencyKey,
      body: {
        to: request.to,
        ...(request.text && { text: request.text }),
        ...(request.from && { from: request.from }),
        ...(hasMedia && { mediaUrls: request.mediaUrls }),
        ...(request.messageType && { messageType: request.messageType }),
      },
    });

    if (!Array.isArray(response.to)) {
      return response as GroupMessageResponse;
    }
    const recipients = response.to.filter(
      (r): r is GroupRecipient => typeof r === "object" && r !== null,
    );
    if (recipients.length === 0) {
      return response as GroupMessageResponse;
    }
    return {
      ...response,
      to: response.to.map((r) => (typeof r === "string" ? r : r.phoneNumber)),
      recipients: response.recipients ?? recipients,
    };
  }

  /**
   * AI-enhance a draft message for clarity, compliance, and send-readiness.
   *
   * Rewrites the supplied text into a single, polished SMS segment (≤160
   * chars) and returns a short explanation of what changed. Pass `messageType`
   * to steer the rewrite (e.g. "marketing" vs "transactional"); with no `text`
   * it generates a suitable message for that type instead. At least one of
   * `text` or `messageType` is required.
   *
   * If AI enhancement is unavailable for the account, the response falls back
   * to the original `text` with an empty `explanation`.
   *
   * @param request - The draft text and/or a message-type hint
   * @returns The enhanced text, an explanation, and the model used
   *
   * @example
   * ```typescript
   * const result = await sendly.messages.enhance({
   *   text: 'hey come check out our sale this weekend',
   *   messageType: 'marketing',
   * });
   *
   * console.log(result.enhanced);     // polished, ≤160-char rewrite
   * console.log(result.explanation);  // what changed and why
   * ```
   *
   * @throws {ValidationError} If neither `text` nor `messageType` is provided
   * @throws {NotFoundError} If AI enhancement is not enabled for the account
   * @throws {AuthenticationError} If the API key is invalid
   */
  async enhance(
    request: EnhanceMessageRequest,
  ): Promise<EnhanceMessageResponse> {
    if (!request || (!request.text && !request.messageType)) {
      throw new Error("Provide 'text' or 'messageType'");
    }

    const response = await this.http.request<EnhanceMessageResponse>({
      method: "POST",
      path: "/ai/enhance",
      body: {
        ...(request.text !== undefined && { text: request.text }),
        ...(request.messageType && { messageType: request.messageType }),
      },
    });

    return response;
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
      path: "/messages",
      query: {
        limit: options.limit,
        offset: options.offset,
        status: options.status,
      },
    });

    return { ...response, data: response.data.map(toMessage) };
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
    const message = await this.http.request<WireMessage>({
      method: "GET",
      path: `/messages/${encodeURIComponent(id)}`,
    });

    return toMessage(message);
  }

  /**
   * Iterate through all messages with automatic pagination
   *
   * @param options - List options: `limit` is the page size, `offset` where
   *   to start, and `status` filters every page
   * @yields Message objects one at a time
   *
   * @example
   * ```typescript
   * // Iterate through all messages
   * for await (const message of sendly.messages.listAll()) {
   *   console.log(`${message.id}: ${message.status}`);
   * }
   *
   * // Only failed messages, 100 per request
   * for await (const message of sendly.messages.listAll({ status: 'failed', limit: 100 })) {
   *   console.log(message.to);
   * }
   * ```
   *
   * @throws {AuthenticationError} If the API key is invalid
   * @throws {RateLimitError} If rate limit is exceeded
   */
  async *listAll(options: ListMessagesOptions = {}): AsyncGenerator<Message> {
    const batchSize = Math.min(options.limit || 100, 100);
    let offset = options.offset ?? 0;
    let hasMore = true;

    while (hasMore) {
      const response = await this.http.request<MessageListResponse>({
        method: "GET",
        path: "/messages",
        query: {
          limit: batchSize,
          offset,
          status: options.status,
        },
      });

      for (const message of response.data) {
        yield toMessage(message);
      }

      offset += response.data.length;
      hasMore =
        response.data.length > 0 &&
        (response.pagination?.hasMore ?? response.data.length >= batchSize);
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
  async schedule(
    request: ScheduleMessageRequest,
    options?: IdempotentRequestOptions,
  ): Promise<ScheduledMessage> {
    // Validate request
    validatePhoneNumber(request.to);
    validateMessageText(request.text);
    if (request.from) {
      validateSenderId(request.from);
    }

    // Validate scheduledAt is in the future (carrier requires 5 min - 5 days)
    const scheduledTime = new Date(request.scheduledAt);
    const now = new Date();
    const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);
    const fiveDaysFromNow = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);

    if (isNaN(scheduledTime.getTime())) {
      throw new Error("Invalid scheduledAt format. Use ISO 8601 format.");
    }

    if (scheduledTime <= fiveMinutesFromNow) {
      throw new Error("scheduledAt must be at least 5 minutes in the future.");
    }

    if (scheduledTime > fiveDaysFromNow) {
      throw new Error("scheduledAt must be within 5 days.");
    }

    const scheduled = await this.http.request<ScheduledMessage>({
      method: "POST",
      path: "/messages/schedule",
      idempotencyKey: options?.idempotencyKey,
      body: {
        to: request.to,
        text: request.text,
        scheduledAt: request.scheduledAt,
        ...(request.from && { from: request.from }),
        ...(request.messageType && { messageType: request.messageType }),
        ...(request.metadata && { metadata: request.metadata }),
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
      path: "/messages/scheduled",
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
      path: `/messages/scheduled/${encodeURIComponent(id)}`,
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
      path: `/messages/scheduled/${encodeURIComponent(id)}`,
    });

    return result;
  }

  // ==========================================================================
  // Batch Messages
  // ==========================================================================

  /**
   * Send multiple SMS messages in a single batch (up to 10,000)
   *
   * @param request - Batch request with array of messages
   * @returns The batch. It may still be `processing`, with no message
   *   results yet; {@link MessagesResource.getBatch} returns the outcome.
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
   * console.log(batch.status);      // 'processing', or the outcome if it already finished
   * console.log(batch.total);       // 2
   *
   * // Poll for the outcome
   * const result = await sendly.messages.getBatch(batch.batchId);
   * ```
   *
   * @throws {ValidationError} If any message is invalid
   * @throws {InsufficientCreditsError} If credit balance is too low
   */
  async sendBatch(
    request: BatchMessageRequest,
    options?: IdempotentRequestOptions,
  ): Promise<BatchSendResponse> {
    // Validate all messages
    if (
      !request.messages ||
      !Array.isArray(request.messages) ||
      request.messages.length === 0
    ) {
      throw new Error("messages must be a non-empty array");
    }

    if (request.messages.length > MAX_BATCH_MESSAGES) {
      throw new Error(
        `Maximum ${MAX_BATCH_MESSAGES.toLocaleString("en-US")} messages per batch`,
      );
    }

    for (const msg of request.messages) {
      validatePhoneNumber(msg.to);
      validateMessageText(msg.text);
    }

    if (request.from) {
      validateSenderId(request.from);
    }

    // The batch endpoint dedupes header-less retries server-side by hashing
    // the request content; an auto-generated key would bypass that net for
    // identical cross-process re-runs, so only caller-supplied keys are sent.
    const batch = await this.http.request<BatchSendResponse>({
      method: "POST",
      path: "/messages/batch",
      idempotencyKey: options?.idempotencyKey,
      autoIdempotencyKey: false,
      body: {
        messages: request.messages,
        ...(request.from && { from: request.from }),
        ...(request.messageType && { messageType: request.messageType }),
        ...(request.metadata && { metadata: request.metadata }),
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
      path: `/messages/batch/${encodeURIComponent(batchId)}`,
    });

    return { ...batch, batchId: batch.batchId ?? batch.id };
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
      path: "/messages/batches",
      query: {
        limit: options.limit,
        offset: options.offset,
        status: options.status,
      },
    });

    return {
      ...response,
      data: response.data.map(
        (batch): BatchSummary => ({ ...batch, batchId: batch.batchId ?? batch.id }),
      ),
    };
  }

  /**
   * Preview a batch without sending (dry run)
   *
   * A live send skips recipients who opted out, but rejects the whole batch
   * if any other message is blocked, so check `canSend` rather than
   * `sendable`.
   *
   * @param request - Batch request with array of messages
   * @returns Preview showing what would happen if batch was sent
   *
   * @example
   * ```typescript
   * const preview = await sendly.messages.previewBatch({
   *   messages: [
   *     { to: '+15551234567', text: 'Hello User 1!' },
   *     { to: '+15559876543', text: 'Hello User 2!' }
   *   ]
   * });
   *
   * console.log(preview.sendable);      // 2
   * console.log(preview.creditsNeeded); // 4
   * console.log(preview.canSend);       // true when nothing found stops the send
   *
   * for (const blocked of preview.blockedMessages ?? []) {
   *   console.log(`${blocked.to}: ${blocked.reason}`);
   * }
   * ```
   *
   * @throws {ValidationError} If any message is invalid
   */
  async previewBatch(
    request: BatchMessageRequest,
  ): Promise<BatchPreviewResponse> {
    // Validate all messages
    if (
      !request.messages ||
      !Array.isArray(request.messages) ||
      request.messages.length === 0
    ) {
      throw new Error("messages must be a non-empty array");
    }

    if (request.messages.length > MAX_BATCH_MESSAGES) {
      throw new Error(
        `Maximum ${MAX_BATCH_MESSAGES.toLocaleString("en-US")} messages per batch`,
      );
    }

    for (const msg of request.messages) {
      validatePhoneNumber(msg.to);
      validateMessageText(msg.text);
    }

    if (request.from) {
      validateSenderId(request.from);
    }

    const preview = await this.http.request<
      BatchPreviewResponse & {
        total: number;
        sendable: number;
        creditBalance: number;
        hasSufficientCredits: boolean;
        hasWriteScope: boolean;
      }
    >({
      method: "POST",
      path: "/messages/batch/preview",
      body: {
        messages: request.messages,
        ...(request.from && { from: request.from }),
        ...(request.messageType && { messageType: request.messageType }),
      },
    });

    return {
      ...preview,
      totalMessages: preview.total,
      willSend: preview.sendable,
      currentBalance: preview.creditBalance,
      hasEnoughCredits: preview.hasSufficientCredits,
      canSend:
        preview.sendable > 0 &&
        preview.blocked === (preview.compliance?.optedOutBlocked ?? 0) &&
        (preview.keyType === "test" || preview.hasSufficientCredits) &&
        preview.hasWriteScope,
    };
  }
}
