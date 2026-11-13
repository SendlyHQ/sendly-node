/**
 * Voice Resource - Configure numbers, AI agents and voices for phone calls
 *
 * @packageDocumentation
 *
 * Everything a call depends on, configured from code: switch voice on for a
 * number and choose how it answers, register the number's emergency
 * address, and create the AI agents that talk on calls.
 *
 * Reads need the `calls:read` scope and writes `calls:write`. Writes need a
 * live API key and accept an optional
 * {@link IdempotentRequestOptions | idempotency key}; POST requests get one
 * automatically. In a team workspace, changing a number or its emergency
 * address also needs a role that can change settings, and managing agents a
 * role that can manage API keys (each agent holds its own scoped sending
 * key); otherwise the API responds `403 forbidden`. Voice is enabled
 * workspace by workspace; until it is, every method responds
 * `404 voice_not_enabled`.
 *
 * @see https://sendly.live/docs/voice
 */

import type { HttpClient } from "../utils/http";
import type { IdempotentRequestOptions } from "../types";
import { ValidationError } from "../errors";

/**
 * How a number answers inbound phone calls:
 * - `none` - not answered; always the mode when voice is off
 * - `ring_dashboard` - rings the team in the dashboard
 * - `agent` - an AI agent answers
 */
export type VoiceMode = "none" | "ring_dashboard" | "agent";

/**
 * A street address registered for emergency calls.
 */
export interface EmergencyAddress {
  /** Street address */
  street: string;
  /** Apartment, suite or floor. Omitted when there is none. */
  unit?: string;
  /** City */
  city: string;
  /** Two-letter state or province code */
  state: string;
  /** ZIP code (US) or postal code (Canada) */
  zip: string;
  /** `US` or `CA` */
  country: string;
}

/**
 * Request for {@link VoiceNumbersResource.registerEmergencyAddress}.
 */
export interface RegisterEmergencyAddressRequest {
  /** Street address */
  street: string;
  /** Apartment, suite or floor */
  unit?: string;
  /** City */
  city: string;
  /** Two-letter state or province code, e.g. `TX` */
  state: string;
  /** Five-digit ZIP (or ZIP+4) in the US, `A1A 1A1` in Canada */
  zip: string;
  /**
   * `US` or `CA`
   * @default "US"
   */
  country?: string;
}

/**
 * A number's emergency address registration.
 */
export interface VoiceNumberEmergencyAddress {
  /**
   * `provisioning` while the registration is being switched on, `active`
   * once it is in place, otherwise the failure status as recorded.
   */
  status: "provisioning" | "active" | (string & {});
  /** The registered address, or `null` when none is on file */
  address: EmergencyAddress | null;
}

/**
 * Credits charged per started minute on a number.
 */
export interface VoiceNumberRates {
  /** An inbound call the team answers in the dashboard */
  inbound: number;
  /** An outbound call (an agent on the call adds its own per-minute charge) */
  outbound: number;
  /** An inbound call an AI agent answers, agent included */
  agent: number;
}

/**
 * A number in the workspace with its voice settings.
 */
export interface VoiceNumber {
  /** Unique number identifier (uuid) */
  id: string;
  /** Always `"voice_number"` */
  object: "voice_number";
  /** The phone number in E.164 */
  phoneNumber: string;
  /** The number's type, for example `local`, or `null` */
  phoneNumberType: string | null;
  /** ISO 3166-1 alpha-2 country code, or `null` */
  countryCode: string | null;
  /** True for the workspace's default sending number */
  isDefault: boolean;
  /** True when the number takes and places phone calls */
  voiceEnabled: boolean;
  /** How inbound calls are answered; always `none` when `voiceEnabled` is false */
  voiceMode: VoiceMode;
  /**
   * The agent that answers when `voiceMode` is `agent`. In other modes,
   * whichever agent was last stored, or `null`.
   */
  agentId: string | null;
  /** The emergency address registration, or `null` if one was never registered */
  emergencyAddress: VoiceNumberEmergencyAddress | null;
  /** Credits per started minute on this number */
  ratePerMinute: VoiceNumberRates;
}

/**
 * Request for {@link VoiceNumbersResource.update}. Send only what changes.
 */
