/**
 * Calls Resource - Phone calls handled by your AI agents
 *
 * @packageDocumentation
 *
 * Place an outbound phone call that one of your workspace's AI agents
 * handles, list and inspect calls (including the transcript of an
 * agent-handled call), end a call, and fetch a recording.
 *
 * Calls are prepaid from the workspace balance per started minute: an
 * agent-handled outbound call costs 10 credits a minute (2 for the call,
 * 8 for the agent). Unanswered calls cost nothing. Destinations are US and
 * Canadian numbers; the `from` number must be voice-enabled in the
 * dashboard (Calls → Settings) and have an emergency address registered.
 *
 * Reads need the `calls:read` scope and writes `calls:write`. Writes need
 * a live API key and accept an optional
 * {@link IdempotentRequestOptions | idempotency key}; POST requests get
 * one automatically. Voice is enabled workspace by workspace; until it is,
 * every method responds `404 voice_not_enabled`.
 *
 * @see https://sendly.live/docs/voice
 */

import type { HttpClient } from "../utils/http";
import type { IdempotentRequestOptions } from "../types";
import { ValidationError } from "../errors";

/**
 * Where a call is in its lifecycle. `ringing` and `active` are live; the
 * rest are terminal. `suspended` can appear on an internal call whose
 * media dropped and may recover.
 */
export type CallStatus =
  | "ringing"
  | "active"
  | "completed"
  | "no_answer"
  | "busy"
  | "cancelled"
  | "declined"
  | "failed"
  | "suspended";

/** Which way the call was placed. */
export type CallDirection = "inbound" | "outbound";

/** `pstn` is a phone call; `internal` is browser-to-browser between teammates. */
export type CallKind = "pstn" | "internal";

/** Who answered: an AI agent or the team in the dashboard. */
export type CallHandledBy = "agent" | "dashboard";

/**
 * Billing state of a call:
 * - `metered` - phone call in progress, charged per started minute
 * - `settled` - ended; `creditsCharged` is final
 * - `unbilled` - never charged (internal calls, rows from before metering)
 */
export type CallBilling = "metered" | "settled" | "unbilled";

/** Recording state on a call, or `null` when nothing was recorded. */
export type CallRecordingStatus = "recording" | "ready" | "failed" | null;

/**
 * One line of an agent call's transcript.
 */
export interface CallTranscriptLine {
  /** Who spoke */
  speaker: "caller" | "agent";
  /** What was said */
  text: string;
  /** Offset from the start of the call, in milliseconds */
  atMs: number;
}

/**
 * A phone call.
 */
export interface Call {
  /** Unique call identifier (uuid) */
  id: string;
  /** Always `"call"` */
  object: "call";
  /** `pstn` (a phone call) or `internal` (browser-to-browser) */
  kind: CallKind;
  /** `inbound` or `outbound` */
  direction: CallDirection;
  /** Lifecycle status */
  status: CallStatus;
  /** Who answered: `agent` or `dashboard` */
  handledBy: CallHandledBy;
  /** The AI agent on the call, or `null` */
  agentId: string | null;
  /** Calling number in E.164, or `null` on internal calls */
  from: string | null;
  /** Called number in E.164, or `null` on internal calls */
  to: string | null;
  /** Display name of the calling side, or `null` */
  callerName: string | null;
  /** Display name of the called side, or `null` */
  calleeName: string | null;
  /** When the call started ringing (ISO 8601) */
  startedAt: string;
  /** When the call was answered (ISO 8601), or `null` */
  answeredAt: string | null;
  /** When the call ended (ISO 8601), or `null` while live */
  endedAt: string | null;
  /** Answered seconds; `0` until the call ends */
  durationSecs: number;
  /** Credits charged so far (final once `billing` is `settled`) */
  creditsCharged: number;
  /** `metered`, `settled` or `unbilled` */
  billing: CallBilling;
  /**
   * Why the call ended, or `null` while live. Normal endings: `normal`,
   * `caller_hung_up`, `callee_hung_up`, `caller_left`, `peer_left`,
   * `agent_ended`, `agent_agent_hangup`, `agent_caller_left`. Never
   * connected: `ring_timeout`, `callee_declined`, `callee_busy`,
   * `caller_cancelled`, `room_closed_unanswered`, `agent_left_unanswered`,
   * `agent_caller_never_joined`, `invalid_number`, `destination_rejected`.
   * Cut short by the platform: `max_duration`, `credits_exhausted`,
   * `media_aborted`, `peer_connection_lost`, `room_closed`, `agent_left`.
   * Setup problems: `setup_failed`, `agent_dispatch_failed`,
   * `agent_api_unreachable`, `agent_already_ended`. Anything unrecognised
   * is reported as `ended`.
   */
  hangupClass: string | null;
  /** `recording`, `ready`, `failed`, or `null` when nothing was recorded */
  recordingStatus: CallRecordingStatus;
  /** The map you attached on create (`{}` when none) */
  metadata: Record<string, string>;
  /**
   * Transcript of an agent-handled call. Only present on
   * {@link CallsResource.get}, and only for agent calls (an empty array
   * when nothing was said). Omitted for other calls.
   */
  transcript?: CallTranscriptLine[];
}

