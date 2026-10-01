/**
 * Campaigns Resource - Bulk SMS Campaign Management
 * @packageDocumentation
 */

import type { HttpClient } from "../utils/http";
import { ValidationError } from "../errors";
import type {
  Campaign,
  CampaignStatus,
  CreateCampaignRequest,
  UpdateCampaignRequest,
  ScheduleCampaignRequest,
  CampaignPreview,
  CampaignSendResult,
  ListCampaignsOptions,
  CampaignListResponse,
  BatchSendResponse,
} from "../types";

/**
 * Campaigns API resource for managing bulk SMS campaigns
 *
 * @example
 * ```typescript
 * // Create a campaign
 * const campaign = await sendly.campaigns.create({
 *   name: 'Welcome Campaign',
 *   text: 'Hello {{name}}, welcome to our service!',
 *   contactListIds: ['lst_xxx']
 * });
 *
 * // Preview before sending
 * const preview = await sendly.campaigns.preview(campaign.id);
 * console.log(`Will send to ${preview.recipientCount} recipients`);
 * console.log(`Cost: ${preview.estimatedCredits} credits`);
 *
 * // Send immediately or schedule
 * await sendly.campaigns.send(campaign.id);
 * // or
 * await sendly.campaigns.schedule(campaign.id, {
 *   scheduledAt: '2024-01-15T10:00:00Z',
 *   timezone: 'America/New_York'
 * });
 * ```
 */
export class CampaignsResource {
  private readonly http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  /**
   * Create a new campaign
   *
   * @param request - Campaign details
   * @returns The created campaign (as draft)
   *
   * @example
   * ```typescript
   * const campaign = await sendly.campaigns.create({
   *   name: 'Black Friday Sale',
   *   text: 'Hi {{name}}! 50% off everything today only. Shop now!',
   *   contactListIds: ['lst_customers']
   * });
   * ```
   *
   * @throws {ValidationError} If `contactListIds` holds more than one ID
   */
  async create(request: CreateCampaignRequest): Promise<Campaign> {
    const targetListId =
      request.contactListIds && oneContactList(request.contactListIds);

    const response = await this.http.request<RawCampaign>({
      method: "POST",
      path: "/campaigns",
      body: {
        name: request.name,
        text: request.text,
        messageText: request.text,
        templateId: request.templateId,
        contactListIds: request.contactListIds,
        ...(targetListId !== undefined && { targetListId }),
      },
    });

    return this.transformCampaign(response);
  }

  /**
   * List campaigns with optional filtering
   *
   * @param options - Filter and pagination options
   * @returns List of campaigns
   *
   * @example
   * ```typescript
   * // List all campaigns
   * const { campaigns } = await sendly.campaigns.list();
   *
   * // List only scheduled campaigns
   * const { campaigns } = await sendly.campaigns.list({ status: 'scheduled' });
   *
   * // Paginate
   * const { campaigns, total } = await sendly.campaigns.list({ limit: 10, offset: 20 });
   * ```
   */
  async list(
    options: ListCampaignsOptions = {},
  ): Promise<CampaignListResponse> {
    const params = new URLSearchParams();
    if (options.limit) params.set("limit", String(options.limit));
    if (options.offset) params.set("offset", String(options.offset));
    if (options.status) params.set("status", options.status);

    const queryString = params.toString();
    const response = await this.http.request<{
      campaigns: RawCampaign[];
      total: number;
      limit: number;
      offset: number;
    }>({
      method: "GET",
      path: `/campaigns${queryString ? `?${queryString}` : ""}`,
    });

    return {
      campaigns: response.campaigns.map((c) => this.transformCampaign(c)),
      total: response.total,
      limit: response.limit,
      offset: response.offset,
    };
  }

  /**
   * Get a campaign by ID
   *
   * @param id - Campaign ID
   * @returns The campaign
   *
   * @example
   * ```typescript
   * const campaign = await sendly.campaigns.get('camp_xxx');
   * console.log(`Status: ${campaign.status}`);
   * console.log(`Delivered: ${campaign.deliveredCount}/${campaign.recipientCount}`);
   * ```
   */
  async get(id: string): Promise<Campaign> {
    const response = await this.http.request<RawCampaign>({
      method: "GET",
      path: `/campaigns/${encodeURIComponent(id)}`,
    });

    return this.transformCampaign(response);
  }