export interface UpdateVoiceNumberRequest {
  /**
   * Switch voice on or off. `true` connects the number for phone calls and
   * answers in `ring_dashboard` mode unless `voiceMode` is `agent`; `false`
   * switches voice off and sets `voiceMode` to `none`, whatever mode is sent.
   */
  voiceEnabled?: boolean;
  /**
   * How the number answers. Sent without `voiceEnabled`, `ring_dashboard`
   * or `agent` switches voice on and `none` switches it off.
   */
  voiceMode?: VoiceMode;
  /**
   * The agent that answers in `agent` mode. Required (here or already
   * stored) when `voiceMode` is `agent`, and the agent must be switched on.
   * `null` clears it.
   */
  agentId?: string | null;
}

/**
 * Response from {@link VoiceNumbersResource.list}.
 */
export interface VoiceNumberListResponse {
  /** Active numbers in the workspace, in the same order as the dashboard */
  data: VoiceNumber[];
}

/**
 * What an agent may do on a call.
 */
export interface VoiceAgentTools {
  /**
   * True when the agent may text the caller during the call. It reads the
   * number back to the caller before sending.
   */
  sendSms: boolean;
  /**
   * An E.164 number the agent may transfer a phone caller to, or `null` to
   * switch transfers off. A caller who asks for a person, or whom the agent
   * cannot help, is offered a transfer; once they confirm, the agent
   * connects them and the call ends with `hangupClass: "transferred"`. If
   * the line is busy or unanswered after 30 seconds, the caller stays with
   * the agent, which takes a message. On update, `""` or `null` removes it.
   */
  transferTo: string | null;
  /**
   * True when quiet office ambience plays under the call, with typing while
   * the agent prepares a reply. Defaults to `false`.
   */
  backgroundAudio?: boolean;
}

/**
 * Who answers a call:
 * - `sendly` - Sendly writes the replies from the agent's instructions
 * - `custom_llm` - Sendly listens and speaks, and your chat completions endpoint writes each reply
 * - `sip` - Sendly connects the caller to your agent's SIP address
 * - `websocket` - Sendly streams the call audio to your WebSocket server and plays back what it sends
 *
 * Your own agents (every kind but `sendly`) need the workspace's
 * bring-your-own-agent feature. More values may be added.
 */
export type VoiceAgentKind =
  | "sendly"
  | "custom_llm"
  | "sip"
  | "websocket"
  | (string & {});

/** How a SIP call to your agent is carried. A `sips:` address always uses `tls`. */
export type SipTransport = "auto" | "udp" | "tcp" | "tls" | (string & {});

/** Whether the audio of a SIP call to your agent is encrypted. */
export type SipMediaEncryption = "disable" | "allow" | "require" | (string & {});

/** The audio format of a WebSocket agent, both ways. */
export type WebSocketAudioFormat =
  | "pcm16_16000"
  | "pcm16_24000"
  | "pcm16_8000"
  | "mulaw_8000"
  | (string & {});

/**
 * How Sendly reaches your model (`kind: "custom_llm"`).
 */
export interface VoiceAgentCustomLlmConnection {
  /** Your endpoint. Sendly sends `POST {baseUrl}/chat/completions` with streaming on. */
  baseUrl: string;
  /** The model name sent in each request */
  model: string;
  /** The names of the extra headers sent with each request. Their values are secret and never returned. */
  headerNames: string[];
  /** True when an API key is saved. The key itself is never returned. */
  hasApiKey: boolean;
}

/**
 * Where Sendly connects the caller (`kind: "sip"`).
 */
export interface VoiceAgentSipConnection {
  /** Your agent's SIP address, e.g. `sip:+15125550100@sip.example.com` */
  uri: string;
  /** How the call is carried */
  transport: SipTransport;
  /** Whether the call audio is encrypted */
  mediaEncryption: SipMediaEncryption;
  /** The digest auth username, or `null` */
  username: string | null;
  /** True when a password is saved. It is never returned. */
  hasPassword: boolean;
  /** Extra `X-` headers sent on the call */
  headers: Record<string, string>;
}

/**
 * Where Sendly streams the call (`kind: "websocket"`).
 */
export interface VoiceAgentWebSocketConnection {
  /** Your `wss://` server */
  url: string;
  /** The audio format both ways */
  audioFormat: WebSocketAudioFormat;
  /** True when an auth token is saved. It is sent as `Authorization: Bearer` and never returned. */
  hasAuthToken: boolean;
  /** Sent to your server in the `start` message */
  customParameters: Record<string, string>;
}