/**
 * Request to place a call handled by an AI agent.
 */
export interface CreateCallRequest {
  /** Number to call, in E.164 (US or Canada) */
  to: string;
  /** The AI agent that talks on the call */
  agentId: string;
  /**
   * Voice-enabled number in your workspace to call from. Optional when the
   * workspace has exactly one voice-enabled number; required otherwise.
   */
  from?: string;
  /**
   * Up to 2000 characters appended to the agent's instructions for this
   * call only (for example who is being called and why). Not echoed back.
   */
  context?: string;
  /**
   * Up to 20 string values keyed by 1-40 character names matching
   * `^[A-Za-z0-9_.:-]+$`; values up to 500 characters. Echoed on every
   * read and in every `call.*` webhook.
   */
  metadata?: Record<string, string>;
}

/**
 * Options for {@link CallsResource.list}.
 */
export interface ListCallsOptions {
  /**
   * Maximum number of calls to return (1-100)
   * @default 50
   */
  limit?: number;
  /**
   * Number of calls to skip for pagination
   * @default 0
   */
  offset?: number;
  /** Only calls with this status */
  status?: CallStatus;
  /** Only calls in this direction */
  direction?: CallDirection;
  /** Only calls of this kind */
  kind?: CallKind;
  /** Only calls handled by this agent */
  agentId?: string;
  /** Only calls to this E.164 number (exact match) */
  to?: string;
  /** Only calls from this E.164 number (exact match) */
  from?: string;
}

/**
 * Response from {@link CallsResource.list}.
 */
export interface CallListResponse {
  /** Calls, newest first */
  data: Call[];
  pagination: {
    /** Total calls matching the filters */
    total: number;
    /** The page size that was applied */
    limit: number;
    /** The offset that was applied */
    offset: number;
    /** True when `offset + data.length < total` */
    hasMore: boolean;
  };
}

/**
 * Response from {@link CallsResource.recording}.
 */
export interface CallRecording {
  /** The call the recording belongs to */
  callId: string;
  /**
   * `none` when there is no recording for this call (recording off, or
   * never answered), `recording` while the call runs, `ready` when `url`
   * can be fetched, `failed` when the recording could not be produced.
   */
  status: "none" | "recording" | "ready" | "failed";
  /** Signed download URL, valid for five minutes. Non-null only when `ready`. */
  url: string | null;
  /** When `url` stops working (ISO 8601). Non-null only when `ready`. */
  expiresAt: string | null;
  /** `audio/ogg` when `ready`, else `null`. Agent calls are dual-channel. */
  contentType: string | null;
}

/**
 * Calls resource - place, list, inspect and end phone calls handled by
 * your AI agents, and fetch their recordings.
 *
 * @example
 * ```typescript
 * // Have an agent call someone
 * const call = await sendly.calls.create({
 *   to: '+15555550123',
 *   agentId: '3c4d5e6f-7081-4293-a4b5-c6d7e8f90a1b',
 *   context: 'You are calling Jordan to confirm the 3pm appointment on Tuesday.',
 *   metadata: { crmId: 'lead_8812' },
 * });
 * console.log(call.status); // "ringing"
 *
 * // Watch it, then read the transcript once it ends
 * const current = await sendly.calls.get(call.id);
 * console.log(current.status, current.hangupClass, current.transcript);
 *
 * // Fetch the recording when it is ready
 * const recording = await sendly.calls.recording(call.id);
 * if (recording.status === 'ready') console.log(recording.url);
 * ```
 */
export class CallsResource {
  private readonly http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  /**
   * Place a phone call that an AI agent handles. Requires the `calls:write`
   * scope and a live API key.
   *
   * The call is returned while it rings (`status: "ringing"`,
   * `creditsCharged: 0`); the first minute is charged when it is answered.
   * Poll {@link CallsResource.get} or subscribe to the `call.started` and
   * `call.completed` webhooks to follow it.
   *
   * @param request - Who to call, which agent talks, and optional context and metadata
   * @param options - Optional idempotency key
   * @returns The new call
   *
   * @example
   * ```typescript
   * const call = await sendly.calls.create({
   *   to: '+15555550123',
   *   agentId: '3c4d5e6f-7081-4293-a4b5-c6d7e8f90a1b',
   *   from: '+15555550188',
   * });
   * console.log(call.id, call.status); // "6f1c2d3e-...", "ringing"
   * ```
   *
   * @throws {ValidationError} If `to` or `agentId` is missing
   * @throws {SendlyError} `voice_not_enabled` (404) when voice isn't switched on for the workspace
   * @throws {SendlyError} `agent_not_found` (404) / `agent_disabled` (409)
   * @throws {SendlyError} `from_number_required` (400) when the workspace has several voice-enabled numbers and `from` is missing
   * @throws {SendlyError} `e911_required` (428) when the number has no emergency address
   * @throws {InsufficientCreditsError} When the balance is below one minute at the agent rate
   * @throws {SendlyError} `lines_busy` (409) / `daily_call_limit` (429)
   */
  async create(
    request: CreateCallRequest,
    options?: IdempotentRequestOptions,
  ): Promise<Call> {
    if (!request || typeof request.to !== "string" || !request.to.trim()) {
      throw new ValidationError("A destination 'to' is required");
    }
    if (typeof request.agentId !== "string" || !request.agentId.trim()) {
      throw new ValidationError("An 'agentId' is required");
    }

    return this.http.request<Call>({
      method: "POST",
      path: "/calls",
      idempotencyKey: options?.idempotencyKey,
      body: {
        to: request.to,
        agentId: request.agentId,
        ...(request.from !== undefined && { from: request.from }),
        ...(request.context !== undefined && { context: request.context }),
        ...(request.metadata !== undefined && { metadata: request.metadata }),
      },
    });
  }

