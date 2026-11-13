/**
 * Tests for the Conversations resource against the bodies the API sends
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Sendly } from "../src/client";
import type { SuggestRepliesResponse } from "../src/types";
import { mockFetchResponse } from "./fixtures/responses";

describe("Conversations resource", () => {
  let client: Sendly;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    client = new Sendly({ apiKey: "sk_test_v1_valid_key", maxRetries: 0 });
    fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("suggestReplies()", () => {
    it("posts to the suggest-replies endpoint and reads the suggestions", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse({
          suggestions: [
            { text: "Yes, we open at 9am.", tone: "professional" },
            { text: "See you at 9!", tone: "friendly" },
          ],
          basedOnMessageId: "msg_in_1",
          model: "gpt-4o-mini",
        }),
      );

      const result: SuggestRepliesResponse =
        await client.conversations.suggestReplies("conv/1");

      const [url, init] = fetchMock.mock.calls[0];
      expect(init.method).toBe("POST");
      expect(String(url)).toMatch(/\/api\/v1\/conversations\/conv%2F1\/suggest-replies$/);
      expect(result.suggestions.map((s) => s.tone)).toEqual(["professional", "friendly"]);
      expect(result.basedOnMessageId).toBe("msg_in_1");
      expect(result.model).toBe("gpt-4o-mini");
      expect(result.disabled).toBeUndefined();
    });

    it("reads disabled and reason when the enterprise turned suggestions off", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse({
          suggestions: [],
          disabled: true,
          reason: "enterprise_policy",
        }),
      );

      const result = await client.conversations.suggestReplies("conv_1");

      expect(result.suggestions).toEqual([]);
      expect(result.disabled).toBe(true);
      expect(result.reason).toBe("enterprise_policy");
    });
  });
});