/**
 * How Sendly reaches your own agent. The shape matches the agent's `kind`;
 * secrets are never returned, only whether one is saved.
 */
export type VoiceAgentConnection =
  | VoiceAgentCustomLlmConnection
  | VoiceAgentSipConnection
  | VoiceAgentWebSocketConnection;

/**
 * Connection settings for a `custom_llm` agent. On update, fields you
 * leave out keep their saved values.
 */
export interface VoiceAgentCustomLlmConnectionInput {
  /**
   * An `https://` URL, up to 2,048 characters, with no credentials or `#`.
   * A trailing `/` is dropped. Required when the agent becomes `custom_llm`.
   */
  baseUrl?: string;
  /** 1 to 200 characters: letters, digits and `_ . : / @ + -`. Required when the agent becomes `custom_llm`. */
  model?: string;
  /** Sent as `Authorization: Bearer`. Left out keeps the saved key, `null` removes it. */
  apiKey?: string | null;
  /**
   * Up to 10 extra headers with secret values. Replaces the saved set;
   * `null` removes them. `Authorization`, `Content-Type`, `Host`,
   * `User-Agent` and `X-Sendly-*` can't be set.
   */
  headers?: Record<string, string> | null;
}

/**
 * Connection settings for a `sip` agent. On update, fields you leave out
 * keep their saved values.
 */
export interface VoiceAgentSipConnectionInput {
  /**
   * `sip:` or `sips:` with a user part and a hostname (not an IP address),
   * e.g. `sip:+15125550100@sip.example.com`. Only `;transport=` may follow.
   * Required when the agent becomes `sip`.
   */
  uri?: string;
  /**
   * How the call is carried
   * @default "tcp"
   */
  transport?: SipTransport;
  /**
   * Whether the call audio is encrypted. `require` needs the `tls` transport.
   * @default "allow"
   */
  mediaEncryption?: SipMediaEncryption;
  /** Digest auth username; `null` or `""` removes it */
  username?: string | null;
  /** Digest auth password. Left out keeps the saved one, `null` removes it. */
  password?: string | null;
  /** Up to 10 headers named `X-...`, not `X-Sendly-...`. Replaces the saved set; `null` removes them. */
  headers?: Record<string, string> | null;
}

/**
 * Connection settings for a `websocket` agent. On update, fields you
 * leave out keep their saved values.
 */
export interface VoiceAgentWebSocketConnectionInput {
  /** A `wss://` URL, up to 2,048 characters, with no credentials or `#`. Required when the agent becomes `websocket`. */
  url?: string;
  /**
   * The audio format both ways
   * @default "pcm16_16000"
   */
  audioFormat?: WebSocketAudioFormat;
  /** Sent as `Authorization: Bearer`. Left out keeps the saved one, `null` removes it. */
  authToken?: string | null;
  /**
   * Up to 20 string values (names of 1-40 letters, digits, `_ . : -`; values
   * up to 500 characters) sent in the `start` message. Replaces the saved
   * set; `null` removes them.
   */
  customParameters?: Record<string, string> | null;
}

/**
 * How Sendly reaches your own agent, matching `kind`. Hosts must resolve to
 * public internet addresses.
 */
export type VoiceAgentConnectionInput =
  | VoiceAgentCustomLlmConnectionInput
  | VoiceAgentSipConnectionInput
  | VoiceAgentWebSocketConnectionInput;

/**
 * An AI agent that answers and places phone calls.
 */