  /**
   * Update a campaign (draft or scheduled only)
   *
   * @param id - Campaign ID
   * @param request - Fields to update
   * @returns The updated campaign
   *
   * @example
   * ```typescript
   * const campaign = await sendly.campaigns.update('camp_xxx', {
   *   name: 'Updated Campaign Name',
   *   text: 'New message text with {{variable}}'
   * });
   * ```
   *
   * @throws {ValidationError} If `contactListIds` holds more than one ID
   */
  async update(id: string, request: UpdateCampaignRequest): Promise<Campaign> {
    const targetListId =
      request.contactListIds && oneContactList(request.contactListIds);

    const response = await this.http.request<RawCampaign>({
      method: "PATCH",
      path: `/campaigns/${encodeURIComponent(id)}`,
      body: {
        ...(request.name && { name: request.name }),
        ...(request.text && { text: request.text, messageText: request.text }),
        ...(request.templateId !== undefined && {
          template_id: request.templateId,
        }),
        ...(request.contactListIds && {
          contact_list_ids: request.contactListIds,
          targetListId,
        }),
      },
    });

    return this.transformCampaign(response);
  }

  /**
   * Delete a campaign
   *
   * Only draft and cancelled campaigns can be deleted.
   *
   * @param id - Campaign ID
   *
   * @example
   * ```typescript
   * await sendly.campaigns.delete('camp_xxx');
   * ```
   */
  async delete(id: string): Promise<void> {
    await this.http.request<void>({
      method: "DELETE",
      path: `/campaigns/${encodeURIComponent(id)}`,
    });
  }

  /**
   * Preview a campaign before sending
   *
   * Returns recipient count, credit estimate, and breakdown by country.
   *
   * @param id - Campaign ID
   * @returns Campaign preview with cost estimate
   *
   * @example
   * ```typescript
   * const preview = await sendly.campaigns.preview('camp_xxx');
   *
   * console.log(`Recipients: ${preview.recipientCount}`);
   * console.log(`Estimated cost: ${preview.estimatedCredits} credits`);
   * console.log(`Your balance: ${preview.currentBalance} credits`);
   *
   * if (!preview.hasEnoughCredits) {
   *   console.log('Not enough credits! Please top up.');
   * }
   * ```
   */
  async preview(id: string): Promise<CampaignPreview> {
    const response = await this.http.request<
      Omit<CampaignPreview, "id" | "breakdown" | "recipientCount"> & {
        recipientCount?: number;
        totalRecipients?: number;
      }
    >({
      method: "GET",
      path: `/campaigns/${encodeURIComponent(id)}/preview`,
    });

    return {
      id,
      recipientCount: response.recipientCount ?? response.totalRecipients ?? 0,
      estimatedCredits: response.estimatedCredits,
      currentBalance: Number(response.currentBalance ?? 0),
      hasEnoughCredits: response.hasEnoughCredits,
      breakdown: response.byCountry
        ? Object.entries(response.byCountry).map(([country, c]) => ({
            country,
            count: c.count,
            creditsPerMessage: c.count > 0 ? c.credits / c.count : 0,
            totalCredits: c.credits,
          }))
        : undefined,
      blockedCount: response.blockedCount,
      sendableCount: response.sendableCount,
      byCountry: response.byCountry,
      warnings: response.warnings,
      messagingProfile: response.messagingProfile,
      optedOutCount: response.optedOutCount,
      invalidCount: response.invalidCount,
      invalidNumberCount: response.invalidNumberCount,
      landlineCount: response.landlineCount,
      sampleRecipients: response.sampleRecipients,
    };
  }

  /**
   * Send a campaign immediately
   *
   * Sends one message per recipient as a batch, and marks the campaign
   * `completed`.
   *
   * @param id - Campaign ID
   * @returns The batch the messages went out in, with the counts
   *
   * @example
   * ```typescript
   * const result = await sendly.campaigns.send('camp_xxx');
   * console.log(`Sent ${result.sentCount} of ${result.recipientCount}`);
   *
   * // Delivery results arrive later
   * const batch = await sendly.messages.getBatch(result.batchId);
   * ```
   */
  async send(id: string): Promise<CampaignSendResult> {
    const response = await this.http.request<BatchSendResponse>({
      method: "POST",
      path: `/campaigns/${encodeURIComponent(id)}/send`,
    });

    return {
      id,
      batchId: response.batchId,
      status: response.status,
      recipientCount: response.total,
      sentCount: response.sent,
      failedCount: response.failed,
      ...(response.retrying !== undefined && {
        retryingCount: response.retrying,
      }),
      creditsUsed: response.creditsUsed,
      creditsRefunded: response.creditsRefunded ?? 0,
      optedOutSkipped: response.optedOutSkipped ?? 0,
      invalidSkipped: response.invalidSkipped ?? 0,
      messages: response.messages ?? [],
    };
  }

