/**
 * Tests for the Templates resource against the bodies the API sends
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Sendly } from "../src/client";
import type { TemplatePreview } from "../src/types";
import { mockFetchResponse } from "./fixtures/responses";

describe("Templates resource", () => {
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

  describe("preview()", () => {
    it("reads the rendered text and counts the API returns", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse({
          template_id: "tpl_preset_otp",
          original_text: "Your {{app_name}} code is {{code}}",
          rendered_text: "Your MyApp code is 123456",
          character_count: 25,
          segment_count: 1,
        }),
      );

      const preview: TemplatePreview = await client.templates.preview(
        "tpl_preset_otp",
        { app_name: "MyApp", code: "123456" },
      );

      expect(preview.id).toBe("tpl_preset_otp");
      expect(preview.originalText).toBe("Your {{app_name}} code is {{code}}");
      expect(preview.previewText).toBe("Your MyApp code is 123456");
      expect(preview.characterCount).toBe(25);
      expect(preview.segmentCount).toBe(1);
      expect(preview.variables).toEqual([]);
      expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
        variables: { app_name: "MyApp", code: "123456" },
      });
    });
  });
});