export interface VoiceAgent {
  /** Unique agent identifier (uuid) */
  id: string;
  /** Always `"voice_agent"` */
  object: "voice_agent";
  /** The agent's name */
  name: string;
  /** False when the agent is switched off; a switched-off agent can't be pointed at a number or put on a call */
  enabled: boolean;
  /** Who answers the call: `sendly`, or one of your own (`custom_llm`, `sip`, `websocket`) */
  kind: VoiceAgentKind;
  /** How Sendly reaches your own agent, matching `kind`; `null` for a `sendly` agent */
  connection: VoiceAgentConnection | null;
  /** True when the agent has a signing secret. Your own agents do: Sendly signs every request to them with it. */
  hasSigningSecret: boolean;
  /** Voice id, one of {@link VoiceVoicesResource.list} */
  voice: string;
  /** Human-readable voice name, e.g. `Ashley (US, warm)` */
  voiceLabel: string;
  /** Language tag, e.g. `en-US` */
  language: string;
  /** What the agent says when it picks up (`""` when unset) */
  greeting: string;
  /** Business instructions the agent follows (`""` when unset) */
  instructions: string;
  /** What the agent may do on a call */
  tools: VoiceAgentTools;
  /** True when the agent holds its own scoped sending key, so `tools.sendSms` can send */
  canSendSms: boolean;
  /** Calls this agent has handled */
  callsHandled: number;
  /** Average answered duration of those calls, in seconds */
  avgDurationSecs: number;
  /** When the agent was created (ISO 8601) */
  createdAt: string;
  /** When the agent last changed (ISO 8601) */
  updatedAt: string;
}

/**
 * The agent as {@link VoiceAgentsResource.create} and
 * {@link VoiceAgentsResource.update} return it.
 */
export interface VoiceAgentWithSecret extends VoiceAgent {
  /**
   * The agent's signing secret, present only when one was just made: on
   * creating your own agent, on switching a `sendly` agent to one of your
   * own, and on `rotateSigningSecret`. Save it now; it is never shown again.
   * Sendly signs every request to your agent with it in the
   * `X-Sendly-Signature` header (`t=<unix>,v1=<hex HMAC-SHA256>`).
   */
  signingSecret?: string;
}

/**
 * Request for {@link VoiceAgentsResource.create}.
 */
export interface CreateVoiceAgentRequest {
  /** 1-80 characters */
  name: string;
  /**
   * Whether the agent is switched on
   * @default true
   */
  enabled?: boolean;
  /** A voice id from {@link VoiceVoicesResource.list}. An unknown id falls back to the default voice. */
  voice?: string;
  /**
   * Language tag, up to 16 characters
   * @default "en-US"
   */
  language?: string;
  /** What the agent says when it picks up, up to 500 characters */
  greeting?: string;
  /** Business instructions the agent follows, up to 4000 characters */
  instructions?: string;
  /** What the agent may do on a call. `sendSms` defaults to `true`, `transferTo` to `null`, `backgroundAudio` to `false`. */
  tools?: Partial<VoiceAgentTools>;
  /**
   * Who answers the call. One of your own (`custom_llm`, `sip`,
   * `websocket`) needs the workspace's bring-your-own-agent feature and a
   * `connection`.
   * @default "sendly"
   */
  kind?: VoiceAgentKind;
  /** How Sendly reaches your own agent, matching `kind`. Required for every kind but `sendly`. */
  connection?: VoiceAgentConnectionInput;
}

/**
 * Request for {@link VoiceAgentsResource.update}. Send only what changes;
 * `tools` keys you leave out keep their current values.
 */
export interface UpdateVoiceAgentRequest {
  /** 1-80 characters */
  name?: string;
  /** Switch the agent on or off */
  enabled?: boolean;
  /** A voice id from {@link VoiceVoicesResource.list}. An unknown id falls back to the default voice. */
  voice?: string;
  /** Language tag, up to 16 characters; `""` resets it to `en-US` */
  language?: string;
  /** Up to 500 characters; `""` clears it */
  greeting?: string;
  /** Up to 4000 characters; `""` clears it */
  instructions?: string;
  /** Tool settings to change */
  tools?: Partial<VoiceAgentTools>;
  /**
   * Switch who answers the call. Switching to one of your own needs a
   * `connection`; switching to `sendly` removes the connection and the
   * signing secret.
   */
  kind?: VoiceAgentKind;
  /**
   * Connection settings to change. With the same `kind`, it is merged into
   * the saved connection: a secret left out is kept, `null` removes it.
   */
  connection?: VoiceAgentConnectionInput;
  /**
   * `true` makes a new signing secret for your own agent; the response
   * carries it once in `signingSecret`. The old one stops working straight
   * away.
   */
  rotateSigningSecret?: true;
}

/**
 * Response from {@link VoiceAgentsResource.list}.
 */
export interface VoiceAgentListResponse {
  /** The workspace's agents */
  data: VoiceAgent[];
}

/**
 * Response from {@link VoiceAgentsResource.delete}.
 */
