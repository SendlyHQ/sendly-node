/**
 * RCS Resource — Discover agents, pre-flight recipient capability
 *
 * @packageDocumentation
 *
 * RCS is a first-class Sendly channel: rich cards, suggestion chips, and
 * branded, verified-sender messaging on Android, sent via
 * `sendly.messages.send({ channel: 'rcs', ... })`.
 *
 * Sending as your brand requires an RCS agent — the verified sender
 * identity recipients see. Agents are registered per workspace through
 * carrier review (contact support to register one for your brand); once
 * an agent is `sendable`, no other setup is needed.
 *
 * Not every recipient can receive RCS. Text messages fall back to SMS
 * automatically by default (the send response discloses it via
 * `channel: 'sms'` and `fellBackTo: 'sms'`); use
 * {@link RcsResource.capability} to check a recipient ahead of time.
 * RCS requires a live API key — delivery is never sandbox-simulated.
 *
 * @see https://sendly.live/docs/rcs
 */

import type { HttpClient } from "../utils/http";
import { validatePhoneNumber } from "../utils/validation";

/**
 * Lifecycle status of an RCS agent.
 *
 * - `draft` — being set up; not sendable
 * - `submitted` — in carrier review; not sendable
 * - `testing` — approved for invited test devices
 * - `approved` — approved; can reach every RCS-capable recipient
 * - `suspended` — sending is currently suspended for this agent
 */
export type RcsAgentStatus =
  | "draft"
  | "submitted"
  | "testing"
  | "approved"
  | "suspended";

/**
 * An RCS agent — the verified sender identity recipients see.
 */
export interface RcsAgent {
  /** Unique agent identifier — pass as `agentId` on sends */
  id: string;
  /** The agent name recipients see */
  name: string;
  /** Lifecycle status */
  status: RcsAgentStatus;
  /** Declared messaging use case, or null when not set */
  useCase: string | null;
  /**
   * True when the agent can send right now (status `testing` or
   * `approved`, and fully provisioned)
   */
  sendable: boolean;
  /** ISO 8601 timestamp when the agent was registered */
  createdAt: string;
}

/**
 * Response from {@link RcsAgentsResource.list}.
 */
export interface RcsAgentListResponse {
  agents: RcsAgent[];
}

/**
 * Options for {@link RcsResource.capability}.
 */
export interface RcsCapabilityOptions {
  /** The recipient's number, in E.164 format */
  to: string;
  /**
   * The agent to check as. Optional when your workspace has exactly one
   * agent; required when it has several.
   */
  agentId?: string;
}

/**
 * Response from {@link RcsResource.capability}.
 */
export interface RcsCapability {
  /** The recipient that was checked, in E.164 format */
  to: string;
  /** The agent the check ran as */
  agentId: string;
  /** True when the recipient can receive RCS from this agent */
  capable: boolean;
  /** RCS features the recipient supports (empty when not capable) */
  features: string[];
}

class RcsAgentsResource {
  private readonly http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  /**
   * List your RCS agents.
   *
   * Returns the agents registered on your workspace, newest first. An
   * empty list means no agent is registered yet — contact support to
   * register one for your brand.
   *
   * @returns Your agents with status and sendability
   *
   * @example
   * ```typescript
   * const { agents } = await sendly.rcs.agents.list();
   * for (const a of agents) {
   *   console.log(`${a.name} — ${a.status}${a.sendable ? ' (sendable)' : ''}`);
   * }
   * ```
   */
  async list(): Promise<RcsAgentListResponse> {
    return this.http.request<RcsAgentListResponse>({
      method: "GET",
      path: "/rcs/agents",
    });
  }
}

/**
 * RCS resource — discover agents and pre-flight recipient capability.
 *
 * @example
 * ```typescript
 * // 1. Find your sendable agent
 * const { agents } = await sendly.rcs.agents.list();
 * const agent = agents.find((a) => a.sendable);
 *
 * // 2. Optionally pre-flight the recipient
 * const { capable } = await sendly.rcs.capability({ to: '+15551234567' });
 *
 * // 3. Send — text falls back to SMS automatically for non-RCS recipients
 * const message = await sendly.messages.send({
 *   channel: 'rcs',
 *   to: '+15551234567',
 *   text: 'Your table is ready!',
 * });
 * ```
 */
export class RcsResource {
  private readonly http: HttpClient;

  /**
   * List the RCS agents registered on your workspace.
   */
  public readonly agents: RcsAgentsResource;

  constructor(http: HttpClient) {
    this.http = http;
    this.agents = new RcsAgentsResource(http);
  }

  /**
   * Check whether a recipient can receive RCS.
   *
   * Runs a live carrier-backed capability probe, so it requires a live
   * API key. You don't have to call this before sending — text sends
   * probe capability themselves and fall back to SMS — but it's useful
   * to decide between a rich card and plain text up front (cards don't
   * fall back).
   *
   * @param options - The recipient, and optionally the agent to check as
   * @returns Whether the recipient is RCS-capable and which features they support
   *
   * @example
   * ```typescript
   * const { capable, features } = await sendly.rcs.capability({
   *   to: '+15551234567',
   * });
   *
   * if (!capable) {
   *   // Send text (falls back to SMS) instead of a rich card
   * }
   * ```
   *
   * @throws {ValidationError} If the number is not E.164
   * @throws {NotFoundError} If RCS isn't enabled or no agent is set up
   */
  async capability(options: RcsCapabilityOptions): Promise<RcsCapability> {
    validatePhoneNumber(options.to);

    return this.http.request<RcsCapability>({
      method: "GET",
      path: "/rcs/capability",
      query: {
        to: options.to,
        ...(options.agentId && { agentId: options.agentId }),
      },
    });
  }
}
