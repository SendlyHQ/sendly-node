/**
 * Numbers Resource — Phone Number Discovery & Provisioning
 *
 * @packageDocumentation
 *
 * Browse the countries and number types Sendly can provision, search
 * available numbers (already priced for your account), list the numbers
 * you own, and buy a new one.
 *
 * Buying a number is asynchronous. The `buy()` call returns `202` with a
 * status:
 *
 * - `provisioning` — the number is being set up; poll {@link NumbersResource.list}
 *   until it appears as active.
 * - `documents_required` / `payment_required` — the purchase needs the user
 *   to finish something on a hosted Sendly page first. The response carries
 *   an `action` object with a `url` (the hosted page), a short `code` the
 *   user types on that page to prove they have terminal access, and an
 *   `actionCode` (the action identifier). Hand the user the URL + `code`,
 *   wait for the action to complete, then call `buy()` again with the SAME
 *   body plus `actionCode` set to the action's `actionCode` — NOT its `code`.
 *
 * @see https://sendly.live/docs/numbers
 */

import type { HttpClient } from "../utils/http";

/**
 * A country Sendly can provision numbers in.
 */
export interface NumberCountry {
  /** ISO 3166-1 alpha-2 country code (e.g. "GB") */
  code: string;
  /** Human-readable country name */
  name: string;
  /** Number types available in this country (e.g. ["mobile", "local"]) */
  numberTypes: string[];
}

/**
 * Response from {@link NumbersResource.listCountries}.
 */
export interface ListNumberCountriesResponse {
  countries: NumberCountry[];
}

/**
 * A number available to buy. `monthlyCost` is already priced for your
 * account in the smallest currency unit's display form (a string).
 */
export interface AvailableNumber {
  /** Phone number in E.164 format */
  phoneNumber: string;
  /** ISO 3166-1 alpha-2 country code */
  country: string;
  /** Number type (e.g. "mobile", "local", "toll_free") */
  numberType: string;
  /** Customer-facing monthly cost (already marked up), as a string */
  monthlyCost: string;
  /** ISO 4217 currency code for `monthlyCost` (e.g. "USD") */
  currency: string;
}

/**
 * Options for {@link NumbersResource.listAvailable}.
 */
export interface ListAvailableNumbersOptions {
  /** ISO 3166-1 alpha-2 country code to search in (e.g. "GB") */
  country: string;
  /** Number type to search for (e.g. "mobile") */
  type: string;
  /** Optional substring the number must contain (digits only) */
  contains?: string;
}

/**
 * Response from {@link NumbersResource.listAvailable}.
 */
export interface ListAvailableNumbersResponse {
  numbers: AvailableNumber[];
}

/**
 * A phone number you own.
 */
export interface OwnedNumber {
  /** Unique number identifier */
  id: string;
  /** Phone number in E.164 format */
  phoneNumber: string;
  /**
   * Lifecycle status, one of:
   * - `provisioning` — being set up with the carrier
   * - `requirements_required` — awaiting regulatory documents (use
   *   `requirementsSubmittedAt` to tell "needs documents" from "under review")
   * - `active` — live; can send and receive
   * - `failed` — provisioning failed
   *
   * A number can only send once it is `active`.
   */
  status: string;
  /** How the number was acquired (e.g. "purchased", "ported") */
  source: string;
  /** ISO 3166-1 alpha-2 country code */
  countryCode: string;
  /** Number type (e.g. "mobile", "local", "toll_free") */
  phoneNumberType: string;
  /** Monthly cost in cents */
  monthlyCostCents: number;
  /**
   * True if this is the workspace's default sending number. Present on the
   * single-number responses ({@link NumbersResource.get},
   * {@link NumbersResource.update}); omitted from the {@link NumbersResource.list}
   * projection.
   */
  isDefault?: boolean;
  /**
   * When the customer submitted regulatory documents (ISO 8601), or `null`.
   * For a `requirements_required` number: `null` = still needs documents,
   * non-null = documents submitted and under carrier review.
   */
  requirementsSubmittedAt: string | null;
  /** True if the number is scheduled to be released at the end of the paid period. */
  pendingCancellation: boolean;
  /** When a scheduled release takes effect (ISO 8601), or `null`. */
  scheduledReleaseAt: string | null;
}

/**
 * Response from {@link NumbersResource.list}.
 */
