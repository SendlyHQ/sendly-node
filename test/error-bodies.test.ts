/**
 * How error bodies the API sends become SDK errors
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Sendly } from "../src/client";
import {
  SendlyError,
  ValidationError,
  NotFoundError,
  InsufficientCreditsError,
  RateLimitError,
} from "../src/errors";
import type { SendlyErrorCode } from "../src/types";
import { mockFetchResponse } from "./fixtures/responses";

async function caught(promise: Promise<unknown>): Promise<SendlyError> {
  try {
    await promise;
  } catch (error) {
    return error as SendlyError;
  }
  throw new Error("expected the call to reject");
}

describe("Error bodies", () => {
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

  describe("a sentence in `error` and no `message`", () => {
    it("uses the sentence as the message and a 400 becomes a ValidationError", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse({ error: "amount must be a positive integer" }, 400),
      );

      const error = await caught(
        client.enterprise.workspaces.transferCredits("org_target", {
          sourceWorkspaceId: "org_source",
          amount: 1.5,
        }),
      );

      expect(error).toBeInstanceOf(ValidationError);
      expect(error.message).toBe("amount must be a positive integer");
      expect(error.code).toBe("invalid_request");
      expect(error.statusCode).toBe(400);
    });

    const byStatus: Array<[number, string, SendlyErrorCode]> = [
      [402, "Workspace must have credits before creating live keys", "insufficient_credits"],
      [403, "You must own the source workspace", "forbidden"],
      [404, "Enterprise account not found", "not_found"],
      [409, "A workspace with a similar name already exists", "conflict"],
      [500, "Failed to provision workspace", "internal_error"],
    ];

    for (const [status, sentence, code] of byStatus) {
      it(`derives ${code} from a ${status}`, async () => {
        fetchMock.mockResolvedValue(mockFetchResponse({ error: sentence }, status));

        const error = await caught(
          client.enterprise.workspaces.createKey("org_1", { name: "ci", type: "live" }),
        );

        expect(error).toBeInstanceOf(SendlyError);
        expect(error.message).toBe(sentence);
        expect(error.code).toBe(code);
        expect(error.statusCode).toBe(status);
      });
    }

    it("makes a 404 sentence a NotFoundError and a 402 sentence an InsufficientCreditsError", async () => {
      fetchMock.mockResolvedValueOnce(
        mockFetchResponse({ error: "Enterprise account not found" }, 404),
      );
      expect(await caught(client.enterprise.getAccount())).toBeInstanceOf(
        NotFoundError,
      );

      fetchMock.mockResolvedValueOnce(
        mockFetchResponse(
          { error: "Workspace must have credits before creating live keys" },
          402,
        ),
      );
      expect(
        await caught(client.enterprise.workspaces.createKey("org_1", { name: "ci", type: "live" })),
      ).toBeInstanceOf(InsufficientCreditsError);
    });

    it("keeps extra fields from the body on error.response", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse(
          {
            error: "Missing required verification fields",
            missingFields: ["brn", "address.zip"],
          },
          400,
        ),
      );

      const error = await caught(client.enterprise.provision({ name: "Acme" }));

      expect(error.message).toBe("Missing required verification fields");
      expect(error.response?.missingFields).toEqual(["brn", "address.zip"]);
    });

    it("keeps the sentence the API sent on error.response", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse(
          { error: "Workspace limit reached", currentCount: 10, maxWorkspaces: 10 },
          403,
        ),
      );

      const error = await caught(
        client.enterprise.provision({ name: "Acme", sourceWorkspaceId: "org_src" }),
      );

      expect(error.code).toBe("forbidden");
      expect(error.message).toBe("Workspace limit reached");
      expect(error.response).toEqual({
        error: "Workspace limit reached",
        message: "HTTP 403",
        currentCount: 10,
        maxWorkspaces: 10,
      });
    });
  });

  describe("no `error` field", () => {
    it("derives the code from the status, so a failed webhook test is a ValidationError", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse(
          { success: false, message: "Test webhook failed: Connection refused" },
          400,
        ),
      );

      const error = await caught(client.webhooks.test("whk_1"));

      expect(error).toBeInstanceOf(ValidationError);
      expect(error.code).toBe("invalid_request");
      expect(error.statusCode).toBe(400);
      expect(error.message).toBe("Test webhook failed: Connection refused");
      expect(error.response).toEqual({
        success: false,
        error: "internal_error",
        message: "Test webhook failed: Connection refused",
      });
    });

    it("stays internal_error on a 500", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse({ message: "Something went wrong" }, 500),
      );

      const error = await caught(client.webhooks.test("whk_1"));

      expect(error.code).toBe("internal_error");
      expect(error.statusCode).toBe(500);
      expect(error.message).toBe("Something went wrong");
    });
  });

  describe("snake_case codes", () => {
    it("maps validation_error to a ValidationError and keeps its code", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse(
          { error: "validation_error", message: "Name is required" },
          400,
        ),
      );

      const error = await caught(client.account.renameApiKey("key_1", "   "));

      expect(error).toBeInstanceOf(ValidationError);
      expect(error.code).toBe("validation_error");
      expect(error.message).toBe("Name is required");
    });

    it("leaves a code with no message as before", async () => {
      fetchMock.mockResolvedValue(mockFetchResponse({ error: "not_found" }, 404));

      const error = await caught(client.labels.list());

      expect(error).toBeInstanceOf(NotFoundError);
      expect(error.code).toBe("not_found");
      expect(error.message).toBe("HTTP 404");
    });

    it("leaves an unlisted code on a 404 a plain SendlyError", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse(
          { error: "workspace_required", message: "Use a workspace key" },
          404,
        ),
      );

      const error = await caught(client.labels.list());

      expect(error).not.toBeInstanceOf(NotFoundError);
      expect(error.code).toBe("workspace_required");
    });
  });

  describe("verify.check", () => {
    it("resolves with status verified on a correct code", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse({
          id: "ver_1",
          status: "verified",
          phone: "+15551234567",
          verified_at: "2026-09-25T10:00:00.000Z",
        }),
      );

      const result = await client.verify.check("ver_1", { code: "123456" });

      expect(result.status).toBe("verified");
      expect(result.verifiedAt).toBe("2026-09-25T10:00:00.000Z");
    });

    it("throws a ValidationError with the attempts left on a wrong code", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse(
          {
            error: "invalid_code",
            message: "Invalid verification code",
            remaining_attempts: 2,
          },
          400,
        ),
      );

      const error = await caught(client.verify.check("ver_1", { code: "000000" }));

      expect(error).toBeInstanceOf(ValidationError);
      expect(error.code).toBe("invalid_code");
      expect(error.response?.remaining_attempts).toBe(2);
      const left: number | undefined = error.response?.remaining_attempts;
      expect(left).toBe(2);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("throws expired on a 410 and max_attempts_exceeded on a 429", async () => {
      fetchMock.mockResolvedValueOnce(
        mockFetchResponse(
          { error: "expired", message: "Verification code has expired" },
          410,
        ),
      );
      const expired = await caught(client.verify.check("ver_1", { code: "1" }));
      expect(expired.code).toBe("expired");
      expect(expired.statusCode).toBe(410);

      fetchMock.mockResolvedValueOnce(
        mockFetchResponse(
          {
            error: "max_attempts_exceeded",
            message: "Maximum verification attempts exceeded",
          },
          429,
        ),
      );
      const exhausted = await caught(client.verify.check("ver_1", { code: "1" }));
      expect(exhausted.code).toBe("max_attempts_exceeded");
      expect(exhausted).not.toBeInstanceOf(RateLimitError);
    });

    it("lets callers branch on the codes the API sends", () => {
      const codes: SendlyErrorCode[] = [
        "invalid_code",
        "expired",
        "max_attempts_exceeded",
        "validation_error",
        "conflict",
        "verification_required",
        "credits_required",
        "from_number_not_supported",
        "invalid_number",
      ];
      const error = new SendlyError("x", codes[0], 400);
      const handled =
        error.code === "invalid_code" ||
        error.code === "expired" ||
        error.code === "max_attempts_exceeded";
      expect(handled).toBe(true);
      const unlisted: SendlyErrorCode = "some_future_code";
      expect(unlisted).toBe("some_future_code");
    });
  });
});
