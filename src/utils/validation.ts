/**
 * Input Validation Utilities
 * @packageDocumentation
 */

import { ValidationError } from "../errors";
import { ALL_SUPPORTED_COUNTRIES } from "../types";

/**
 * Validate phone number format (E.164)
 */
export function validatePhoneNumber(phone: string): void {
  // E.164 format: + followed by 1-15 digits
  const e164Regex = /^\+[1-9]\d{1,14}$/;

  if (!phone) {
    throw new ValidationError("Phone number is required");
  }

  if (!e164Regex.test(phone)) {
    throw new ValidationError(
      `Invalid phone number format: ${phone}. Expected E.164 format (e.g., +15551234567)`,
    );
  }
}

/**
 * Validate message text
 */
export function validateMessageText(text: string): void {
  if (!text) {
    throw new ValidationError("Message text is required");
  }

  if (typeof text !== "string") {
    throw new ValidationError("Message text must be a string");
  }

  // Warn about very long messages (but don't block them)
  if (text.length > 1600) {
    console.warn(
      `Message is ${text.length} characters. This will be split into ${Math.ceil(text.length / 160)} segments.`,
    );
  }
}

/**
 * Validate sender ID
 */
export function validateSenderId(from: string): void {
  if (!from) {
    return; // Optional field
  }

  // Phone number format (toll-free)
  if (from.startsWith("+")) {
    validatePhoneNumber(from);
    return;
  }

  // Alphanumeric sender ID (2-11 characters)
  const alphanumericRegex = /^[a-zA-Z0-9]{2,11}$/;

  if (!alphanumericRegex.test(from)) {
    throw new ValidationError(
      `Invalid sender ID: ${from}. Must be 2-11 alphanumeric characters or a valid phone number.`,
    );
  }
}

/**
 * Validate list limit
 */
export function validateLimit(limit?: number): void {
  if (limit === undefined) {
    return;
  }

  if (typeof limit !== "number" || !Number.isInteger(limit)) {
    throw new ValidationError("Limit must be an integer");
  }

  if (limit < 1 || limit > 100) {
    throw new ValidationError("Limit must be between 1 and 100");
  }
}

/**
 * Validate message ID format
 * Accepts: UUID format, msg_xxx, schd_xxx (scheduled), batch_xxx
 */
export function validateMessageId(id: string): void {
  if (!id) {
    throw new ValidationError("Message ID is required");
  }

  if (typeof id !== "string") {
    throw new ValidationError("Message ID must be a string");
  }

  // UUID format or prefixed format (msg_, schd_, batch_)
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const prefixedRegex = /^(msg|schd|batch)_[a-zA-Z0-9]+$/;

  if (!uuidRegex.test(id) && !prefixedRegex.test(id)) {
    throw new ValidationError(`Invalid message ID format: ${id}`);
  }
}

/**
 * Get country code from phone number
 */
export function getCountryFromPhone(phone: string): string | null {
  // Remove + prefix
  const digits = phone.replace(/^\+/, "");

  // Check US/Canada (country code 1)
  if (digits.startsWith("1") && digits.length === 11) {
    return "US"; // Could be CA, but we treat as domestic
  }

  // Map of country codes to ISO codes (simplified)
  const countryPrefixes: Record<string, string> = {
    "44": "GB",
    "48": "PL",
    "351": "PT",
    "40": "RO",
    "420": "CZ",
    "36": "HU",
    "86": "CN",
    "82": "KR",
    "91": "IN",
    "63": "PH",
    "66": "TH",
    "84": "VN",
    "33": "FR",
    "34": "ES",
    "46": "SE",
    "47": "NO",
    "45": "DK",
    "358": "FI",
    "353": "IE",
    "81": "JP",
    "61": "AU",
    "64": "NZ",
    "65": "SG",
    "852": "HK",
    "60": "MY",
    "62": "ID",
    "55": "BR",
    "54": "AR",
    "56": "CL",
    "57": "CO",
    "27": "ZA",
    "30": "GR",
    "49": "DE",
    "39": "IT",
    "31": "NL",
    "32": "BE",
    "43": "AT",
    "41": "CH",
    "52": "MX",
    "972": "IL",
    "971": "AE",
    "966": "SA",
    "20": "EG",
    "234": "NG",
    "254": "KE",
    "886": "TW",
    "92": "PK",
    "90": "TR",
  };

  // Try to match country prefixes (longest first)
  const sortedPrefixes = Object.keys(countryPrefixes).sort(
    (a, b) => b.length - a.length,
  );

  for (const prefix of sortedPrefixes) {
    if (digits.startsWith(prefix)) {
      return countryPrefixes[prefix];
    }
  }

  return null;
}

/**
 * Check if a country is supported
 */
export function isCountrySupported(countryCode: string): boolean {
  return ALL_SUPPORTED_COUNTRIES.includes(countryCode.toUpperCase());
}

/**
 * Calculate number of SMS segments for a message
 */
export function calculateSegments(text: string): number {
  // Check if message contains non-GSM characters (requires UCS-2 encoding)
  const isUnicode = /[^\x00-\x7F]/.test(text);

  // GSM: 160 chars single, 153 chars per segment for multi
  // UCS-2: 70 chars single, 67 chars per segment for multi
  const singleLimit = isUnicode ? 70 : 160;
  const multiLimit = isUnicode ? 67 : 153;

  if (text.length <= singleLimit) {
    return 1;
  }

  return Math.ceil(text.length / multiLimit);
}