export interface ListNumbersResponse {
  numbers: OwnedNumber[];
}

/**
 * Request body for {@link NumbersResource.buy}.
 */
export interface BuyNumberRequest {
  /** Phone number to buy, in E.164 format */
  phoneNumber: string;
  /** ISO 3166-1 alpha-2 country code */
  countryCode: string;
  /** Number type (e.g. "mobile", "local", "toll_free") */
  phoneNumberType: string;
  /** Customer-facing monthly cost from the available-numbers listing */
  monthlyCost: string;
  /**
   * The `actionCode` (action identifier) from a prior buy response's `action`
   * object. Set this only when re-calling `buy()` after the user finished a
   * `documents_required` / `payment_required` hosted-page step. Pass the
   * action's `actionCode`, NOT its display `code`.
   */
  actionCode?: string;
}

/**
 * Outcome of a buy attempt.
 *
 * - `provisioning` — purchase accepted, the number is being set up; poll
 *   {@link NumbersResource.list} until it is `active`.
 * - `documents_required` — the country needs business details + documents. The
 *   response carries an `action` (hosted-page `url` + `code`); have the user
 *   complete it, then call `buy()` again with `actionCode`.
 * - `under_review` — the submitted details are in; the number is reserved and
 *   being verified + registered (usually a few business days). It cannot send
 *   until it is `active` — poll {@link NumbersResource.list} for the status.
 * - `payment_required` — a card is needed first. The response carries an
 *   `action` (hosted-page `url` + `code`); have the user add a card, then call
 *   `buy()` again with `actionCode`.
 */
export type BuyNumberStatus =
  | "provisioning"
  | "documents_required"
  | "under_review"
  | "payment_required";

/**
 * Hosted-page hand-off returned when a buy needs the user to finish a step.
 */
export interface NumberBuyAction {
  /**
   * Action identifier (32-hex string). Pass this back as the buy request's
   * `actionCode` to re-buy once the action completes. Not for display.
   */
  actionCode: string;
  /** Hosted Sendly page URL to send the user to */
  url: string;
  /**
   * Short display code (8 chars) the user enters on the hosted page to prove
   * terminal access. Show this to the user — do NOT use it as `actionCode`.
   */
  code: string;
  /** When this action expires (epoch milliseconds) */
  expiresAt: number;
}

/**
 * The number returned in a successful (`provisioning`) buy response. Carries
 * only `id`, `phoneNumber`, and `status` — use {@link NumbersResource.list}
 * for the full record.
 */
export interface BuyNumberResult {
  /** Unique number identifier */
  id: string;
  /** Phone number in E.164 format */
  phoneNumber: string;
  /** Provisioning / lifecycle status */
  status: string;
}

/**
 * Response from {@link NumbersResource.buy}.
 *
 * When `status` is `documents_required` or `payment_required`, `action`
 * carries the hosted-page hand-off (URL + display `code` + `actionCode`).
 * Hand the user the URL + `code`, wait for completion, then call `buy()`
 * again with the same body plus `actionCode` set to the action's `actionCode`.
 */
export interface BuyNumberResponse {
  status: BuyNumberStatus;
  /** The provisioned number, when status is `provisioning` */
  number?: BuyNumberResult;
  /** Outstanding requirements, when status is `documents_required` */
  requirements?: unknown[];
  /** Hosted-page hand-off, when status requires user action */
  action?: NumberBuyAction;
}

/**
 * Request body for {@link NumbersResource.update}.
 *
 * Supply at least one field. Only these two mutations are supported:
 *
 * - `isDefault: true` — make this number the workspace's default sender. The
 *   number must be `active`, or the call fails with `invalid_state`.
 * - `pendingCancellation: false` — cancel a previously scheduled release and
 *   keep the number.
 *
 * A body with neither field fails with `no_supported_fields`.
 */
export interface UpdateNumberRequest {
  /** Set to `true` to make this the workspace's default sender (requires `active`). */
  isDefault?: true;
  /** Set to `false` to cancel a scheduled release and keep the number. */
  pendingCancellation?: false;
}

/**
 * Response from {@link NumbersResource.release}.
 *
 * - Immediate release: `{ success: true }`.
 * - Scheduled release (a live paid purchase is cancelled at the end of the
 *   paid period): `{ success: true, scheduled: true, scheduledReleaseAt }`.
 */
