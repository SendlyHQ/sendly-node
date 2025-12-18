/**
 * HTTP Client Utility
 * @packageDocumentation
 */

import type { RequestOptions, RateLimitInfo, ApiErrorResponse } from "../types";
import {
  SendlyError,
  NetworkError,
  TimeoutError,
  RateLimitError,
} from "../errors";

const DEFAULT_BASE_URL = "https://sendly.live/api/";
const DEFAULT_TIMEOUT = 30000;
const DEFAULT_MAX_RETRIES = 3;

export interface HttpClientConfig {
  apiKey: string;
  baseUrl: string;
  timeout: number;
  maxRetries: number;
}

/**
 * HTTP client for making API requests
 */
export class HttpClient {
  private readonly config: HttpClientConfig;
  private rateLimitInfo?: RateLimitInfo;

  constructor(config: Partial<HttpClientConfig> & { apiKey: string }) {
    this.config = {
      apiKey: config.apiKey,
      baseUrl: config.baseUrl || DEFAULT_BASE_URL,
      timeout: config.timeout || DEFAULT_TIMEOUT,
      maxRetries: config.maxRetries ?? DEFAULT_MAX_RETRIES,
    };

    // Validate API key format
    if (!this.isValidApiKey(this.config.apiKey)) {
      throw new Error(
        "Invalid API key format. Expected sk_test_v1_xxx or sk_live_v1_xxx",
      );
    }

    // Validate HTTPS for non-localhost URLs to protect API key
    const baseUrl = new URL(this.config.baseUrl);
    if (
      baseUrl.protocol !== "https:" &&
      !baseUrl.hostname.includes("localhost") &&
      baseUrl.hostname !== "127.0.0.1"
    ) {
      throw new Error(
        "API key must only be transmitted over HTTPS. Use https:// or localhost for development.",
      );
    }
  }

  /**
   * Validate API key format
   */
  private isValidApiKey(key: string): boolean {
    return /^sk_(test|live)_v1_[a-zA-Z0-9_-]+$/.test(key);
  }

  /**
   * Get current rate limit info
   */
  getRateLimitInfo(): RateLimitInfo | undefined {
    return this.rateLimitInfo;
  }

  /**
   * Check if we're using a test key
   */
  isTestMode(): boolean {
    return this.config.apiKey.startsWith("sk_test_");
  }

  /**
   * Make an HTTP request to the API
   */
  async request<T>(options: RequestOptions): Promise<T> {
    const url = this.buildUrl(options.path, options.query);
    const headers = this.buildHeaders(options.headers);

    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        const response = await this.executeRequest(url, {
          method: options.method,
          headers,
          body: options.body ? JSON.stringify(options.body) : undefined,
        });

        // Update rate limit info from headers
        this.updateRateLimitInfo(response.headers);

        // Parse response body
        const data = await this.parseResponse<T>(response);

        return data;
      } catch (error) {
        lastError = error as Error;

        // Don't retry on certain errors
        if (error instanceof SendlyError) {
          // Don't retry authentication errors
          if (error.statusCode === 401 || error.statusCode === 403) {
            throw error;
          }

          // Don't retry validation errors
          if (error.statusCode === 400 || error.statusCode === 404) {
            throw error;
          }

          // Don't retry insufficient credits
          if (error.statusCode === 402) {
            throw error;
          }

          // Don't retry rate limiting - throw immediately so caller can decide
          if (error instanceof RateLimitError) {
            throw error;
          }
        }

        // Retry on network errors and 5xx errors
        if (attempt < this.config.maxRetries) {
          const backoffTime = this.calculateBackoff(attempt);
          await this.sleep(backoffTime);
          continue;
        }
      }
    }

    throw lastError || new NetworkError("Request failed after retries");
  }

  /**
   * Execute the HTTP request
   */
  private async executeRequest(
    url: string,
    init: RequestInit,
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
      });

      return response;
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        throw new TimeoutError(
          `Request timed out after ${this.config.timeout}ms`,
        );
      }
      throw new NetworkError(
        `Network request failed: ${(error as Error).message}`,
        error as Error,
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Parse the response body
   */
  private async parseResponse<T>(response: Response): Promise<T> {
    const contentType = response.headers.get("content-type");
    let data: unknown;

    if (contentType?.includes("application/json")) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    // Handle error responses
    if (!response.ok) {
      const errorResponse = data as ApiErrorResponse;
      throw SendlyError.fromResponse(response.status, {
        ...errorResponse,
        error: errorResponse?.error || "internal_error",
        message: errorResponse?.message || `HTTP ${response.status}`,
      });
    }

    return data as T;
  }

  /**
   * Build the full URL with query parameters
   */
  private buildUrl(
    path: string,
    query?: Record<string, string | number | boolean | undefined>,
  ): string {
    // Remove leading slash from path and ensure baseUrl doesn't end with slash
    const base = this.config.baseUrl.replace(/\/$/, "");
    const cleanPath = path.startsWith("/") ? path.slice(1) : path;
    const fullUrl = `${base}/${cleanPath}`;
    const url = new URL(fullUrl);

    if (query) {
      Object.entries(query).forEach(([key, value]) => {
        if (value !== undefined) {
          url.searchParams.append(key, String(value));
        }
      });
    }

    return url.toString();
  }

  /**
   * Build request headers
   */
  private buildHeaders(
    additionalHeaders?: Record<string, string>,
  ): Record<string, string> {
    return {
      Authorization: `Bearer ${this.config.apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": "@sendly/node/1.0.0",
      ...additionalHeaders,
    };
  }

  /**
   * Update rate limit info from response headers
   */
  private updateRateLimitInfo(headers: Headers): void {
    const limit = headers.get("X-RateLimit-Limit");
    const remaining = headers.get("X-RateLimit-Remaining");
    const reset = headers.get("X-RateLimit-Reset");

    if (limit && remaining && reset) {
      this.rateLimitInfo = {
        limit: parseInt(limit, 10),
        remaining: parseInt(remaining, 10),
        reset: parseInt(reset, 10),
      };
    }
  }

  /**
   * Calculate exponential backoff time
   */
  private calculateBackoff(attempt: number): number {
    // Exponential backoff: 1s, 2s, 4s, etc. with jitter
    const baseDelay = Math.pow(2, attempt) * 1000;
    const jitter = Math.random() * 500;
    return Math.min(baseDelay + jitter, 30000); // Max 30 seconds
  }

  /**
   * Sleep for a given number of milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
