import type { HttpClient } from "../utils/http";
import { transformKeys } from "../utils/transform";
import type {
  EnterpriseAccount,
  EnterpriseWorkspace,
  EnterpriseWorkspaceDetail,
  CreateWorkspaceOptions,
  ProvisionWorkspaceOptions,
  TransferCreditsOptions,
  TransferCreditsResult,
  CreateKeyOptions,
  CreatedApiKey,
  WorkspaceCredits,
  EnterpriseWebhook,
  EnterpriseWebhookTestResult,
  AnalyticsOverview,
  MessageAnalytics,
  DeliveryAnalyticsItem,
  CreditAnalytics,
  AnalyticsPeriod,
  ProvisionWorkspaceResult,
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
  BillingBreakdown,
  BulkProvisionWorkspace,
  BulkProvisionResult,
  SetCustomDomainResult,
  SendInvitationOptions,
  Invitation,
  QuotaSettings,
  UpdateQuotaOptions,
} from "../types";

class WorkspacesSubResource {
  private readonly http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  async create(options: CreateWorkspaceOptions): Promise<EnterpriseWorkspace> {
    if (!options.name || options.name.trim().length === 0) {
      throw new Error("Workspace name is required");
    }

    const response = await this.http.request<unknown>({
      method: "POST",
      path: "/enterprise/workspaces",
      body: {
        name: options.name,
        ...(options.description && { description: options.description }),
      },
    });

    return transformKeys<EnterpriseWorkspace>(response);
  }

  async list(): Promise<{
    workspaces: EnterpriseWorkspace[];
    maxWorkspaces: number;
    workspacesUsed: number;
  }> {
    const response = await this.http.request<unknown>({
      method: "GET",
      path: "/enterprise/workspaces",
    });

    return transformKeys(response);
  }

  async get(workspaceId: string): Promise<EnterpriseWorkspaceDetail> {
    const response = await this.http.request<unknown>({
      method: "GET",
      path: `/enterprise/workspaces/${encodeURIComponent(workspaceId)}`,
    });

    return transformKeys<EnterpriseWorkspaceDetail>(response);
  }

  async delete(workspaceId: string): Promise<void> {
    await this.http.request<void>({
      method: "DELETE",
      path: `/enterprise/workspaces/${encodeURIComponent(workspaceId)}`,
    });
  }

  async submitVerification(
    workspaceId: string,
    data: {
      businessName: string;
      businessType: string;
      ein: string;
      address: string;
      city: string;
      state: string;
      zip: string;
      useCase: string;
      sampleMessages: string[];
      monthlyVolume?: number;
    },
  ): Promise<unknown> {
    const response = await this.http.request<unknown>({
      method: "POST",
      path: `/enterprise/workspaces/${encodeURIComponent(workspaceId)}/verification/submit`,
      body: {
        business_name: data.businessName,
        business_type: data.businessType,
        ein: data.ein,
        address: data.address,
        city: data.city,
        state: data.state,
        zip: data.zip,
        use_case: data.useCase,
        sample_messages: data.sampleMessages,
        ...(data.monthlyVolume && { monthly_volume: data.monthlyVolume }),
      },
    });

    return transformKeys(response);
  }

  async inheritVerification(
    workspaceId: string,
    options: { sourceWorkspaceId: string },
  ): Promise<unknown> {
    const response = await this.http.request<unknown>({
      method: "POST",
      path: `/enterprise/workspaces/${encodeURIComponent(workspaceId)}/verification/inherit`,
      body: { source_workspace_id: options.sourceWorkspaceId },
    });

    return transformKeys(response);
  }

  async getVerification(workspaceId: string): Promise<unknown> {
    const response = await this.http.request<unknown>({
      method: "GET",
      path: `/enterprise/workspaces/${encodeURIComponent(workspaceId)}/verification`,
    });

    return transformKeys(response);
  }