export interface DeletedVoiceAgent {
  /** The deleted agent's id */
  id: string;
  /** Always `"voice_agent"` */
  object: "voice_agent";
  /** Always true */
  deleted: true;
}

/**
 * A voice an agent can speak with.
 */
export interface Voice {
  /** Voice id to pass as `voice` when creating or updating an agent */
  id: string;
  /** Human-readable name, e.g. `Ashley (US, warm)` */
  label: string;
  /** Language the voice speaks, e.g. `en` */
  language: string;
}

/**
 * Response from {@link VoiceVoicesResource.list}.
 */
export interface VoiceListResponse {
  /** Every voice an agent can use */
  data: Voice[];
}

function requireText(value: unknown, message: string): void {
  if (typeof value !== "string" || !value.trim()) {
    throw new ValidationError(message);
  }
}

function numberPath(number: string): string {
  requireText(
    number,
    "A 'number' is required: the number's id or its E.164 phone number",
  );
  return `/voice/numbers/${encodeURIComponent(number)}`;
}

function agentPath(id: string): string {
  requireText(id, "An agent 'id' is required");
  return `/voice/agents/${encodeURIComponent(id)}`;
}

function agentBody(request: UpdateVoiceAgentRequest): Record<string, unknown> {
  return {
    ...(request.name !== undefined && { name: request.name }),
    ...(request.enabled !== undefined && { enabled: request.enabled }),
    ...(request.voice !== undefined && { voice: request.voice }),
    ...(request.language !== undefined && { language: request.language }),
    ...(request.greeting !== undefined && { greeting: request.greeting }),
    ...(request.instructions !== undefined && {
      instructions: request.instructions,
    }),
    ...(request.tools !== undefined && { tools: request.tools }),
    ...(request.kind !== undefined && { kind: request.kind }),
    ...(request.connection !== undefined && {
      connection: request.connection,
    }),
    ...(request.rotateSigningSecret === true && { rotateSigningSecret: true }),
  };
}

class VoiceNumbersResource {
  private readonly http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  /**
   * List the workspace's active numbers with their voice settings, in the
   * same order as the dashboard. Requires the `calls:read` scope.
   *
   * @returns The numbers
   *
   * @example
   * ```typescript
   * const { data } = await sendly.voice.numbers.list();
   * for (const n of data) {
   *   console.log(n.phoneNumber, n.voiceMode, n.emergencyAddress?.status ?? 'no emergency address');
   * }
   * ```
   */
  async list(): Promise<VoiceNumberListResponse> {
    return this.http.request<VoiceNumberListResponse>({
      method: "GET",
      path: "/voice/numbers",
    });
  }

  /**
   * Retrieve a number's voice settings. Requires the `calls:read` scope.
   *
   * @param number - The number's id or its E.164 phone number
   * @returns The number
   *
   * @example
   * ```typescript
   * const number = await sendly.voice.numbers.get('+15555550188');
   * console.log(number.voiceEnabled, number.voiceMode, number.ratePerMinute);
   * ```
   *
   * @throws {ValidationError} If `number` is missing
   * @throws {SendlyError} `number_not_found` (404) when the number isn't active in this workspace
   */
  async get(number: string): Promise<VoiceNumber> {
    return this.http.request<VoiceNumber>({
      method: "GET",
      path: numberPath(number),
    });
  }

