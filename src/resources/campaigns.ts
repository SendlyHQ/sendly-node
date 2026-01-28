/**
 * Campaigns Resource - Bulk SMS Campaign Management
 * @packageDocumentation
 */

import type { HttpClient } from "../utils/http";
import type {
  Campaign,
  CampaignStatus,
  CreateCampaignRequest,
  UpdateCampaignRequest,
  ScheduleCampaignRequest,
  CampaignPreview,
  ListCampaignsOptions,
  CampaignListResponse,
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
   *   contactListIds: ['lst_customers', 'lst_subscribers']
   * });
   * ```
   */
  async create(request: CreateCampaignRequest): Promise<Campaign> {
    const response = await this.http.request<RawCampaign>({
      method: "POST",
      path: "/campaigns",
      body: {
        name: request.name,
        text: request.text,
        templateId: request.templateId,
        contactListIds: request.contactListIds,
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
   * const campaign = await sendly.campaigns.get('cmp_xxx');
   * console.log(`Status: ${campaign.status}`);
   * console.log(`Delivered: ${campaign.deliveredCount}/${campaign.recipientCount}`);
   * ```
   */
  async get(id: string): Promise<Campaign> {
    const response = await this.http.request<RawCampaign>({
      method: "GET",
      path: `/campaigns/${id}`,
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
   * const campaign = await sendly.campaigns.update('cmp_xxx', {
   *   name: 'Updated Campaign Name',
   *   text: 'New message text with {{variable}}'
   * });
   * ```
   */
  async update(id: string, request: UpdateCampaignRequest): Promise<Campaign> {
    const response = await this.http.request<RawCampaign>({
      method: "PATCH",
      path: `/campaigns/${id}`,
      body: {
        ...(request.name && { name: request.name }),
        ...(request.text && { text: request.text }),
        ...(request.templateId !== undefined && {
          template_id: request.templateId,
        }),
        ...(request.contactListIds && {
          contact_list_ids: request.contactListIds,
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
   * await sendly.campaigns.delete('cmp_xxx');
   * ```
   */
  async delete(id: string): Promise<void> {
    await this.http.request<void>({
      method: "DELETE",
      path: `/campaigns/${id}`,
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
   * const preview = await sendly.campaigns.preview('cmp_xxx');
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
    const response = await this.http.request<{
      id: string;
      recipient_count: number;
      estimated_segments: number;
      estimated_credits: number;
      current_balance: number;
      has_enough_credits: boolean;
      breakdown?: Array<{
        country: string;
        count: number;
        credits_per_message: number;
        total_credits: number;
      }>;
    }>({
      method: "GET",
      path: `/campaigns/${id}/preview`,
    });

    return {
      id: response.id,
      recipientCount: response.recipient_count,
      estimatedSegments: response.estimated_segments,
      estimatedCredits: response.estimated_credits,
      currentBalance: response.current_balance,
      hasEnoughCredits: response.has_enough_credits,
      breakdown: response.breakdown?.map((b) => ({
        country: b.country,
        count: b.count,
        creditsPerMessage: b.credits_per_message,
        totalCredits: b.total_credits,
      })),
    };
  }

  /**
   * Send a campaign immediately
   *
   * @param id - Campaign ID
   * @returns The updated campaign (status: sending)
   *
   * @example
   * ```typescript
   * const campaign = await sendly.campaigns.send('cmp_xxx');
   * console.log(`Campaign is now ${campaign.status}`);
   * ```
   */
  async send(id: string): Promise<Campaign> {
    const response = await this.http.request<RawCampaign>({
      method: "POST",
      path: `/campaigns/${id}/send`,
    });

    return this.transformCampaign(response);
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
   * const campaign = await sendly.campaigns.schedule('cmp_xxx', {
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
      path: `/campaigns/${id}/schedule`,
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
   * const campaign = await sendly.campaigns.cancel('cmp_xxx');
   * console.log(`Campaign cancelled`);
   * ```
   */
  async cancel(id: string): Promise<Campaign> {
    const response = await this.http.request<RawCampaign>({
      method: "POST",
      path: `/campaigns/${id}/cancel`,
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
   * const cloned = await sendly.campaigns.clone('cmp_xxx');
   * console.log(`Created clone: ${cloned.id}`);
   * ```
   */
  async clone(id: string): Promise<Campaign> {
    const response = await this.http.request<RawCampaign>({
      method: "POST",
      path: `/campaigns/${id}/clone`,
    });

    return this.transformCampaign(response);
  }

  private transformCampaign(raw: RawCampaign): Campaign {
    return {
      id: raw.id,
      name: raw.name,
      text: raw.text,
      templateId: raw.template_id,
      contactListIds: raw.contact_list_ids || [],
      status: raw.status as CampaignStatus,
      recipientCount: raw.recipient_count || 0,
      sentCount: raw.sent_count || 0,
      deliveredCount: raw.delivered_count || 0,
      failedCount: raw.failed_count || 0,
      estimatedCredits: raw.estimated_credits || 0,
      creditsUsed: raw.credits_used || 0,
      scheduledAt: raw.scheduled_at,
      timezone: raw.timezone,
      startedAt: raw.started_at,
      completedAt: raw.completed_at,
      createdAt: raw.created_at,
      updatedAt: raw.updated_at,
    };
  }
}

interface RawCampaign {
  id: string;
  name: string;
  text: string;
  template_id?: string | null;
  contact_list_ids?: string[];
  status: string;
  recipient_count?: number;
  sent_count?: number;
  delivered_count?: number;
  failed_count?: number;
  estimated_credits?: number;
  credits_used?: number;
  scheduled_at?: string | null;
  timezone?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
}
