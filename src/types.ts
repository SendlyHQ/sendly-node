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
 * Message channel. Messages are SMS unless a request opts into another
 * channel.
 */
export type MessageChannel = "sms" | "whatsapp" | "rcs";

/**
 * Request payload for sending an SMS message
 */
export interface SendMessageRequest {
  /**
   * Message channel. Omit (or pass "sms") for SMS. To send on WhatsApp,
   * pass a {@link SendWhatsAppMessageRequest} (`channel: "whatsapp"`)
   * instead — it has its own required fields and response shape. To send
   * on RCS, pass a {@link SendRcsMessageRequest} (`channel: "rcs"`).
   */
  channel?: "sms";

  /**
   * Destination phone number in E.164 format (e.g., +15551234567)
   */
  to: string;

  /**
   * Message content (max 160 chars per segment)
   */
  text: string;

  /**
   * Sender ID or phone number (optional, uses default if not provided).
   * Accepts any of:
   * - One of your owned/active numbers (E.164) — toll-free, ported, or a
   *   purchased number — usable for any destination, including international.
   * - A 2-11 character alphanumeric sender ID (international only).
   * An unrecognised value is rejected for US/Canada and ignored (falls back to
   * your sender ID) for international.
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
 * Variable values for one dynamic-URL button on an approved WhatsApp
 * template.
 */
export interface WhatsAppTemplateButtonVariables {
  /**
   * Zero-based index of the button on the approved template
   */
  index: number;

  /**
   * Values for the button's URL placeholders, keyed by placeholder number:
   * { "1": "4821" }
   */
  variables: Record<string, string>;
}

/**
 * The approved WhatsApp template to send, with its variable values.
 */
export interface WhatsAppTemplateSendParams {
  /**
   * Template name as approved (e.g. "order_shipped")
   */
  name: string;

  /**
   * Template language code (e.g. "en_US") — must match the approved
   * template's language exactly
   */
  language: string;

  /**
   * Body variable values keyed by placeholder number:
   * { "1": "Acme Inc", "2": "#4821" }
   */
  variables?: Record<string, string>;

  /**
   * Variable values for dynamic-URL buttons
   */
  buttons?: WhatsAppTemplateButtonVariables[];
}

/**
 * Request payload for sending a WhatsApp message.
 *
 * Provide exactly one of:
 * - `text` — free-form text; only deliverable inside an open 24-hour
 *   customer-service window (the recipient messaged you in the last 24h)
 * - `mediaUrls` — a single media attachment (optional `text` becomes its
 *   caption); also window-bound
 * - `template` — an approved template; works regardless of the window
 *
 * WhatsApp sends require the `sms:send` scope, a live API key and a `from`
 * number that has been connected to WhatsApp (see `sendly.whatsapp.signup`).
 */
export interface SendWhatsAppMessageRequest {
  /**
   * Selects the WhatsApp channel
   */
  channel: "whatsapp";

  /**
   * Destination phone number in E.164 format (e.g., +15551234567)
   */
  to: string;

  /**
   * Sending number in E.164 format. Required — must be one of your numbers
   * with an active WhatsApp connection.
   */
  from: string;

  /**
   * Free-form message text (max 4096 bytes), or the caption when
   * `mediaUrls` is provided (max 1024 bytes). Requires an open 24-hour
   * window — outside it the API responds 422 `whatsapp_window_closed`;
   * send a `template` instead.
   */
  text?: string;

  /**
   * Media attachment URL. WhatsApp accepts exactly one per message.
   * Must be a publicly accessible HTTPS URL.
   */
  mediaUrls?: string[];

  /**
   * Approved template to send. Works regardless of the 24-hour window.
   */
  template?: WhatsAppTemplateSendParams;

  /**
   * Custom JSON metadata to attach to the message (max 4KB).
   */
  metadata?: Record<string, any>;
}

/**
 * What kind of WhatsApp message was sent
 */
export type WhatsAppMessageKind = "text" | "media" | "template";

/**
 * Billing category of a sent WhatsApp template (Meta reviews and may
 * reclassify templates; the category on the send response is what was
 * billed).
 */
export type WhatsAppMessageCategory =
  | "marketing"
  | "utility"
  | "authentication";

/**
 * WhatsApp-specific details on a sent message
 */
export interface WhatsAppMessageDetails {
  /**
   * What was sent: free-form text, media, or a template
   */
  kind: WhatsAppMessageKind;

  /**
   * The template that was sent (template sends only)
   */
  template?: {
    name: string;
    language: string;
    category: WhatsAppMessageCategory;
  };

  /**
   * WhatsApp message id — null until the first delivery report lands;
   * populated on the message record afterwards
   */
  messageId: string | null;
}

/**
 * A sent WhatsApp message
 */
export interface WhatsAppMessage {
  /**
   * Unique message identifier
   */
  id: string;

  /**
   * Always "whatsapp"
   */
  channel: "whatsapp";

  /**
   * Always "whatsapp"
   */
  message_format: "whatsapp";

  /**
   * Destination phone number
   */
  to: string;

  /**
   * Sending number
   */
  from: string;

  /**
   * Body text for free-form text sends, or the caption for media sends
   * (pass it as `text` with `mediaUrls`); null for template sends and for
   * media sent without a caption
   */
  text: string | null;

  /**
   * Current delivery status
   */
  status: MessageStatus;

  /**
   * Always 1 — WhatsApp has no segment concept
   */
  segments: number;

  /**
   * Credits charged for this message. Free-form text or media inside the
   * 24-hour window: 1 credit each for the first 1,000 per sending number
   * per calendar month (UTC), then the destination's utility template
   * price; countries without a listed price use the default utility price
   * of 12 credits. Templates are priced by category and destination
   * country; countries without a listed price use 33 (marketing), 12
   * (utility) and 12 (authentication) credits. A failed send gives its
   * slot back.
   */
  creditsUsed: number;

  /**
   * WhatsApp-specific details
   */
  whatsapp: WhatsAppMessageDetails;

  /**
   * ISO 8601 timestamp when the message was created
   */
  createdAt: string;

  /**
   * Custom JSON metadata attached to the message
   */
  metadata?: Record<string, any>;
}

/**
 * A suggestion chip on an RCS message — a tap-to-send reply.
 */
export interface RcsReplySuggestion {
  reply: {
    /**
     * Chip label the recipient taps
     */
    text: string;

    /**
     * Payload delivered back to you when the chip is tapped
     */
    postbackData: string;
  };
}

/**
 * A suggestion chip on an RCS message — an open-URL action.
 */
export interface RcsActionSuggestion {
  action: {
    /**
     * Chip label the recipient taps
     */
    text: string;

    /**
     * Payload delivered back to you when the chip is tapped
     */
    postbackData: string;

    /**
     * URL opened on the recipient's device when the chip is tapped
     */
    url: string;
  };
}

/**
 * A suggestion chip on an RCS message. Each entry is exactly one of a
 * `reply` or an `action`.
 */
export type RcsSuggestion = RcsReplySuggestion | RcsActionSuggestion;

/**
 * Layout of an RCS rich card
 */
export type RcsCardOrientation = "vertical" | "horizontal";

/**
 * A rich card to send on RCS.
 */
export interface RcsCardParams {
  /**
   * Card title
   */
  title: string;

  /**
   * Card body text
   */
  description: string;

  /**
   * Card image — a publicly accessible JPEG, PNG, or GIF URL
   */
  mediaUrl?: string;

  /**
   * Card layout (default "vertical")
   */
  orientation?: RcsCardOrientation;

