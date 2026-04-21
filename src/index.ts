/**
 * Sendly Node.js SDK
 *
 * Official SDK for the Sendly SMS API.
 *
 * @example
 * ```typescript
 * import Sendly from '@sendly/node';
 *
 * const sendly = new Sendly('sk_live_v1_your_api_key');
 *
 * // Send an SMS
 * const message = await sendly.messages.send({
 *   to: '+15551234567',
 *   text: 'Hello from Sendly!'
 * });
 *
 * console.log(`Message sent: ${message.id}`);
 * ```
 *
 * @packageDocumentation
 */

// Main client
export { Sendly, Sendly as default } from "./client";

// Types - Messages
export type {
  SendlyConfig,
  SendMessageRequest,
  Message,
  MessageStatus,
  MessageType,
  SenderType,
  ListMessagesOptions,
  MessageListResponse,
  ScheduleMessageRequest,
  ScheduledMessage,
  ScheduledMessageStatus,
  ListScheduledMessagesOptions,
  ScheduledMessageListResponse,
  CancelledMessageResponse,
  BatchMessageItem,
  BatchMessageRequest,
  BatchMessageResult,
  BatchStatus,
  BatchMessageResponse,
  ListBatchesOptions,
  BatchListResponse,
  ApiErrorResponse,
  SendlyErrorCode,
  RateLimitInfo,
  PricingTier,
} from "./types";

// Types - Media
export type { MediaFile, MediaUploadOptions } from "./types";

// Types - Webhooks
export type {
  WebhookEventType,
  ListHealthEventSource,
  CircuitState,
  DeliveryStatus,
  Webhook,
  WebhookCreatedResponse,
  CreateWebhookOptions,
  UpdateWebhookOptions,
  WebhookDelivery,
  WebhookTestResult,
  WebhookSecretRotation,
} from "./types";

// Types - Account & Credits
export type { Account, Credits, CreditTransaction, ApiKey } from "./types";

// Types - Verify (OTP)
export type {
  VerificationStatus,
  VerificationDeliveryStatus,
  SendVerificationRequest,
  SendVerificationResponse,
  CheckVerificationRequest,
  CheckVerificationResponse,
  Verification,
  ListVerificationsOptions,
  VerificationListResponse,
  VerifySessionStatus,
  CreateVerifySessionRequest,
  VerifySession,
  ValidateSessionTokenRequest,
  ValidateSessionTokenResponse,
} from "./types";

// Types - Templates
export type {
  TemplateVariable,
  TemplateStatus,
  Template,
  CreateTemplateRequest,
  UpdateTemplateRequest,
  TemplateListResponse,
  TemplatePreview,
} from "./types";

// Types - Campaigns
export type {
  CampaignStatus,
  Campaign,
  CreateCampaignRequest,
  UpdateCampaignRequest,
  ScheduleCampaignRequest,
  CampaignPreview,
  ListCampaignsOptions,
  CampaignListResponse,
} from "./types";

// Types - Contacts
export type {
  Contact,
  ContactList,
  CreateContactRequest,
  UpdateContactRequest,
  CreateContactListRequest,
  UpdateContactListRequest,
  ListContactsOptions,
  ContactListResponse,
  ContactListsResponse,
  ImportContactItem,
  ImportContactsRequest,
  ImportContactsError,
  ImportContactsResponse,
  CheckNumbersResponse,
  BulkMarkValidOptions,
  BulkMarkValidResponse,
} from "./types";

// Types - Enterprise
export type {
  EnterpriseAccount,
  EnterpriseWorkspaceSummary,
  EnterpriseWorkspace,
  EnterpriseWorkspaceDetail,
  CreateWorkspaceOptions,
  ProvisionWorkspaceOptions,
  ProvisionWorkspaceResult,
  TransferCreditsOptions,
  TransferCreditsResult,
  CreateKeyOptions,
  CreatedApiKey,
  WorkspaceCredits,
  EnterpriseWebhook,
  EnterpriseWebhookTestResult,
  AnalyticsOverview,
  MessageAnalyticsDataPoint,
  MessageAnalytics,
  DeliveryAnalyticsItem,
  CreditAnalyticsDataPoint,
  CreditAnalytics,
  AnalyticsPeriod,
  OptInPage,
  CreateOptInPageOptions,
  CreateOptInPageResult,
  UpdateOptInPageOptions,
  WorkspaceWebhook,
  SetWorkspaceWebhookOptions,
  SetWorkspaceWebhookResult,
  SuspendWorkspaceOptions,
  SuspendWorkspaceResult,
  ResumeWorkspaceResult,
  AutoTopUpSettings,
  UpdateAutoTopUpOptions,
  BillingBreakdownOptions,
  WorkspaceBillingItem,
  BillingBreakdown,
  BulkProvisionWorkspace,
  BulkProvisionResultItem,
  BulkProvisionResult,
  DnsRecord,
  SetCustomDomainResult,
  SendInvitationOptions,
  Invitation,
  QuotaSettings,
  UpdateQuotaOptions,
  GenerateBusinessPageOptions,
  GenerateBusinessPageResponse,
} from "./types";

// Types - Conversations
export type {
  ConversationStatus,
  Conversation,
  ListConversationsOptions,
  ConversationListResponse,
  ConversationWithMessages,
  GetConversationOptions,
  UpdateConversationRequest,
  ReplyToConversationRequest,
  SuggestedReply,
  SuggestRepliesResponse,
  Label,
  LabelListResponse,
  CreateLabelRequest,
  AddLabelsRequest,
  DraftStatus,
  MessageDraft,
  CreateDraftRequest,
  UpdateDraftRequest,
  DraftListResponse,
  ListDraftsOptions,
} from "./types";

// Constants
export {
  CREDITS_PER_SMS,
  SUPPORTED_COUNTRIES,
  ALL_SUPPORTED_COUNTRIES,
  SANDBOX_TEST_NUMBERS,
} from "./types";

// Errors
export {
  SendlyError,
  AuthenticationError,
  RateLimitError,
  InsufficientCreditsError,
  ValidationError,
  NotFoundError,
  NetworkError,
  TimeoutError,
} from "./errors";

// Utilities (for advanced usage)
export {
  validatePhoneNumber,
  validateMessageText,
  validateSenderId,
  getCountryFromPhone,
  isCountrySupported,
  calculateSegments,
} from "./utils/validation";

// Webhooks
export {
  Webhooks,
  WebhookSignatureError,
  verifyWebhookSignature,
  parseWebhookEvent,
  generateWebhookSignature,
  type WebhookEvent,
  type WebhookMessageData,
  type WebhookMessageStatus,
} from "./utils/webhooks";
