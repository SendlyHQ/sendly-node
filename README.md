# @sendly/node

Official Node.js SDK for the [Sendly](https://sendly.live) SMS API.

## Installation

```bash
npm install @sendly/node
# or
yarn add @sendly/node
# or
pnpm add @sendly/node
```

## Requirements

- Node.js 18.0.0 or higher
- A Sendly API key ([get one here](https://sendly.live/dashboard))

## Quick Start

```typescript
import Sendly from '@sendly/node';

// Initialize with your API key
const sendly = new Sendly('sk_live_v1_your_api_key');

// Send an SMS
const message = await sendly.messages.send({
  to: '+15551234567',
  text: 'Hello from Sendly!'
});

console.log(`Message sent: ${message.id}`);
console.log(`Status: ${message.status}`);
```

## Prerequisites for Live Messaging

Before sending live SMS messages, you need:

1. **Business Verification** - Complete verification in the [Sendly dashboard](https://sendly.live/dashboard)
   - **International**: Instant approval (just provide Sender ID)
   - **US/Canada**: Requires carrier approval (3-7 business days)

2. **Credits** - Add credits to your account
   - Test keys (`sk_test_*`) work without credits (sandbox mode)
   - Live keys (`sk_live_*`) require credits for each message

3. **Live API Key** - Generate after verification + credits
   - Dashboard → API Keys → Create Live Key

### Test vs Live Keys

| Key Type | Prefix | Credits Required | Verification Required | Use Case |
|----------|--------|------------------|----------------------|----------|
| Test | `sk_test_v1_*` | No | No | Development, testing |
| Live | `sk_live_v1_*` | Yes | Yes | Production messaging |

> **Note**: You can start development immediately with a test key. Messages to sandbox test numbers are free and don't require verification.

## Features

- ✅ Full TypeScript support with exported types
- ✅ Automatic retries with exponential backoff
- ✅ Rate limit handling (respects `Retry-After`)
- ✅ Promise-based async/await API
- ✅ ESM and CommonJS support
- ✅ Zero runtime dependencies

## Usage

### Sending Messages

```typescript
import Sendly from '@sendly/node';

const sendly = new Sendly('sk_live_v1_xxx');

// Basic usage (marketing message - default)
const message = await sendly.messages.send({
  to: '+15551234567',
  text: 'Check out our new features!'
});

// Transactional message (bypasses quiet hours)
const message = await sendly.messages.send({
  to: '+15551234567',
  text: 'Your verification code is: 123456',
  messageType: 'transactional'
});

// With custom sender ID (international)
const message = await sendly.messages.send({
  to: '+447700900123',
  text: 'Hello from MyApp!',
  from: 'MYAPP'
});
```

### Listing Messages

```typescript
// Get recent messages (default limit: 50)
const { data: messages, count } = await sendly.messages.list();

// Get last 10 messages
const { data: messages } = await sendly.messages.list({ limit: 10 });

// Iterate through messages
for (const msg of messages) {
  console.log(`${msg.to}: ${msg.status}`);
}
```

### Getting a Message

```typescript
const message = await sendly.messages.get('msg_xxx');

console.log(`Status: ${message.status}`);
console.log(`Delivered: ${message.deliveredAt}`);
```

### Rate Limit Information

```typescript
// After any API call, you can check rate limit status
await sendly.messages.send({ to: '+1555...', text: 'Hello!' });

const rateLimit = sendly.getRateLimitInfo();
if (rateLimit) {
  console.log(`${rateLimit.remaining}/${rateLimit.limit} requests remaining`);
  console.log(`Resets in ${rateLimit.reset} seconds`);
}
```

## Configuration

```typescript
import Sendly from '@sendly/node';

const sendly = new Sendly({
  apiKey: 'sk_live_v1_xxx',
  
  // Optional: Custom base URL (for testing)
  baseUrl: 'https://sendly.live/api/v1',
  
  // Optional: Request timeout in ms (default: 30000)
  timeout: 60000,
  
  // Optional: Max retry attempts (default: 3)
  maxRetries: 5
});
```

## Error Handling

The SDK provides typed error classes for different error scenarios:

```typescript
import Sendly, {
  SendlyError,
  AuthenticationError,
  RateLimitError,
  InsufficientCreditsError,
  ValidationError,
  NotFoundError
} from '@sendly/node';

const sendly = new Sendly('sk_live_v1_xxx');

try {
  await sendly.messages.send({
    to: '+15551234567',
    text: 'Hello!'
  });
} catch (error) {
  if (error instanceof AuthenticationError) {
    console.error('Invalid API key:', error.message);
  } else if (error instanceof RateLimitError) {
    console.error(`Rate limited. Retry after ${error.retryAfter} seconds`);
  } else if (error instanceof InsufficientCreditsError) {
    console.error(`Not enough credits. Need ${error.creditsNeeded}, have ${error.currentBalance}`);
  } else if (error instanceof ValidationError) {
    console.error('Invalid request:', error.message);
  } else if (error instanceof NotFoundError) {
    console.error('Resource not found:', error.message);
  } else if (error instanceof SendlyError) {
    console.error(`API error [${error.code}]:`, error.message);
  } else {
    throw error;
  }
}
```

## Testing (Sandbox Mode)

Use a test API key (`sk_test_v1_xxx`) to test without sending real messages:

```typescript
import Sendly, { SANDBOX_TEST_NUMBERS } from '@sendly/node';

const sendly = new Sendly('sk_test_v1_xxx');

// Check if in test mode
console.log(sendly.isTestMode()); // true

// Use sandbox test numbers
await sendly.messages.send({
  to: SANDBOX_TEST_NUMBERS.SUCCESS,  // +15005550000 - Always succeeds
  text: 'Test message'
});

await sendly.messages.send({
  to: SANDBOX_TEST_NUMBERS.INVALID,  // +15005550001 - Returns invalid_number error
  text: 'Test message'
});
```

### Available Test Numbers

| Number | Behavior |
|--------|----------|
| `+15005550000` | Success (instant) |
| `+15005550001` | Fails: invalid_number |
| `+15005550002` | Fails: unroutable_destination |
| `+15005550003` | Fails: queue_full |
| `+15005550004` | Fails: rate_limit_exceeded |
| `+15005550006` | Fails: carrier_violation |

## Pricing Tiers

```typescript
import { CREDITS_PER_SMS, SUPPORTED_COUNTRIES } from '@sendly/node';

// Credits per SMS by tier
console.log(CREDITS_PER_SMS.domestic); // 1 (US/Canada)
console.log(CREDITS_PER_SMS.tier1);    // 8 (UK, Poland, India, etc.)
console.log(CREDITS_PER_SMS.tier2);    // 12 (France, Japan, Australia, etc.)
console.log(CREDITS_PER_SMS.tier3);    // 16 (Germany, Italy, Mexico, etc.)

// Supported countries by tier
console.log(SUPPORTED_COUNTRIES.domestic); // ['US', 'CA']
console.log(SUPPORTED_COUNTRIES.tier1);    // ['GB', 'PL', 'IN', ...]
```

## Utilities

The SDK exports validation utilities for advanced use cases:

```typescript
import {
  validatePhoneNumber,
  getCountryFromPhone,
  isCountrySupported,
  calculateSegments
} from '@sendly/node';

// Validate phone number format
validatePhoneNumber('+15551234567'); // OK
validatePhoneNumber('555-1234'); // Throws ValidationError

// Get country from phone number
getCountryFromPhone('+447700900123'); // 'GB'
getCountryFromPhone('+15551234567');  // 'US'

// Check if country is supported
isCountrySupported('GB'); // true
isCountrySupported('XX'); // false

// Calculate SMS segments
calculateSegments('Hello!'); // 1
calculateSegments('A'.repeat(200)); // 2
```

## TypeScript

The SDK is written in TypeScript and exports all types:

```typescript
import type {
  SendlyConfig,
  SendMessageRequest,
  Message,
  MessageStatus,
  ListMessagesOptions,
  MessageListResponse,
  RateLimitInfo,
  PricingTier
} from '@sendly/node';
```

## API Reference

### `Sendly`

#### Constructor

```typescript
new Sendly(apiKey: string)
new Sendly(config: SendlyConfig)
```

#### Properties

- `messages` - Messages resource

#### Methods

- `isTestMode()` - Returns `true` if using a test API key
- `getRateLimitInfo()` - Returns current rate limit info
- `getBaseUrl()` - Returns configured base URL

### `sendly.messages`

#### `send(request: SendMessageRequest): Promise<Message>`

Send an SMS message.

#### `list(options?: ListMessagesOptions): Promise<MessageListResponse>`

List sent messages.

#### `get(id: string): Promise<Message>`

Get a specific message by ID.

## Support

- 📚 [Documentation](https://sendly.live/docs)
- 💬 [Discord](https://discord.gg/sendly)
- 📧 [support@sendly.live](mailto:support@sendly.live)

## License

MIT