  /**
   * Buttons on the card
   */
  suggestions?: RcsSuggestion[];
}

/**
 * Request payload for sending an RCS message.
 *
 * Provide exactly one of:
 * - `text` — a text message, optionally with `suggestions` chips
 * - `card` — a rich card (title, description, image, buttons)
 *
 * When the recipient's device or network doesn't support RCS, text
 * messages automatically fall back to SMS (billed as SMS; suggestions are
 * dropped) — the response says so via `channel: "sms"` and
 * `fellBackTo: "sms"`. Rich cards have no SMS form and respond 422
 * instead. Pass `fallbackToSms: false` to disable the fallback and get a
 * 422 for non-RCS recipients.
 *
 * RCS sends require a live API key and an approved RCS agent on your
 * workspace (see `sendly.rcs.agents`).
 */
export interface SendRcsMessageRequest {
  /**
   * Selects the RCS channel
   */
  channel: "rcs";

  /**
   * Destination phone number in E.164 format (e.g., +15551234567)
   */
  to: string;

  /**
   * The RCS agent to send as. Optional when your workspace has exactly
   * one agent; required (as a disambiguator) when it has several.
   */
  agentId?: string;

  /**
   * Message text. Provide exactly one of `text` or `card`.
   */
  text?: string;

  /**
   * Rich card. Provide exactly one of `text` or `card`.
   */
  card?: RcsCardParams;

  /**
   * Suggestion chips for a `text` message. Card buttons go in
   * `card.suggestions` instead. Dropped (and disclosed via
   * `rcs.suggestionsDropped`) when the message falls back to SMS.
   */
  suggestions?: RcsSuggestion[];

  /**
   * Deliver as SMS when the recipient doesn't support RCS (default true).
   * Set false to get a 422 `rcs_not_supported_for_recipient` instead.
   */
  fallbackToSms?: boolean;

  /**
   * Custom JSON metadata to attach to the message (max 4KB).
   */
  metadata?: Record<string, any>;
}

/**
 * What kind of RCS message was sent
 */
export type RcsMessageKind = "text" | "card";

/**
 * RCS-specific details on a message that was delivered over RCS
 */
export interface RcsMessageDetails {
  /**
   * What was sent: a text message or a rich card
   */
  kind: RcsMessageKind;

  /**
   * The RCS agent the message was sent as
   */
  agentId: string;

  /**
   * The agent name recipients see
   */
  agentName: string;
}

/**
 * RCS-specific details on a message that fell back to SMS
 */
export interface RcsFallbackDetails {
  /**
   * Always "rcs" — the channel the request asked for
   */
  requestedChannel: "rcs";

  /**
   * The RCS agent the send was attempted as
   */
  agentId: string;

  /**
   * Present (true) when the request carried suggestion chips — they have
   * no SMS form and were dropped
   */
  suggestionsDropped?: boolean;
}

/**
 * An RCS message that was delivered over RCS.
 */
export interface RcsSentMessage {
  /**
   * Unique message identifier
   */
  id: string;

  /**
   * "rcs" — the message went out over RCS
   */
  channel: "rcs";

  /**
   * Always "rcs"
   */
  message_format: "rcs";

  /**
   * Destination phone number
   */
  to: string;

  /**
   * The sending agent's name
   */
  from: string;

  /**
   * Body text for text sends; null for card sends
   */
  text: string | null;

  /**
   * Current delivery status
   */
  status: MessageStatus;

  /**
   * Always 1 — RCS has no segment concept
   */
  segments: number;

  /**
   * Credits charged for this message
   */
  creditsUsed: number;

  /**
   * RCS-specific details
   */
  rcs: RcsMessageDetails;

  /**
   * ISO 8601 timestamp when the message was created
   */
  createdAt: string;

  /**
   * Custom JSON metadata attached to the message
   */
  metadata?: Record<string, any>;
}

/**
 * An RCS request that was delivered as SMS because the recipient's device
 * or network doesn't support RCS. Billed as SMS.
 */
export interface RcsFallbackMessage {
  /**
   * Unique message identifier
   */
  id: string;

  /**
   * "sms" — the message fell back to SMS
   */
  channel: "sms";

  /**
   * Always "sms" on a fallback — the giveaway that the recipient didn't
   * get an RCS message
   */
  fellBackTo: "sms";

  /**
   * Always "sms"
   */
  message_format: "sms";

  /**
   * Destination phone number
   */
  to: string;

  /**
   * The SMS sender used for the fallback (a number or sender ID)
   */
  from: string;

  /**
   * Body text
   */
  text: string;

  /**
   * Current delivery status
   */
  status: MessageStatus;

  /**
   * SMS segments billed
   */
  segments: number;

  /**
   * Credits charged for this message (SMS pricing)
   */
  creditsUsed: number;

  /**
   * What the request asked for, and what was dropped
   */
  rcs: RcsFallbackDetails;

  /**
   * ISO 8601 timestamp when the message was created
   */
  createdAt: string;

  /**
   * Custom JSON metadata attached to the message
   */
  metadata?: Record<string, any>;
}

/**
 * The response to an RCS send. Check `channel` (or `fellBackTo`) to tell
 * whether the message went out over RCS or fell back to SMS:
 *
 * ```typescript
 * const message = await sendly.messages.send({
 *   channel: 'rcs',
 *   to: '+15551234567',
 *   text: 'Your table is ready!',
 * });
 *
 * if (message.channel === 'rcs') {
 *   console.log(message.rcs.agentName);  // delivered over RCS
 * } else {
 *   console.log(message.fellBackTo);     // 'sms' — delivered as SMS
 * }
 * ```
 */
export type RcsMessage = RcsSentMessage | RcsFallbackMessage;

/**
 * Request to send a group MMS to multiple recipients (US/Canada only).
 * Group messaging is an A2P 10DLC capability: the sending number must be an
 * MMS-enabled, 10DLC-registered number you own.
 */
export interface SendGroupMessageRequest {
  /**
   * 2-8 recipient phone numbers in E.164 format. US and Canada only, and each
   * must be an MMS-capable mobile.
   */
  to: string[];

  /**
   * Message body. Required unless `mediaUrls` is provided.
   */
  text?: string;

  /**
   * Sending number (E.164). Optional — omit to use your workspace's default
   * sending number. When provided it must be an MMS-enabled, 10DLC-registered
   * number you own, or the request is rejected with `invalid_from_number`.
   */
  from?: string;

  /**
   * HTTPS media URLs to attach. Required unless `text` is provided.
   */
  mediaUrls?: string[];

  /**
   * Message type for compliance. Group MMS defaults to "transactional"; pass
   * "marketing" to apply quiet-hours rules.
   */
  messageType?: MessageType;
}

/**
 * A recipient of a group MMS and its delivery status.
 */
export interface GroupRecipient {
  /**
   * Recipient in E.164 format.
   */
  phoneNumber: string;

  /**
   * Delivery status for this recipient.
   */
  status?: string;
}

/**
 * Response from sending a group MMS.
 */
export interface GroupMessageResponse {
  /**
   * Message id — matches the `id` in delivery webhooks.
   */
  id: string;

  /**
   * Delivery status ("sent" on a live send, "delivered" when simulated).
   */
  status: MessageStatus;

  /**
   * The recipients the group message was sent to.
   */
  to: string[];

  /**
   * Each recipient with its delivery status. Present on live sends.
   */
  recipients?: GroupRecipient[];

  /**
   * Identifier for the group conversation. Present on live sends.
   */
  group_message_id?: string;

  /**
   * True when the send was simulated (test key, or before your account's
   * domestic verification is approved) and nothing was sent to the carrier.
   */
  simulated?: boolean;

  /**
   * Human-readable note, present on simulated sends.
   */
  message?: string;
}

/**
 * Message status values
 * Note: "sending" was removed as it doesn't exist in the database
 */
export type MessageStatus =
  | "queued"
  | "sent"
  | "delivered"
  /** Read receipts exist on RCS and WhatsApp only — SMS never reports one */
  | "read"
  | "failed"
  | "bounced"
  | "retrying";

/**
 * How the message was sent
 */
export type SenderType = "number_pool" | "alphanumeric" | "sandbox" | "explicit";

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
   *
   * Note: not populated by every endpoint today — treat as possibly
   * undefined at runtime. Messages sent through the SDK are always
   * outbound.
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
   *
   * Note: not populated by every endpoint today — treat as possibly
   * undefined at runtime.
   */
  isSandbox: boolean;

