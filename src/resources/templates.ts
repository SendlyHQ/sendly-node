/**
 * Templates Resource - SMS Template Management
 * @packageDocumentation
 */

import type { HttpClient } from "../utils/http";
import type {
  Template,
  CreateTemplateRequest,
  UpdateTemplateRequest,
  TemplateListResponse,
  TemplatePreview,
} from "../types";

/**
 * Templates API resource for managing SMS templates
 *
 * @example
 * ```typescript
 * // List available templates
 * const { templates } = await sendly.templates.list();
 *
 * // Create a custom template
 * const template = await sendly.templates.create({
 *   name: 'My OTP',
 *   text: 'Your {{app_name}} code is {{code}}'
 * });
 *
 * // Publish for use
 * await sendly.templates.publish(template.id);
 * ```
 */
export class TemplatesResource {
  private readonly http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  /**
   * List all templates (presets + custom)
   *
   * @returns List of templates
   *
   * @example
   * ```typescript
   * const { templates } = await sendly.templates.list();
   * templates.forEach(t => {
   *   console.log(`${t.name}: ${t.isPreset ? 'preset' : t.status}`);
   * });
   * ```
   */
  async list(): Promise<TemplateListResponse> {
    const response = await this.http.request<{
      templates: Array<{
        id: string;
        name: string;
        text: string;
        variables: Array<{ key: string; type: string; fallback?: string }>;
        is_preset: boolean;
        preset_slug?: string | null;
        status: string;
        version: number;
        published_at?: string | null;
        created_at: string;
        updated_at: string;
      }>;
    }>({
      method: "GET",
      path: "/templates",
    });

    return {
      templates: response.templates.map((t) => this.transformTemplate(t)),
    };
  }

  /**
   * List preset templates only (no auth required)
   *
   * @returns List of preset templates
   *
   * @example
   * ```typescript
   * const { templates } = await sendly.templates.presets();
   * // Returns: otp, 2fa, login, signup, reset, generic
   * ```
   */
  async presets(): Promise<TemplateListResponse> {
    const response = await this.http.request<{
      templates: Array<{
        id: string;
        name: string;
        text: string;
        variables: Array<{ key: string; type: string; fallback?: string }>;
        is_preset: boolean;
        preset_slug?: string | null;
        status: string;
        version: number;
        published_at?: string | null;
        created_at: string;
        updated_at: string;
      }>;
    }>({
      method: "GET",
      path: "/templates/presets",
    });

    return {
      templates: response.templates.map((t) => this.transformTemplate(t)),
    };
  }

  /**
   * Get a template by ID
   *
   * @param id - Template ID
   * @returns The template
   *
   * @example
   * ```typescript
   * const template = await sendly.templates.get('tpl_preset_otp');
   * console.log(template.text); // "Your {{app_name}} code is {{code}}"
   * ```
   */
  async get(id: string): Promise<Template> {
    const response = await this.http.request<{
      id: string;
      name: string;
      text: string;
      variables: Array<{ key: string; type: string; fallback?: string }>;
      is_preset: boolean;
      preset_slug?: string | null;
      status: string;
      version: number;
      published_at?: string | null;
      created_at: string;
      updated_at: string;
    }>({
      method: "GET",
      path: `/templates/${id}`,
    });

    return this.transformTemplate(response);
  }

  /**
   * Create a new template
   *
   * @param request - Template details
   * @returns The created template (as draft)
   *
   * @example
   * ```typescript
   * const template = await sendly.templates.create({
   *   name: 'Password Reset',
   *   text: '{{app_name}}: Your password reset code is {{code}}. Valid for 10 minutes.'
   * });
   *
   * // Template is created as draft, publish when ready
   * await sendly.templates.publish(template.id);
   * ```
   */
  async create(request: CreateTemplateRequest): Promise<Template> {
    const response = await this.http.request<{
      id: string;
      name: string;
      text: string;
      variables: Array<{ key: string; type: string; fallback?: string }>;
      is_preset: boolean;
      preset_slug?: string | null;
      status: string;
      version: number;
      published_at?: string | null;
      created_at: string;
      updated_at: string;
    }>({
      method: "POST",
      path: "/templates",
      body: {
        name: request.name,
        text: request.text,
      },
    });

    return this.transformTemplate(response);
  }

  /**
   * Update a template
   *
   * Note: Updating a published template creates a new draft version.
   *
   * @param id - Template ID
   * @param request - Fields to update
   * @returns The updated template
   *
   * @example
   * ```typescript
   * const template = await sendly.templates.update('tpl_xxx', {
   *   text: 'New message text with {{code}}'
   * });
   * ```
   */
  async update(id: string, request: UpdateTemplateRequest): Promise<Template> {
    const response = await this.http.request<{
      id: string;
      name: string;
      text: string;
      variables: Array<{ key: string; type: string; fallback?: string }>;
      is_preset: boolean;
      preset_slug?: string | null;
      status: string;
      version: number;
      published_at?: string | null;
      created_at: string;
      updated_at: string;
    }>({
      method: "PATCH",
      path: `/templates/${id}`,
      body: {
        ...(request.name && { name: request.name }),
        ...(request.text && { text: request.text }),
      },
    });

    return this.transformTemplate(response);
  }

