/**
 * Tests for Validation Utilities
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  validatePhoneNumber,
  validateMessageText,
  validateSenderId,
  validateLimit,
  validateMessageId,
  getCountryFromPhone,
  isCountrySupported,
  calculateSegments,
} from "../src/utils/validation";
import { ValidationError } from "../src/errors";

describe("Validation Utilities", () => {
  describe("validatePhoneNumber()", () => {
    it("should accept valid E.164 phone numbers", () => {
      expect(() => validatePhoneNumber("+15551234567")).not.toThrow();
      expect(() => validatePhoneNumber("+441234567890")).not.toThrow();
      expect(() => validatePhoneNumber("+861234567890")).not.toThrow();
      expect(() => validatePhoneNumber("+12")).not.toThrow(); // Minimum 2 digits after country code
    });

    it("should throw for empty phone number", () => {
      expect(() => validatePhoneNumber("")).toThrow(ValidationError);
      expect(() => validatePhoneNumber("")).toThrow("Phone number is required");
    });

    it("should throw for phone without + prefix", () => {
      expect(() => validatePhoneNumber("15551234567")).toThrow(ValidationError);
      expect(() => validatePhoneNumber("15551234567")).toThrow(
        "Invalid phone number format",
      );
    });

    it("should throw for phone with non-digits", () => {
      expect(() => validatePhoneNumber("+1-555-123-4567")).toThrow(
        ValidationError,
      );
      expect(() => validatePhoneNumber("+1 555 123 4567")).toThrow(
        ValidationError,
      );
      expect(() => validatePhoneNumber("+1(555)1234567")).toThrow(
        ValidationError,
      );
    });

    it("should throw for phone starting with +0", () => {
      expect(() => validatePhoneNumber("+0123456789")).toThrow(ValidationError);
    });

    it("should throw for too long phone number (>15 digits)", () => {
      expect(() => validatePhoneNumber("+1234567890123456")).toThrow(
        ValidationError,
      );
    });

    it("should throw for just + sign", () => {
      expect(() => validatePhoneNumber("+")).toThrow(ValidationError);
    });
  });

  describe("validateMessageText()", () => {
    let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    });

    afterEach(() => {
      consoleWarnSpy.mockRestore();
    });

    it("should accept valid message text", () => {
      expect(() => validateMessageText("Hello World")).not.toThrow();
      expect(() => validateMessageText("A")).not.toThrow();
      expect(() => validateMessageText("Text with emojis 🎉")).not.toThrow();
    });

    it("should throw for empty text", () => {
      expect(() => validateMessageText("")).toThrow(ValidationError);
      expect(() => validateMessageText("")).toThrow("Message text is required");
    });

    it("should throw for non-string text", () => {
      expect(() => validateMessageText(123 as any)).toThrow(ValidationError);
      expect(() => validateMessageText(null as any)).toThrow(ValidationError);
      expect(() => validateMessageText(undefined as any)).toThrow(
        ValidationError,
      );
      expect(() => validateMessageText({} as any)).toThrow(ValidationError);
    });

    it("should warn for very long messages (>1600 chars)", () => {
      const longText = "A".repeat(1601);
      expect(() => validateMessageText(longText)).not.toThrow();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Message is 1601 characters"),
      );
    });

    it("should not warn for messages under 1600 chars", () => {
      const text = "A".repeat(1600);
      expect(() => validateMessageText(text)).not.toThrow();
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });
  });

  describe("validateSenderId()", () => {
    it("should accept valid alphanumeric sender IDs", () => {
      expect(() => validateSenderId("ABC123")).not.toThrow();
      expect(() => validateSenderId("Sendly")).not.toThrow();
      expect(() => validateSenderId("AB")).not.toThrow();
      expect(() => validateSenderId("12345678901")).not.toThrow();
    });

    it("should accept valid phone numbers as sender ID", () => {
      expect(() => validateSenderId("+15551234567")).not.toThrow();
      expect(() => validateSenderId("+441234567890")).not.toThrow();
    });

    it("should accept empty/undefined (optional field)", () => {
      expect(() => validateSenderId("")).not.toThrow();
    });

    it("should throw for sender ID with special characters", () => {
      expect(() => validateSenderId("ABC-123")).toThrow(ValidationError);
      expect(() => validateSenderId("ABC_123")).toThrow(ValidationError);
      expect(() => validateSenderId("ABC 123")).toThrow(ValidationError);
    });

    it("should throw for sender ID too short (<2 chars)", () => {
      expect(() => validateSenderId("A")).toThrow(ValidationError);
    });

    it("should throw for sender ID too long (>11 chars)", () => {
      expect(() => validateSenderId("ABCDEFGHIJKL")).toThrow(ValidationError);
    });

    it("should throw for invalid phone format", () => {
      expect(() => validateSenderId("+0123456789")).toThrow(ValidationError);
    });
  });

  describe("validateLimit()", () => {
    it("should accept valid limits", () => {
      expect(() => validateLimit(1)).not.toThrow();
      expect(() => validateLimit(50)).not.toThrow();
      expect(() => validateLimit(100)).not.toThrow();
    });

    it("should accept undefined (optional)", () => {
      expect(() => validateLimit(undefined)).not.toThrow();
    });

    it("should throw for limit < 1", () => {
      expect(() => validateLimit(0)).toThrow(ValidationError);
      expect(() => validateLimit(-1)).toThrow(ValidationError);
    });

    it("should throw for limit > 100", () => {
      expect(() => validateLimit(101)).toThrow(ValidationError);
      expect(() => validateLimit(1000)).toThrow(ValidationError);
    });

    it("should throw for non-integer", () => {
      expect(() => validateLimit(50.5)).toThrow(ValidationError);
      expect(() => validateLimit(NaN)).toThrow(ValidationError);
    });

    it("should throw for non-number types", () => {
      expect(() => validateLimit("50" as any)).toThrow(ValidationError);
      expect(() => validateLimit(null as any)).toThrow(ValidationError);
    });
  });

  describe("validateMessageId()", () => {
    it("should accept valid UUID format", () => {
      expect(() =>
        validateMessageId("550e8400-e29b-41d4-a716-446655440000"),
      ).not.toThrow();
      expect(() =>
        validateMessageId("123e4567-e89b-12d3-a456-426614174000"),
      ).not.toThrow();
    });

    it("should accept valid prefixed format", () => {
      expect(() => validateMessageId("msg_abc123")).not.toThrow();
      expect(() => validateMessageId("msg_XYZ789")).not.toThrow();
      expect(() => validateMessageId("msg_test123")).not.toThrow(); // No underscores in ID
    });

    it("should throw for empty ID", () => {
      expect(() => validateMessageId("")).toThrow(ValidationError);
      expect(() => validateMessageId("")).toThrow("Message ID is required");
    });

    it("should throw for non-string ID", () => {
      expect(() => validateMessageId(123 as any)).toThrow(ValidationError);
      expect(() => validateMessageId(null as any)).toThrow(ValidationError);
    });

    it("should throw for invalid format", () => {
      expect(() => validateMessageId("invalid-id")).toThrow(ValidationError);
      expect(() => validateMessageId("123abc")).toThrow(ValidationError);
      expect(() => validateMessageId("message_abc")).toThrow(ValidationError);
    });

    it("should throw for malformed UUID", () => {
      expect(() => validateMessageId("550e8400-e29b-41d4-a716")).toThrow(
        ValidationError,
      );
      expect(() => validateMessageId("not-a-uuid-at-all")).toThrow(
        ValidationError,
      );
    });
  });

  describe("getCountryFromPhone()", () => {
    it("should return US for +1 numbers", () => {
      expect(getCountryFromPhone("+15551234567")).toBe("US");
      expect(getCountryFromPhone("+14155551234")).toBe("US");
    });

    it("should return country code for international numbers", () => {
      expect(getCountryFromPhone("+441234567890")).toBe("GB");
      expect(getCountryFromPhone("+33123456789")).toBe("FR");
      expect(getCountryFromPhone("+49123456789")).toBe("DE");
      expect(getCountryFromPhone("+861234567890")).toBe("CN");
      expect(getCountryFromPhone("+819012345678")).toBe("JP");
    });

    it("should handle multi-digit country codes", () => {
      expect(getCountryFromPhone("+351123456789")).toBe("PT");
      expect(getCountryFromPhone("+420123456789")).toBe("CZ");
      expect(getCountryFromPhone("+852123456789")).toBe("HK");
    });

    it("should return null for unknown country codes", () => {
      expect(getCountryFromPhone("+999123456789")).toBeNull();
    });

    it("should match longest prefix first", () => {
      // 852 (HK) should be matched before 85 (unknown)
      expect(getCountryFromPhone("+852123456789")).toBe("HK");
    });
  });

  describe("isCountrySupported()", () => {
    it("should return true for supported countries", () => {
      expect(isCountrySupported("US")).toBe(true);
      expect(isCountrySupported("GB")).toBe(true);
      expect(isCountrySupported("FR")).toBe(true);
      expect(isCountrySupported("DE")).toBe(true);
    });

    it("should be case-insensitive", () => {
      expect(isCountrySupported("us")).toBe(true);
      expect(isCountrySupported("gb")).toBe(true);
    });

    it("should return false for unsupported countries", () => {
      expect(isCountrySupported("ZZ")).toBe(false);
      expect(isCountrySupported("XX")).toBe(false);
    });
  });

  describe("calculateSegments()", () => {
    it("should return 1 for short GSM messages", () => {
      expect(calculateSegments("Hello")).toBe(1);
      expect(calculateSegments("A".repeat(160))).toBe(1);
    });

    it("should calculate multiple segments for long GSM messages", () => {
      // Single SMS limit is 160 chars for GSM
      expect(calculateSegments("A".repeat(160))).toBe(1);
      expect(calculateSegments("A".repeat(161))).toBe(2);
      // Multi-part uses 153 chars per segment (7 bytes for UDH header)
      expect(calculateSegments("A".repeat(306))).toBe(2); // 306/153 = 2
      expect(calculateSegments("A".repeat(307))).toBe(3); // 307/153 = 2.006 -> 3
      expect(calculateSegments("A".repeat(459))).toBe(3); // 459/153 = 3
    });

    it("should return 1 for short Unicode messages", () => {
      expect(calculateSegments("Hello 👋")).toBe(1);
      // Emoji is 4 bytes, so 70 emojis = 280 chars > 70 limit
      expect(calculateSegments("A".repeat(70))).toBe(1); // 70 ASCII chars
    });

    it("should calculate multiple segments for long Unicode messages", () => {
      // Once message contains Unicode, it switches to UCS-2 encoding
      const unicodeMessage = "A".repeat(71); // Force Unicode detection with emoji
      expect(calculateSegments("A".repeat(67) + "👋")).toBe(1); // 68 chars total, under 70
      expect(calculateSegments("A".repeat(71) + "👋")).toBe(2); // 72 chars total, over 70
      expect(calculateSegments("A".repeat(134) + "👋")).toBe(3); // 135 chars total
    });

    it("should handle empty string", () => {
      expect(calculateSegments("")).toBe(1);
    });

    it("should handle mixed ASCII and Unicode", () => {
      // Any Unicode character makes entire message UCS-2
      expect(calculateSegments("Hello 世界")).toBe(1);
      expect(calculateSegments("A".repeat(65) + "世界")).toBe(1);
      expect(calculateSegments("A".repeat(69) + "世")).toBe(1);
      expect(calculateSegments("A".repeat(70) + "世")).toBe(2);
    });
  });
});
