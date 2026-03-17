import type { HttpClient } from "../utils/http";
import type {
  MessageDraft,
  DraftListResponse,
  CreateDraftRequest,
  UpdateDraftRequest,
  ListDraftsOptions,
} from "../types";

export class DraftsResource {
  private readonly http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  async create(request: CreateDraftRequest): Promise<MessageDraft> {
    return this.http.request<MessageDraft>({
      method: "POST",
      path: "/drafts",
      body: { ...request },
    });
  }

  async list(options?: ListDraftsOptions): Promise<DraftListResponse> {
    const params = new URLSearchParams();
    if (options?.conversationId) params.set("conversation_id", options.conversationId);
    if (options?.status) params.set("status", options.status);
    if (options?.limit) params.set("limit", String(options.limit));
    if (options?.offset) params.set("offset", String(options.offset));
    const qs = params.toString();
    return this.http.request<DraftListResponse>({
      method: "GET",
      path: `/drafts${qs ? `?${qs}` : ""}`,
    });
  }

  async get(id: string): Promise<MessageDraft> {
    return this.http.request<MessageDraft>({
      method: "GET",
      path: `/drafts/${id}`,
    });
  }

  async update(id: string, request: UpdateDraftRequest): Promise<MessageDraft> {
    return this.http.request<MessageDraft>({
      method: "PATCH",
      path: `/drafts/${id}`,
      body: { ...request },
    });
  }

  async approve(id: string): Promise<MessageDraft> {
    return this.http.request<MessageDraft>({
      method: "POST",
      path: `/drafts/${id}/approve`,
    });
  }

  async reject(id: string, reason?: string): Promise<MessageDraft> {
    return this.http.request<MessageDraft>({
      method: "POST",
      path: `/drafts/${id}/reject`,
      body: reason ? { reason } : {},
    });
  }
}
