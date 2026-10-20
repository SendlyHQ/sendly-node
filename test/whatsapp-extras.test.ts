/**
 * Tests for the WhatsApp extras: profile photo, conversational components,
 * calling, adding a number by code, the call channel and unconfirmed sends.
 * Fixtures mirror what the API handlers return.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { Sendly } from "../src/client";
import {
  NetworkError,
  SendlyError,
  TimeoutError,
  ValidationError,
} from "../src/errors";
import { mockFetchResponse } from "./fixtures/responses";
import type {
  AddWhatsAppNumberRequest,
  WhatsAppCallingSettings,
  WhatsAppConversationalComponents,
  WhatsAppSender,
  WhatsAppSenderProfile,
  WhatsAppSignup,
  WhatsAppSignupStatus,
  WhatsAppVerificationMethod,
} from "../src/resources/whatsapp";
import type { Call, CallChannel } from "../src/resources/calls";
import type { SendlyErrorCode } from "../src/types";
import type * as Exported from "../src";

const PHONE = "+14155550123";
const ENCODED = "%2B14155550123";

function bodyOf(fetchMock: ReturnType<typeof vi.fn>, index = 0) {
  return JSON.parse(fetchMock.mock.calls[index][1].body);
}

describe("WhatsApp extras", () => {
  let client: Sendly;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    client = new Sendly("sk_live_v1_valid_key");
    fetchMock = vi.fn();
    global.fetch = fetchMock;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const profile: WhatsAppSenderProfile = {
    phoneNumber: PHONE,
    displayName: "Acme Coffee",
    profilePhotoUrl: "https://media.example.com/acme.png",
    category: "Restaurant",
    about: "Fresh roasts daily",
    description: null,
    email: null,
    website: "https://acme.example.com",
    address: null,
  };

  describe("senders.uploadProfilePhoto()", () => {
    it("posts the image as the multipart field 'file' and returns the profile", async () => {
      fetchMock.mockResolvedValue(mockFetchResponse(profile));
      const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2]);

      const result = await client.whatsapp.senders.uploadProfilePhoto(PHONE, png, {
        contentType: "image/png",
        filename: "logo.png",
      });

      expect(result).toEqual(profile);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toContain(`/v1/whatsapp/senders/${ENCODED}/profile/photo`);
      expect(init.method).toBe("POST");
      expect(init.body).toBeInstanceOf(FormData);
      expect(init.headers["Content-Type"]).toBeUndefined();
      const file = (init.body as FormData).get("file") as File;
      expect(file.type).toBe("image/png");
      expect(file.name).toBe("logo.png");
      expect(Buffer.from(await file.arrayBuffer())).toEqual(png);
    });

    it("defaults to a JPEG label and accepts a Blob", async () => {
      fetchMock.mockResolvedValue(mockFetchResponse(profile));

      await client.whatsapp.senders.uploadProfilePhoto(
        PHONE,
        new Blob([Buffer.from([0xff, 0xd8, 0xff, 0xe0])]),
      );

      const file = (fetchMock.mock.calls[0][1].body as FormData).get("file") as File;
      expect(file.type).toBe("image/jpeg");
      expect(file.name).toBe("profile.jpg");
    });

    it("rejects an invalid phone number locally", async () => {
      await expect(
        client.whatsapp.senders.uploadProfilePhoto("not-a-number", Buffer.from([1])),
      ).rejects.toThrow(ValidationError);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("surfaces whatsapp_profile_photo_too_large (413) without retrying", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse(
          {
            error: "whatsapp_profile_photo_too_large",
            message: "The photo must be 5 MB or smaller.",
          },
          413,
        ),
      );

      const error = await client.whatsapp.senders
        .uploadProfilePhoto(PHONE, Buffer.from([0xff, 0xd8, 0xff]))
        .catch((e: any) => e);

      expect(error).toBeInstanceOf(SendlyError);
      expect(error.code).toBe("whatsapp_profile_photo_too_large");
      expect(error.statusCode).toBe(413);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("surfaces whatsapp_profile_photo_invalid (400)", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse(
          {
            error: "whatsapp_profile_photo_invalid",
            message: "The photo must be a JPEG or PNG image.",
          },
          400,
        ),
      );

      const error = await client.whatsapp.senders
        .uploadProfilePhoto(PHONE, Buffer.from("GIF89a"))
        .catch((e: any) => e);

      expect(error.code).toBe("whatsapp_profile_photo_invalid");
    });
  });

  describe("senders.deleteProfilePhoto()", () => {
    it("sends DELETE and returns the profile without a photo", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse({ ...profile, profilePhotoUrl: null }),
      );

      const result = await client.whatsapp.senders.deleteProfilePhoto(PHONE);

      expect(result.profilePhotoUrl).toBeNull();
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining(`/v1/whatsapp/senders/${ENCODED}/profile/photo`),
        expect.objectContaining({ method: "DELETE" }),
      );
    });

    it("rejects an invalid phone number locally", async () => {
      await expect(
        client.whatsapp.senders.deleteProfilePhoto("12"),
      ).rejects.toThrow(ValidationError);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  const components: WhatsAppConversationalComponents = {
    phoneNumber: PHONE,
    iceBreakers: ["What are your hours?", "Book a table"],
    commands: [{ command: "menu", description: "See today's menu" }],
  };

  describe("senders.getConversationalComponents()", () => {
    it("gets the ice breakers and commands", async () => {
      fetchMock.mockResolvedValue(mockFetchResponse(components));

      const result = await client.whatsapp.senders.getConversationalComponents(PHONE);

      expect(result).toEqual(components);
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining(
          `/v1/whatsapp/senders/${ENCODED}/conversational_components`,
        ),
        expect.objectContaining({ method: "GET" }),
      );
    });
  });

  describe("senders.updateConversationalComponents()", () => {
    it("PATCHes only the lists given", async () => {
      fetchMock.mockResolvedValue(mockFetchResponse({ ...components, commands: [] }));

      const result = await client.whatsapp.senders.updateConversationalComponents(
        PHONE,
        { commands: [] },
      );

      expect(result.commands).toEqual([]);
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining(
          `/v1/whatsapp/senders/${ENCODED}/conversational_components`,
        ),
        expect.objectContaining({ method: "PATCH" }),
      );
      expect(bodyOf(fetchMock)).toEqual({ commands: [] });
    });

    it("sends both lists when both are given", async () => {
      fetchMock.mockResolvedValue(mockFetchResponse(components));

      await client.whatsapp.senders.updateConversationalComponents(PHONE, {
        iceBreakers: components.iceBreakers,
        commands: components.commands,
      });

      expect(bodyOf(fetchMock)).toEqual({
        iceBreakers: components.iceBreakers,
        commands: components.commands,
      });
    });

    it("surfaces the API's invalid_request as a ValidationError", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse(
          {
            error: "invalid_request",
            message: "At most 4 ice breakers are allowed.",
          },
          400,
        ),
      );

      await expect(
        client.whatsapp.senders.updateConversationalComponents(PHONE, {
          iceBreakers: ["a", "b", "c", "d", "e"],
        }),
      ).rejects.toThrow(ValidationError);
    });
  });

  describe("senders.setCalling()", () => {
    it("PATCHes enabled and returns the calling settings", async () => {
      const settings: WhatsAppCallingSettings = {
        phoneNumber: PHONE,
        callingEnabled: true,
        outboundCallingAllowed: false,
      };
      fetchMock.mockResolvedValue(mockFetchResponse(settings));

      const result = await client.whatsapp.senders.setCalling(PHONE, {
        enabled: true,
      });

      expect(result).toEqual(settings);
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining(`/v1/whatsapp/senders/${ENCODED}/calling`),
        expect.objectContaining({ method: "PATCH" }),
      );
      expect(bodyOf(fetchMock)).toEqual({ enabled: true });
    });

    it("sends enabled false to switch calling off", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse({
          phoneNumber: PHONE,
          callingEnabled: false,
          outboundCallingAllowed: false,
        }),
      );

      await client.whatsapp.senders.setCalling(PHONE, { enabled: false });

      expect(bodyOf(fetchMock)).toEqual({ enabled: false });
    });

    it("surfaces voice_not_enabled (409)", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse(
          {
            error: "voice_not_enabled",
            message:
              "Turn on calls for this number first, in its voice settings, so WhatsApp calls have somewhere to ring.",
          },
          409,
        ),
      );

      const error = await client.whatsapp.senders
        .setCalling(PHONE, { enabled: true })
        .catch((e: any) => e);

      expect(error.code).toBe("voice_not_enabled");
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("senders.list() new fields", () => {
    it("carries the business account, name and calling flags", async () => {
      const sender: WhatsAppSender = {
        phoneNumber: PHONE,
        displayName: "Acme Coffee",
        status: "active",
        qualityRating: "GREEN",
        businessAccountId: "102938475610293",
        businessName: "Acme Coffee LLC",
        callingEnabled: true,
        outboundCallingAllowed: false,
        createdAt: "2026-09-30T09:12:00.000Z",
      };
      fetchMock.mockResolvedValue(mockFetchResponse({ senders: [sender] }));

      const { senders } = await client.whatsapp.senders.list();

      expect(senders[0].businessAccountId).toBe("102938475610293");
      expect(senders[0].businessName).toBe("Acme Coffee LLC");
      expect(senders[0].callingEnabled).toBe(true);
      expect(senders[0].outboundCallingAllowed).toBe(false);
    });
  });

  const verifying: WhatsAppSignup = {
    id: "5b0d8f3e-2c4a-4e1b-9a7d-6c5b4a3f2e1d",
    status: "verifying",
    phoneNumber: PHONE,
    businessAccountId: "102938475610293",
    failureReasons: null,
    verificationMethod: "sms",
    verificationAttemptsRemaining: 5,
    updatedAt: "2026-09-30T10:00:00.000Z",
  };

  describe("signup.create() with businessAccountId", () => {
    it("adds a number to a connected account and returns the verifying signup", async () => {
      fetchMock.mockResolvedValue(mockFetchResponse(verifying, 201));
      const request: AddWhatsAppNumberRequest = {
        phoneNumber: PHONE,
        businessAccountId: "102938475610293",
        verificationMethod: "voice",
        displayName: "Acme Coffee",
      };

      const signup = await client.whatsapp.signup.create(request);

      expect(signup.status).toBe("verifying");
      expect(signup.verificationAttemptsRemaining).toBe(5);
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/v1/whatsapp/signup"),
        expect.objectContaining({ method: "POST" }),
      );
      expect(bodyOf(fetchMock)).toEqual({
        phoneNumber: PHONE,
        businessAccountId: "102938475610293",
        verificationMethod: "voice",
        displayName: "Acme Coffee",
      });
    });

    it("omits the optional fields when they are not given", async () => {
      fetchMock.mockResolvedValue(mockFetchResponse(verifying, 201));

      await client.whatsapp.signup.create({
        phoneNumber: PHONE,
        businessAccountId: "102938475610293",
      });

      expect(bodyOf(fetchMock)).toEqual({
        phoneNumber: PHONE,
        businessAccountId: "102938475610293",
      });
    });

    it("keeps the Facebook signup body unchanged without businessAccountId", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse(
          {
            id: "was_1",
            connectUrl: "https://sendly.live/whatsapp/connect?token=abc",
            status: "initiated",
          },
          201,
        ),
      );

      const session = await client.whatsapp.signup.create({ phoneNumber: PHONE });

      expect(session.connectUrl).toContain("/whatsapp/connect");
      expect(bodyOf(fetchMock)).toEqual({ phoneNumber: PHONE });
    });

    it("refuses an empty businessAccountId before anything is sent", async () => {
      await expect(
        client.whatsapp.signup.create({ phoneNumber: PHONE, businessAccountId: "" }),
      ).rejects.toThrow(ValidationError);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("refuses verificationMethod or displayName without businessAccountId", async () => {
      await expect(
        client.whatsapp.signup.create({
          phoneNumber: PHONE,
          verificationMethod: "voice",
        } as unknown as AddWhatsAppNumberRequest),
      ).rejects.toThrow(ValidationError);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("surfaces whatsapp_business_account_not_found (404)", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse(
          {
            error: "whatsapp_business_account_not_found",
            message:
              "There's no connected WhatsApp Business account with this id in your workspace. Connect a number with the Facebook step first.",
          },
          404,
        ),
      );

      const error = await client.whatsapp.signup
        .create({ phoneNumber: PHONE, businessAccountId: "999" })
        .catch((e: any) => e);

      expect(error.code).toBe("whatsapp_business_account_not_found");
      expect(error.statusCode).toBe(404);
    });
  });

  describe("calls that must not repeat", () => {
    const retrying = () =>
      new Sendly({ apiKey: "sk_live_v1_valid_key", maxRetries: 2 });
    const activeSignup = {
      id: verifying.id,
      status: "active",
      phoneNumber: PHONE,
      businessAccountId: "104996582519384",
      failureReasons: null,
      updatedAt: "2026-10-01T14:04:12.880Z",
    };

    it("signup.create() with businessAccountId throws a 502 whatsapp_verification_start_failed after one request", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse(
          {
            error: "whatsapp_verification_start_failed",
            message:
              "WhatsApp couldn't start verifying this number. Any setup fee is refunded automatically. Please try again shortly.",
          },
          502,
        ),
      );

      const error = await retrying()
        .whatsapp.signup.create({
          phoneNumber: PHONE,
          businessAccountId: "104996582519384",
        })
        .catch((e: any) => e);

      expect(error).toBeInstanceOf(SendlyError);
      expect(error.code).toBe("whatsapp_verification_start_failed");
      expect(error.statusCode).toBe(502);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("signup.create() with businessAccountId throws a 500 after one request", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse(
          {
            error: "internal_error",
            message:
              "Something went wrong asking WhatsApp for the code. Any setup fee is refunded automatically. Please try again.",
          },
          500,
        ),
      );

      const error = await retrying()
        .whatsapp.signup.create({
          phoneNumber: PHONE,
          businessAccountId: "104996582519384",
        })
        .catch((e: any) => e);

      expect(error.statusCode).toBe(500);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("signup.verify() throws a 502 whatsapp_activation_pending after one request", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse(
          {
            error: "whatsapp_activation_pending",
            message:
              "WhatsApp accepted the code, but we couldn't finish connecting the number. Our team has been alerted; check back shortly.",
          },
          502,
        ),
      );

      const error = await retrying()
        .whatsapp.signup.verify(verifying.id, "482913")
        .catch((e: any) => e);

      expect(error.code).toBe("whatsapp_activation_pending");
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("signup.verify() throws a 502 whatsapp_verification_unavailable after one request", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse(
          {
            error: "whatsapp_verification_unavailable",
            message: "WhatsApp couldn't check the code right now. Please try again shortly.",
          },
          502,
        ),
      );

      const error = await retrying()
        .whatsapp.signup.verify(verifying.id, "482913")
        .catch((e: any) => e);

      expect(error.code).toBe("whatsapp_verification_unavailable");
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("senders.uploadProfilePhoto() throws a 502 whatsapp_profile_update_failed after one request", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse(
          {
            error: "whatsapp_profile_update_failed",
            message:
              "The photo couldn't be uploaded. WhatsApp needs a square JPEG or PNG at least 192 pixels wide. Please try again shortly.",
          },
          502,
        ),
      );

      const error = await retrying()
        .whatsapp.senders.uploadProfilePhoto(PHONE, Buffer.from([0xff, 0xd8, 0xff, 0xe0]))
        .catch((e: any) => e);

      expect(error.code).toBe("whatsapp_profile_update_failed");
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    const networkDown = () => {
      fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    };

    it("signup.create() with businessAccountId throws a network error after one request", async () => {
      networkDown();

      const error = await retrying()
        .whatsapp.signup.create({
          phoneNumber: PHONE,
          businessAccountId: "104996582519384",
        })
        .catch((e: any) => e);

      expect(error).toBeInstanceOf(NetworkError);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("signup.verify() throws a network error after one request", async () => {
      networkDown();

      const error = await retrying()
        .whatsapp.signup.verify(verifying.id, "482913")
        .catch((e: any) => e);

      expect(error).toBeInstanceOf(NetworkError);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("signup.verify() throws a timeout after one request", async () => {
      const abort = new Error("The operation was aborted");
      abort.name = "AbortError";
      fetchMock.mockRejectedValue(abort);

      const error = await retrying()
        .whatsapp.signup.verify(verifying.id, "482913")
        .catch((e: any) => e);

      expect(error).toBeInstanceOf(TimeoutError);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("senders.uploadProfilePhoto() throws a network error after one request", async () => {
      networkDown();

      const error = await retrying()
        .whatsapp.senders.uploadProfilePhoto(PHONE, Buffer.from([0xff, 0xd8, 0xff, 0xe0]))
        .catch((e: any) => e);

      expect(error).toBeInstanceOf(NetworkError);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("signup.verify() still waits out a 429 the API never ran", async () => {
      fetchMock
        .mockResolvedValueOnce(
          mockFetchResponse(
            {
              error: "too_many_concurrent_verifications",
              message: "Too many API key checks are running at once. Try again in a moment.",
              retryAfter: 1,
            },
            429,
            { "Retry-After": "1" },
          ),
        )
        .mockResolvedValueOnce(mockFetchResponse(activeSignup));

      const signup = await retrying().whatsapp.signup.verify(verifying.id, "482913");

      expect(signup.status).toBe("active");
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("signup.resend() keeps the normal retry on a network error", async () => {
      fetchMock
        .mockRejectedValueOnce(new TypeError("fetch failed"))
        .mockResolvedValueOnce(mockFetchResponse(verifying));

      const signup = await retrying().whatsapp.signup.resend(verifying.id);

      expect(signup.status).toBe("verifying");
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("signup.resend() keeps the normal retry on a 502", async () => {
      fetchMock
        .mockResolvedValueOnce(
          mockFetchResponse(
            {
              error: "whatsapp_verification_resend_failed",
              message: "WhatsApp couldn't send another code right now. Please try again shortly.",
            },
            502,
          ),
        )
        .mockResolvedValueOnce(mockFetchResponse(verifying));

      const signup = await retrying().whatsapp.signup.resend(verifying.id);

      expect(signup.status).toBe("verifying");
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("signup.create() without businessAccountId keeps the normal retry on a 503", async () => {
      fetchMock
        .mockResolvedValueOnce(
          mockFetchResponse(
            {
              error: "whatsapp_unavailable",
              message:
                "WhatsApp connections are temporarily unavailable. You haven't been charged. Please try again later.",
              retryAfter: 3600,
            },
            503,
          ),
        )
        .mockResolvedValueOnce(
          mockFetchResponse(
            {
              id: "was_1",
              connectUrl: "https://sendly.live/whatsapp/connect?token=abc",
              status: "initiated",
            },
            201,
          ),
        );

      const session = await retrying().whatsapp.signup.create({ phoneNumber: PHONE });

      expect(session.status).toBe("initiated");
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("signup.verify() still returns the signup when the first request succeeds", async () => {
      fetchMock.mockResolvedValue(mockFetchResponse(activeSignup));

      const signup = await retrying().whatsapp.signup.verify(verifying.id, "482913");

      expect(signup.status).toBe("active");
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("signup.create() without businessAccountId while verifying", () => {
    it("surfaces whatsapp_verification_in_progress (409) with the signup id", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse(
          {
            error: "whatsapp_verification_in_progress",
            message:
              "This number is already being added to a connected WhatsApp Business account. Enter its verification code, or wait for that attempt to expire.",
            id: verifying.id,
          },
          409,
        ),
      );

      const error = await client.whatsapp.signup
        .create({ phoneNumber: PHONE })
        .catch((e: any) => e);

      expect(error).toBeInstanceOf(SendlyError);
      expect(error.code).toBe("whatsapp_verification_in_progress");
      expect(error.response.id).toBe(verifying.id);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("signup.verify()", () => {
    it("posts the code and returns the active signup", async () => {
      const active: WhatsAppSignup = {
        id: verifying.id,
        status: "active",
        phoneNumber: PHONE,
        businessAccountId: "102938475610293",
        failureReasons: null,
        updatedAt: "2026-09-30T10:02:00.000Z",
      };
      fetchMock.mockResolvedValue(mockFetchResponse(active));

      const result = await client.whatsapp.signup.verify(verifying.id, "123-456");

      expect(result.status).toBe("active");
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining(`/v1/whatsapp/signup/${verifying.id}/verify`),
        expect.objectContaining({ method: "POST" }),
      );
      expect(bodyOf(fetchMock)).toEqual({ code: "123-456" });
    });

    it("surfaces a wrong code with attemptsRemaining and does not retry it", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse(
          {
            error: "whatsapp_verification_code_invalid",
            message: "That code wasn't accepted. Check it, or request a new one.",
            attemptsRemaining: 3,
          },
          422,
        ),
      );

      const error = await client.whatsapp.signup
        .verify(verifying.id, "000000")
        .catch((e: any) => e);

      expect(error).toBeInstanceOf(SendlyError);
      expect(error.code).toBe("whatsapp_verification_code_invalid");
      expect(error.response.attemptsRemaining).toBe(3);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("requires an id", async () => {
      await expect(client.whatsapp.signup.verify("", "123456")).rejects.toThrow();
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("signup.resend()", () => {
    it("posts the method and returns the signup", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse({ ...verifying, verificationMethod: "voice" }),
      );

      const result = await client.whatsapp.signup.resend(verifying.id, "voice");

      expect(result.verificationMethod).toBe("voice");
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining(`/v1/whatsapp/signup/${verifying.id}/resend`),
        expect.objectContaining({ method: "POST" }),
      );
      expect(bodyOf(fetchMock)).toEqual({ verificationMethod: "voice" });
    });

    it("sends an empty body without a method", async () => {
      fetchMock.mockResolvedValue(mockFetchResponse(verifying));

      await client.whatsapp.signup.resend(verifying.id);

      expect(bodyOf(fetchMock)).toEqual({});
    });

    it("surfaces resend_too_soon (429) with retryAfter and does not retry it", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse(
          {
            error: "whatsapp_verification_resend_too_soon",
            message: "Wait 12 seconds before requesting another code.",
            retryAfter: 12,
          },
          429,
          { "Retry-After": "12" },
        ),
      );

      const error = await client.whatsapp.signup
        .resend(verifying.id)
        .catch((e: any) => e);

      expect(error.code).toBe("whatsapp_verification_resend_too_soon");
      expect(error.response.retryAfter).toBe(12);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("signup.get() while verifying", () => {
    it("returns the code read from the number's texts", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse({ ...verifying, verificationCode: "123456" }),
      );

      const signup = await client.whatsapp.signup.get(verifying.id);

      expect(signup.verificationCode).toBe("123456");
      expect(signup.verificationMethod).toBe("sms");
    });
  });

  describe("messages.send() on WhatsApp", () => {
    it("throws whatsapp_send_unconfirmed (409) once, without retrying", async () => {
      fetchMock.mockResolvedValue(
        mockFetchResponse(
          {
            error: "whatsapp_send_unconfirmed",
            errorCode: "E024",
            message:
              "We couldn't confirm whether WhatsApp accepted this message. It has been marked failed and refunded, but it may still be delivered. Check before sending it again, or it could arrive twice.",
          },
          409,
        ),
      );

      const error = await client.messages
        .send({ channel: "whatsapp", to: "+14155550199", from: PHONE, text: "Hi" })
        .catch((e: any) => e);

      expect(error).toBeInstanceOf(SendlyError);
      expect(error.code).toBe("whatsapp_send_unconfirmed");
      expect(error.statusCode).toBe(409);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("types", () => {
    it("lists the new codes, statuses, methods and channels", () => {
      const codes: SendlyErrorCode[] = [
        "whatsapp_send_unconfirmed",
        "file_required",
        "whatsapp_profile_photo_invalid",
        "whatsapp_profile_photo_too_large",
        "whatsapp_profile_update_failed",
        "whatsapp_conversational_components_fetch_failed",
        "whatsapp_conversational_components_update_failed",
        "display_name_required",
        "whatsapp_business_account_not_found",
        "whatsapp_signup_in_progress",
        "whatsapp_already_enabled",
        "whatsapp_verification_start_failed",
        "whatsapp_verification_in_progress",
        "invalid_verification_code",
        "whatsapp_verification_code_invalid",
        "whatsapp_verification_failed",
        "whatsapp_verification_busy",
        "whatsapp_verification_unavailable",
        "whatsapp_activation_pending",
        "signup_not_active",
        "signup_not_found",
        "whatsapp_verification_resend_too_soon",
        "whatsapp_verification_resend_failed",
        "whatsapp_calling_unavailable",
        "whatsapp_calling_update_failed",
      ];
      const status: WhatsAppSignupStatus = "verifying";
      const method: WhatsAppVerificationMethod = "voice";
      const channels: CallChannel[] = ["phone", "whatsapp", "browser", "satellite"];
      expect(codes).toHaveLength(25);
      expect(status).toBe("verifying");
      expect(method).toBe("voice");
      expect(channels).toHaveLength(4);
    });

    it("exports the new types from the package entry point", () => {
      const request: Exported.AddWhatsAppNumberRequest = {
        phoneNumber: PHONE,
        businessAccountId: "104996582519384",
        verificationMethod: "voice" as Exported.WhatsAppVerificationMethod,
      };
      const photo: Exported.WhatsAppProfilePhotoOptions = { contentType: "image/png" };
      const command: Exported.WhatsAppCommand = { command: "quote", description: "Get a price" };
      const update: Exported.UpdateWhatsAppConversationalComponentsRequest = {
        commands: [command],
      };
      const read: Exported.WhatsAppConversationalComponents = {
        phoneNumber: PHONE,
        iceBreakers: [],
        commands: [command],
      };
      const calling: Exported.UpdateWhatsAppCallingRequest = { enabled: true };
      const settings: Exported.WhatsAppCallingSettings = {
        phoneNumber: PHONE,
        callingEnabled: true,
        outboundCallingAllowed: false,
      };
      const channel: Exported.CallChannel = "whatsapp";
      expect([request, photo, update, read, calling, settings, channel]).toHaveLength(7);
    });
  });
});

describe("Call channel", () => {
  let client: Sendly;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    client = new Sendly("sk_live_v1_valid_key");
    fetchMock = vi.fn();
    global.fetch = fetchMock;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const call: Call = {
    id: "6f1c2d3e-4a5b-4c6d-8e9f-0a1b2c3d4e5f",
    object: "call",
    kind: "pstn",
    channel: "whatsapp",
    direction: "inbound",
    status: "completed",
    handledBy: "dashboard",
    agentId: null,
    from: "+14155550188",
    to: PHONE,
    callerName: null,
    calleeName: null,
    startedAt: "2026-09-30T14:03:11.000Z",
    answeredAt: "2026-09-30T14:03:15.000Z",
    endedAt: "2026-09-30T14:05:00.000Z",
    durationSecs: 105,
    creditsCharged: 4,
    billing: "settled",
    hangupClass: "normal",
    recordingStatus: null,
    metadata: {},
  };

  it("passes channel through on calls.get()", async () => {
    fetchMock.mockResolvedValue(mockFetchResponse(call));

    const result = await client.calls.get(call.id);

    expect(result.channel).toBe("whatsapp");
  });

  it("keeps a channel value this version does not know", async () => {
    fetchMock.mockResolvedValue(mockFetchResponse({ ...call, channel: "satellite" }));

    const result = await client.calls.get(call.id);

    expect(result.channel).toBe("satellite");
  });
});
