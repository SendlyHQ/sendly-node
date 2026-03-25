import type { HttpClient } from "../utils/http";
import type {
  Conversation,
  ConversationListResponse,
  ConversationWithMessages,
  ListConversationsOptions,
  GetConversationOptions,
  UpdateConversationRequest,
  ReplyToConversationRequest,
  SuggestRepliesResponse,
  ConversationContext,
  LabelListResponse,
  Message,
} from "../types";

export class ConversationsResource {
  private readonly http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  async list(options?: ListConversationsOptions): Promise<ConversationListResponse> {
    const params = new URLSearchParams();
    if (options?.limit) params.set("limit", String(options.limit));
    if (options?.offset) params.set("offset", String(options.offset));
    if (options?.status) params.set("status", options.status);
    const qs = params.toString();
    return this.http.request<ConversationListResponse>({
      method: "GET",
      path: `/conversations${qs ? `?${qs}` : ""}`,
    });
  }

  async get(id: string, options?: GetConversationOptions): Promise<ConversationWithMessages> {
    const params = new URLSearchParams();
    if (options?.includeMessages) params.set("include_messages", "true");
    if (options?.messageLimit) params.set("message_limit", String(options.messageLimit));
    if (options?.messageOffset) params.set("message_offset", String(options.messageOffset));
    const qs = params.toString();
    return this.http.request<ConversationWithMessages>({
      method: "GET",
      path: `/conversations/${id}${qs ? `?${qs}` : ""}`,
    });
  }

  async reply(conversationId: string, request: ReplyToConversationRequest): Promise<Message> {
    return this.http.request<Message>({
      method: "POST",
      path: `/conversations/${conversationId}/messages`,
      body: { ...request },
    });
  }

  async update(id: string, request: UpdateConversationRequest): Promise<Conversation> {
    return this.http.request<Conversation>({
      method: "PATCH",
      path: `/conversations/${id}`,
      body: { ...request },
    });
  }

  async markRead(id: string): Promise<Conversation> {
    return this.http.request<Conversation>({
      method: "POST",
      path: `/conversations/${id}/mark-read`,
    });
  }

  async close(id: string): Promise<Conversation> {
    return this.http.request<Conversation>({
      method: "POST",
      path: `/conversations/${id}/close`,
    });
  }

  async reopen(id: string): Promise<Conversation> {
    return this.http.request<Conversation>({
      method: "POST",
      path: `/conversations/${id}/reopen`,
    });
  }

  async getContext(conversationId: string, options?: { maxMessages?: number }): Promise<ConversationContext> {
    const params = new URLSearchParams();
    if (options?.maxMessages) params.set("max_messages", String(options.maxMessages));
    const qs = params.toString();
    return this.http.request<ConversationContext>({
      method: "GET",
      path: `/conversations/${conversationId}/context${qs ? `?${qs}` : ""}`,
    });
  }

  async suggestReplies(conversationId: string): Promise<SuggestRepliesResponse> {
    return this.http.request<SuggestRepliesResponse>({
      method: "POST",
      path: `/conversations/${conversationId}/suggest-replies`,
    });
  }

  async addLabels(conversationId: string, labelIds: string[]): Promise<LabelListResponse> {
    return this.http.request<LabelListResponse>({
      method: "POST",
      path: `/conversations/${conversationId}/labels`,
      body: { labelIds },
    });
  }

  async removeLabel(conversationId: string, labelId: string): Promise<void> {
    await this.http.request<void>({
      method: "DELETE",
      path: `/conversations/${conversationId}/labels/${labelId}`,
    });
  }
}
