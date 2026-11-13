import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Sendly } from "../src/client";
import { mockFetchResponse } from "./fixtures/responses";

describe("conversations.list()", () => {
  let client: Sendly;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    client = new Sendly({ apiKey: "sk_live_v1_valid_key", maxRetries: 0 });
    fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const page = {
    data: [],
    pagination: { total: 0, limit: 20, offset: 0, hasMore: false },
  };

  it("sends the label filter with the others", async () => {
    fetchMock.mockResolvedValue(mockFetchResponse(page));

    await client.conversations.list({ limit: 20, status: "active", label: "lbl_vip" });

    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.pathname).toMatch(/\/v1\/conversations$/);
    expect(url.searchParams.get("label")).toBe("lbl_vip");
    expect(url.searchParams.get("status")).toBe("active");
    expect(url.searchParams.get("limit")).toBe("20");
  });

  it("leaves label out when it is not given", async () => {
    fetchMock.mockResolvedValue(mockFetchResponse(page));

    await client.conversations.list();

    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.searchParams.has("label")).toBe(false);
  });
});