  /**
   * Schedule a campaign for later
   *
   * @param id - Campaign ID
   * @param request - Schedule details
   * @returns The updated campaign (status: scheduled)
   *
   * @example
   * ```typescript
   * const campaign = await sendly.campaigns.schedule('camp_xxx', {
   *   scheduledAt: '2024-01-15T10:00:00Z',
   *   timezone: 'America/New_York'
   * });
   *
   * console.log(`Scheduled for ${campaign.scheduledAt}`);
   * ```
   */
  async schedule(
    id: string,
    request: ScheduleCampaignRequest,
  ): Promise<Campaign> {
    const response = await this.http.request<RawCampaign>({
      method: "POST",
      path: `/campaigns/${encodeURIComponent(id)}/schedule`,
      body: {
        scheduledAt: request.scheduledAt,
        timezone: request.timezone,
      },
    });

    return this.transformCampaign(response);
  }

  /**
   * Cancel a scheduled campaign
   *
   * @param id - Campaign ID
   * @returns The updated campaign (status: cancelled)
   *
   * @example
   * ```typescript
   * const campaign = await sendly.campaigns.cancel('camp_xxx');
   * console.log(`Campaign cancelled`);
   * ```
   */
  async cancel(id: string): Promise<Campaign> {
    const response = await this.http.request<RawCampaign>({
      method: "POST",
      path: `/campaigns/${encodeURIComponent(id)}/cancel`,
    });

    return this.transformCampaign(response);
  }

  /**
   * Clone a campaign
   *
   * Creates a new draft campaign with the same settings.
   *
   * @param id - Campaign ID to clone
   * @returns The new campaign (as draft)
   *
   * @example
   * ```typescript
   * const cloned = await sendly.campaigns.clone('camp_xxx');
   * console.log(`Created clone: ${cloned.id}`);
   * ```
   */
  async clone(id: string): Promise<Campaign> {
    const response = await this.http.request<RawCampaign>({
      method: "POST",
      path: `/campaigns/${encodeURIComponent(id)}/clone`,
    });

    return this.transformCampaign(response);
  }

  private transformCampaign(raw: RawCampaign): Campaign {
    return {
      id: raw.id,
      name: raw.name,
      text: (raw.text ?? raw.messageText) as string,
      templateId: raw.template_id,
      contactListIds:
        raw.contact_list_ids ?? (raw.targetListId ? [raw.targetListId] : []),
      status: raw.status as CampaignStatus,
      recipientCount: raw.totalRecipients ?? raw.recipient_count ?? 0,
      sentCount: raw.sentCount ?? raw.sent_count ?? 0,
      deliveredCount: raw.deliveredCount ?? raw.delivered_count ?? 0,
      failedCount: raw.failedCount ?? raw.failed_count ?? 0,
      estimatedCredits: raw.estimatedCredits ?? raw.estimated_credits ?? 0,
      creditsUsed: raw.creditsUsed ?? raw.credits_used ?? 0,
      scheduledAt: raw.scheduledAt ?? raw.scheduled_at ?? null,
      timezone: raw.timezone,
      startedAt: raw.sentAt ?? raw.started_at ?? null,
      completedAt: raw.completedAt ?? raw.completed_at ?? null,
      createdAt: (raw.createdAt ?? raw.created_at) as string,
      updatedAt: (raw.updatedAt ?? raw.updated_at) as string,
    };
  }
}

function oneContactList(contactListIds: string[]): string | null {
  if (contactListIds.length > 1) {
    throw new ValidationError(
      "A campaign targets one contact list; pass a single ID in contactListIds",
    );
  }
  return contactListIds[0] ?? null;
}

interface RawCampaign {
  id: string;
  name: string;
  text?: string;
  messageText?: string;
  template_id?: string | null;
  contact_list_ids?: string[];
  targetListId?: string | null;
  status: string;
  totalRecipients?: number;
  recipient_count?: number;
  sentCount?: number;
  sent_count?: number;
  deliveredCount?: number;
  delivered_count?: number;
  failedCount?: number;
  failed_count?: number;
  estimatedCredits?: number;
  estimated_credits?: number;
  creditsUsed?: number;
  credits_used?: number;
  scheduledAt?: string | null;
  scheduled_at?: string | null;
  timezone?: string | null;
  sentAt?: string | null;
  started_at?: string | null;
  completedAt?: string | null;
  completed_at?: string | null;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
}