export interface ReleaseNumberResponse {
  /** Always `true` on success. */
  success: true;
  /** `true` when the release was scheduled for the end of the paid period. */
  scheduled?: true;
  /** When the scheduled release takes effect (ISO 8601), when `scheduled`. */
  scheduledReleaseAt?: string;
}

/**
 * Numbers resource — discover, buy, and list phone numbers.
 *
 * @example
 * ```typescript
 * // 1. Browse what's available
 * const { countries } = await sendly.numbers.listCountries();
 * const { numbers } = await sendly.numbers.listAvailable({
 *   country: "GB",
 *   type: "mobile",
 * });
 *
 * // 2. Buy one
 * const result = await sendly.numbers.buy({
 *   phoneNumber: numbers[0].phoneNumber,
 *   countryCode: numbers[0].country,
 *   phoneNumberType: numbers[0].numberType,
 *   monthlyCost: numbers[0].monthlyCost,
 * });
 *
 * if (result.status === "provisioning") {
 *   console.log("Number is being set up");
 * } else if (result.action) {
 *   // documents_required / payment_required: send the user to the hosted page.
 *   // Show them the display `code`; keep `actionCode` for the re-buy.
 *   console.log(`Finish at ${result.action.url} (code ${result.action.code})`);
 *   // ...after they complete it, re-call buy() with actionCode set to
 *   //    result.action.actionCode.
 * }
 *
 * // 3. List the numbers you own
 * const { numbers: owned } = await sendly.numbers.list();
 * ```
 */
export class NumbersResource {
  private readonly http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  /**
   * List the countries Sendly can provision numbers in, with the number
   * types available in each.
   *
   * @returns Supported countries and their number types
   *
   * @example
   * ```typescript
   * const { countries } = await sendly.numbers.listCountries();
   * for (const c of countries) {
   *   console.log(`${c.name} (${c.code}): ${c.numberTypes.join(", ")}`);
   * }
   * ```
   */
  async listCountries(): Promise<ListNumberCountriesResponse> {
    return this.http.request<ListNumberCountriesResponse>({
      method: "GET",
      path: "/numbers/countries",
    });
  }

  /**
   * Search numbers available to buy in a country. Prices are already
   * customer-priced for your account.
   *
   * @param options - Country, number type, and optional `contains` filter
   * @returns Available numbers with pricing
   *
   * @example
   * ```typescript
   * const { numbers } = await sendly.numbers.listAvailable({
   *   country: "GB",
   *   type: "mobile",
   *   contains: "7700",
   * });
   * ```
   */
  async listAvailable(
    options: ListAvailableNumbersOptions,
  ): Promise<ListAvailableNumbersResponse> {
    return this.http.request<ListAvailableNumbersResponse>({
      method: "GET",
      path: "/numbers/available",
      query: {
        country: options.country,
        type: options.type,
        contains: options.contains,
      },
    });
  }

  /**
   * List the phone numbers you own.
   *
   * @returns Your numbers and their lifecycle status
   *
   * @example
   * ```typescript
   * const { numbers } = await sendly.numbers.list();
   * for (const n of numbers) {
   *   console.log(`${n.phoneNumber} — ${n.status}`);
   * }
   * ```
   */
  async list(): Promise<ListNumbersResponse> {
    return this.http.request<ListNumbersResponse>({
      method: "GET",
      path: "/numbers",
    });
  }

  /**
   * Get a single phone number you own by id. Unlike {@link NumbersResource.list},
   * the returned record includes `isDefault`.
   *
   * @param id - The number's id
   * @returns The full owned-number record
   *
   * @example
   * ```typescript
   * const number = await sendly.numbers.get("num_xxx");
   * console.log(`${number.phoneNumber} — default: ${number.isDefault}`);
   * ```
   *
   * @throws {NotFoundError} If no such number exists in your workspace
   * @throws {AuthenticationError} If the API key is invalid
   */
  async get(id: string): Promise<OwnedNumber> {
    if (!id) {
      throw new Error("A number 'id' is required");
    }

    return this.http.request<OwnedNumber>({
      method: "GET",
      path: `/numbers/${encodeURIComponent(id)}`,
    });
  }

