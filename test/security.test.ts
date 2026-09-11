/**
 * Regression tests for SDK-side security guarantees.
 *
 * Each block below encodes a defect that shipped once. They are asserted here
 * so a refactor cannot quietly reintroduce one.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Sendly } from "../src/client";
import { mockFetchResponse } from "./fixtures/responses";

const LIVE_KEY = "sk_live_v1_secret_key_material";

const TEMPLATE_BODY = {
  id: "tpl_1",
  name: "t",
  text: "hi",
  variables: [],
  is_preset: false,
  preset_slug: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

describe("API key transport guard", () => {
  it("refuses plaintext HTTP for a host that merely contains 'localhost'", () => {
    expect(
      () =>
        new Sendly({
          apiKey: LIVE_KEY,
          baseUrl: "http://localhost.attacker.example/api/v1",
        }),
    ).toThrow("HTTPS");
  });

  it("refuses plaintext HTTP for a host with a loopback-looking prefix", () => {
    for (const host of [
      "http://127.0.0.1.attacker.example/api/v1",
      "http://notlocalhost/api/v1",
      "http://localhost-staging.example.com/api/v1",
    ]) {
      expect(() => new Sendly({ apiKey: LIVE_KEY, baseUrl: host })).toThrow(
        "HTTPS",
      );
    }
  });

  it("still allows genuine loopback development hosts over HTTP", () => {
    for (const host of [
      "http://localhost:3000/api/v1",
      "http://api.localhost:3000/api/v1",
      "http://127.0.0.1:3000/api/v1",
      "http://127.10.20.30:3000/api/v1",
      "http://[::1]:3000/api/v1",
    ]) {
      expect(
        () => new Sendly({ apiKey: LIVE_KEY, baseUrl: host }),
      ).not.toThrow();
    }
  });

  it("allows any host over HTTPS", () => {
    expect(
      () =>
        new Sendly({ apiKey: LIVE_KEY, baseUrl: "https://custom.example/api/v1" }),
    ).not.toThrow();
  });
});

describe("API key exposure", () => {
  it("keeps the key out of JSON.stringify, spreads and enumeration", () => {
    const client = new Sendly(LIVE_KEY);

    const serialised = JSON.stringify(client) ?? "";
    expect(serialised).not.toContain("secret_key_material");

    expect(JSON.stringify({ ...client })).not.toContain("secret_key_material");
    expect(Object.keys(client)).not.toContain("config");

    // util.inspect (what console.log prints) walks enumerable own keys only.
    expect(
      JSON.stringify(Object.entries(client)),
    ).not.toContain("secret_key_material");
  });
});

describe("path parameter encoding", () => {
  let client: Sendly;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    client = new Sendly("sk_test_v1_valid_key");
    fetchMock = vi.fn();
    global.fetch = fetchMock;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not let an id traverse out of its collection", async () => {
    fetchMock.mockResolvedValue(mockFetchResponse(TEMPLATE_BODY));

    await client.templates.get("../../admin/users");

    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).not.toContain("/admin/users");
    expect(url).toContain("/templates/");
  });

  it("does not let an id inject query parameters", async () => {
    fetchMock.mockResolvedValue(mockFetchResponse(TEMPLATE_BODY));

    await client.templates.get("abc?admin=true");

    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).not.toContain("admin=true");
    expect(url).toContain("abc%3Fadmin%3Dtrue");
  });

  it("leaves ordinary ids byte-for-byte unchanged", async () => {
    fetchMock.mockResolvedValue(mockFetchResponse(TEMPLATE_BODY));

    await client.templates.get("tpl_01HZX8K4QRSTUV-abc.def");

    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain("/templates/tpl_01HZX8K4QRSTUV-abc.def");
  });

  it("preserves query strings alongside an encoded id", async () => {
    fetchMock.mockResolvedValue(mockFetchResponse({}));

    await client.conversations.get("conv_123", { messageLimit: 10 });

    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain("/conversations/conv_123");
    expect(url).toContain("message_limit=10");
  });
});