  /**
   * Change how a number answers phone calls. Requires the `calls:write`
   * scope and a live API key.
   *
   * This changes what happens when real people call the number. Turning
   * voice on connects the number for calls before the change is saved, and
   * a `ring_dashboard` or `agent` mode on its own turns it on;
   * `voiceMode: "none"` on its own or `voiceEnabled: false` switches it off.
   *
   * @param number - The number's id or its E.164 phone number
   * @param request - `voiceEnabled`, `voiceMode` and `agentId`; send only what changes
   * @param options - Optional idempotency key
   * @returns The number after the change
   *
   * @example
   * ```typescript
   * // Have an agent answer
   * const number = await sendly.voice.numbers.update('+15555550188', {
   *   voiceEnabled: true,
   *   voiceMode: 'agent',
   *   agentId: '3c4d5e6f-7081-4293-a4b5-c6d7e8f90a1b',
   * });
   *
   * // Ring the team in the dashboard instead
   * await sendly.voice.numbers.update(number.id, { voiceMode: 'ring_dashboard' });
   * ```
   *
   * @throws {ValidationError} If `number` is missing, or `invalid_request` (400) for a wrongly typed field
   * @throws {SendlyError} `invalid_voice_mode` (400) / `agent_required` (400) when `agent` mode has no agent
   * @throws {SendlyError} `number_not_found` (404) / `agent_not_found` (404)
   * @throws {SendlyError} `agent_disabled` (409) when the agent is switched off
   * @throws {SendlyError} `voice_attach_failed` (503) when voice couldn't be switched on; try again
   * @throws {SendlyError} `voice_unavailable` (503) when voice can't be switched on for numbers yet
   */
  async update(
    number: string,
    request: UpdateVoiceNumberRequest,
    options?: IdempotentRequestOptions,
  ): Promise<VoiceNumber> {
    const path = numberPath(number);
    const changes = request ?? {};

    return this.http.request<VoiceNumber>({
      method: "PATCH",
      path,
      idempotencyKey: options?.idempotencyKey,
      body: {
        ...(changes.voiceEnabled !== undefined && {
          voiceEnabled: changes.voiceEnabled,
        }),
        ...(changes.voiceMode !== undefined && { voiceMode: changes.voiceMode }),
        ...(changes.agentId !== undefined && { agentId: changes.agentId }),
      },
    });
  }

  /**
   * Register the street address emergency services are sent to when
   * someone calls them from this number. Requires the `calls:write` scope
   * and a live API key.
   *
   * A US or Canadian number needs one before it can place calls. The first
   * registration adds $1.50 a month to the number; registering again
   * replaces the address without adding the charge a second time.
   *
   * @param number - The number's id or its E.164 phone number
   * @param request - The address (`country` defaults to `US`)
   * @param options - Optional idempotency key
   * @returns The number with its `emergencyAddress`
   *
   * @example
   * ```typescript
   * const number = await sendly.voice.numbers.registerEmergencyAddress('+15555550188', {
   *   street: '500 Example Ave',
   *   unit: 'Suite 2',
   *   city: 'Austin',
   *   state: 'TX',
   *   zip: '78701',
   * });
   * console.log(number.emergencyAddress?.status);
   * ```
   *
   * @throws {ValidationError} If `number`, `street`, `city`, `state` or `zip` is missing or not a string, or `invalid_request` (400) for a `unit` or `country` that isn't a string
   * @throws {SendlyError} `invalid_address` (400) for a malformed field, or (422) when the address couldn't be validated; `error.response.suggested` holds a corrected address when one was found
   * @throws {SendlyError} `e911_not_applicable` (400) for a number outside the US and Canada
   * @throws {SendlyError} `number_not_found` (404)
   * @throws {SendlyError} `carrier_refused` (503) when the registration was refused; try again, unless the message says the number couldn't be found for emergency registration (contact support)
   */
  async registerEmergencyAddress(
    number: string,
    request: RegisterEmergencyAddressRequest,
    options?: IdempotentRequestOptions,
  ): Promise<VoiceNumber> {
    const path = `${numberPath(number)}/emergency-address`;
    if (!request || typeof request !== "object") {
      throw new ValidationError("An emergency address is required");
    }
    requireText(request.street, "An emergency address 'street' is required");
    requireText(request.city, "An emergency address 'city' is required");
    requireText(request.state, "An emergency address 'state' is required");
    requireText(request.zip, "An emergency address 'zip' is required");

    return this.http.request<VoiceNumber>({
      method: "POST",
      path,
      idempotencyKey: options?.idempotencyKey,
      body: {
        street: request.street,
        ...(request.unit !== undefined && { unit: request.unit }),
        city: request.city,
        state: request.state,
        zip: request.zip,
        ...(request.country !== undefined && { country: request.country }),
      },
    });
  }
}

class VoiceAgentsResource {
  private readonly http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  /**
   * List the workspace's AI agents with their call stats. Requires the
   * `calls:read` scope.
   *
   * @returns The agents
   *
   * @example
   * ```typescript
   * const { data } = await sendly.voice.agents.list();
   * for (const agent of data) {
   *   console.log(`${agent.name} (${agent.voiceLabel}) ${agent.callsHandled} calls`);
   * }
   * ```
   */
  async list(): Promise<VoiceAgentListResponse> {
    return this.http.request<VoiceAgentListResponse>({
      method: "GET",
      path: "/voice/agents",
    });
  }

