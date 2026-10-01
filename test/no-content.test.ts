/**
 * DELETE routes that answer 204 No Content (no body, no Content-Type)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Sendly } from "../src/client";
import { SendlyError } from "../src/errors";

function noContent(status = 204): Response {
  return {
    ok: true,
    status,
    statusText: "No Content",
    headers: new Headers(),
    text: async () => "",
  } as unknown as Response;
}

describe("204 No Content responses", () => {
  let client: Sendly;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    client = new Sendly("sk_test_v1_valid_key");
    fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const deletes: Array<[string, string, (c: Sendly) => Promise<void>]> = [
    ["webhooks.delete", "/v1/webhooks/whk_1", (c) => c.webhooks.delete("whk_1")],
    ["labels.delete", "/v1/labels/lbl_1", (c) => c.labels.delete("lbl_1")],
    [
      "conversations.removeLabel",
      "/v1/conversations/conv_1/labels/lbl_1",
      (c) => c.conversations.removeLabel("conv_1", "lbl_1"),
    ],
    ["contacts.delete", "/v1/contacts/cnt_1", (c) => c.contacts.delete("cnt_1")],
    [
      "contacts.lists.delete",
      "/v1/contact-lists/lst_1",
      (c) => c.contacts.lists.delete("lst_1"),
    ],
    ["templates.delete", "/v1/templates/tpl_1", (c) => c.templates.delete("tpl_1")],
    ["campaigns.delete", "/v1/campaigns/camp_1", (c) => c.campaigns.delete("camp_1")],
  ];

  for (const [name, path, call] of deletes) {
    it(`${name} resolves on a 204 with no body`, async () => {
      fetchMock.mockResolvedValue(noContent());

      await expect(call(client)).resolves.toBeUndefined();

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toContain(path);
      expect(init.method).toBe("DELETE");
    });
  }

  it("resolves a 205 Reset Content the same way", async () => {
    fetchMock.mockResolvedValue(noContent(205));

    await expect(client.labels.delete("lbl_1")).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("still rejects a 200 that is not JSON, without retrying", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "Content-Type": "text/html" }),
      text: async () => "<html>captive portal</html>",
    } as unknown as Response);

    const error = await client.labels.delete("lbl_1").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(SendlyError);
    expect((error as SendlyError).code).toBe("invalid_response");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