  async transferCredits(
    workspaceId: string,
    options: TransferCreditsOptions,
  ): Promise<TransferCreditsResult> {
    if (!options.sourceWorkspaceId) {
      throw new Error("sourceWorkspaceId is required");
    }
    if (!options.amount || options.amount <= 0) {
      throw new Error("amount must be a positive number");
    }

    const response = await this.http.request<unknown>({
      method: "POST",
      path: `/enterprise/workspaces/${encodeURIComponent(workspaceId)}/transfer-credits`,
      body: {
        source_workspace_id: options.sourceWorkspaceId,
        amount: options.amount,
      },
    });

    return transformKeys<TransferCreditsResult>(response);
  }

  async getCredits(workspaceId: string): Promise<WorkspaceCredits> {
    const response = await this.http.request<unknown>({
      method: "GET",
      path: `/enterprise/workspaces/${encodeURIComponent(workspaceId)}/credits`,
    });

    return transformKeys<WorkspaceCredits>(response);
  }

  async createKey(
    workspaceId: string,
    options?: CreateKeyOptions,
  ): Promise<CreatedApiKey> {
    const response = await this.http.request<unknown>({
      method: "POST",
      path: `/enterprise/workspaces/${encodeURIComponent(workspaceId)}/keys`,
      body: {
        ...(options?.name && { name: options.name }),
        ...(options?.type && { type: options.type }),
      },
    });

    return transformKeys<CreatedApiKey>(response);
  }

  async listKeys(
    workspaceId: string,
  ): Promise<Array<{ id: string; name: string; keyPrefix: string; createdAt: string; lastUsedAt: string | null }>> {
    const response = await this.http.request<unknown[]>({
      method: "GET",
      path: `/enterprise/workspaces/${encodeURIComponent(workspaceId)}/keys`,
    });

    return response.map((item) => transformKeys(item));
  }

  async revokeKey(workspaceId: string, keyId: string): Promise<void> {
    await this.http.request<void>({
      method: "DELETE",
      path: `/enterprise/workspaces/${encodeURIComponent(workspaceId)}/keys/${encodeURIComponent(keyId)}`,
    });
  }

  async listOptInPages(workspaceId: string): Promise<OptInPage[]> {
    const response = await this.http.request<unknown[]>({
      method: "GET",
      path: `/enterprise/workspaces/${encodeURIComponent(workspaceId)}/opt-in-pages`,
    });

    return response.map((item) => transformKeys<OptInPage>(item));
  }

  async createOptInPage(
    workspaceId: string,
    options: CreateOptInPageOptions,
  ): Promise<CreateOptInPageResult> {
    if (!options.businessName) {
      throw new Error("businessName is required");
    }

    const response = await this.http.request<unknown>({
      method: "POST",
      path: `/enterprise/workspaces/${encodeURIComponent(workspaceId)}/opt-in-pages`,
      body: {
        businessName: options.businessName,
        ...(options.useCase && { useCase: options.useCase }),
        ...(options.useCaseSummary && { useCaseSummary: options.useCaseSummary }),
        ...(options.sampleMessages && { sampleMessages: options.sampleMessages }),
      },
    });

    return transformKeys<CreateOptInPageResult>(response);
  }

  async updateOptInPage(
    workspaceId: string,
    pageId: string,
    options: UpdateOptInPageOptions,
  ): Promise<OptInPage> {
    const response = await this.http.request<unknown>({
      method: "PATCH",
      path: `/enterprise/workspaces/${encodeURIComponent(workspaceId)}/opt-in-pages/${encodeURIComponent(pageId)}`,
      body: {
        ...(options.logoUrl !== undefined && { logoUrl: options.logoUrl }),
        ...(options.headerColor !== undefined && { headerColor: options.headerColor }),
        ...(options.buttonColor !== undefined && { buttonColor: options.buttonColor }),
        ...(options.customHeadline !== undefined && { customHeadline: options.customHeadline }),
        ...(options.customBenefits !== undefined && { customBenefits: options.customBenefits }),
      },
    });

    return transformKeys<OptInPage>(response);
  }