  /**
   * Create an AI agent. Requires the `calls:write` scope and a live API key.
   *
   * The agent answers real callers on any number pointed at it and talks on
   * the calls you place with it. Each agent gets its own scoped sending key
   * so it can text callers; `canSendSms` says whether it has one. A
   * workspace can have up to 20 agents.
   *
   * Pass `kind` and `connection` to answer with your own agent instead:
   * your chat completions endpoint (`custom_llm`), your SIP address (`sip`)
   * or your WebSocket server (`websocket`). The response then carries
   * `signingSecret` once; save it to check that requests come from Sendly.
   *
   * @param request - The agent's name, voice, greeting, instructions, tools, and for your own agent its kind and connection
   * @param options - Optional idempotency key
   * @returns The new agent, with `signingSecret` for your own agent
   *
   * @example
   * ```typescript
   * const agent = await sendly.voice.agents.create({
   *   name: 'Front desk',
   *   voice: 'ashley',
   *   greeting: 'Thanks for calling Acme, how can I help?',
   *   instructions: 'Answer questions about opening hours and take a message for anything else.',
   *   tools: { sendSms: true },
   * });
   * console.log(agent.id, agent.canSendSms);
   *
   * // Answer with your own agent on a SIP address
   * const own = await sendly.voice.agents.create({
   *   name: 'Front desk',
   *   kind: 'sip',
   *   connection: { uri: 'sip:frontdesk@sip.example.com', transport: 'tls' },
   *   tools: { transferTo: '+15125550142' },
   * });
   * console.log(own.signingSecret); // shown once
   * ```
   *
   * @throws {ValidationError} If `name` is missing, or `invalid_request` (400) naming the field the API rejected, including `connection.<field>` when the connection is missing or breaks a rule
   * @throws {SendlyError} `byo_agents_not_enabled` (403) when `kind` is one of your own and the workspace's bring-your-own-agent feature is off
   * @throws {SendlyError} `agent_limit` (409) when the workspace already has 20 agents
   */
  async create(
    request: CreateVoiceAgentRequest,
    options?: IdempotentRequestOptions,
  ): Promise<VoiceAgentWithSecret> {
    if (!request || typeof request !== "object") {
      throw new ValidationError("An agent 'name' is required");
    }
    requireText(request.name, "An agent 'name' is required");

    return this.http.request<VoiceAgentWithSecret>({
      method: "POST",
      path: "/voice/agents",
      idempotencyKey: options?.idempotencyKey,
      body: agentBody(request),
    });
  }

  /**
   * Retrieve an agent. Requires the `calls:read` scope.
   *
   * @param id - Agent identifier
   * @returns The agent
   *
   * @example
   * ```typescript
   * const agent = await sendly.voice.agents.get('3c4d5e6f-7081-4293-a4b5-c6d7e8f90a1b');
   * console.log(agent.enabled, agent.greeting);
   * ```
   *
   * @throws {ValidationError} If `id` is missing
   * @throws {SendlyError} `agent_not_found` (404) when the agent isn't in this workspace
   */
  async get(id: string): Promise<VoiceAgent> {
    return this.http.request<VoiceAgent>({
      method: "GET",
      path: agentPath(id),
    });
  }