  /**
   * How the message was sent
   * - "number_pool": Sent from toll-free number pool (US/CA)
   * - "alphanumeric": Sent with alphanumeric sender ID (international)
   * - "sandbox": Sent in sandbox/test mode
   * - "explicit": Sent from a specific number on your account (the `from`
   *   you passed, or your verified sender)
   */
  senderType?: SenderType;

  /**
   * True when the send was simulated (test key, or an account not yet set
   * up to send to this destination) and nothing reached a handset
   */
  simulated?: boolean;

  /**
   * Why a live send was simulated
   */
  simulatedReason?: string;

  /**
   * Dashboard path where you can fix what caused the simulation
   */
  actionUrl?: string;

  /**
   * Message format
   */
  messageFormat?: "sms" | "mms" | "whatsapp" | "rcs";

  /**
   * Media attached to an MMS message
   */
  mediaUrls?: string[];

  /**
   * Batch the message was sent in
   */
  batchId?: string | null;

  /**
   * @deprecated Internal carrier reference — will be removed from the
   * public type in a future release. Use `id` to track messages.
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
    /** One-sentence summary of what the sender wants */
    summary?: string;
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
   * Number of messages on this page (not the total; see `pagination.total`)
   */
  count: number;

  /**
   * Where this page sits in the full result
   */
  pagination?: {
    /** Messages matching the query, across all pages */
    total: number;
    limit: number;
    offset: number;
    page: number;
    totalPages: number;
    hasMore: boolean;
  };
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
 * Most messages one batch can carry
 */
export const MAX_BATCH_MESSAGES = 10000;

/**
 * Request payload for sending batch messages
 */
export interface BatchMessageRequest {
  /**
   * Array of messages to send (max 10,000)
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
   * Position of the message in the request (sendBatch only)
   */
  index?: number;

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
 * A batch and its messages, as returned by {@link MessagesResource.getBatch}
 */
export interface BatchMessageResponse {
  /**
   * Unique batch identifier
   */
  batchId: string;

  /**
   * Unique batch identifier (same as `batchId`)
   */
  id?: string;

  /**
   * Current batch status
   */
  status: BatchStatus;

  /**
   * Total number of messages in batch
   */
  total: number;

  /**
   * Number of messages waiting to be sent
   */
  queued: number;

  /**
   * Number of messages sent
   */
  sent: number;

  /**
   * Number of messages delivered
   */
  delivered?: number;

  /**
   * Number of messages that failed
   */
  failed: number;

  /**
   * Number of messages being retried (sendBatch only)
   */
  retrying?: number;

  /**
   * Recipients skipped because they opted out (sendBatch only)
   */
  optedOutSkipped?: number;

  /**
   * Recipients skipped because their number can't receive SMS (sendBatch only)
   */
  invalidSkipped?: number;

  /**
   * Credits reserved when the batch was accepted
   */
  creditsReserved?: number;

  /**
   * Total credits used
   */
  creditsUsed: number;

  /**
   * Credits returned for messages that failed
   */
  creditsRefunded?: number;

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
 * Response from {@link MessagesResource.sendBatch}. A batch that is still
 * processing has `status: "processing"` and an empty `messages` array;
 * poll {@link MessagesResource.getBatch} for the outcome.
 */
export interface BatchSendResponse
  extends Omit<BatchMessageResponse, "queued" | "createdAt"> {
  /** @deprecated Not returned when sending; read it from getBatch */
  queued?: number;
  /** @deprecated Not returned when sending; read it from getBatch */
  createdAt?: string;
}

/**
 * A batch as listed by {@link MessagesResource.listBatches}, without its
 * messages
 */
export interface BatchSummary extends Omit<BatchMessageResponse, "messages"> {
  /** @deprecated Not returned by listBatches; call getBatch for the messages */
  messages?: BatchMessageResult[];
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
  data: BatchSummary[];

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
   * Whether nothing the preview found stops a send: at least one message is
   * sendable, none is blocked except by an opt-out, the balance covers it
   * (not needed with a test key, whose sends are free), and the API key has
   * the `sms:send` scope. A send skips opted-out recipients but rejects the
   * whole batch if any other message is blocked. A test key's send skips the
   * destination and verification checks, so it can go through while
   * `canSend` is false.
   */
  canSend: boolean;

  /**
   * Total number of messages (same as `total`)
   */
  totalMessages: number;

  /**
   * Number of messages that pass the preview's checks (same as `sendable`);
   * see `canSend` for whether a send of the batch goes through
   */
  willSend: number;

  /**
   * Number of messages the preview blocks, opted-out recipients included
   */
  blocked: number;

  /**
   * Total credits required
   */
  creditsNeeded: number;

  /**
   * Current credit balance (same as `creditBalance`)
   */
  currentBalance: number;

  /**
   * Whether user has enough credits (same as `hasSufficientCredits`)
   */
  hasEnoughCredits: boolean;

  /**
   * Total number of messages in the request
   */
  total?: number;

  /**
   * Number of messages that pass the preview's checks
   */
  sendable?: number;

  /**
   * Repeated numbers, which are sent once
   */
  duplicates?: number;

  /**
   * Current credit balance
   */
  creditBalance?: number;

  /**
   * Whether the balance covers `creditsNeeded`
   */
  hasSufficientCredits?: boolean;

  /**
   * Whether the balance is a shared enterprise credit pool
   */
  pooled?: boolean;

  /**
   * Type of the API key used for the preview
   */
  keyType?: "test" | "live";

  /**
   * Scopes of the API key used for the preview
   */
  keyScopes?: string[];

  /**
   * Whether the API key has the `sms:send` scope needed to send
   */
  hasWriteScope?: boolean;

  /**
   * What the workspace's verification lets it send to
   */
  messagingProfile?: {
    canSendDomestic: boolean;
    canSendInternational: boolean;
    verificationStatus: string | null;
    verificationType: string | null;
  };

  /**
   * Messages and credits per destination country
   */
  byCountry?: Record<
    string,
    {
      count: number;
      credits: number;
      tier: string;
      allowed: boolean;
      blockedReason?: string;
    }
  >;

  /**
   * Each message that will not be sent, and why
   */
  blockedMessages?: Array<{
    index: number;
    to: string;
    reason: string;
  }>;

  /**
   * Content and quiet-hours checks
   */
  compliance?: {
    messageType: MessageType;
    optedOutBlocked?: number;
    shaftBlocked: number;
    quietHoursBlocked: number;
    quietHoursRescheduled: number;
    shaftBlockedMessages: Array<{
      index: number;
      to: string;
      category: string;
      matchedTerms: string[];
    }>;
    quietHoursBlockedMessages: Array<{
      index: number;
      to: string;
      recipientTimezone: string;
      recipientLocalTime: string;
      nextAllowedTime?: string;
    }>;
  };

  /**
   * Warnings that do not block sending
   */
  warnings?: string[];

  /**
   * @deprecated Not returned by the API; see `blockedMessages`
   */
  messages?: BatchPreviewItem[];

  /**
   * @deprecated Not returned by the API; see `blockedMessages`
   */
  blockReasons?: Record<string, number>;
}

// ============================================================================
// AI Message Enhancement
// ============================================================================

/**
 * Request to AI-enhance a draft message. Provide `text`, `messageType`, or
 * both — at least one is required.
 */
export interface EnhanceMessageRequest {
  /**
   * Draft message text to rewrite. Optional if `messageType` is provided (the
   * model then generates a suitable message for that type). Only the first 500
   * characters are considered; the result is trimmed to one SMS segment.
   */
  text?: string;