  async deleteOptInPage(workspaceId: string, pageId: string): Promise<void> {
    await this.http.request<void>({
      method: "DELETE",
      path: `/enterprise/workspaces/${encodeURIComponent(workspaceId)}/opt-in-pages/${encodeURIComponent(pageId)}`,
    });
  }

  async setWebhook(
    workspaceId: string,
    options: SetWorkspaceWebhookOptions,
  ): Promise<SetWorkspaceWebhookResult> {
    if (!options.url) {
      throw new Error("Webhook URL is required");
    }

    const response = await this.http.request<unknown>({
      method: "PUT",
      path: `/enterprise/workspaces/${encodeURIComponent(workspaceId)}/webhooks`,
      body: {
        url: options.url,
        ...(options.events && { events: options.events }),
        ...(options.description && { description: options.description }),
      },
    });

    return transformKeys<SetWorkspaceWebhookResult>(response);
  }

  async listWebhooks(workspaceId: string): Promise<WorkspaceWebhook[]> {
    const response = await this.http.request<unknown[]>({
      method: "GET",
      path: `/enterprise/workspaces/${encodeURIComponent(workspaceId)}/webhooks`,
    });

    return response.map((item) => transformKeys<WorkspaceWebhook>(item));
  }

  async deleteWebhooks(workspaceId: string, webhookId?: string): Promise<void> {
    const params = new URLSearchParams();
    if (webhookId) params.set("webhookId", webhookId);
    const query = params.toString();

    await this.http.request<void>({
      method: "DELETE",
      path: `/enterprise/workspaces/${encodeURIComponent(workspaceId)}/webhooks${query ? `?${query}` : ""}`,
    });
  }

  async testWebhook(workspaceId: string): Promise<EnterpriseWebhookTestResult> {
    const response = await this.http.request<unknown>({
      method: "POST",
      path: `/enterprise/workspaces/${encodeURIComponent(workspaceId)}/webhooks/test`,
    });

    return transformKeys<EnterpriseWebhookTestResult>(response);
  }

  async suspend(
    workspaceId: string,
    options?: SuspendWorkspaceOptions,
  ): Promise<SuspendWorkspaceResult> {
    const response = await this.http.request<unknown>({
      method: "POST",
      path: `/enterprise/workspaces/${encodeURIComponent(workspaceId)}/suspend`,
      body: {
        ...(options?.reason && { reason: options.reason }),
      },
    });

    return transformKeys<SuspendWorkspaceResult>(response);
  }

  async resume(workspaceId: string): Promise<ResumeWorkspaceResult> {
    const response = await this.http.request<unknown>({
      method: "POST",
      path: `/enterprise/workspaces/${encodeURIComponent(workspaceId)}/resume`,
    });

    return transformKeys<ResumeWorkspaceResult>(response);
  }

  async provisionBulk(
    workspaces: BulkProvisionWorkspace[],
  ): Promise<BulkProvisionResult> {
    if (!Array.isArray(workspaces) || workspaces.length === 0) {
      throw new Error("workspaces array is required");
    }
    if (workspaces.length > 50) {
      throw new Error("Maximum 50 workspaces per bulk provision");
    }

    const response = await this.http.request<unknown>({
      method: "POST",
      path: "/enterprise/workspaces/provision/bulk",
      body: { workspaces },
    });

    return transformKeys<BulkProvisionResult>(response);
  }

  async setCustomDomain(
    workspaceId: string,
    pageId: string,
    domain: string,
  ): Promise<SetCustomDomainResult> {
    if (!domain) {
      throw new Error("domain is required");
    }

    const response = await this.http.request<unknown>({
      method: "PUT",
      path: `/enterprise/workspaces/${encodeURIComponent(workspaceId)}/pages/${encodeURIComponent(pageId)}/domain`,
      body: { domain },
    });

    return transformKeys<SetCustomDomainResult>(response);
  }