  /**
   * Update a phone number you own. Supply at least one supported mutation:
   *
   * - `isDefault: true` — make this the workspace's default sending number
   *   (the number must be `active`).
   * - `pendingCancellation: false` — cancel a previously scheduled release and
   *   keep the number.
   *
   * @param id - The number's id
   * @param request - The mutation(s) to apply
   * @returns The updated owned-number record (including `isDefault`)
   *
   * @example
   * ```typescript
   * // Make a number the default sender
   * const updated = await sendly.numbers.update("num_xxx", { isDefault: true });
   *
   * // Cancel a scheduled release ("keep this number")
   * await sendly.numbers.update("num_xxx", { pendingCancellation: false });
   * ```
   *
   * @throws {ValidationError} If no supported field is provided, or `isDefault`
   *   is requested for a non-active number
   * @throws {NotFoundError} If no such number exists in your workspace
   * @throws {AuthenticationError} If the API key is invalid
   */
  async update(
    id: string,
    request: UpdateNumberRequest,
  ): Promise<OwnedNumber> {
    if (!id) {
      throw new Error("A number 'id' is required");
    }
    if (
      !request ||
      (request.isDefault === undefined &&
        request.pendingCancellation === undefined)
    ) {
      throw new Error(
        "Provide at least one of { isDefault: true } or { pendingCancellation: false }",
      );
    }

    return this.http.request<OwnedNumber>({
      method: "PATCH",
      path: `/numbers/${encodeURIComponent(id)}`,
      body: {
        ...(request.isDefault !== undefined && { isDefault: request.isDefault }),
        ...(request.pendingCancellation !== undefined && {
          pendingCancellation: request.pendingCancellation,
        }),
      },
    });
  }

  /**
   * Release a phone number you own. A live paid purchase is cancelled at the
   * end of the paid period (the response then carries `scheduled: true` and a
   * `scheduledReleaseAt`); everything else is released immediately.
   *
   * @param id - The number's id
   * @returns `{ success: true }` for an immediate release, or
   *   `{ success: true, scheduled: true, scheduledReleaseAt }` when scheduled
   *
   * @example
   * ```typescript
   * const result = await sendly.numbers.release("num_xxx");
   * if (result.scheduled) {
   *   console.log(`Releases at ${result.scheduledReleaseAt}`);
   * } else {
   *   console.log("Released");
   * }
   * ```
   *
   * @throws {NotFoundError} If no such number exists in your workspace
   * @throws {ValidationError} If the carrier release failed
   * @throws {AuthenticationError} If the API key is invalid
   */
  async release(id: string): Promise<ReleaseNumberResponse> {
    if (!id) {
      throw new Error("A number 'id' is required");
    }

    return this.http.request<ReleaseNumberResponse>({
      method: "DELETE",
      path: `/numbers/${encodeURIComponent(id)}`,
    });
  }

  /**
   * Buy a phone number. Asynchronous — returns `202` with a status.
   *
   * When the status is `documents_required` or `payment_required`, the
   * response carries an `action` hand-off (hosted-page URL + display `code`
   * + `actionCode`). Hand the user the URL + `code`, wait for them to
   * complete it, then call `buy()` again with the SAME body plus `actionCode`
   * set to the action's `actionCode` (the identifier — NOT the display `code`).
   *
   * @param request - The number to buy (from a listing) and optional `actionCode`
   * @returns The buy outcome
   *
   * @example
   * ```typescript
   * const result = await sendly.numbers.buy({
   *   phoneNumber: "+447700900123",
   *   countryCode: "GB",
   *   phoneNumberType: "mobile",
   *   monthlyCost: "1.50",
   * });
   *
   * // After a documents_required / payment_required action is completed,
   * // re-buy with the action's actionCode (the 32-hex identifier):
   * const finished = await sendly.numbers.buy({
   *   phoneNumber: "+447700900123",
   *   countryCode: "GB",
   *   phoneNumberType: "mobile",
   *   monthlyCost: "1.50",
   *   actionCode: result.action!.actionCode,
   * });
   * ```
   */
  async buy(request: BuyNumberRequest): Promise<BuyNumberResponse> {
    return this.http.request<BuyNumberResponse>({
      method: "POST",
      path: "/numbers/buy",
      body: {
        phoneNumber: request.phoneNumber,
        countryCode: request.countryCode,
        phoneNumberType: request.phoneNumberType,
        monthlyCost: request.monthlyCost,
        ...(request.actionCode !== undefined && {
          actionCode: request.actionCode,
        }),
      },
    });
  }
}
