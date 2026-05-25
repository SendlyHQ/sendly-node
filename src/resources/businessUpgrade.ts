/**
 * Business Upgrade Resource — Entity-Upgrade ("fork-with-new-number")
 *
 * @packageDocumentation
 *
 * Manages the toll-free business entity upgrade flow: when a customer
 * forms a new legal entity (e.g. an LLC), this resource lets them
 * reserve a new toll-free number under the new entity, submit it for
 * carrier review, and atomically swap to it on approval — without
 * disrupting outbound SMS during the 1-2 week review window.
 *
 * @see https://sendly.live/docs/business-upgrade
 */

import type { HttpClient } from "../utils/http";

export type EntityType =
  | "SOLE_PROPRIETOR"
  | "PRIVATE_PROFIT"
  | "PUBLIC_PROFIT"
  | "NON_PROFIT"
  | "GOVERNMENT";

export type BrnType =
  | "EIN"
  | "SSN"
  | "DUNS"
  | "CRA"
  | "VAT"
  | "LEI"
  | "OTHER";

export type Disposition = "moved" | "released";

export interface PreflightCandidate {
  businessName: string;
  doingBusinessAs?: string;
  brn: string;
  brnType: BrnType;
  brnCountry: string;
  entityType: EntityType;
  website?: string;
  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  zip?: string;
  addressCountry?: string;
  contactFirstName?: string;
  contactLastName?: string;
  contactEmail?: string;
  contactPhone?: string;
  monthlyVolume?: string;
  useCase?: string;
  useCaseSummary?: string;
  sampleMessages?: string;
  optInWorkflow?: string;
  privacyUrl?: string;
  termsUrl?: string;
  additionalInformation?: string;
  ageGatedContent?: boolean;
}

export interface PreflightIssue {
  severity: "blocker" | "warning" | "info";
  field: string;
  code: string;
  message: string;
  suggestion?: string;
}

export interface PreflightProposedFix {
  field: string;
  current: unknown;
  proposed: unknown;
  reason: string;
}

export interface PreflightReport {
  verificationId: string;
  businessName: string | null;
  country: "CA" | "US" | "OTHER" | "UNKNOWN";
  verdict: "ready" | "warnings" | "blocked";
  issues: PreflightIssue[];
  proposedFixes: PreflightProposedFix[];
}

export interface StartUpgradeParams {
  businessName: string;
  brn: string;
  brnType: BrnType;
  brnCountry: string;
  entityType: EntityType;
  doingBusinessAs?: string;
  website?: string;
  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  zip?: string;
  addressCountry?: string;
  contactFirstName?: string;
  contactLastName?: string;
  contactEmail?: string;
  contactPhone?: string;
  monthlyVolume?: string;
  useCase?: string;
  useCaseSummary?: string;
  sampleMessages?: string;
  optInWorkflow?: string;
  privacyUrl?: string;
  termsUrl?: string;
  additionalInformation?: string;
  ageGatedContent?: boolean;
}

export interface EinDocumentInput {
  /** Buffer containing the PDF bytes */
  buffer: Buffer | Uint8Array;
  /** Filename (defaults to "ein-doc.pdf") */
  filename?: string;
  /** Content-Type (defaults to "application/pdf") */
  contentType?: string;
}

export interface StartUpgradeResponse {
  success: true;
  pendingVerificationId: string;
  telnyxVerificationId: string;
  tollFreeNumber: string;
  telnyxMessagingProfileId: string;
  einDocStored: boolean;
  message: string;
}

export interface UpgradeStatusResponse {
  pending: {
    id: string;
    businessName: string;
    status: string;
    entityType: string | null;
    brnType: string | null;
    brnCountry: string | null;
    tollFreeNumber: string | null;
    rejectionReason: string | null;
    createdAt: string;
    updatedAt: string;
  } | null;
}

export interface CancelUpgradeResponse {
  success: boolean;
  cancelled: boolean;
  cancelledVerificationId?: string;
  message: string;
}

export interface ResubmitUpgradeResponse {
  success: boolean;
  pendingVerificationId: string;
  message: string;
}

export interface DispositionResponse {
  success: boolean;
  disposition: Disposition;
  supersededVerificationId: string;
  message: string;
}

export interface BestPrefillResponse {
  prefill: {
    monthlyVolume?: string;
    useCase?: string;
    useCaseSummary?: string;
    sampleMessages?: string;
    optInWorkflow?: string;
    optInImageUrls?: string;
    optInSource?: string;
    privacyUrl?: string;
    termsUrl?: string;
    additionalInformation?: string;
    isvReseller?: string;
    ageGatedContent?: boolean;
  };
  sourceWorkspaceCount: number;
}

