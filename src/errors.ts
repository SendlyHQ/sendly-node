/**
 * Sendly SDK Error Classes
 * @packageDocumentation
 */

import type { ApiErrorResponse, SendlyErrorCode } from "./types";

/**
 * Base error class for all Sendly SDK errors
 */
export class SendlyError extends Error {
  /**
   * Machine-readable error code
   */
  public readonly code: SendlyErrorCode;

  /**
   * HTTP status code (if applicable)
   */
  public readonly statusCode?: number;

  /**
   * Raw API response (if applicable)
   */
  public readonly response?: ApiErrorResponse;

  constructor(
    message: string,
    code: SendlyErrorCode,
    statusCode?: number,
    response?: ApiErrorResponse,
  ) {
    super(message);
    this.name = "SendlyError";
    this.code = code;
    this.statusCode = statusCode;
    this.response = response;

    // Maintains proper stack trace for where error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Create a SendlyError from an API response
   *
   * @param statusCode - HTTP status of the response
   * @param response - Error body whose `error` and `message` become the
   *   error's code and message
   * @param body - Body kept on `error.response`; defaults to `response`
   */
  static fromResponse(
    statusCode: number,
    response: ApiErrorResponse,
    body: ApiErrorResponse = response,
  ): SendlyError {
    const message = response.message || "An unknown error occurred";
    const code = response.error || "internal_error";

    // Return specific error types based on the error code
    switch (code) {
      case "unauthorized":
      case "invalid_auth_format":
      case "invalid_key_format":
      case "invalid_api_key":
      case "api_key_required":
      case "key_revoked":
      case "key_expired":
      case "insufficient_permissions":
        return new AuthenticationError(message, code, statusCode, body);

      case "rate_limit_exceeded":
      case "too_many_failed_key_attempts":
      case "too_many_concurrent_verifications":
        return new RateLimitError(
          message,
          response.retryAfter || 60,
          statusCode,
          body,
          code,
        );

      case "insufficient_credits":
        return new InsufficientCreditsError(
          message,
          response.creditsNeeded || 0,
          response.currentBalance || 0,
          statusCode,
          body,
        );

      case "invalid_request":
      case "unsupported_destination":
      case "validation_error":
      case "invalid_code":
        return new ValidationError(message, code, statusCode, body);

      case "not_found":
        return new NotFoundError(message, statusCode, body);

      default:
        return new SendlyError(message, code, statusCode, body);
    }
  }
}

/**
 * Thrown when authentication fails
 */
export class AuthenticationError extends SendlyError {
  constructor(
    message: string,
    code: SendlyErrorCode = "unauthorized",
    statusCode?: number,
    response?: ApiErrorResponse,
  ) {
    super(message, code, statusCode, response);
    this.name = "AuthenticationError";
  }
}

/**
 * Thrown when rate limit is exceeded
 *
 * `code` is `rate_limit_exceeded` for the request limit. It is
 * `too_many_failed_key_attempts` when repeated wrong API keys from one
 * address locked the account out for a while: fix the key, then wait
 * `retryAfter` seconds, since until the lockout ends the right key can be
 * refused too. It is `too_many_concurrent_verifications` when too many
 * first-time key checks ran at once; the client retries that one itself
 * and only throws it once its retries run out.
 */
export class RateLimitError extends SendlyError {
  /**
   * Seconds to wait before retrying
   */
  public readonly retryAfter: number;

  constructor(
    message: string,
    retryAfter: number,
    statusCode?: number,
    response?: ApiErrorResponse,
    code: SendlyErrorCode = "rate_limit_exceeded",
  ) {
    super(message, code, statusCode, response);
    this.name = "RateLimitError";
    this.retryAfter = retryAfter;
  }
}

/**
 * Thrown when credit balance is insufficient
 */
export class InsufficientCreditsError extends SendlyError {
  /**
   * Credits needed for the operation
   */
  public readonly creditsNeeded: number;

  /**
   * Current credit balance
   */
  public readonly currentBalance: number;

  constructor(
    message: string,
    creditsNeeded: number,
    currentBalance: number,
    statusCode?: number,
    response?: ApiErrorResponse,
  ) {
    super(message, "insufficient_credits", statusCode, response);
    this.name = "InsufficientCreditsError";
    this.creditsNeeded = creditsNeeded;
    this.currentBalance = currentBalance;
  }
}

/**
 * Thrown when request validation fails
 */
export class ValidationError extends SendlyError {
  constructor(
    message: string,
    code: SendlyErrorCode = "invalid_request",
    statusCode?: number,
    response?: ApiErrorResponse,
  ) {
    super(message, code, statusCode, response);
    this.name = "ValidationError";
  }
}

/**
 * Thrown when a resource is not found
 */
export class NotFoundError extends SendlyError {
  constructor(
    message: string,
    statusCode?: number,
    response?: ApiErrorResponse,
  ) {
    super(message, "not_found", statusCode, response);
    this.name = "NotFoundError";
  }
}

/**
 * Thrown when a network or connection error occurs
 */
export class NetworkError extends SendlyError {
  constructor(message: string, cause?: Error) {
    super(message, "internal_error");
    this.name = "NetworkError";
    this.cause = cause;
  }
}

/**
 * Thrown when a request times out
 */
export class TimeoutError extends SendlyError {
  constructor(message: string = "Request timed out") {
    super(message, "internal_error");
    this.name = "TimeoutError";
  }
}