  async sendInvitation(
    workspaceId: string,
    options: SendInvitationOptions,
  ): Promise<Invitation> {
    if (!options.email) {
      throw new Error("email is required");
    }
    if (!options.role) {
      throw new Error("role is required");
    }

    const response = await this.http.request<unknown>({
      method: "POST",
      path: `/enterprise/workspaces/${encodeURIComponent(workspaceId)}/invitations`,
      body: {
        email: options.email,
        role: options.role,
      },
    });

    return transformKeys<Invitation>(response);
  }

  async listInvitations(workspaceId: string): Promise<Invitation[]> {
    const response = await this.http.request<unknown[]>({
      method: "GET",
      path: `/enterprise/workspaces/${encodeURIComponent(workspaceId)}/invitations`,
    });

    return response.map((item) => transformKeys<Invitation>(item));
  }

  async cancelInvitation(workspaceId: string, inviteId: string): Promise<void> {
    await this.http.request<void>({
      method: "DELETE",
      path: `/enterprise/workspaces/${encodeURIComponent(workspaceId)}/invitations/${encodeURIComponent(inviteId)}`,
    });
  }

  async getQuota(workspaceId: string): Promise<QuotaSettings> {
    const response = await this.http.request<unknown>({
      method: "GET",
      path: `/enterprise/workspaces/${encodeURIComponent(workspaceId)}/quota`,
    });

    return transformKeys<QuotaSettings>(response);
  }

  async setQuota(
    workspaceId: string,
    options: UpdateQuotaOptions,
  ): Promise<QuotaSettings> {
    const response = await this.http.request<unknown>({
      method: "PUT",
      path: `/enterprise/workspaces/${encodeURIComponent(workspaceId)}/quota`,
      body: {
        monthlyMessageQuota: options.monthlyMessageQuota,
      },
    });

    return transformKeys<QuotaSettings>(response);
  }
}

class WebhooksSubResource {
  private readonly http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  async set(options: { url: string }): Promise<EnterpriseWebhook> {
    if (!options.url) {
      throw new Error("Webhook URL is required");
    }

    const response = await this.http.request<unknown>({
      method: "POST",
      path: "/enterprise/webhooks",
      body: { url: options.url },
    });

    return transformKeys<EnterpriseWebhook>(response);
  }

  async get(): Promise<EnterpriseWebhook> {
    const response = await this.http.request<unknown>({
      method: "GET",
      path: "/enterprise/webhooks",
    });

    return transformKeys<EnterpriseWebhook>(response);
  }

  async delete(): Promise<void> {
    await this.http.request<void>({
      method: "DELETE",
      path: "/enterprise/webhooks",
    });
  }

  async test(): Promise<EnterpriseWebhookTestResult> {
    const response = await this.http.request<unknown>({
      method: "POST",
      path: "/enterprise/webhooks/test",
    });

    return transformKeys<EnterpriseWebhookTestResult>(response);
  }
}

class AnalyticsSubResource {
  private readonly http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  async overview(): Promise<AnalyticsOverview> {
    const response = await this.http.request<unknown>({
      method: "GET",
      path: "/enterprise/analytics/overview",
    });

    return transformKeys<AnalyticsOverview>(response);
  }

  async messages(options?: {
    period?: AnalyticsPeriod;
    workspaceId?: string;
  }): Promise<MessageAnalytics> {
    const params = new URLSearchParams();
    if (options?.period) params.set("period", options.period);
    if (options?.workspaceId) params.set("workspaceId", options.workspaceId);
    const query = params.toString();

    const response = await this.http.request<unknown>({
      method: "GET",
      path: `/enterprise/analytics/messages${query ? `?${query}` : ""}`,
    });

    return transformKeys<MessageAnalytics>(response);
  }

  async delivery(): Promise<DeliveryAnalyticsItem[]> {
    const response = await this.http.request<unknown[]>({
      method: "GET",
      path: "/enterprise/analytics/delivery",
    });

    return response.map((item) => transformKeys<DeliveryAnalyticsItem>(item));
  }

