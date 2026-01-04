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

### Scheduling Messages

```typescript
// Schedule a message for future delivery
const scheduled = await sendly.messages.schedule({
  to: '+15551234567',
  text: 'Your appointment is tomorrow!',
  scheduledAt: '2025-01-15T10:00:00Z'
});

console.log(`Scheduled: ${scheduled.id}`);
console.log(`Will send at: ${scheduled.scheduledAt}`);

// List scheduled messages
const { data: scheduledMessages } = await sendly.messages.listScheduled();

// Get a specific scheduled message
const msg = await sendly.messages.getScheduled('sched_xxx');

// Cancel a scheduled message (refunds credits)
const result = await sendly.messages.cancelScheduled('sched_xxx');
console.log(`Refunded: ${result.creditsRefunded} credits`);
```

### Batch Messages

```typescript
// Send multiple messages in one API call (up to 1000)
const batch = await sendly.messages.sendBatch({
  messages: [
    { to: '+15551234567', text: 'Hello User 1!' },
    { to: '+15559876543', text: 'Hello User 2!' },
    { to: '+15551112222', text: 'Hello User 3!' }
  ]
});

console.log(`Batch ID: ${batch.batchId}`);
console.log(`Queued: ${batch.queued}`);
console.log(`Failed: ${batch.failed}`);
console.log(`Credits used: ${batch.creditsUsed}`);

// Get batch status
const status = await sendly.messages.getBatch('batch_xxx');

// List all batches
const { data: batches } = await sendly.messages.listBatches();

// Preview batch (dry run) - validates without sending
const preview = await sendly.messages.previewBatch({
  messages: [
    { to: '+15551234567', text: 'Hello User 1!' },
    { to: '+447700900123', text: 'Hello UK!' }
  ]
});
console.log(`Total credits needed: ${preview.totalCredits}`);
console.log(`Valid: ${preview.valid}, Invalid: ${preview.invalid}`);
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

## Webhooks

Manage webhook endpoints to receive real-time delivery status updates.

```typescript
// Create a webhook endpoint
const webhook = await sendly.webhooks.create({
  url: 'https://example.com/webhooks/sendly',
  events: ['message.delivered', 'message.failed']
});

console.log(`Webhook ID: ${webhook.id}`);
console.log(`Secret: ${webhook.secret}`); // Store this securely!

// List all webhooks
const webhooks = await sendly.webhooks.list();

// Get a specific webhook
const wh = await sendly.webhooks.get('whk_xxx');

// Update a webhook
await sendly.webhooks.update('whk_xxx', {
  url: 'https://new-endpoint.example.com/webhook',
  events: ['message.delivered', 'message.failed', 'message.sent']
});

// Test a webhook (sends a test event)
const testResult = await sendly.webhooks.test('whk_xxx');
console.log(`Test ${testResult.success ? 'passed' : 'failed'}`);

// Rotate webhook secret
const rotation = await sendly.webhooks.rotateSecret('whk_xxx');
console.log(`New secret: ${rotation.secret}`);

// View delivery history
const deliveries = await sendly.webhooks.getDeliveries('whk_xxx');

// Retry a failed delivery
await sendly.webhooks.retryDelivery('whk_xxx', 'del_yyy');

// Delete a webhook
await sendly.webhooks.delete('whk_xxx');
```

### Verifying Webhook Signatures

```typescript
import { Webhooks } from '@sendly/node';

const webhooks = new Webhooks('your_webhook_secret');

// In your webhook handler
app.post('/webhooks/sendly', (req, res) => {
  const signature = req.headers['x-sendly-signature'];
  const payload = req.body;

  try {
    const event = webhooks.verifyAndParse(payload, signature);
    
    switch (event.type) {
      case 'message.delivered':
        console.log(`Message ${event.data.id} delivered`);
        break;
      case 'message.failed':
        console.log(`Message ${event.data.id} failed: ${event.data.errorCode}`);
        break;
    }
    
    res.status(200).send('OK');
  } catch (error) {
    console.error('Invalid signature');
    res.status(400).send('Invalid signature');
  }
});
```

## Account & Credits

```typescript
// Get account information
const account = await sendly.account.get();
console.log(`Email: ${account.email}`);