  /**
   * Hint about the kind of message so the rewrite is targeted (e.g.
   * "marketing", "transactional"). Optional if `text` is provided.
   */
  messageType?: string;
}

/**
 * Result of an AI message enhancement.
 */
export interface EnhanceMessageResponse {
  /**
   * The rewritten message, capped at 160 characters (one SMS segment). When AI
   * enhancement is unavailable, this falls back to the original `text`.
   */
  enhanced: string;

  /**
   * Short explanation of what changed. An empty string on the fallback path.
   */
  explanation: string;

  /**
   * The model that produced the enhancement, when available.
   */
  model?: string;
}

// ============================================================================
// Branded Short Links (URL shortening)
// ============================================================================

/**
 * Request to mint a branded short link.
 */
export interface CreateShortLinkRequest {
  /**
   * Destination URL to shorten. Must be an `http://` or `https://` URL.
   */
  url: string;
}

/**
 * A newly minted branded short link.
 */
export interface ShortLink {
  /** Short code (the segment after the domain, e.g. "Ab3xY7"). */
  code: string;
  /** Full branded short URL to share (e.g. "https://sendly.live/l/Ab3xY7"). */
  shortUrl: string;
  /** The destination the short link redirects to. */
  destinationUrl: string;
}

/**
 * Options for listing short links.
 */
export interface ListShortLinksOptions {
  /**
   * Maximum number of links to return (1-200)
   * @default 50
   */
  limit?: number;

  /**
   * Number of links to skip for pagination
   * @default 0
   */
  offset?: number;
}

/**
 * A short link with click analytics, as returned by
 * {@link LinksResource.list}.
 */
export interface ShortLinkListItem {
  /** Short code (the segment after the domain). */
  code: string;
  /** Full branded short URL. */
  shortUrl: string;
  /** The destination the short link redirects to. */
  destinationUrl: string;
  /** Workspace brand slug segment, or `null` when unbranded. */
  brandSlug: string | null;
  /** Total human clicks recorded (link-preview bots are excluded). */
  clickCount: number;
  /** Whether the link is disabled (the redirect then returns 404). */
  disabled: boolean;
  /** ISO 3166-1 alpha-2 country of the most recent click, or `null`. */
  lastCountry: string | null;
  /** When the link was last clicked (ISO 8601), or `null`. */
  lastClickedAt: string | null;
  /** When the link was created (ISO 8601). */
  createdAt: string;
  /** 14-day daily click histogram, oldest first (today last). */
  spark: number[];
}

/**
 * Response from {@link LinksResource.list}.
 */
export interface ShortLinkListResponse {
  /** The workspace's short links, newest first. */
  links: ShortLinkListItem[];
  /** Total number of short links in the workspace. */
  total: number;
}

/**
 * Response from enabling or disabling a short link.
 */
export interface ShortLinkDisabledResponse {
  /** Short code that was updated. */
  code: string;
  /** New disabled state. */
  disabled: boolean;
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
  | "too_many_failed_key_attempts"
  | "too_many_concurrent_verifications"
  | "whatsapp_not_enabled"
  | "whatsapp_unavailable"
  | "whatsapp_signup_limit_reached"
  | "whatsapp_requires_live_key"
  | "whatsapp_sender_not_connected"
  | "whatsapp_window_closed"
  | "whatsapp_template_not_found"
  | "whatsapp_template_not_approved"
  | "whatsapp_invalid_content"
  /** WhatsApp refused the message (422, final) or provably never received it (502, safe to send again) */
  | "whatsapp_send_failed"
  /** The outcome of a WhatsApp send is unknown (409): marked failed and refunded, but it may still be delivered */
  | "whatsapp_send_unconfirmed"
  | "file_required"
  | "whatsapp_profile_photo_invalid"
  | "whatsapp_profile_photo_too_large"
  | "whatsapp_profile_update_failed"
  | "whatsapp_conversational_components_fetch_failed"
  | "whatsapp_conversational_components_update_failed"
  | "whatsapp_calling_unavailable"
  | "whatsapp_calling_update_failed"
  | "display_name_required"
  | "whatsapp_business_account_not_found"
  | "whatsapp_signup_in_progress"
  | "whatsapp_already_enabled"
  | "whatsapp_verification_in_progress"
  | "whatsapp_verification_start_failed"
  | "invalid_verification_code"
  /** Wrong WhatsApp verification code; `response.attemptsRemaining` says how many tries are left */
  | "whatsapp_verification_code_invalid"
  | "whatsapp_verification_failed"
  | "whatsapp_verification_busy"
  | "whatsapp_verification_unavailable"
  | "whatsapp_activation_pending"
  /** Too soon to send another WhatsApp code; `response.retryAfter` is the wait in seconds */
  | "whatsapp_verification_resend_too_soon"
  | "whatsapp_verification_resend_failed"
  | "signup_not_active"
  | "signup_not_found"
  | "rcs_not_enabled"
  | "rcs_requires_live_key"
  | "rcs_agent_not_ready"
  | "rcs_agent_ambiguous"
  | "rcs_invalid_content"
  | "rcs_not_supported_for_recipient"
  | "rcs_send_failed"
  | "rcs_capability_check_failed"
  | "rcs_not_found"
  | "rcs_field_locked"
  | "rcs_us_only"
  | "rcs_brand_not_verified"
  | "rcs_launch_not_ready"
  | "rcs_internal_error"
  | "voice_not_enabled"
  | "outbound_calls_not_enabled"
  | "agent_required"
  | "agent_not_found"
  | "agent_disabled"
  | "invalid_metadata"
  | "from_number_required"
  | "no_voice_number"
  | "number_not_found"
  | "destination_not_supported"
  | "e911_required"
  | "lines_busy"
  | "daily_call_limit"
  | "call_not_found"
  | "invalid_voice_mode"
  | "agent_limit"
  | "agent_in_use"
  | "invalid_address"
  | "e911_not_applicable"
  | "voice_attach_failed"
  | "carrier_refused"
  | "voice_unavailable"
  | "live_key_required"
  | "voice_internal_error"
  | "forbidden"
  | "invalid_idempotency_key"
  | "idempotency_key_mismatch"
  | "sms_fallback_unavailable"
  | "sms_fallback_failed"
  | "recipient_opted_out"
  | "compliance_blocked"
  | "validation_error"
  | "conflict"
  | "verification_required"
  | "credits_required"
  /** Wrong verification code; `response.remaining_attempts` says how many tries are left */
  | "invalid_code"
  /** The verification code expired (HTTP 410) */
  | "expired"
  /** No verification attempts are left (HTTP 429, not a rate limit) */
  | "max_attempts_exceeded"
  | "invalid_number"
  | "from_number_not_supported"
  /** No card on file for a fee (HTTP 402); `response.nextStep` is `add_payment_method` */
  | "payment_method_required"
  /** The card was declined for a fee (HTTP 402); `response.nextStep` is `update_payment_method` */
  | "payment_failed"
  /** The bank wants the payment confirmed (HTTP 402); open `response.checkoutUrl` */
  | "payment_requires_authentication"
  | "short_code_invalid_application"
  | "short_code_ai_draft_unedited"
  | "short_code_locked"
  | "short_code_conflict"
  /** Another payment for the application is still running (HTTP 409) */
  | "short_code_payment_in_progress"
  /** The card processor didn't confirm the setup fee (HTTP 503); submit again later */
  | "short_code_payment_unconfirmed"
  /** The setup fee was charged but couldn't be recorded, so it was refunded (HTTP 500) */
  | "short_code_payment_not_recorded"
  /** A refund of the setup fee is still going through (HTTP 409) */
  | "short_code_refund_pending"
  | "short_codes_not_enabled"
  | "internal_error"
  /** The response did not come from the Sendly API (wrong baseUrl, or a proxy intercepted it) */
  | "invalid_response"
  | (string & {});

/**
 * One field-level problem reported alongside a validation error
 */
export interface ApiFieldError {
  /**
   * Dot path of the field, e.g. "brand.ein" or "devices.0.phoneNumber"
   */
  path: string;