  async credits(options?: {
    period?: AnalyticsPeriod;
  }): Promise<CreditAnalytics> {
    const params = new URLSearchParams();
    if (options?.period) params.set("period", options.period);
    const query = params.toString();

    const response = await this.http.request<unknown>({
      method: "GET",
      path: `/enterprise/analytics/credits${query ? `?${query}` : ""}`,
    });

    return transformKeys<CreditAnalytics>(response);
  }
}

class SettingsSubResource {
  private readonly http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  async getAutoTopUp(): Promise<AutoTopUpSettings> {
    const response = await this.http.request<unknown>({
      method: "GET",
      path: "/enterprise/settings/auto-top-up",
    });

    return transformKeys<AutoTopUpSettings>(response);
  }

  async updateAutoTopUp(options: UpdateAutoTopUpOptions): Promise<AutoTopUpSettings> {
    const response = await this.http.request<unknown>({
      method: "PUT",
      path: "/enterprise/settings/auto-top-up",
      body: {
        enabled: options.enabled,
        threshold: options.threshold,
        amount: options.amount,
        ...(options.sourceWorkspaceId !== undefined && { sourceWorkspaceId: options.sourceWorkspaceId }),
      },
    });

    return transformKeys<AutoTopUpSettings>(response);
  }
}

class BillingSubResource {
  private readonly http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  async getBreakdown(options?: BillingBreakdownOptions): Promise<BillingBreakdown> {
    const params = new URLSearchParams();
    if (options?.period) params.set("period", options.period);
    if (options?.page) params.set("page", String(options.page));
    if (options?.limit) params.set("limit", String(options.limit));
    const query = params.toString();

    const response = await this.http.request<unknown>({
      method: "GET",
      path: `/enterprise/billing/workspace-breakdown${query ? `?${query}` : ""}`,
    });

    return transformKeys<BillingBreakdown>(response);
  }
}

export class EnterpriseResource {
  private readonly http: HttpClient;
  public readonly workspaces: WorkspacesSubResource;
  public readonly webhooks: WebhooksSubResource;
  public readonly analytics: AnalyticsSubResource;
  public readonly settings: SettingsSubResource;
  public readonly billing: BillingSubResource;

  constructor(http: HttpClient) {
    this.http = http;
    this.workspaces = new WorkspacesSubResource(http);
    this.webhooks = new WebhooksSubResource(http);
    this.analytics = new AnalyticsSubResource(http);
    this.settings = new SettingsSubResource(http);
    this.billing = new BillingSubResource(http);
  }

  async getAccount(): Promise<EnterpriseAccount> {
    const response = await this.http.request<unknown>({
      method: "GET",
      path: "/enterprise/account",
    });

    return transformKeys<EnterpriseAccount>(response);
  }

  async provision(
    options: ProvisionWorkspaceOptions,
  ): Promise<ProvisionWorkspaceResult> {
    const body: Record<string, unknown> = {
      name: options.name,
    };

    if (options.sourceWorkspaceId) {
      body.sourceWorkspaceId = options.sourceWorkspaceId;
    }
    if (options.inheritWithNewNumber) {
      body.inheritWithNewNumber = true;
    }
    if (options.verification) {
      body.verification = options.verification;
    }
    if (options.creditAmount !== undefined) {
      body.creditAmount = options.creditAmount;
    }
    if (options.creditSourceWorkspaceId) {
      body.creditSourceWorkspaceId = options.creditSourceWorkspaceId;
    }
    if (options.keyName) {
      body.keyName = options.keyName;
    }
    if (options.keyType) {
      body.keyType = options.keyType;
    }
    if (options.webhookUrl) {
      body.webhookUrl = options.webhookUrl;
    }
    if (options.generateOptInPage !== undefined) {
      body.generateOptInPage = options.generateOptInPage;
    }

    const response = await this.http.request<ProvisionWorkspaceResult>({
      method: "POST",
      path: "/enterprise/workspaces/provision",
      body,
    });

    return transformKeys(response) as ProvisionWorkspaceResult;
  }
}
