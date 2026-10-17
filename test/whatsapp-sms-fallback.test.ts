import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { Sendly } from "../src/client";
import { mockFetchResponse } from "./fixtures/responses";
import type { WhatsAppMessage, WhatsAppSmsFallback } from "../src";

const FROM = "+18885550190";
const TO = "+15555550142";

function bodyOf(fetchMock: ReturnType<typeof vi.fn>) {
  return JSON.parse(fetchMock.mock.calls[0][1].body);
}

describe("WhatsApp sends with fallbackToSms", () => {
  let client: Sendly;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    client = new Sendly({ apiKey: "sk_live_v1_test", maxRetries: 0 });
    fetchMock = vi.fn();
    global.fetch = fetchMock;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends fallbackToSms when it's set, and leaves it out otherwise", async () => {
    const sent = {
      id: "msg_wa",
      channel: "whatsapp",
      message_format: "whatsapp",
      to: TO,
      from: FROM,
      text: "Your table is ready.",
      status: "failed",
      segments: 1,
      creditsUsed: 0,
      whatsapp: { kind: "text", messageId: null },
      createdAt: "2026-10-17T10:00:00.000Z",
      fallback: { channel: "sms", status: "sent", reason: "window_closed", messageId: "msg_sms", creditsUsed: 2 },
    };
    fetchMock.mockResolvedValueOnce(mockFetchResponse(sent, 201));
    const message = (await client.messages.send({
      channel: "whatsapp",
      from: FROM,
      to: TO,
      text: "Your table is ready.",
      fallbackToSms: true,
    })) as WhatsAppMessage;
    expect(bodyOf(fetchMock)).toEqual({
      channel: "whatsapp",
      to: TO,
      from: FROM,
      text: "Your table is ready.",
      fallbackToSms: true,
    });
    const fallback: WhatsAppSmsFallback | undefined = message.fallback;
    expect(fallback?.status).toBe("sent");
    expect(fallback?.messageId).toBe("msg_sms");

    fetchMock.mockResolvedValueOnce(mockFetchResponse({ ...sent, status: "sent", fallback: undefined }, 201));
    await client.messages.send({ channel: "whatsapp", from: FROM, to: TO, text: "Hi" });
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).not.toHaveProperty("fallbackToSms");
  });

  it("passes fallbackToSms: false through as sent", async () => {
    fetchMock.mockResolvedValueOnce(mockFetchResponse({ id: "m", channel: "whatsapp" }, 201));
    await client.messages.send({ channel: "whatsapp", from: FROM, to: TO, text: "Hi", fallbackToSms: false });
    expect(bodyOf(fetchMock).fallbackToSms).toBe(false);
  });
});

describe("WhatsApp responses the types must allow", () => {
  let client: Sendly;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    client = new Sendly({ apiKey: "sk_live_v1_test", maxRetries: 0 });
    fetchMock = vi.fn();
    global.fetch = fetchMock;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns a send WhatsApp accepted but couldn't fully record, without sending again", async () => {
    fetchMock.mockResolvedValueOnce(
      mockFetchResponse(
        {
          id: "msg_wa_rec",
          channel: "whatsapp",
          message_format: "whatsapp",
          messageFormat: "whatsapp",
          to: TO,
          from: FROM,
          status: "sent",
          direction: "outbound",
          segments: 1,
          metadata: {},
        },
        201,
      ),
    );
    const message = (await client.messages.send({
      channel: "whatsapp",
      from: FROM,
      to: TO,
      text: "Hi",
    })) as WhatsAppMessage;
    expect(message.id).toBe("msg_wa_rec");
    expect(message.whatsapp?.kind).toBeUndefined();
    expect(message.createdAt).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("types the fallback and fallbackOf of a message read back", async () => {
    fetchMock.mockResolvedValueOnce(
      mockFetchResponse({
        id: "msg_sms",
        to: TO,
        from: FROM,
        text: "Your table is ready.",
        status: "delivered",
        direction: "outbound",
        segments: 1,
        creditsUsed: 2,
        isSandbox: false,
        createdAt: "2026-10-17T10:00:00.000Z",
        messageFormat: "sms",
        fallbackOf: "msg_wa",
      }),
    );
    const message = await client.messages.get("msg_sms");
    const fallback: WhatsAppSmsFallback | undefined = message.fallback;
    expect(message.fallbackOf).toBe("msg_wa");
    expect(fallback).toBeUndefined();
  });
});
