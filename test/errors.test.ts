/**
 * Tests for Error Classes
 */

import { describe, it, expect } from "vitest";
import {
  SendlyError,
  AuthenticationError,
  RateLimitError,
  InsufficientCreditsError,
  ValidationError,
  NotFoundError,
  NetworkError,
  TimeoutError,
} from "../src/errors";
import type { ApiErrorResponse } from "../src/types";

describe("Error Classes", () => {
  describe("SendlyError", () => {
    it("should create error with message and code", () => {
      const error = new SendlyError("Test error", "internal_error");
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(SendlyError);
      expect(error.message).toBe("Test error");
      expect(error.code).toBe("internal_error");
      expect(error.name).toBe("SendlyError");
    });

    it("should include status code", () => {
      const error = new SendlyError("Test error", "internal_error", 500);
      expect(error.statusCode).toBe(500);
    });

    it("should include API response", () => {
      const response: ApiErrorResponse = {
        error: "internal_error",
        message: "Test error",
      };
      const error = new SendlyError(
        "Test error",
        "internal_error",
        500,
        response,
      );
      expect(error.response).toEqual(response);
    });

    it("should have stack trace", () => {
      const error = new SendlyError("Test error", "internal_error");
      expect(error.stack).toBeDefined();
    });
  });

  describe("SendlyError.fromResponse()", () => {
    it("should create AuthenticationError for unauthorized", () => {
      const response: ApiErrorResponse = {
        error: "unauthorized",
        message: "Invalid API key",
      };
      const error = SendlyError.fromResponse(401, response);
      expect(error).toBeInstanceOf(AuthenticationError);
      expect(error.message).toBe("Invalid API key");
      expect(error.code).toBe("unauthorized");
      expect(error.statusCode).toBe(401);
    });

    it("should create AuthenticationError for invalid_api_key", () => {
      const response: ApiErrorResponse = {
        error: "invalid_api_key",
        message: "Invalid API key format",
      };
      const error = SendlyError.fromResponse(401, response);
      expect(error).toBeInstanceOf(AuthenticationError);
    });

    it("should create AuthenticationError for key_revoked", () => {
      const response: ApiErrorResponse = {
        error: "key_revoked",
        message: "API key has been revoked",
      };
      const error = SendlyError.fromResponse(401, response);
      expect(error).toBeInstanceOf(AuthenticationError);
    });

    it("should create AuthenticationError for key_expired", () => {
      const response: ApiErrorResponse = {
        error: "key_expired",
        message: "API key has expired",
      };
      const error = SendlyError.fromResponse(401, response);
      expect(error).toBeInstanceOf(AuthenticationError);
    });

    it("should create RateLimitError for rate_limit_exceeded", () => {
      const response: ApiErrorResponse = {
        error: "rate_limit_exceeded",
        message: "Rate limit exceeded",
        retryAfter: 60,
      };
      const error = SendlyError.fromResponse(429, response);
      expect(error).toBeInstanceOf(RateLimitError);
      expect((error as RateLimitError).retryAfter).toBe(60);
    });

    it("should use default retryAfter if not provided", () => {
      const response: ApiErrorResponse = {
        error: "rate_limit_exceeded",
        message: "Rate limit exceeded",
      };
      const error = SendlyError.fromResponse(429, response);
      expect(error).toBeInstanceOf(RateLimitError);
      expect((error as RateLimitError).retryAfter).toBe(60);
    });

    it("should create InsufficientCreditsError", () => {
      const response: ApiErrorResponse = {
        error: "insufficient_credits",
        message: "Insufficient credits",
        creditsNeeded: 5,
        currentBalance: 2,
      };
      const error = SendlyError.fromResponse(402, response);
      expect(error).toBeInstanceOf(InsufficientCreditsError);
      expect((error as InsufficientCreditsError).creditsNeeded).toBe(5);
      expect((error as InsufficientCreditsError).currentBalance).toBe(2);
    });

    it("should use default values for insufficient credits", () => {
      const response: ApiErrorResponse = {
        error: "insufficient_credits",
        message: "Insufficient credits",
      };
      const error = SendlyError.fromResponse(402, response);
      expect((error as InsufficientCreditsError).creditsNeeded).toBe(0);
      expect((error as InsufficientCreditsError).currentBalance).toBe(0);
    });

    it("should create ValidationError for invalid_request", () => {
      const response: ApiErrorResponse = {
        error: "invalid_request",
        message: "Invalid phone number",
      };
      const error = SendlyError.fromResponse(400, response);
      expect(error).toBeInstanceOf(ValidationError);
    });

    it("should create ValidationError for unsupported_destination", () => {
      const response: ApiErrorResponse = {
        error: "unsupported_destination",
        message: "Destination country not supported",
      };
      const error = SendlyError.fromResponse(400, response);
      expect(error).toBeInstanceOf(ValidationError);
    });

    it("should create NotFoundError", () => {
      const response: ApiErrorResponse = {
        error: "not_found",
        message: "Message not found",
      };
      const error = SendlyError.fromResponse(404, response);
      expect(error).toBeInstanceOf(NotFoundError);
    });

    it("should use default message if not provided", () => {
      const response: ApiErrorResponse = {
        error: "internal_error",
        message: "",
      };
      const error = SendlyError.fromResponse(500, response);
      expect(error.message).toBe("An unknown error occurred");
    });

    it("should use default error code if not provided", () => {
      const response = { message: "Error" } as ApiErrorResponse;
      const error = SendlyError.fromResponse(500, response);
      expect(error.code).toBe("internal_error");
    });
  });

  describe("AuthenticationError", () => {
    it("should create authentication error", () => {
      const error = new AuthenticationError("Invalid API key");
      expect(error).toBeInstanceOf(SendlyError);
      expect(error).toBeInstanceOf(AuthenticationError);
      expect(error.message).toBe("Invalid API key");
      expect(error.code).toBe("unauthorized");
      expect(error.name).toBe("AuthenticationError");
    });

    it("should accept custom error code", () => {
      const error = new AuthenticationError(
        "API key expired",
        "key_expired",
        401,
      );
      expect(error.code).toBe("key_expired");
    });
  });

  describe("RateLimitError", () => {
    it("should create rate limit error with retryAfter", () => {
      const error = new RateLimitError("Rate limit exceeded", 60);
      expect(error).toBeInstanceOf(SendlyError);
      expect(error).toBeInstanceOf(RateLimitError);
      expect(error.message).toBe("Rate limit exceeded");
      expect(error.code).toBe("rate_limit_exceeded");
      expect(error.retryAfter).toBe(60);
      expect(error.name).toBe("RateLimitError");
    });

    it("should include status code", () => {
      const error = new RateLimitError("Rate limit exceeded", 120, 429);
      expect(error.statusCode).toBe(429);
      expect(error.retryAfter).toBe(120);
    });
  });

  describe("InsufficientCreditsError", () => {
    it("should create insufficient credits error", () => {
      const error = new InsufficientCreditsError(
        "Insufficient credits",
        5,
        2,
      );
      expect(error).toBeInstanceOf(SendlyError);
      expect(error).toBeInstanceOf(InsufficientCreditsError);
      expect(error.message).toBe("Insufficient credits");
      expect(error.code).toBe("insufficient_credits");
      expect(error.creditsNeeded).toBe(5);
      expect(error.currentBalance).toBe(2);
      expect(error.name).toBe("InsufficientCreditsError");
    });

    it("should include status code", () => {
      const error = new InsufficientCreditsError(
        "Insufficient credits",
        10,
        3,
        402,
      );
      expect(error.statusCode).toBe(402);
    });
  });

  describe("ValidationError", () => {
    it("should create validation error", () => {
      const error = new ValidationError("Invalid phone number");
      expect(error).toBeInstanceOf(SendlyError);
      expect(error).toBeInstanceOf(ValidationError);
      expect(error.message).toBe("Invalid phone number");
      expect(error.code).toBe("invalid_request");
      expect(error.name).toBe("ValidationError");
    });

    it("should accept custom error code", () => {
      const error = new ValidationError(
        "Unsupported destination",
        "unsupported_destination",
        400,
      );
      expect(error.code).toBe("unsupported_destination");
    });
  });

  describe("NotFoundError", () => {
    it("should create not found error", () => {
      const error = new NotFoundError("Message not found");
      expect(error).toBeInstanceOf(SendlyError);
      expect(error).toBeInstanceOf(NotFoundError);
      expect(error.message).toBe("Message not found");
      expect(error.code).toBe("not_found");
      expect(error.name).toBe("NotFoundError");
    });

    it("should include status code", () => {
      const error = new NotFoundError("Resource not found", 404);
      expect(error.statusCode).toBe(404);
    });
  });

  describe("NetworkError", () => {
    it("should create network error", () => {
      const error = new NetworkError("Connection failed");
      expect(error).toBeInstanceOf(SendlyError);
      expect(error).toBeInstanceOf(NetworkError);
      expect(error.message).toBe("Connection failed");
      expect(error.code).toBe("internal_error");
      expect(error.name).toBe("NetworkError");
    });

    it("should include cause", () => {
      const cause = new Error("Network timeout");
      const error = new NetworkError("Connection failed", cause);
      expect(error.cause).toBe(cause);
    });
  });

  describe("TimeoutError", () => {
    it("should create timeout error with default message", () => {
      const error = new TimeoutError();
      expect(error).toBeInstanceOf(SendlyError);
      expect(error).toBeInstanceOf(TimeoutError);
      expect(error.message).toBe("Request timed out");
      expect(error.code).toBe("internal_error");
      expect(error.name).toBe("TimeoutError");
    });

    it("should create timeout error with custom message", () => {
      const error = new TimeoutError("Custom timeout message");
      expect(error.message).toBe("Custom timeout message");
    });
  });
});