  /**
   * What is wrong with it
   */
  message: string;
}

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
   * Field-level detail (for validation errors such as rcs_invalid_content)
   */
  errors?: ApiFieldError[];

  /**
   * Attempts left after a wrong code (invalid_code errors from verify.check)
   */
  remaining_attempts?: number;

  /**
   * Attempts left after a wrong code (whatsapp_verification_code_invalid
   * errors from whatsapp.signup.verify)
   */
  attemptsRemaining?: number;

  /**
   * What to do about a payment error: `add_payment_method`,
   * `update_payment_method` or `complete_payment`
   */
  nextStep?: string;

  /**
   * The amount a payment error is about, in cents
   */
  amountCents?: number;

  /**
   * A secure payment page to finish a payment the bank wants confirmed
   * (payment_requires_authentication)
   */
  checkoutUrl?: string;

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

  /**
   * Target the un-versioned API root (`/api`) instead of the versioned base
   * (`/api/v1`). Used by endpoints that live outside the versioned surface,
   * such as branded short-link management.
   */
  unversioned?: boolean;

  /**
   * Idempotency key for this request (1-255 printable ASCII characters).
   * When omitted, POST requests are automatically assigned a unique key
   * that is reused across retry attempts, so on endpoints with idempotency
   * support (all message-sending endpoints) the server can recognize a
   * retry of a request that already reached it and return the original
   * result instead of executing again. Supply your own key to extend that
   * protection across process restarts.
   */
  idempotencyKey?: string;

  /**
   * Set to false to skip auto-generating an idempotency key for a POST.
   * Used for the batch endpoint, where the server dedupes header-less
   * retries by request content and an auto key would bypass that net.
   * A caller-supplied idempotencyKey is always sent regardless.
   */
  autoIdempotencyKey?: boolean;

