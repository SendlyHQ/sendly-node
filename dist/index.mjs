// src/errors.ts
var SendlyError = class _SendlyError extends Error {
  /**
   * Machine-readable error code
   */
  code;
  /**
   * HTTP status code (if applicable)
   */
  statusCode;
  /**
   * Raw API response (if applicable)
   */
  response;
  constructor(message, code, statusCode, response) {
    super(message);
    this.name = "SendlyError";
    this.code = code;
    this.statusCode = statusCode;
    this.response = response;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
  /**
   * Create a SendlyError from an API response
   */
  static fromResponse(statusCode, response) {
    const message = response.message || "An unknown error occurred";
    const code = response.error || "internal_error";
    switch (code) {
      case "unauthorized":
      case "invalid_auth_format":
      case "invalid_key_format":
      case "invalid_api_key":
      case "key_revoked":
      case "key_expired":
      case "insufficient_permissions":
        return new AuthenticationError(message, code, statusCode, response);
      case "rate_limit_exceeded":
        return new RateLimitError(
          message,
          response.retryAfter || 60,
          statusCode,
          response
        );
      case "insufficient_credits":
        return new InsufficientCreditsError(
          message,
          response.creditsNeeded || 0,
          response.currentBalance || 0,
          statusCode,
          response
        );
      case "invalid_request":
      case "unsupported_destination":
        return new ValidationError(message, code, statusCode, response);
      case "not_found":
        return new NotFoundError(message, statusCode, response);
      default:
        return new _SendlyError(message, code, statusCode, response);
    }
  }
};
var AuthenticationError = class extends SendlyError {
  constructor(message, code = "unauthorized", statusCode, response) {
    super(message, code, statusCode, response);
    this.name = "AuthenticationError";
  }
};
var RateLimitError = class extends SendlyError {
  /**
   * Seconds to wait before retrying
   */
  retryAfter;
  constructor(message, retryAfter, statusCode, response) {
    super(message, "rate_limit_exceeded", statusCode, response);
    this.name = "RateLimitError";
    this.retryAfter = retryAfter;
  }
};
var InsufficientCreditsError = class extends SendlyError {
  /**
   * Credits needed for the operation
   */
  creditsNeeded;
  /**
   * Current credit balance
   */
  currentBalance;
  constructor(message, creditsNeeded, currentBalance, statusCode, response) {
    super(message, "insufficient_credits", statusCode, response);
    this.name = "InsufficientCreditsError";
    this.creditsNeeded = creditsNeeded;
    this.currentBalance = currentBalance;
  }
};
var ValidationError = class extends SendlyError {
  constructor(message, code = "invalid_request", statusCode, response) {
    super(message, code, statusCode, response);
    this.name = "ValidationError";
  }
};
var NotFoundError = class extends SendlyError {
  constructor(message, statusCode, response) {
    super(message, "not_found", statusCode, response);
    this.name = "NotFoundError";
  }
};
var NetworkError = class extends SendlyError {
  constructor(message, cause) {
    super(message, "internal_error");
    this.name = "NetworkError";
    this.cause = cause;
  }
};
var TimeoutError = class extends SendlyError {
  constructor(message = "Request timed out") {
    super(message, "internal_error");
    this.name = "TimeoutError";
  }
};

// src/utils/http.ts
var DEFAULT_BASE_URL = "https://sendly.live/api/";
var DEFAULT_TIMEOUT = 3e4;
var DEFAULT_MAX_RETRIES = 3;
var HttpClient = class {
  config;
  rateLimitInfo;
  constructor(config) {
    this.config = {
      apiKey: config.apiKey,
      baseUrl: config.baseUrl || DEFAULT_BASE_URL,
      timeout: config.timeout || DEFAULT_TIMEOUT,
      maxRetries: config.maxRetries ?? DEFAULT_MAX_RETRIES
    };
    if (!this.isValidApiKey(this.config.apiKey)) {
      throw new Error(
        "Invalid API key format. Expected sk_test_v1_xxx or sk_live_v1_xxx"
      );
    }
    const baseUrl = new URL(this.config.baseUrl);
    if (baseUrl.protocol !== "https:" && !baseUrl.hostname.includes("localhost") && baseUrl.hostname !== "127.0.0.1") {
      throw new Error(
        "API key must only be transmitted over HTTPS. Use https:// or localhost for development."
      );
    }
  }
  /**
   * Validate API key format
   */
  isValidApiKey(key) {
    return /^sk_(test|live)_v1_[a-zA-Z0-9_-]+$/.test(key);
  }
  /**
   * Get current rate limit info
   */
  getRateLimitInfo() {
    return this.rateLimitInfo;
  }
  /**
   * Check if we're using a test key
   */
  isTestMode() {
    return this.config.apiKey.startsWith("sk_test_");
  }
  /**
   * Make an HTTP request to the API
   */
  async request(options) {
    const url = this.buildUrl(options.path, options.query);
    const headers = this.buildHeaders(options.headers);
    let lastError;
    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        const response = await this.executeRequest(url, {
          method: options.method,
          headers,
          body: options.body ? JSON.stringify(options.body) : void 0
        });
        this.updateRateLimitInfo(response.headers);
        const data = await this.parseResponse(response);
        return data;
      } catch (error) {
        lastError = error;
        if (error instanceof SendlyError) {
          if (error.statusCode === 401 || error.statusCode === 403) {
            throw error;
          }
          if (error.statusCode === 400 || error.statusCode === 404) {
            throw error;
          }
          if (error.statusCode === 402) {
            throw error;
          }
          if (error instanceof RateLimitError) {
            throw error;
          }
        }
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
  async executeRequest(url, init) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);
    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal
      });
      return response;
    } catch (error) {
      if (error.name === "AbortError") {
        throw new TimeoutError(
          `Request timed out after ${this.config.timeout}ms`
        );
      }
      throw new NetworkError(
        `Network request failed: ${error.message}`,
        error
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }
  /**
   * Parse the response body
   */
  async parseResponse(response) {
    const contentType = response.headers.get("content-type");
    let data;
    if (contentType?.includes("application/json")) {
      data = await response.json();
    } else {
      data = await response.text();
    }
    if (!response.ok) {
      const errorResponse = data;
      throw SendlyError.fromResponse(response.status, {
        ...errorResponse,
        error: errorResponse?.error || "internal_error",
        message: errorResponse?.message || `HTTP ${response.status}`
      });
    }
    return data;
  }
  /**
   * Build the full URL with query parameters
   */
  buildUrl(path, query) {
    const base = this.config.baseUrl.replace(/\/$/, "");
    const cleanPath = path.startsWith("/") ? path.slice(1) : path;
    const fullUrl = `${base}/${cleanPath}`;
    const url = new URL(fullUrl);
    if (query) {
      Object.entries(query).forEach(([key, value]) => {
        if (value !== void 0) {
          url.searchParams.append(key, String(value));
        }
      });
    }
    return url.toString();
  }
  /**
   * Build request headers
   */
  buildHeaders(additionalHeaders) {
    return {
      Authorization: `Bearer ${this.config.apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": "@sendly/node/1.0.0",
      ...additionalHeaders
    };
  }
  /**
   * Update rate limit info from response headers
   */
  updateRateLimitInfo(headers) {
    const limit = headers.get("X-RateLimit-Limit");
    const remaining = headers.get("X-RateLimit-Remaining");
    const reset = headers.get("X-RateLimit-Reset");
    if (limit && remaining && reset) {
      this.rateLimitInfo = {
        limit: parseInt(limit, 10),
        remaining: parseInt(remaining, 10),
        reset: parseInt(reset, 10)
      };
    }
  }
  /**
   * Calculate exponential backoff time
   */
  calculateBackoff(attempt) {
    const baseDelay = Math.pow(2, attempt) * 1e3;
    const jitter = Math.random() * 500;
    return Math.min(baseDelay + jitter, 3e4);
  }
  /**
   * Sleep for a given number of milliseconds
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
};

// src/types.ts
var CREDITS_PER_SMS = {
  domestic: 1,
  tier1: 8,
  tier2: 12,
  tier3: 16
};
var SUPPORTED_COUNTRIES = {
  domestic: ["US", "CA"],
  tier1: [
    "GB",
    "PL",
    "PT",
    "RO",
    "CZ",
    "HU",
    "CN",
    "KR",
    "IN",
    "PH",
    "TH",
    "VN"
  ],
  tier2: [
    "FR",
    "ES",
    "SE",
    "NO",
    "DK",
    "FI",
    "IE",
    "JP",
    "AU",
    "NZ",
    "SG",
    "HK",
    "MY",
    "ID",
    "BR",
    "AR",
    "CL",
    "CO",
    "ZA",
    "GR"
  ],
  tier3: [
    "DE",
    "IT",
    "NL",
    "BE",
    "AT",
    "CH",
    "MX",
    "IL",
    "AE",
    "SA",
    "EG",
    "NG",
    "KE",
    "TW",
    "PK",
    "TR"
  ]
};
var ALL_SUPPORTED_COUNTRIES = Object.values(SUPPORTED_COUNTRIES).flat();
var SANDBOX_TEST_NUMBERS = {
  /** Always succeeds instantly */
  SUCCESS: "+15550001234",
  /** Succeeds after 10 second delay */
  DELAYED: "+15550001010",
  /** Fails with invalid_number error */
  INVALID: "+15550001001",
  /** Fails with carrier_rejected error after 2 seconds */
  REJECTED: "+15550001002",
  /** Fails with rate_limit_exceeded error */
  RATE_LIMITED: "+15550001003"
};

// src/utils/validation.ts
function validatePhoneNumber(phone) {
  const e164Regex = /^\+[1-9]\d{1,14}$/;
  if (!phone) {
    throw new ValidationError("Phone number is required");
  }
  if (!e164Regex.test(phone)) {
    throw new ValidationError(
      `Invalid phone number format: ${phone}. Expected E.164 format (e.g., +15551234567)`
    );
  }
}
function validateMessageText(text) {
  if (!text) {
    throw new ValidationError("Message text is required");
  }
  if (typeof text !== "string") {
    throw new ValidationError("Message text must be a string");
  }
  if (text.length > 1600) {
    console.warn(
      `Message is ${text.length} characters. This will be split into ${Math.ceil(text.length / 160)} segments.`
    );
  }
}
function validateSenderId(from) {
  if (!from) {
    return;
  }
  if (from.startsWith("+")) {
    validatePhoneNumber(from);
    return;
  }
  const alphanumericRegex = /^[a-zA-Z0-9]{2,11}$/;
  if (!alphanumericRegex.test(from)) {
    throw new ValidationError(
      `Invalid sender ID: ${from}. Must be 2-11 alphanumeric characters or a valid phone number.`
    );
  }
}
function validateLimit(limit) {
  if (limit === void 0) {
    return;
  }
  if (typeof limit !== "number" || !Number.isInteger(limit)) {
    throw new ValidationError("Limit must be an integer");
  }
  if (limit < 1 || limit > 100) {
    throw new ValidationError("Limit must be between 1 and 100");
  }
}
function validateMessageId(id) {
  if (!id) {
    throw new ValidationError("Message ID is required");
  }
  if (typeof id !== "string") {
    throw new ValidationError("Message ID must be a string");
  }
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const prefixedRegex = /^(msg|schd|batch)_[a-zA-Z0-9]+$/;
  if (!uuidRegex.test(id) && !prefixedRegex.test(id)) {
    throw new ValidationError(`Invalid message ID format: ${id}`);
  }
}
function getCountryFromPhone(phone) {
  const digits = phone.replace(/^\+/, "");
  if (digits.startsWith("1") && digits.length === 11) {
    return "US";
  }
  const countryPrefixes = {
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
    "90": "TR"
  };
  const sortedPrefixes = Object.keys(countryPrefixes).sort(
    (a, b) => b.length - a.length
  );
  for (const prefix of sortedPrefixes) {
    if (digits.startsWith(prefix)) {
      return countryPrefixes[prefix];
    }
  }
  return null;
}
function isCountrySupported(countryCode) {
  return ALL_SUPPORTED_COUNTRIES.includes(countryCode.toUpperCase());
}
function calculateSegments(text) {
  const isUnicode = /[^\x00-\x7F]/.test(text);
  const singleLimit = isUnicode ? 70 : 160;
  const multiLimit = isUnicode ? 67 : 153;
  if (text.length <= singleLimit) {
    return 1;
  }
  return Math.ceil(text.length / multiLimit);
}

// src/resources/messages.ts
var MessagesResource = class {
  http;
  constructor(http) {
    this.http = http;
  }
  /**
   * Send an SMS message
   *
   * @param request - Message details
   * @returns The created message
   *
   * @example
   * ```typescript
   * const message = await sendly.messages.send({
   *   to: '+15551234567',
   *   text: 'Your verification code is: 123456'
   * });
   *
   * console.log(message.id);        // msg_xxx
   * console.log(message.status);    // 'queued'
   * console.log(message.segments);  // 1
   * ```
   *
   * @throws {ValidationError} If the request is invalid
   * @throws {InsufficientCreditsError} If credit balance is too low
   * @throws {AuthenticationError} If the API key is invalid
   * @throws {RateLimitError} If rate limit is exceeded
   */
  async send(request) {
    validatePhoneNumber(request.to);
    validateMessageText(request.text);
    if (request.from) {
      validateSenderId(request.from);
    }
    const message = await this.http.request({
      method: "POST",
      path: "/v1/messages",
      body: {
        to: request.to,
        text: request.text,
        ...request.from && { from: request.from }
      }
    });
    return message;
  }
  /**
   * List sent messages
   *
   * @param options - List options
   * @returns Paginated list of messages
   *
   * @example
   * ```typescript
   * // Get last 50 messages (default)
   * const { data: messages, count } = await sendly.messages.list();
   *
   * // Get last 10 messages
   * const { data: messages } = await sendly.messages.list({ limit: 10 });
   *
   * // Iterate through messages
   * for (const msg of messages) {
   *   console.log(`${msg.to}: ${msg.status}`);
   * }
   * ```
   *
   * @throws {AuthenticationError} If the API key is invalid
   * @throws {RateLimitError} If rate limit is exceeded
   */
  async list(options = {}) {
    validateLimit(options.limit);
    const response = await this.http.request({
      method: "GET",
      path: "/v1/messages",
      query: {
        limit: options.limit,
        offset: options.offset,
        status: options.status
      }
    });
    return response;
  }
  /**
   * Get a specific message by ID
   *
   * @param id - Message ID
   * @returns The message details
   *
   * @example
   * ```typescript
   * const message = await sendly.messages.get('msg_xxx');
   *
   * console.log(message.status);      // 'delivered'
   * console.log(message.deliveredAt); // '2025-01-15T10:30:00Z'
   * ```
   *
   * @throws {NotFoundError} If the message doesn't exist
   * @throws {AuthenticationError} If the API key is invalid
   * @throws {RateLimitError} If rate limit is exceeded
   */
  async get(id) {
    validateMessageId(id);
    const message = await this.http.request({
      method: "GET",
      path: `/v1/messages/${encodeURIComponent(id)}`
    });
    return message;
  }
  /**
   * Iterate through all messages with automatic pagination
   *
   * @param options - List options (limit is used as batch size)
   * @yields Message objects one at a time
   *
   * @example
   * ```typescript
   * // Iterate through all messages
   * for await (const message of sendly.messages.listAll()) {
   *   console.log(`${message.id}: ${message.status}`);
   * }
   *
   * // With custom batch size
   * for await (const message of sendly.messages.listAll({ limit: 100 })) {
   *   console.log(message.to);
   * }
   * ```
   *
   * @throws {AuthenticationError} If the API key is invalid
   * @throws {RateLimitError} If rate limit is exceeded
   */
  async *listAll(options = {}) {
    const batchSize = Math.min(options.limit || 100, 100);
    let offset = 0;
    let hasMore = true;
    while (hasMore) {
      const response = await this.http.request({
        method: "GET",
        path: "/v1/messages",
        query: {
          limit: batchSize,
          offset
        }
      });
      for (const message of response.data) {
        yield message;
      }
      if (response.data.length < batchSize) {
        hasMore = false;
      } else {
        offset += batchSize;
      }
    }
  }
  // ==========================================================================
  // Scheduled Messages
  // ==========================================================================
  /**
   * Schedule an SMS message for future delivery
   *
   * @param request - Schedule request details
   * @returns The scheduled message
   *
   * @example
   * ```typescript
   * const scheduled = await sendly.messages.schedule({
   *   to: '+15551234567',
   *   text: 'Your appointment reminder!',
   *   scheduledAt: '2025-01-20T10:00:00Z'
   * });
   *
   * console.log(scheduled.id);           // msg_xxx
   * console.log(scheduled.status);       // 'scheduled'
   * console.log(scheduled.scheduledAt);  // '2025-01-20T10:00:00Z'
   * ```
   *
   * @throws {ValidationError} If the request is invalid
   * @throws {InsufficientCreditsError} If credit balance is too low
   * @throws {AuthenticationError} If the API key is invalid
   */
  async schedule(request) {
    validatePhoneNumber(request.to);
    validateMessageText(request.text);
    if (request.from) {
      validateSenderId(request.from);
    }
    const scheduledTime = new Date(request.scheduledAt);
    const now = /* @__PURE__ */ new Date();
    const oneMinuteFromNow = new Date(now.getTime() + 60 * 1e3);
    if (isNaN(scheduledTime.getTime())) {
      throw new Error("Invalid scheduledAt format. Use ISO 8601 format.");
    }
    if (scheduledTime <= oneMinuteFromNow) {
      throw new Error("scheduledAt must be at least 1 minute in the future.");
    }
    const scheduled = await this.http.request({
      method: "POST",
      path: "/v1/messages/schedule",
      body: {
        to: request.to,
        text: request.text,
        scheduledAt: request.scheduledAt,
        ...request.from && { from: request.from }
      }
    });
    return scheduled;
  }
  /**
   * List scheduled messages
   *
   * @param options - List options
   * @returns Paginated list of scheduled messages
   *
   * @example
   * ```typescript
   * const { data: scheduled } = await sendly.messages.listScheduled();
   *
   * for (const msg of scheduled) {
   *   console.log(`${msg.to}: ${msg.scheduledAt}`);
   * }
   * ```
   */
  async listScheduled(options = {}) {
    validateLimit(options.limit);
    const response = await this.http.request({
      method: "GET",
      path: "/v1/messages/scheduled",
      query: {
        limit: options.limit,
        offset: options.offset,
        status: options.status
      }
    });
    return response;
  }
  /**
   * Get a specific scheduled message by ID
   *
   * @param id - Message ID
   * @returns The scheduled message details
   *
   * @example
   * ```typescript
   * const scheduled = await sendly.messages.getScheduled('msg_xxx');
   * console.log(scheduled.scheduledAt);
   * ```
   */
  async getScheduled(id) {
    validateMessageId(id);
    const scheduled = await this.http.request({
      method: "GET",
      path: `/v1/messages/scheduled/${encodeURIComponent(id)}`
    });
    return scheduled;
  }
  /**
   * Cancel a scheduled message
   *
   * @param id - Message ID to cancel
   * @returns Cancellation confirmation with refunded credits
   *
   * @example
   * ```typescript
   * const result = await sendly.messages.cancelScheduled('msg_xxx');
   *
   * console.log(result.status);          // 'cancelled'
   * console.log(result.creditsRefunded); // 1
   * ```
   *
   * @throws {NotFoundError} If the message doesn't exist
   * @throws {ValidationError} If the message is not cancellable
   */
  async cancelScheduled(id) {
    validateMessageId(id);
    const result = await this.http.request({
      method: "DELETE",
      path: `/v1/messages/scheduled/${encodeURIComponent(id)}`
    });
    return result;
  }
  // ==========================================================================
  // Batch Messages
  // ==========================================================================
  /**
   * Send multiple SMS messages in a single batch
   *
   * @param request - Batch request with array of messages
   * @returns Batch response with individual message results
   *
   * @example
   * ```typescript
   * const batch = await sendly.messages.sendBatch({
   *   messages: [
   *     { to: '+15551234567', text: 'Hello User 1!' },
   *     { to: '+15559876543', text: 'Hello User 2!' }
   *   ]
   * });
   *
   * console.log(batch.batchId);     // batch_xxx
   * console.log(batch.queued);      // 2
   * console.log(batch.creditsUsed); // 2
   * ```
   *
   * @throws {ValidationError} If any message is invalid
   * @throws {InsufficientCreditsError} If credit balance is too low
   */
  async sendBatch(request) {
    if (!request.messages || !Array.isArray(request.messages) || request.messages.length === 0) {
      throw new Error("messages must be a non-empty array");
    }
    if (request.messages.length > 1e3) {
      throw new Error("Maximum 1000 messages per batch");
    }
    for (const msg of request.messages) {
      validatePhoneNumber(msg.to);
      validateMessageText(msg.text);
    }
    if (request.from) {
      validateSenderId(request.from);
    }
    const batch = await this.http.request({
      method: "POST",
      path: "/v1/messages/batch",
      body: {
        messages: request.messages,
        ...request.from && { from: request.from }
      }
    });
    return batch;
  }
  /**
   * Get batch status and results
   *
   * @param batchId - Batch ID
   * @returns Batch details with message results
   *
   * @example
   * ```typescript
   * const batch = await sendly.messages.getBatch('batch_xxx');
   *
   * console.log(batch.status);  // 'completed'
   * console.log(batch.sent);    // 2
   * console.log(batch.failed);  // 0
   * ```
   */
  async getBatch(batchId) {
    if (!batchId || !batchId.startsWith("batch_")) {
      throw new Error("Invalid batch ID format");
    }
    const batch = await this.http.request({
      method: "GET",
      path: `/v1/messages/batch/${encodeURIComponent(batchId)}`
    });
    return batch;
  }
  /**
   * List message batches
   *
   * @param options - List options
   * @returns Paginated list of batches
   *
   * @example
   * ```typescript
   * const { data: batches } = await sendly.messages.listBatches();
   *
   * for (const batch of batches) {
   *   console.log(`${batch.batchId}: ${batch.status}`);
   * }
   * ```
   */
  async listBatches(options = {}) {
    validateLimit(options.limit);
    const response = await this.http.request({
      method: "GET",
      path: "/v1/messages/batches",
      query: {
        limit: options.limit,
        offset: options.offset,
        status: options.status
      }
    });
    return response;
  }
};

// src/client.ts
var DEFAULT_BASE_URL2 = "https://sendly.live/api";
var DEFAULT_TIMEOUT2 = 3e4;
var DEFAULT_MAX_RETRIES2 = 3;
var Sendly = class {
  /**
   * Messages API resource
   *
   * @example
   * ```typescript
   * // Send a message
   * await sendly.messages.send({ to: '+1555...', text: 'Hello!' });
   *
   * // List messages
   * const { data } = await sendly.messages.list({ limit: 10 });
   *
   * // Get a message
   * const msg = await sendly.messages.get('msg_xxx');
   * ```
   */
  messages;
  http;
  config;
  /**
   * Create a new Sendly client
   *
   * @param configOrApiKey - API key string or configuration object
   */
  constructor(configOrApiKey) {
    if (typeof configOrApiKey === "string") {
      this.config = {
        apiKey: configOrApiKey,
        baseUrl: DEFAULT_BASE_URL2,
        timeout: DEFAULT_TIMEOUT2,
        maxRetries: DEFAULT_MAX_RETRIES2
      };
    } else {
      this.config = {
        apiKey: configOrApiKey.apiKey,
        baseUrl: configOrApiKey.baseUrl || DEFAULT_BASE_URL2,
        timeout: configOrApiKey.timeout || DEFAULT_TIMEOUT2,
        maxRetries: configOrApiKey.maxRetries ?? DEFAULT_MAX_RETRIES2
      };
    }
    this.http = new HttpClient({
      apiKey: this.config.apiKey,
      baseUrl: this.config.baseUrl,
      timeout: this.config.timeout,
      maxRetries: this.config.maxRetries
    });
    this.messages = new MessagesResource(this.http);
  }
  /**
   * Check if the client is using a test API key
   *
   * @returns true if using a test key (sk_test_v1_xxx)
   *
   * @example
   * ```typescript
   * if (sendly.isTestMode()) {
   *   console.log('Running in test mode');
   * }
   * ```
   */
  isTestMode() {
    return this.http.isTestMode();
  }
  /**
   * Get current rate limit information
   *
   * Returns the rate limit info from the most recent API request.
   *
   * @returns Rate limit info or undefined if no requests have been made
   *
   * @example
   * ```typescript
   * await sendly.messages.send({ to: '+1555...', text: 'Hello!' });
   *
   * const rateLimit = sendly.getRateLimitInfo();
   * if (rateLimit) {
   *   console.log(`${rateLimit.remaining}/${rateLimit.limit} requests remaining`);
   *   console.log(`Resets in ${rateLimit.reset} seconds`);
   * }
   * ```
   */
  getRateLimitInfo() {
    return this.http.getRateLimitInfo();
  }
  /**
   * Get the configured base URL
   */
  getBaseUrl() {
    return this.config.baseUrl;
  }
};

// src/utils/webhooks.ts
import * as crypto from "crypto";
var WebhookSignatureError = class extends Error {
  constructor(message = "Invalid webhook signature") {
    super(message);
    this.name = "WebhookSignatureError";
  }
};
function verifyWebhookSignature(payload, signature, secret) {
  if (!payload || !signature || !secret) {
    return false;
  }
  const expectedSignature = generateWebhookSignature(payload, secret);
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}
function parseWebhookEvent(payload, signature, secret) {
  if (!verifyWebhookSignature(payload, signature, secret)) {
    throw new WebhookSignatureError();
  }
  let event;
  try {
    event = JSON.parse(payload);
  } catch {
    throw new Error("Failed to parse webhook payload");
  }
  if (!event.id || !event.type || !event.createdAt) {
    throw new Error("Invalid webhook event structure");
  }
  return event;
}
function generateWebhookSignature(payload, secret) {
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(payload);
  return "sha256=" + hmac.digest("hex");
}
var Webhooks = class {
  secret;
  /**
   * Create a new Webhooks instance
   * @param secret - Your webhook secret from the Sendly dashboard
   */
  constructor(secret) {
    if (!secret) {
      throw new Error("Webhook secret is required");
    }
    this.secret = secret;
  }
  /**
   * Verify a webhook signature
   * @param payload - Raw request body
   * @param signature - X-Sendly-Signature header
   */
  verify(payload, signature) {
    return verifyWebhookSignature(payload, signature, this.secret);
  }
  /**
   * Parse and verify a webhook event
   * @param payload - Raw request body
   * @param signature - X-Sendly-Signature header
   */
  parse(payload, signature) {
    return parseWebhookEvent(payload, signature, this.secret);
  }
  /**
   * Generate a signature for testing
   * @param payload - Payload to sign
   */
  sign(payload) {
    return generateWebhookSignature(payload, this.secret);
  }
};
export {
  ALL_SUPPORTED_COUNTRIES,
  AuthenticationError,
  CREDITS_PER_SMS,
  InsufficientCreditsError,
  NetworkError,
  NotFoundError,
  RateLimitError,
  SANDBOX_TEST_NUMBERS,
  SUPPORTED_COUNTRIES,
  Sendly,
  SendlyError,
  TimeoutError,
  ValidationError,
  WebhookSignatureError,
  Webhooks,
  calculateSegments,
  Sendly as default,
  generateWebhookSignature,
  getCountryFromPhone,
  isCountrySupported,
  parseWebhookEvent,
  validateMessageText,
  validatePhoneNumber,
  validateSenderId,
  verifyWebhookSignature
};
