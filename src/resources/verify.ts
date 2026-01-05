/**
 * Verify Resource - OTP Verification API
 * @packageDocumentation
 */

import type { HttpClient } from "../utils/http";
import type {
  SendVerificationRequest,
  SendVerificationResponse,
  CheckVerificationRequest,
  CheckVerificationResponse,
  Verification,
  ListVerificationsOptions,
  VerificationListResponse,
} from "../types";
import { validatePhoneNumber } from "../utils/validation";

/**
 * Verify API resource for OTP verification
 *
 * @example
 * ```typescript
 * // Send an OTP
 * const verification = await sendly.verify.send({
 *   to: '+15551234567',
 *   appName: 'MyApp'
 * });
 *
 * // Check the OTP
 * const result = await sendly.verify.check(verification.id, {
 *   code: '123456'
 * });
 *
 * if (result.status === 'verified') {
 *   console.log('Phone verified!');
 * }
 * ```
 */
export class VerifyResource {
  private readonly http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  /**
   * Send an OTP verification code
   *
   * @param request - Verification request details
   * @returns The created verification with ID and expiry
   *
   * @example
   * ```typescript
   * // Basic usage
   * const verification = await sendly.verify.send({
   *   to: '+15551234567'
   * });
   *
   * // With custom options
   * const verification = await sendly.verify.send({
   *   to: '+15551234567',
   *   appName: 'MyApp',
   *   codeLength: 8,
   *   timeoutSecs: 600
   * });
   *
   * // In sandbox mode, the code is returned for testing
   * if (verification.sandboxCode) {
   *   console.log('Test code:', verification.sandboxCode);
   * }
   * ```
   */
  async send(
    request: SendVerificationRequest,
  ): Promise<SendVerificationResponse> {
    validatePhoneNumber(request.to);

    const response = await this.http.request<{
      id: string;
      status: string;
      phone: string;
      expires_at: string;
      sandbox: boolean;
      sandbox_code?: string;
      message?: string;
    }>({
      method: "POST",
      path: "/verify",
      body: {
        to: request.to,
        ...(request.templateId && { template_id: request.templateId }),
        ...(request.profileId && { profile_id: request.profileId }),
        ...(request.appName && { app_name: request.appName }),
        ...(request.timeoutSecs && { timeout_secs: request.timeoutSecs }),
        ...(request.codeLength && { code_length: request.codeLength }),
      },
    });

    return {
      id: response.id,
      status: response.status as SendVerificationResponse["status"],
      phone: response.phone,
      expiresAt: response.expires_at,
      sandbox: response.sandbox,
      sandboxCode: response.sandbox_code,
      message: response.message,
    };
  }

  /**
   * Resend an OTP verification code
   *
   * @param id - Verification ID
   * @returns Updated verification with new expiry
   *
   * @example
   * ```typescript
   * // Resend when delivery failed or code expired
   * const result = await sendly.verify.resend('ver_xxx');
   * console.log('New code expires at:', result.expiresAt);
   * ```
   */
  async resend(id: string): Promise<SendVerificationResponse> {
    const response = await this.http.request<{
      id: string;
      status: string;
      phone: string;
      expires_at: string;
      sandbox: boolean;
      sandbox_code?: string;
      message?: string;
    }>({
      method: "POST",
      path: `/verify/${id}/resend`,
    });

    return {
      id: response.id,
      status: response.status as SendVerificationResponse["status"],
      phone: response.phone,
      expiresAt: response.expires_at,
      sandbox: response.sandbox,
      sandboxCode: response.sandbox_code,
      message: response.message,
    };
  }

  /**
   * Check/verify an OTP code
   *
   * @param id - Verification ID
   * @param request - The code to verify
   * @returns Verification result
   *
   * @example
   * ```typescript
   * const result = await sendly.verify.check('ver_xxx', {
   *   code: '123456'
   * });
   *
   * if (result.status === 'verified') {
   *   // User is verified
   * } else if (result.remainingAttempts !== undefined) {
   *   console.log(`Wrong code. ${result.remainingAttempts} attempts remaining`);
   * }
   * ```
   */
  async check(
    id: string,
    request: CheckVerificationRequest,
  ): Promise<CheckVerificationResponse> {
    const response = await this.http.request<{
      id: string;
      status: string;
      phone: string;
      verified_at?: string;
      remaining_attempts?: number;
    }>({
      method: "POST",
      path: `/verify/${id}/check`,
      body: { code: request.code },
    });

    return {
      id: response.id,
      status: response.status as CheckVerificationResponse["status"],
      phone: response.phone,
      verifiedAt: response.verified_at,
      remainingAttempts: response.remaining_attempts,
    };
  }

  /**
   * Get a verification by ID
   *
   * @param id - Verification ID
   * @returns The verification record
   *
   * @example
   * ```typescript
   * const verification = await sendly.verify.get('ver_xxx');
   * console.log(verification.status); // 'pending', 'verified', 'expired', etc.
   * ```
   */
  async get(id: string): Promise<Verification> {
    const response = await this.http.request<{
      id: string;
      status: string;
      phone: string;
      delivery_status: string;
      attempts: number;
      max_attempts: number;
      expires_at: string;
      verified_at?: string | null;
      created_at: string;
      sandbox: boolean;
      app_name?: string;
      template_id?: string;
      profile_id?: string;
    }>({
      method: "GET",
      path: `/verify/${id}`,
    });

    return {
      id: response.id,
      status: response.status as Verification["status"],
      phone: response.phone,
      deliveryStatus:
        response.delivery_status as Verification["deliveryStatus"],
      attempts: response.attempts,
      maxAttempts: response.max_attempts,
      expiresAt: response.expires_at,
      verifiedAt: response.verified_at,
      createdAt: response.created_at,
      sandbox: response.sandbox,
      appName: response.app_name,
      templateId: response.template_id,
      profileId: response.profile_id,
    };
  }

  /**
   * List recent verifications
   *
   * @param options - Filter and pagination options
   * @returns List of verifications
   *
   * @example
   * ```typescript
   * // List recent verifications
   * const { verifications } = await sendly.verify.list({ limit: 10 });
   *
   * // Filter by status
   * const { verifications } = await sendly.verify.list({
   *   status: 'verified'
   * });
   * ```
   */
  async list(
    options: ListVerificationsOptions = {},
  ): Promise<VerificationListResponse> {
    const response = await this.http.request<{
      verifications: Array<{
        id: string;
        status: string;
        phone: string;
        delivery_status: string;
        attempts: number;
        max_attempts: number;
        expires_at: string;
        verified_at?: string | null;
        created_at: string;
        sandbox: boolean;
        app_name?: string;
        template_id?: string;
        profile_id?: string;
      }>;
      pagination: {
        limit: number;
        has_more: boolean;
      };
    }>({
      method: "GET",
      path: "/verify",
      query: {
        ...(options.limit && { limit: options.limit }),
        ...(options.status && { status: options.status }),
      },
    });

    return {
      verifications: response.verifications.map((v) => ({
        id: v.id,
        status: v.status as Verification["status"],
        phone: v.phone,
        deliveryStatus: v.delivery_status as Verification["deliveryStatus"],
        attempts: v.attempts,
        maxAttempts: v.max_attempts,
        expiresAt: v.expires_at,
        verifiedAt: v.verified_at,
        createdAt: v.created_at,
        sandbox: v.sandbox,
        appName: v.app_name,
        templateId: v.template_id,
        profileId: v.profile_id,
      })),
      pagination: {
        limit: response.pagination.limit,
        hasMore: response.pagination.has_more,
      },
    };
  }
}