/**
 * BusinessUpgrade resource
 *
 * @example
 * ```typescript
 * // Preview validation before submitting
 * const preview = await sendly.businessUpgrade.preflight({
 *   businessName: "Acme Holdings LLC",
 *   brn: "12-3456789",
 *   brnType: "EIN",
 *   brnCountry: "US",
 *   entityType: "PRIVATE_PROFIT",
 * });
 *
 * // Submit the upgrade with the IRS letter
 * import { readFileSync } from "fs";
 * const result = await sendly.businessUpgrade.start("ws_abc", {
 *   businessName: "Acme Holdings LLC",
 *   brn: "12-3456789",
 *   brnType: "EIN",
 *   brnCountry: "US",
 *   entityType: "PRIVATE_PROFIT",
 * }, {
 *   einDoc: { buffer: readFileSync("./CP-575.pdf"), filename: "CP-575.pdf" }
 * });
 * ```
 */
export class BusinessUpgradeResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Validate a candidate entity upgrade payload before submission.
   * Returns issues + proposed auto-fixes. No writes — purely advisory.
   */
  async preflight(candidate: PreflightCandidate): Promise<PreflightReport> {
    return this.http.request<PreflightReport>({
      method: "POST",
      path: "/verification/preflight",
      body: candidate as unknown as Record<string, unknown>,
    });
  }

  /**
   * Get a "best-of" prefill across all the caller's verified workspaces.
   * Returns most-recent non-empty values per messaging field. Use this
   * to pre-populate the upgrade form for users whose current workspace
   * has incomplete data.
   */
  async bestPrefill(): Promise<BestPrefillResponse> {
    return this.http.request<BestPrefillResponse>({
      method: "GET",
      path: "/verification/best-prefill",
    });
  }

  /**
   * Start an entity upgrade for the given workspace. Auto-provisions
   * a new toll-free number + messaging profile and submits to the
   * carrier for review. Returns the pending verification details.
   *
   * The current toll-free number continues sending throughout the
   * 1-2 week carrier review; on approval, an atomic swap promotes
   * the new number.
   */
  async start(
    workspaceId: string,
    params: StartUpgradeParams,
    options?: { einDoc?: EinDocumentInput },
  ): Promise<StartUpgradeResponse> {
    const form = new FormData();
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null) continue;
      form.append(k, typeof v === "boolean" ? String(v) : (v as string));
    }
    if (options?.einDoc) {
      const blob = new Blob([options.einDoc.buffer as Uint8Array], {
        type: options.einDoc.contentType || "application/pdf",
      });
      form.append(
        "einDoc",
        blob as Blob,
        options.einDoc.filename || "ein-doc.pdf",
      );
    }
    return this.http.requestFormData<StartUpgradeResponse>(
      `/workspaces/${encodeURIComponent(workspaceId)}/upgrade`,
      form,
    );
  }

  /**
   * Check whether the given workspace has a pending entity upgrade.
   * Returns `{ pending: null }` if no upgrade is in flight.
   */
  async status(workspaceId: string): Promise<UpgradeStatusResponse> {
    return this.http.request<UpgradeStatusResponse>({
      method: "GET",
      path: `/workspaces/${encodeURIComponent(workspaceId)}/upgrade/status`,
    });
  }

  /**
   * Cancel a pending entity upgrade for the given workspace. Releases
   * the reserved toll-free number, deletes the new messaging profile,
   * and removes the stored EIN document. Idempotent.
   */
  async cancel(workspaceId: string): Promise<CancelUpgradeResponse> {
    return this.http.request<CancelUpgradeResponse>({
      method: "POST",
      path: `/workspaces/${encodeURIComponent(workspaceId)}/upgrade/cancel`,
    });
  }

  /**
   * Resubmit a rejected (or waiting-for-customer) entity upgrade with
   * updated fields and optionally a new EIN document.
   */
  async resubmit(
    workspaceId: string,
    params: Partial<StartUpgradeParams>,
    options?: { einDoc?: EinDocumentInput },
  ): Promise<ResubmitUpgradeResponse> {
    const form = new FormData();
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null) continue;
      form.append(k, typeof v === "boolean" ? String(v) : (v as string));
    }
    if (options?.einDoc) {
      const blob = new Blob([options.einDoc.buffer as Uint8Array], {
        type: options.einDoc.contentType || "application/pdf",
      });
      form.append(
        "einDoc",
        blob as Blob,
        options.einDoc.filename || "ein-doc.pdf",
      );
    }
    return this.http.requestFormData<ResubmitUpgradeResponse>(
      `/workspaces/${encodeURIComponent(workspaceId)}/upgrade/resubmit`,
      form,
    );
  }

  /**
   * After a successful entity-upgrade approval, choose what happens to
   * the old toll-free number:
   *
   * - `moved`: keep it active under another workspace owned by the
   *   same user (requires `targetWorkspaceId`)
   * - `released`: return it to the carrier pool
   */
  async setDisposition(
    workspaceId: string,
    body: { disposition: Disposition; targetWorkspaceId?: string },
  ): Promise<DispositionResponse> {
    return this.http.request<DispositionResponse>({
      method: "POST",
      path: `/workspaces/${encodeURIComponent(workspaceId)}/upgrade/disposition`,
      body: {
        disposition: body.disposition,
        targetOrgId: body.targetWorkspaceId,
      } as Record<string, unknown>,
    });
  }
}