  /**
   * Publish a draft template
   *
   * Published templates are locked and can be used with the Verify API.
   *
   * @param id - Template ID
   * @returns The published template
   *
   * @example
   * ```typescript
   * const template = await sendly.templates.publish('tpl_xxx');
   * console.log(template.status); // 'published'
   * ```
   */
  async publish(id: string): Promise<Template> {
    const response = await this.http.request<{
      id: string;
      name: string;
      text: string;
      variables: Array<{ key: string; type: string; fallback?: string }>;
      is_preset: boolean;
      preset_slug?: string | null;
      status: string;
      version: number;
      published_at?: string | null;
      created_at: string;
      updated_at: string;
    }>({
      method: "POST",
      path: `/templates/${id}/publish`,
    });

    return this.transformTemplate(response);
  }

  /**
   * Preview a template with sample values
   *
   * @param id - Template ID
   * @param variables - Optional custom variable values
   * @returns Template with interpolated preview text
   *
   * @example
   * ```typescript
   * const preview = await sendly.templates.preview('tpl_preset_otp', {
   *   app_name: 'MyApp',
   *   code: '123456'
   * });
   * console.log(preview.previewText);
   * // "Your MyApp code is 123456"
   * ```
   */
  async preview(
    id: string,
    variables?: Record<string, string>,
  ): Promise<TemplatePreview> {
    const response = await this.http.request<{
      id: string;
      name: string;
      original_text: string;
      preview_text: string;
      variables: Array<{ key: string; type: string; fallback?: string }>;
    }>({
      method: "POST",
      path: `/templates/${id}/preview`,
      body: variables ? { variables } : {},
    });

    return {
      id: response.id,
      name: response.name,
      originalText: response.original_text,
      previewText: response.preview_text,
      variables: response.variables.map((v) => ({
        key: v.key,
        type: v.type as "string" | "number",
        fallback: v.fallback,
      })),
    };
  }

  /**
   * Delete a template
   *
   * Note: Preset templates cannot be deleted.
   *
   * @param id - Template ID
   *
   * @example
   * ```typescript
   * await sendly.templates.delete('tpl_xxx');
   * ```
   */
  async delete(id: string): Promise<void> {
    await this.http.request<void>({
      method: "DELETE",
      path: `/templates/${id}`,
    });
  }

  /**
   * Clone a template
   *
   * Creates a copy of an existing template (including presets).
   *
   * @param id - Template ID to clone
   * @param options - Optional clone options
   * @returns The cloned template (as draft)
   *
   * @example
   * ```typescript
   * // Clone a preset template
   * const myOtp = await sendly.templates.clone('tpl_preset_otp', {
   *   name: 'My Custom OTP'
   * });
   *
   * // Modify and publish
   * await sendly.templates.update(myOtp.id, {
   *   text: 'Your {{app_name}} code: {{code}}. Expires in 5 min.'
   * });
   * await sendly.templates.publish(myOtp.id);
   * ```
   */
  async clone(id: string, options?: { name?: string }): Promise<Template> {
    const response = await this.http.request<{
      id: string;
      name: string;
      text: string;
      variables: Array<{ key: string; type: string; fallback?: string }>;
      is_preset: boolean;
      preset_slug?: string | null;
      status: string;
      version: number;
      published_at?: string | null;
      created_at: string;
      updated_at: string;
    }>({
      method: "POST",
      path: `/templates/${id}/clone`,
      body: options?.name ? { name: options.name } : {},
    });

    return this.transformTemplate(response);
  }

  private transformTemplate(t: {
    id: string;
    name: string;
    text: string;
    variables: Array<{ key: string; type: string; fallback?: string }>;
    is_preset: boolean;
    preset_slug?: string | null;
    status: string;
    version: number;
    published_at?: string | null;
    created_at: string;
    updated_at: string;
  }): Template {
    return {
      id: t.id,
      name: t.name,
      text: t.text,
      variables: t.variables.map((v) => ({
        key: v.key,
        type: v.type as "string" | "number",
        fallback: v.fallback,
      })),
      isPreset: t.is_preset,
      presetSlug: t.preset_slug,
      status: t.status as Template["status"],
      version: t.version,
      publishedAt: t.published_at,
      createdAt: t.created_at,
      updatedAt: t.updated_at,
    };
  }
}
