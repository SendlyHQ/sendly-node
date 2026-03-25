import type { HttpClient } from "../utils/http";
import type {
  AutoLabelRule,
  AutoLabelRuleListResponse,
  CreateAutoLabelRuleRequest,
  UpdateAutoLabelRuleRequest,
} from "../types";

export class RulesResource {
  private readonly http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  async list(): Promise<AutoLabelRuleListResponse> {
    return this.http.request<AutoLabelRuleListResponse>({
      method: "GET",
      path: "/rules",
    });
  }

  async create(request: CreateAutoLabelRuleRequest): Promise<AutoLabelRule> {
    return this.http.request<AutoLabelRule>({
      method: "POST",
      path: "/rules",
      body: { ...request },
    });
  }

  async update(id: string, request: UpdateAutoLabelRuleRequest): Promise<AutoLabelRule> {
    return this.http.request<AutoLabelRule>({
      method: "PATCH",
      path: `/rules/${id}`,
      body: { ...request },
    });
  }

  async delete(id: string): Promise<void> {
    await this.http.request<void>({
      method: "DELETE",
      path: `/rules/${id}`,
    });
  }
}