// Check credit balance
const credits = await sendly.account.getCredits();
console.log(`Available: ${credits.availableBalance} credits`);
console.log(`Reserved (scheduled): ${credits.reservedBalance} credits`);
console.log(`Total: ${credits.balance} credits`);

// View credit transaction history
const { data: transactions } = await sendly.account.getCreditTransactions();
for (const tx of transactions) {
  console.log(`${tx.type}: ${tx.amount} credits - ${tx.description}`);
}

// List API keys
const { data: keys } = await sendly.account.listApiKeys();
for (const key of keys) {
  console.log(`${key.name}: ${key.prefix}*** (${key.type})`);
}

// Get API key usage stats
const usage = await sendly.account.getApiKeyUsage('key_xxx');
console.log(`Messages sent: ${usage.messagesSent}`);
console.log(`Credits used: ${usage.creditsUsed}`);

// Create a new API key
const newKey = await sendly.account.createApiKey({
  name: 'Production Key',
  type: 'live',
  scopes: ['sms:send', 'sms:read']
});
console.log(`New key: ${newKey.key}`); // Only shown once!

// Revoke an API key
await sendly.account.revokeApiKey('key_xxx');
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
- `webhooks` - Webhooks resource
- `account` - Account resource

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

#### `schedule(request: ScheduleMessageRequest): Promise<ScheduledMessage>`

Schedule a message for future delivery.

#### `listScheduled(options?: ListScheduledMessagesOptions): Promise<ScheduledMessageListResponse>`

List scheduled messages.

#### `getScheduled(id: string): Promise<ScheduledMessage>`

Get a scheduled message by ID.

#### `cancelScheduled(id: string): Promise<CancelScheduledMessageResponse>`

Cancel a scheduled message and refund credits.

#### `sendBatch(request: SendBatchRequest): Promise<BatchMessageResponse>`

Send multiple messages in one API call.

#### `getBatch(batchId: string): Promise<BatchMessageResponse>`

Get batch status by ID.

#### `listBatches(options?: ListBatchesOptions): Promise<BatchListResponse>`

List all batches.

### `sendly.webhooks`

#### `create(request: CreateWebhookRequest): Promise<Webhook>`

Create a new webhook endpoint.

#### `list(): Promise<Webhook[]>`

List all webhooks.

#### `get(id: string): Promise<Webhook>`

Get a webhook by ID.

#### `update(id: string, request: UpdateWebhookRequest): Promise<Webhook>`

Update a webhook.

#### `delete(id: string): Promise<void>`

Delete a webhook.

#### `test(id: string): Promise<WebhookTestResult>`

Send a test event to a webhook.

#### `rotateSecret(id: string): Promise<WebhookSecretRotation>`

Rotate webhook secret.

#### `getDeliveries(id: string): Promise<WebhookDelivery[]>`

Get delivery history for a webhook.

#### `retryDelivery(webhookId: string, deliveryId: string): Promise<void>`

Retry a failed delivery.

### `sendly.account`

#### `get(): Promise<Account>`

Get account information.

#### `getCredits(): Promise<Credits>`

Get credit balance.

#### `getCreditTransactions(): Promise<CreditTransactionListResponse>`

Get credit transaction history.

#### `listApiKeys(): Promise<ApiKeyListResponse>`

List API keys.

#### `getApiKey(id: string): Promise<ApiKey>`

Get an API key by ID.

#### `getApiKeyUsage(id: string): Promise<ApiKeyUsage>`

Get usage statistics for an API key.

## Support

- 📚 [Documentation](https://sendly.live/docs)
- 💬 [Discord](https://discord.gg/sendly)
- 📧 [support@sendly.live](mailto:support@sendly.live)

## License

MIT