  /**
   * Set to true to retry only a request the API provably never ran (a 429
   * `too_many_concurrent_verifications`). A 5xx, a timeout or a network
   * error is thrown at once. Used for calls that change state on every
   * attempt, such as submitting a WhatsApp verification code.
   */
  retryUnsentOnly?: boolean;
}

/**
 * Per-call options accepted by mutating resource methods.
 */
export interface IdempotentRequestOptions {
  /**
   * Idempotency key for this operation (1-255 printable ASCII characters).
   *
   * The SDK already generates a key per logical request automatically, so
   * the server can dedupe the SDK's own timeout retries. Supply your own
   * key when you need idempotency across process restarts or your own
   * retry loops — repeating a request with the same key within 24 hours
   * returns the original response instead of executing again.
   *
   * Note: a 2xx response, or a 4xx other than a 429, is recorded under the
   * key once the original attempt completes, and repeating the request with
   * the same key returns it; use a fresh key to run a refused request again.
   * A 5xx or a 429 is never recorded, so retry it under the same key.
   *
   * @example
   * ```typescript
   * await sendly.messages.send(
   *   { to: '+15551234567', text: 'Your order shipped!' },
   *   { idempotencyKey: `order-4821-shipped` }
   * );
   * ```
   */
  idempotencyKey?: string;
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
  // Retired: the API has never emitted these and rejects them when you
  // subscribe. Kept so existing code still compiles; they will go in the
  // next major. Do not add them to a webhook's events array.
  | "message.queued"
  | "message.undelivered"
  | "message.sent"
  | "message.delivered"
  | "message.read"
  | "message.failed"
  | "message.bounced"
  | "message.retrying"
  | "message.received"
  | "message.opt_out"
  | "message.opt_in"
  | "verification.created"
  | "verification.delivered"
  | "verification.verified"
  | "verification.expired"
  | "verification.failed"
  | "verification.resent"
  | "verification.delivery_failed"
  | "conversation.created"
  | "conversation.updated"
  | "draft.created"
  | "draft.approved"
  | "draft.rejected"
  | "contact.auto_flagged"
  | "contact.marked_valid"
  | "contacts.lookup_completed"
  | "contacts.bulk_marked_valid"
  | "brand.verified"
  | "brand.failed"
  | "campaign.approved"
  | "campaign.rejected"
  | "campaign.suspended"
  | "assignment.confirmed"
  | "assignment.failed"
  | "rcs_brand.verified"
  | "rcs_brand.failed"
  | "rcs_agent.testing"
  | "rcs_agent.live"
  | "rcs_agent.rejected"
  | "rcs_agent.action_required"
  | "port.completed"
  | "port_out.requested"
  | "port_out.completed"
  | "port_out.rejected"
  | "port_out.cancelled"
  | "number.activated"
  | "number.failed"
  | "number.requirements_required"
  | "number.released"
  | "whatsapp_account.connected"
  | "whatsapp_account.failed"
  | "whatsapp_template.approved"
  | "whatsapp_template.rejected"
  | "whatsapp_template.paused"
  | "call.started"
  | "call.completed"
  | "call.recording.ready"
  | "short_code.action_required"
  | "short_code.rejected"
  | "short_code.filed"
  | "short_code.live"
  | "short_code.suspended"
  | "short_code.reactivated"
  | "short_code.payment_succeeded"
  | "short_code.payment_failed";

/**
 * Source of a list-health event. Frozen enum — new values will be
 * added in minor SDK versions, never removed.
 */
export type ListHealthEventSource =
  | "send_failure"
  | "carrier_lookup"
  | "user_action"
  | "bulk_mark_valid";

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
  message_format?: "sms" | "mms" | "whatsapp" | "rcs";
  media_urls?: string[];
  batch_id?: string | null;
  /** When the recipient read the message (Unix seconds), on read receipts */
  read_at?: number | string;
}

/**
 * Webhook event payload from Sendly
 */
export interface WebhookEvent {
  /** Unique event identifier (evt_xxx) */
  id: string;
  /** Event type */
  type: WebhookEventType | (string & {});
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
  /**
   * HTTPS endpoint URL. A test key can only register localhost or a tunnel
   * host such as ngrok, loca.lt or webhook.site.
   */
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
 * Options for replaying webhook deliveries
 */
export interface WebhookRedeliverOptions {
  /** Earliest delivery created_at to consider, ISO-8601 (default: now − 24h) */
  since?: string;
  /** Latest delivery created_at to consider, ISO-8601 (default: now) */
  until?: string;
  /** Filter by event type (default: all) */
  eventTypes?: WebhookEventType[];
  /** Replay deliveries in any of these statuses (default: ['failed', 'cancelled']) */
  statuses?: DeliveryStatus[];
  /** Maximum number of deliveries to requeue (default: 1000, max 10000) */
  limit?: number;
}

/**
 * Result of replaying webhook deliveries
 */
export interface WebhookRedeliverResult {
  message: string;
  /** Number of deliveries that were re-queued */
  requeued: number;
  /** Number of deliveries that failed to re-queue */
  skipped: number;
  /** True if the matching set was larger than `limit` */
  truncated: boolean;
  /** Total number of matching deliveries before the limit was applied */
  windowSize: number;
  /** IDs of the new delivery records created by the replay */
  deliveryIds: string[];
  since: string;
  until: string;
  limit: number;
}

/**
 * Options for backfilling missed webhook deliveries from the message log
 */
export interface WebhookBackfillOptions {
  /** Earliest message created_at to consider, ISO-8601 (default: now − 24h) */
  since?: string;
  /** Latest message created_at to consider, ISO-8601 (default: now) */
  until?: string;
  /** Filter by event type (default: subscribed message events) */
  eventTypes?: WebhookEventType[];
  /** Maximum number of events to synthesize (default: 1000, max 10000) */
  limit?: number;
}

/**
 * Result of backfilling missed webhook deliveries
 */
export interface WebhookBackfillResult {
  message: string;
  /** Number of deliveries synthesized and dispatched */
  synthesized: number;
  /** Synthesized count grouped by event type */
  byType: Record<string, number>;
  /** True if there were more eligible events than `limit` */
  truncated: boolean;
  /** Total number of messages scanned for the window */
  candidatesScanned: number;
  /** IDs of the new delivery records */
  deliveryIds: string[];
  since: string;
  until: string;
  limit: number;
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
  /** Whether the endpoint accepted the delivery */
  success?: boolean;
  /** HTTP status code from the endpoint, 0 when it did not answer */
  httpStatus?: number;
  /** Response body from the endpoint */
  responseBody?: string | null;
}

/**
 * An event type you can subscribe a webhook to, with what it means
 */
export interface WebhookEventTypeDetail {
  /** Event type name */
  type: WebhookEventType;
  /** What the event reports */
  description: string;
}

/**
 * The test delivery sent by {@link WebhooksResource.test}
 */
export interface WebhookTestDelivery {
  /** Delivery ID (del_xxx) */
  id: string;
  /** Delivery ID (same as `id`) */
  deliveryId?: string;
  /** URL the test event was sent to */
  webhookUrl?: string;
  /** Always "webhook.test" */
  eventType: string;
  /** Delivery status */
  status: DeliveryStatus;
  /** Response time in milliseconds */
  responseTime?: number;
  /** HTTP status code from the endpoint */
  statusCode?: number;
  /** Start of the response body from the endpoint */
  responseBody?: string;
  /** Error message if the delivery failed */
  error?: string;
  /** When the delivery succeeded (ISO 8601) */
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
  /** Summary of the result */
  message?: string;
  /** The test delivery */
  delivery?: WebhookTestDelivery;
}

/**
 * Response from rotating webhook secret
 */
export interface WebhookSecretRotation {
  /** @deprecated Not returned by the API; always undefined */
  webhook?: Webhook;
  /** New signing secret */
  newSecret: string;
  /** New signing secret (same value as `newSecret`) */
  secret?: string;
  /**
   * The webhook's secret version as the API reports it. Rotating through
   * the API does not change it, so it does not count rotations.
   */
  newSecretVersion?: number;
  /** When the secret was rotated (ISO 8601) */
  rotatedAt?: string;
  /**
   * Grace period the API reports, in hours. Deliveries are signed with the
   * new secret as soon as the rotation returns.
   */
  gracePeriodHours?: number;
  /** @deprecated Not returned by the API; always undefined */
  oldSecretExpiresAt?: string;
  /** Message about the rotation */
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
  /** The workspace the API key belongs to, or `null` when it has none */
  organization?: {
    id: string;
    name: string;
    isPersonal: boolean;
  } | null;
  /** Credit balance of the key's workspace */
  credits?: {
    balance: number;
    reservedBalance: number;
  };
  /** Business verification of the key's workspace, or `null` when there is none */
  verification?: {
    status: string;
    type: string | null;
    region: string | null;
    submittedAt: string | null;
    updatedAt: string | null;
  } | null;
  /** The API key that made the request */
  apiKey?: {
    id: string;
    name: string;
    type: "test" | "live";
    scopes: string[];
    createdAt?: string;
    lastUsedAt?: string | null;
  };
  /** Sending limits for the API key */
  limits?: {
    messagesPerMinute: number;
    messagesPerDay: number;
  };
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
  /**
   * Transaction type. Auto-recharges are recorded as `purchase`, and
   * `adjustment` is never recorded; any type added later arrives as its
   * own string.
   */
  type:
    | "purchase"
    | "usage"
    | "refund"
    | "adjustment"
    | "bonus"
    | "transfer"
    | "admin_grant"
    | "admin_seed"
    | (string & {});
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
  /** @deprecated No endpoint returns the last four characters; always undefined */
  lastFour?: string;
  /** Permissions granted (the key's scopes) */
  permissions: string[];
  /** The key's scopes */
  scopes?: string[];
  /** Whether the key is active */
  isActive?: boolean;
  /** When key was created (ISO 8601) */
  createdAt: string;
  /** When key was last used (ISO 8601) */
  lastUsedAt?: string | null;
  /** When key expires (ISO 8601) */
  expiresAt?: string | null;
  /** Whether key is revoked */
  isRevoked: boolean;
}

/**
 * Usage statistics for a single API key (see {@link AccountResource.getApiKeyUsage}).
 */
export interface ApiKeyUsage {
  /** Key ID the statistics belong to */
  keyId: string;
  /** Key name/label */
  keyName: string;
  /** Rolled-up totals across the recorded requests */
  summary: {
    /** Number of recorded requests */
    totalRequests: number;
    /** Credits consumed by those requests */
    totalCredits: number;
    /** When the key was last used (ISO 8601), or null if never */
    lastUsed: string | null;
  };
  /** Most recent requests, newest first */
  recentRequests: Array<{
    endpoint: string;
    method: string;
    statusCode: number;
    creditsUsed: number;
    createdAt: string;
  }>;
  /** Request counts per endpoint, busiest first */
  endpointBreakdown: Array<{ endpoint: string; count: number }>;
}

/**
 * A rotated (newly issued) API key. Carries every {@link ApiKey} field plus the
 * one-time raw secret and a caution to store it.
 */
export interface RotatedApiKey extends ApiKey {
  /** The raw new secret (`sk_…`). Shown only once — store it now. */
  key: string;
  /** Human-readable caution about the one-time secret. */
  warning: string;
}

/**
 * Response from rotating an API key (see {@link AccountResource.rotateApiKey}).
 */
export interface RotateApiKeyResponse {
  /** The newly issued key, including its one-time raw `key` and a `warning`. */
  newKey: RotatedApiKey;
  /** The predecessor key, now counting down its grace period. */
  oldKey: ApiKey;
  /** Human-readable summary (e.g. when the old key expires). */
  message: string;
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
 * Verification status. The API returns `pending`, `verified`, `expired` and
 * `failed`; `invalid` is never returned.
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
  /**
   * @deprecated Never set: a wrong code throws an `invalid_code` error
   * instead. Read `error.response.remaining_attempts`.
   */
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
  /** @deprecated Not returned by the preview endpoint; always undefined */
  name?: string;
  /** Original text with variables */
  originalText: string;
  /** Interpolated text with sample values */
  previewText: string;
  /** Number of characters in the preview text */
  characterCount?: number;
  /** Number of SMS segments the preview text needs */
  segmentCount?: number;
  /** Variables detected (the preview endpoint does not list them, so this is empty) */
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
 * Campaign status values. A campaign that has been sent is `completed`.
 * `sent` and `paused` are never returned; as a list filter, `sent` matches
 * completed campaigns.
 */
export type CampaignStatus =
  | "draft"
  | "scheduled"
  | "sending"
  | "completed"
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
  /** The contact list to send to, as a one-element array (a campaign targets one list) */
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
  /** The contact list to send to, as a one-element array (a campaign targets one list) */
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
  /** @deprecated Not returned by the preview endpoint; always undefined */
  estimatedSegments?: number;
  /** Estimated credits needed */
  estimatedCredits: number;
  /** Current credit balance */
  currentBalance: number;
  /** Whether user has enough credits */
  hasEnoughCredits: boolean;
  /** Contacts on the list that opted out and will be skipped */
  optedOutCount?: number;
  /** Contacts with a missing or malformed phone number */
  invalidCount?: number;
  /** Contacts skipped because their number was flagged as unable to receive SMS */
  invalidNumberCount?: number;
  /** Contacts skipped because their number is a landline */
  landlineCount?: number;
  /** Up to five of the recipients */
  sampleRecipients?: Array<{ phone: string; name?: string }>;
  /**
   * Breakdown by country, from `byCountry`. `creditsPerMessage` is the
   * average for that country.
   */
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
 * Result of {@link CampaignsResource.send}: the batch the campaign's
 * messages went out in. Call {@link CampaignsResource.get} for the campaign
 * itself.
 */
export interface CampaignSendResult {
  /** The campaign that was sent */
  id: string;
  /** Batch the messages were sent in; see {@link MessagesResource.getBatch} */
  batchId: string;
  /** Status of that batch */
  status: BatchStatus;
  /** Messages in the batch */
  recipientCount: number;
  /** Messages sent */
  sentCount: number;
  /** Messages that failed */
  failedCount: number;
  /** Messages being retried */
  retryingCount?: number;
  /** Credits used */
  creditsUsed: number;
  /** Credits returned for messages that failed */
  creditsRefunded: number;
  /** Recipients skipped because they opted out */
  optedOutSkipped: number;
  /** Recipients skipped because their number can't receive SMS */
  invalidSkipped: number;
  /** Each message in the batch (empty while the batch is processing) */
  messages: BatchMessageResult[];
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
   * When a user manually cleared an auto-flag on this contact. Carrier
   * re-checks that would re-flag the contact as invalid respect this
   * timestamp and leave the contact clean, so your manual decisions
   * survive future lookups.
   */
  userMarkedValidAt?: string | null;

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
  /**
   * True if a carrier lookup for this scope was already running when you
   * called this. The dashboard renders an "already in progress" toast when
   * it sees this flag; server-side integrators can treat it as a soft
   * no-op and wait for `contacts.lookup_completed` webhook.
   */
  alreadyRunning?: boolean;
  message?: string;
}

/**
 * Scope for `contacts.bulkMarkValid()`. Pass either an explicit id array
 * (up to 10,000 per call) OR a `listId` — not both. Foreign ids silently
 * no-op via the per-org filter.
 */
export interface BulkMarkValidOptions {
  /** Explicit contact ids to clear (max 10,000). */
  ids?: string[];
  /** Clear every flagged member of this list. */
  listId?: string;
}

/**
 * Response from `contacts.bulkMarkValid()`.
 */
export interface BulkMarkValidResponse {
  /** Number of contacts whose invalid flag was actually cleared. */
  cleared: number;
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

/**
 * Business entity type of a verification
 */
export type VerificationEntityType =
  | "SOLE_PROPRIETOR"
  | "PRIVATE_PROFIT"
  | "PUBLIC_PROFIT"
  | "NON_PROFIT"
  | "GOVERNMENT";

/**
 * Changes to apply to a verification copied from another workspace
 */
export interface ProvisionVerificationOverrides {
  businessName?: string;
  doingBusinessAs?: string;
  website?: string;
  entityType?: VerificationEntityType;
  useCase?: string;
  useCaseSummary?: string;
  sampleMessages?: string;
  monthlyVolume?: string;
  additionalInformation?: string;
  brn?: string;
  brnType?: string;
  brnCountry?: string;
  contact?: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
  };
  address?: {
    addr1?: string;
    addr2?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
  };
}

export interface ProvisionWorkspaceOptions {
  name: string;
  sourceWorkspaceId?: string;
  inheritWithNewNumber?: boolean;
  /**
   * Changes to the copied verification. Applied when inheriting with a new
   * number (`sourceWorkspaceId` with `inheritWithNewNumber: true`).
   */
  verificationOverrides?: ProvisionVerificationOverrides;
  /**
   * Business details for a workspace with its own verification. `brn` is
   * required, and `website` is required unless `generateBusinessPage` is true.
   */
  verification?: {
    businessName: string;
    doingBusinessAs?: string;
    website?: string;
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
    entityType?: VerificationEntityType;
    useCase: string;
    useCaseSummary: string;
    sampleMessages: string;
    optInWorkflow?: string;
    optInImageUrls?: string;
    monthlyVolume?: string;
    additionalInformation?: string;
    ageGatedContent?: boolean;
    privacyUrl?: string;
    termsUrl?: string;
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
    /**
     * Verification type, such as `toll_free`. Only an inherited verification
     * carries it; when the workspace got its own verification (`inherited`
     * is false), it is undefined.
     */
    type: string;
    tollFreeNumber: string | null;
    inherited?: boolean;
    newNumber?: boolean;
  };
  credits?: {
    balance: number;
    transferred?: number;
    /** Set instead of the other fields when the credit transfer failed */
    error?: string;
  };
  key?: {
    id: string;
    name: string;
    key: string;
    keyPrefix: string;
    type: string;
  };
  optInPage?: {
    id?: string;
    url: string;
    slug: string;
    /** @deprecated Not returned by the API; use `id` */
    pageId?: string;
    /** Set instead of the other fields when the page could not be created */
    error?: string;
  };
  legalPages?: {
    privacyUrl?: string;
    termsUrl?: string;
    privacyPageId?: string;
    termsPageId?: string;
    /** Set instead of the other fields when the pages could not be created */
    error?: string;
  };
  /** The generated business page, when `generateBusinessPage` was set */
  businessPage?: {
    id: string;
    slug: string;
    url: string;
    /** Set instead of the other fields when the page could not be created */
    error?: string;
  };
  webhook?: {
    /** @deprecated Not returned by the API; always undefined */
    id?: string;
    url: string;
    /** Set instead of `url` when the webhook could not be saved */
    error?: string;
  };
  apiBaseUrl?: string;
  dashboardUrl?: string;
}

/**
 * Result of giving a workspace another workspace's verification
 */
export interface InheritVerificationResult {
  /** The workspace's verification */
  verificationId: string;
  /** Verification status */
  status: string;
  /** Verification type (e.g. "toll_free") */
  type: string;
  /** The workspace's toll-free number, if it has one yet */
  tollFreeNumber: string | null;
  /** The workspace the verification came from */
  inheritedFrom: string;
  /** True when a new toll-free number was ordered for the workspace */
  newNumber?: boolean;
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
  /** Display name for the key (defaults to "API key") */
  name?: string;
  type?: "live" | "test";
  /** Scopes to grant the key (defaults to every scope) */
  scopes?: string[];
}

export interface CreatedApiKey {
  id: string;
  name: string;
  key: string;
  keyPrefix: string;
  type?: "live" | "test";
  scopes?: string[];
  createdAt: string;
}

export interface WorkspaceCredits {
  balance: number;
  lifetimeCredits: number;
}

export interface EnterpriseWebhook {
  url: string;
  /** Event types delivered, or `null` for all */
  events?: string[] | null;
  /** Workspaces whose events are delivered, or `null` for all */
  workspaces?: string[] | null;
  /**
   * Secret to verify deliveries with. Returned only by the first `set()`,
   * when the secret is created; store it then.
   */
  signingSecret?: string;
}

/**
 * Result of rotating the enterprise webhook signing secret
 */
export interface EnterpriseWebhookSecretRotation {
  success: boolean;
  /** The new signing secret. Shown only once; store it now. */
  secret: string;
  /** When the secret was rotated (ISO 8601) */
  rotatedAt: string;
  message: string;
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
  /** The period asked for. The totals are current and do not depend on it. */
  period: string;
  /** Credits held across your workspaces */
  totalBalance?: number;
  /** Credits ever added across your workspaces */
  totalLifetime?: number;
  /** Credits used (`totalLifetime` minus `totalBalance`) */
  totalUsed?: number;
  /** Number of workspaces counted */
  workspaceCount?: number;
  /** @deprecated The API returns totals, not a daily series; always empty */
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

/** A compliance problem with a short code application, by field. */
export interface ShortCodeIssue {
  path: string;
  message: string;
}

/** A carrier form the application needs, and where it stands. */
export interface ShortCodeDocument {
  kind: string;
  templateReady: boolean;
  signedAt: string | null;
  signedByName: string | null;
  awaitingSignature: boolean;
}

/** The short code application a workspace is filling in, or has filed. */
export interface ShortCodeApplication {
  id: string | null;
  shortCode: string | null;
  countryCode: string;
  status: string;
  reviewStatus: string;
  reviewNote: string | null;
  orderType: "new" | "migration";
  codeType: "random" | "vanity";
  contentProviderSameAsBrand: boolean;
  sampleMessages: string[];
  useCase: string | null;
  optInFlow: string | null;
  optInConfirmation: string | null;
  helpResponse: string | null;
  stopConfirmation: string | null;
  messageFrequency: string | null;
  campaignKeyword: string | null;
  expectedMonthlyVolume: string | null;
  expectedDailyVolume: string | null;
  privacyPolicyUrl: string | null;
  termsUrl: string | null;
  requestedDigits: string | null;
  losingProvider: string | null;
  brandContactName: string | null;
  brandContactEmail: string | null;
  brandContactPhone: string | null;
  contentProviderLegalName: string | null;
  contentProviderEin: string | null;
  contentProviderContactName: string | null;
  contentProviderContactEmail: string | null;
  contentProviderContactPhone: string | null;
  brandRegistrationStatus: string;
  contentProviderRegistrationStatus: string;
  submittedAt: string | null;
  /** When Sendly finished reviewing the application */
  reviewedAt?: string | null;
  filedAt: string | null;
  activatedAt: string | null;
  /** When the registry registration is next due to be re-vetted */
  registryRevettingDueAt?: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

/** The application plus everything the caller needs to act on it. */
export interface ShortCodeApplicationView {
  enabled: boolean;
  application: ShortCodeApplication;
  editable: boolean;
  lockMessage: string | null;
  canStartNewApplication: boolean;
  requiredDocuments: string[];
  missingDocuments: string[];
  documents: ShortCodeDocument[];
  quote: {
    codeType: "random" | "vanity";
    monthlyUsd: number | null;
    /** One-time setup fee, in US dollars */
    setupUsd?: number;
    currency: "USD";
    /** Always false, kept for older clients; `billing` says what is charged */
    autoBilled: false;
    /** One-time setup fee in cents, charged at submit */
    setupCents?: number;
    /** Monthly lease in cents, fixed when the application is submitted */
    monthlyCents?: number;
    /** The lease runs at least this many months from go-live */
    minimumTermMonths?: number;
    /** When the setup fee is charged */
    setupChargedAt?: "submit";
    /** When the first lease month is charged */
    leaseStartsAt?: "go_live";
  };
  /** Where the setup fee and the lease stand, and every charge */
  billing?: ShortCodeBilling;
  /** Whether the workspace's business is verified, which the application needs */
  verification?: {
    verified: boolean;
    state: "verified" | "in_review" | "needs_attention" | "not_started";
    href: string;
  };
  carriers: {
    approved: number;
    total: number;
    overall: "not_submitted" | "in_progress" | "approved" | "rejected";
    /** Where each carrier's certification stands */
    byCarrier?: Array<{
      carrier: string;
      label: string;
      status: "not_submitted" | "submitted" | "in_review" | "approved" | "rejected";
      updatedAt: string | null;
    }>;
  };
  submitted?: boolean;
  alreadySubmitted?: boolean;
  /** On submit: the setup fee's status and whether this call charged it */
  payment?: { status: "paid" | "waived"; charged: boolean };
  ignoredFields?: string[];
}

/** Where a short code's setup fee stands. */
export type ShortCodeSetupFeeStatus =
  | "unpaid"
  | "processing"
  | "requires_action"
  | "failed"
  | "no_payment_method"
  | "paid"
  | "waived"
  | "refund_pending"
  | "refunded";

/** Where a short code's monthly lease stands. */
export type ShortCodeLeaseState =
  | "not_started"
  | "running"
  | "past_due"
  | "paused"
  | "ending"
  | "ended";

/** A lease month that has not been paid. */
export interface ShortCodeLeasePastDue {
  chargeId: string;
  amountCents: number;
  status: string;
  periodStart: string | null;
  periodEnd: string | null;
  firstFailedAt: string | null;
  /** When sending from the code pauses if the month is still unpaid */
  pauseAt: string | null;
  noticeStage: string | null;
}

/** The monthly lease of a short code. */
export interface ShortCodeLease {
  monthlyCents: number;
  minimumTermMonths: number;
  /** Present on the application; always `go_live` */
  startsAt?: "go_live";
  state: ShortCodeLeaseState;
  /** False while Sendly is not billing leases yet */
  billingEnabled: boolean;
  startedAt: string | null;
  nextChargeAt: string | null;
  paidThrough: string | null;
  termEndsAt: string | null;
  /** Set once the lease is cancelled: the day it ends */
  endsAt: string | null;
  cancelRequestedAt: string | null;
  pastDue: ShortCodeLeasePastDue | null;
  /** Months that fell due and are charged in the next daily run */
  dueMonths: number;
  dueCents: number;
}

/** One short code charge: the setup fee or a lease month. */
export interface ShortCodeCharge {
  id: string;
  kind: "setup" | "lease";
  amountCents: number;
  /** `paid`, `refunded`, `waived`, `not_charged`, or a payment still being taken */
  status: string;
  paidAt: string | null;
  refundedCents: number;
  refundedAt: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  createdAt: string | null;
}

/** Where the money stands on a short code application. */
export interface ShortCodeBilling {
  setupFee: {
    amountCents: number;
    status: ShortCodeSetupFeeStatus;
    chargedAt: "submit";
    paidAt: string | null;
    refundedCents: number;
    refundedAt: string | null;
  };
  lease: ShortCodeLease;
  terms: {
    version: string;
    acceptedVersion: string | null;
    acceptedAt: string | null;
  };
  refundPolicy: "full_refund_before_filing";
  /** Set when the workspace isn't charged by card */
  exempt: "mock" | "enterprise" | null;
  charges: ShortCodeCharge[];
}

/** Where a listed short code's setup fee and lease stand. */
export interface ShortCodeListBilling {
  setupFee: { status: ShortCodeSetupFeeStatus; amountCents: number };
  lease: ShortCodeLease;
}

/** What a dry run of the application says, without changing anything. */
export interface ShortCodePreflight {
  ok: boolean;
  issues: ShortCodeIssue[];
  requiredDocuments: string[];
  missingDocuments: string[];
  documents: ShortCodeDocument[];
  ignoredFields?: string[];
}

/** A short code leased to the workspace. */
export interface ShortCode {
  id: string;
  shortCode: string | null;
  countryCode: string;
  status: string;
  /** Where Sendly's review of the application stands */
  reviewStatus?: string;
  useCase: string;
  createdAt: string;
  /** Where the code's setup fee and lease stand */
  billing?: ShortCodeListBilling;
}

/** Fields a caller may set on the application. */
export type ShortCodeApplicationInput = Partial<
  Pick<
    ShortCodeApplication,
    | "useCase"
    | "optInFlow"
    | "optInConfirmation"
    | "helpResponse"
    | "stopConfirmation"
    | "messageFrequency"
    | "campaignKeyword"
    | "expectedMonthlyVolume"
    | "expectedDailyVolume"
    | "privacyPolicyUrl"
    | "termsUrl"
    | "countryCode"
    | "orderType"
    | "codeType"
    | "requestedDigits"
    | "losingProvider"
    | "brandContactName"
    | "brandContactEmail"
    | "brandContactPhone"
    | "contentProviderLegalName"
    | "contentProviderEin"
    | "contentProviderContactName"
    | "contentProviderContactEmail"
    | "contentProviderContactPhone"
    | "contentProviderSameAsBrand"
    | "sampleMessages"
  >
>;

/** The body of a submit: final answers, plus acceptance of the price. */
export type ShortCodeSubmitInput = ShortCodeApplicationInput & {
  /**
   * Accepts the $999 setup fee, charged to the workspace's card when you
   * submit, the monthly lease from go-live and the 3-month minimum. Submit
   * is refused with `short_code_invalid_application` until this is `true`.
   */
  acceptTerms?: boolean;
};
