/**
 * Test fixtures and mock responses
 */

import type {
  Message,
  MessageListResponse,
  ScheduledMessage,
  ScheduledMessageListResponse,
  CancelledMessageResponse,
  BatchMessageResponse,
  BatchListResponse,
  ApiErrorResponse,
  WebhookEvent,
} from "../../src/types";

// =============================================================================
// Messages
// =============================================================================

export const mockMessage: Message = {
  id: "msg_test123",
  to: "+15551234567",
  from: "+15559876543",
  text: "Hello from Sendly!",
  status: "queued",
  error: null,
  segments: 1,
  creditsUsed: 1,
  isSandbox: true,
  createdAt: "2025-01-15T10:00:00Z",
  deliveredAt: null,
};

export const mockDeliveredMessage: Message = {
  ...mockMessage,
  status: "delivered",
  deliveredAt: "2025-01-15T10:01:00Z",
};

export const mockFailedMessage: Message = {
  ...mockMessage,
  status: "failed",
  error: "Invalid phone number",
};

export const mockMessageList: MessageListResponse = {
  data: [mockMessage, mockDeliveredMessage],
  count: 2,
};

// =============================================================================
// Scheduled Messages
// =============================================================================

export const mockScheduledMessage: ScheduledMessage = {
  id: "msg_scheduled123",
  to: "+15551234567",
  from: null,
  text: "Scheduled reminder",
  status: "scheduled",
  scheduledAt: "2025-01-20T10:00:00Z",
  creditsReserved: 1,
  error: null,
  createdAt: "2025-01-15T10:00:00Z",
  cancelledAt: null,
  sentAt: null,
};

export const mockScheduledMessageList: ScheduledMessageListResponse = {
  data: [mockScheduledMessage],
  count: 1,
};

export const mockCancelledMessage: CancelledMessageResponse = {
  id: "msg_scheduled123",
  status: "cancelled",
  creditsRefunded: 1,
  cancelledAt: "2025-01-15T10:05:00Z",
};

// =============================================================================
// Batch Messages
// =============================================================================

export const mockBatchResponse: BatchMessageResponse = {
  batchId: "batch_test123",
  status: "completed",
  total: 2,
  queued: 2,
  sent: 2,
  failed: 0,
  creditsUsed: 2,
  messages: [
    {
      id: "msg_batch1",
      to: "+15551234567",
      status: "queued",
    },
    {
      id: "msg_batch2",
      to: "+15559876543",
      status: "queued",
    },
  ],
  createdAt: "2025-01-15T10:00:00Z",
  completedAt: "2025-01-15T10:00:05Z",
};

export const mockBatchList: BatchListResponse = {
  data: [mockBatchResponse],
  count: 1,
};

// =============================================================================
// Error Responses
// =============================================================================

export const mockAuthError: ApiErrorResponse = {
  error: "invalid_api_key",
  message: "Invalid API key provided",
};

export const mockValidationError: ApiErrorResponse = {
  error: "invalid_request",
  message: "Invalid phone number format",
};

export const mockNotFoundError: ApiErrorResponse = {
  error: "not_found",
  message: "Message not found",
};

export const mockRateLimitError: ApiErrorResponse = {
  error: "rate_limit_exceeded",
  message: "Rate limit exceeded",
  retryAfter: 60,
};

export const mockInsufficientCreditsError: ApiErrorResponse = {
  error: "insufficient_credits",
  message: "Insufficient credits",
  creditsNeeded: 5,
  currentBalance: 2,
};

export const mockServerError: ApiErrorResponse = {
  error: "internal_error",
  message: "Internal server error",
};

// =============================================================================
// Webhook Events
// =============================================================================

export const mockWebhookEvent: WebhookEvent = {
  id: "evt_test123",
  type: "message.delivered",
  data: {
    message_id: "msg_test123",
    status: "delivered",
    to: "+15551234567",
    from: "+15559876543",
    delivered_at: "2025-01-15T10:01:00Z",
    segments: 1,
    credits_used: 1,
  },
  created_at: "2025-01-15T10:01:00Z",
  api_version: "v1",
};

export const mockWebhookFailedEvent: WebhookEvent = {
  id: "evt_test456",
  type: "message.failed",
  data: {
    message_id: "msg_test456",
    status: "failed",
    to: "+15551234567",
    from: "+15559876543",
    error: "Invalid phone number",
    error_code: "invalid_number",
    failed_at: "2025-01-15T10:01:00Z",
    segments: 1,
    credits_used: 0,
  },
  created_at: "2025-01-15T10:01:00Z",
  api_version: "v1",
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Create a mock fetch Response
 */
export function mockFetchResponse(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    headers: new Headers({
      "Content-Type": "application/json",
      "X-RateLimit-Limit": "100",
      "X-RateLimit-Remaining": "99",
      "X-RateLimit-Reset": "60",
      ...headers,
    }),
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

/**
 * Create a mock network error
 */
export function mockNetworkError(): Promise<never> {
  return Promise.reject(new Error("Network request failed"));
}

/**
 * Create a mock timeout error
 */
export function mockTimeoutError(): Promise<never> {
  const error = new Error("The operation was aborted");
  error.name = "AbortError";
  return Promise.reject(error);
}