  /**
   * Update an agent. Requires the `calls:write` scope and a live API key.
   *
   * Send only the fields that change; `tools` keys you leave out keep their
   * current values, and `connection` is merged into the saved one (a secret
   * left out is kept, `null` removes it). Changes apply to the next call the
   * agent takes.
   *
   * @param id - Agent identifier
   * @param request - Any subset of the create fields, plus `rotateSigningSecret`
   * @param options - Optional idempotency key
   * @returns The agent after the change, with `signingSecret` when one was just made
   *
   * @example
   * ```typescript
   * await sendly.voice.agents.update('3c4d5e6f-7081-4293-a4b5-c6d7e8f90a1b', {
   *   greeting: 'Thanks for calling Acme. How can I help today?',
   *   tools: { sendSms: false },
   * });
   *
   * // Replace your own agent's signing secret
   * const { signingSecret } = await sendly.voice.agents.update(
   *   '3c4d5e6f-7081-4293-a4b5-c6d7e8f90a1b',
   *   { rotateSigningSecret: true },
   * );
   * ```
   *
   * @throws {ValidationError} If `id` is missing, or `invalid_request` (400) naming the field the API rejected, including a `connection` that breaks a rule or is missing when `kind` changes, and `rotateSigningSecret` on a `sendly` agent
   * @throws {SendlyError} `byo_agents_not_enabled` (403) when the change needs the workspace's bring-your-own-agent feature, which is off
   * @throws {SendlyError} `agent_not_found` (404) when the agent isn't in this workspace
   * @throws {SendlyError} `agent_in_use` (409) when `enabled` is `false` while numbers still answer with the agent
   */
  async update(
    id: string,
    request: UpdateVoiceAgentRequest,
    options?: IdempotentRequestOptions,
  ): Promise<VoiceAgentWithSecret> {
    const path = agentPath(id);

    return this.http.request<VoiceAgentWithSecret>({
      method: "PATCH",
      path,
      idempotencyKey: options?.idempotencyKey,
      body: agentBody(request ?? {}),
    });
  }

  /**
   * Delete an agent and revoke its sending key. Requires the `calls:write`
   * scope and a live API key.
   *
   * An agent that still answers a number can't be deleted: point those
   * numbers at another agent or back to the team first with
   * {@link VoiceNumbersResource.update}.
   *
   * @param id - Agent identifier
   * @param options - Optional idempotency key
   * @returns Deletion confirmation
   *
   * @example
   * ```typescript
   * const result = await sendly.voice.agents.delete('3c4d5e6f-7081-4293-a4b5-c6d7e8f90a1b');
   * console.log(result.deleted); // true
   * ```
   *
   * @throws {ValidationError} If `id` is missing
   * @throws {SendlyError} `agent_not_found` (404) when the agent isn't in this workspace
   * @throws {SendlyError} `agent_in_use` (409) while a number answers with the agent; `error.response.numbers` lists them
   */
  async delete(
    id: string,
    options?: IdempotentRequestOptions,
  ): Promise<DeletedVoiceAgent> {
    const path = agentPath(id);

    return this.http.request<DeletedVoiceAgent>({
      method: "DELETE",
      path,
      idempotencyKey: options?.idempotencyKey,
    });
  }
}

class VoiceVoicesResource {
  private readonly http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  /**
   * List the voices an agent can speak with. Requires the `calls:read`
   * scope.
   *
   * @returns The voices
   *
   * @example
   * ```typescript
   * const { data } = await sendly.voice.voices.list();
   * console.log(data.map((v) => `${v.id}: ${v.label}`));
   * ```
   */
  async list(): Promise<VoiceListResponse> {
    return this.http.request<VoiceListResponse>({
      method: "GET",
      path: "/voice/voices",
    });
  }
}

/**
 * Voice resource - configure numbers, AI agents and voices for phone calls.
 *
 * @example
 * ```typescript
 * // Create an agent with one of the available voices
 * const { data: voices } = await sendly.voice.voices.list();
 * const agent = await sendly.voice.agents.create({
 *   name: 'Front desk',
 *   voice: voices[0].id,
 *   greeting: 'Thanks for calling Acme, how can I help?',
 * });
 *
 * // Register the emergency address, then have the agent answer the number
 * await sendly.voice.numbers.registerEmergencyAddress('+15555550188', {
 *   street: '500 Example Ave',
 *   city: 'Austin',
 *   state: 'TX',
 *   zip: '78701',
 * });
 * await sendly.voice.numbers.update('+15555550188', {
 *   voiceEnabled: true,
 *   voiceMode: 'agent',
 *   agentId: agent.id,
 * });
 * ```
 */
export class VoiceResource {
  /**
   * Voice settings and emergency addresses for the workspace's numbers.
   */
  public readonly numbers: VoiceNumbersResource;

  /**
   * The AI agents that answer and place calls.
   */
  public readonly agents: VoiceAgentsResource;

  /**
   * The voices an agent can speak with.
   */
  public readonly voices: VoiceVoicesResource;

  constructor(http: HttpClient) {
    this.numbers = new VoiceNumbersResource(http);
    this.agents = new VoiceAgentsResource(http);
    this.voices = new VoiceVoicesResource(http);
  }
}