  /**
   * List calls, newest first. Requires the `calls:read` scope.
   *
   * @param options - Pagination and filters (`status`, `direction`, `kind`, `agentId`, `to`, `from`)
   * @returns The page and pagination info
   *
   * @example
   * ```typescript
   * const { data, pagination } = await sendly.calls.list({
   *   status: 'completed',
   *   limit: 20,
   * });
   * for (const call of data) {
   *   console.log(`${call.to} ${call.durationSecs}s ${call.creditsCharged} credits`);
   * }
   * if (pagination.hasMore) console.log("more at offset", pagination.offset + pagination.limit);
   * ```
   */
  async list(options: ListCallsOptions = {}): Promise<CallListResponse> {
    return this.http.request<CallListResponse>({
      method: "GET",
      path: "/calls",
      query: {
        limit: options.limit,
        offset: options.offset,
        status: options.status,
        direction: options.direction,
        kind: options.kind,
        agentId: options.agentId,
        to: options.to,
        from: options.from,
      },
    });
  }

  /**
   * Retrieve a call. Agent-handled calls include the `transcript`.
   * Requires the `calls:read` scope.
   *
   * @param id - Call identifier
   * @returns The call
   *
   * @example
   * ```typescript
   * const call = await sendly.calls.get('6f1c2d3e-4a5b-4c6d-8e9f-0a1b2c3d4e5f');
   * for (const line of call.transcript ?? []) {
   *   console.log(`${line.speaker}: ${line.text}`);
   * }
   * ```
   *
   * @throws {ValidationError} If `id` is missing
   * @throws {SendlyError} `call_not_found` (404) when the call isn't in this workspace
   */
  async get(id: string): Promise<Call> {
    if (!id || typeof id !== "string") {
      throw new ValidationError("A call 'id' is required");
    }

    return this.http.request<Call>({
      method: "GET",
      path: `/calls/${encodeURIComponent(id)}`,
    });
  }

  /**
   * End a call. Requires the `calls:write` scope and a live API key.
   *
   * A ringing call becomes `cancelled` (`hangupClass: "caller_cancelled"`),
   * an active one `completed` (`hangupClass: "normal"`). Calling this on a
   * call that has already ended returns it unchanged.
   *
   * @param id - Call identifier
   * @param options - Optional idempotency key
   * @returns The call after hanging up
   *
   * @example
   * ```typescript
   * const call = await sendly.calls.hangup('6f1c2d3e-4a5b-4c6d-8e9f-0a1b2c3d4e5f');
   * console.log(call.status, call.hangupClass); // "completed", "normal"
   * ```
   *
   * @throws {ValidationError} If `id` is missing
   * @throws {SendlyError} `call_not_found` (404) when the call isn't in this workspace
   */
  async hangup(id: string, options?: IdempotentRequestOptions): Promise<Call> {
    if (!id || typeof id !== "string") {
      throw new ValidationError("A call 'id' is required");
    }

    return this.http.request<Call>({
      method: "POST",
      path: `/calls/${encodeURIComponent(id)}/hangup`,
      idempotencyKey: options?.idempotencyKey,
      body: {},
    });
  }

  /**
   * Fetch a call's recording. Requires the `calls:read` scope.
   *
   * `url` is a signed download link valid for five minutes and is only set
   * while `status` is `ready`. Subscribe to `call.recording.ready` to know
   * when to call this.
   *
   * @param id - Call identifier
   * @returns The recording status and, when ready, a signed URL
   *
   * @example
   * ```typescript
   * const recording = await sendly.calls.recording('6f1c2d3e-4a5b-4c6d-8e9f-0a1b2c3d4e5f');
   * if (recording.status === 'ready') {
   *   const audio = await fetch(recording.url!); // audio/ogg, until recording.expiresAt
   * }
   * ```
   *
   * @throws {ValidationError} If `id` is missing
   * @throws {SendlyError} `call_not_found` (404) when the call isn't in this workspace
   */
  async recording(id: string): Promise<CallRecording> {
    if (!id || typeof id !== "string") {
      throw new ValidationError("A call 'id' is required");
    }

    return this.http.request<CallRecording>({
      method: "GET",
      path: `/calls/${encodeURIComponent(id)}/recording`,
    });
  }
}
