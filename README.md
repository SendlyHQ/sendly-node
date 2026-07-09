<p align="center">
  <img src="https://raw.githubusercontent.com/SendlyHQ/sendly-node/main/.github/header.svg" alt="Sendly Node.js SDK" />
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@sendly/node"><img src="https://img.shields.io/npm/v/@sendly/node.svg?style=flat-square" alt="npm version" /></a>
  <a href="https://github.com/SendlyHQ/sendly-node/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/@sendly/node.svg?style=flat-square" alt="license" /></a>
</p>

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
console.log(`Credits needed: ${preview.creditsNeeded}`);
console.log(`Will send: ${preview.willSend}, Blocked: ${preview.blocked}`);
```

### Group MMS

```typescript
// Send a group MMS to 2-8 recipients (US/Canada only). Every recipient sees
// the others and replies fan out to the whole group. Requires an MMS-enabled,
// 10DLC-registered number you own (omit `from` to use your default sender).
const group = await sendly.messages.sendGroup({
  to: ['+14155551234', '+14155555678'],
  text: 'Hey team - quick sync at noon?'
});

console.log(group.id);                // msg_xxx
console.log(group.status);            // 'sent' (or 'delivered' when simulated)
console.log(group.group_message_id);  // grp_xxx (present on live sends)
```

### AI Enhance

```typescript
// Rewrite a draft into a single, polished SMS segment. Provide `text`,
// `messageType`, or both.
const result = await sendly.messages.enhance({
  text: 'hey come check out our sale this weekend',
  messageType: 'marketing'
});

console.log(result.enhanced);     // polished, <=160-char rewrite
console.log(result.explanation);  // what changed and why
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
console.log(`Secret: ${webhook.secret}`); // Only returned at creation - store securely!

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
  const timestamp = req.headers['x-sendly-timestamp'];
  const payload = req.body;

  try {
    const event = webhooks.parse(payload, signature, timestamp);
    
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
const transactions = await sendly.account.getCreditTransactions();
for (const tx of transactions) {
  console.log(`${tx.type}: ${tx.amount} credits - ${tx.description}`);
}

// List API keys
const keys = await sendly.account.listApiKeys();
for (const key of keys) {
  console.log(`${key.name}: ${key.prefix}*** (${key.type})`);
}

// Get API key usage stats
const usage = await sendly.account.getApiKeyUsage('key_xxx');
console.log(`Messages sent: ${usage.messagesSent}`);
console.log(`Credits used: ${usage.creditsUsed}`);

// Create a new API key
const { apiKey, key } = await sendly.account.createApiKey('Production Key');
console.log(`New key: ${key}`); // Only shown once!
console.log(`Key ID: ${apiKey.id}`);

// Revoke an API key
await sendly.account.revokeApiKey('key_xxx');

// Rotate an API key — issues a new key and keeps the old one working for a
// grace period (gracePeriodHours: 24-168, default 24) so you can roll callers
// over without downtime. The new secret is shown only once.
const { newKey, oldKey, message } = await sendly.account.rotateApiKey('key_xxx', {
  gracePeriodHours: 72
});
console.log(`New key: ${newKey.key}`); // Save this - shown once!
console.log(message);                  // "Old key will expire in 72 hours"
```

## Phone Numbers

Discover, buy, and manage the phone numbers you own.

```typescript
// Browse what's available and buy one
const { countries } = await sendly.numbers.listCountries();
const { numbers } = await sendly.numbers.listAvailable({ country: 'GB', type: 'mobile' });
await sendly.numbers.buy({
  phoneNumber: numbers[0].phoneNumber,
  countryCode: numbers[0].country,
  phoneNumberType: numbers[0].numberType,
  monthlyCost: numbers[0].monthlyCost
});

// List the numbers you own
const { numbers: owned } = await sendly.numbers.list();

// Get one by id (includes isDefault)
const number = await sendly.numbers.get('num_xxx');
console.log(`${number.phoneNumber} — default: ${number.isDefault}`);

// Make a number your workspace's default sender (must be active)
await sendly.numbers.update('num_xxx', { isDefault: true });

// Cancel a scheduled release ("keep this number")
await sendly.numbers.update('num_xxx', { pendingCancellation: false });

// Release a number. A live paid purchase is cancelled at period end.
const result = await sendly.numbers.release('num_xxx');
if (result.scheduled) {
  console.log(`Releases at ${result.scheduledReleaseAt}`);
} else {
  console.log('Released');
}
```

## Branded Links

Mint branded short links for a destination URL, list them with click
analytics, and disable an individual link. Requires the `url_shortener`
rollout flag on your account.

```typescript
// Shorten a URL
const link = await sendly.links.create({ url: 'https://example.com/welcome' });
console.log(link.shortUrl); // https://sendly.live/l/Ab3xY7

// List your links with click counts
const { links, total } = await sendly.links.list({ limit: 20 });
for (const l of links) {
  console.log(`${l.shortUrl} -> ${l.destinationUrl} (${l.clickCount} clicks)`);
}

// Disable (kill) a link, or re-enable it
await sendly.links.disable(link.code);
await sendly.links.enable(link.code);
```

## 10DLC (Local Number Texting)

Register your business for carrier review so you can text from local (10-digit) US numbers. The flow is brand → campaign → assign number. Writes require a live API key.

```typescript
// 1. Register a brand for carrier review
const { data: brand } = await sendly.tenDlc.createBrand({
  legalName: 'Acme Holdings LLC',
  ein: '12-3456789',
  website: 'https://acme.example',
  email: 'ops@acme.example',
});

// Poll until the brand is verified (or failed, with failureReasons)
const { data: refreshed } = await sendly.tenDlc.getBrand(brand.id);
console.log(refreshed.status); // "pending" -> "verified"

// 2. Pre-check your use case, then create a campaign
const { data: check } = await sendly.tenDlc.qualify(brand.id, 'MIXED');
if (check.qualified) {
  const { data: campaign } = await sendly.tenDlc.createCampaign({
    brandId: brand.id,
    useCase: 'MIXED',
    description: 'Order updates and support replies for Acme customers',
    messageFlow: 'Customers opt in at checkout on acme.example',
    sampleMessages: ['Your order #123 has shipped!'],
    optOutKeywords: 'STOP',
  });

  // Poll until carriers approve
  const { data: approved } = await sendly.tenDlc.getCampaign(campaign.id);
  console.log(approved.status); // "pending" -> "active"
  console.log(approved.throughput?.tier); // e.g. "Standard"

  // 3. Assign a number you own — it can send once the assignment is Active
  const { data: assignment } = await sendly.tenDlc.assignNumber(
    campaign.id,
    '+15551234567',
  );
  console.log(assignment.status); // "Under review" -> "Active"
}

// List everything
const { data: brands } = await sendly.tenDlc.listBrands();
const { data: campaigns } = await sendly.tenDlc.listCampaigns();
const { data: assignments } = await sendly.tenDlc.listAssignments();
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
console.log(CREDITS_PER_SMS.domestic); // 2 (US/Canada)
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

#### `cancelScheduled(id: string): Promise<CancelledMessageResponse>`

Cancel a scheduled message and refund credits.

#### `sendBatch(request: BatchMessageRequest): Promise<BatchMessageResponse>`

Send multiple messages in one API call.

#### `getBatch(batchId: string): Promise<BatchMessageResponse>`

Get batch status by ID.

#### `listBatches(options?: ListBatchesOptions): Promise<BatchListResponse>`

List all batches.

### `sendly.webhooks`

#### `create(options: CreateWebhookOptions): Promise<WebhookCreatedResponse>`

Create a new webhook endpoint. The returned object includes a one-time `secret`.

#### `list(): Promise<Webhook[]>`

List all webhooks.

#### `get(id: string): Promise<Webhook>`

Get a webhook by ID.

#### `update(id: string, options: UpdateWebhookOptions): Promise<Webhook>`

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

#### `getCreditTransactions(options?: { limit?: number; offset?: number }): Promise<CreditTransaction[]>`

Get credit transaction history.

#### `listApiKeys(): Promise<ApiKey[]>`

List API keys.

#### `getApiKey(id: string): Promise<ApiKey>`

Get an API key by ID.

#### `getApiKeyUsage(id: string): Promise<ApiKeyUsage>`

Get usage statistics for an API key.

## Enterprise

The Enterprise API lets you programmatically manage workspaces, verification, credits, and API keys for multi-tenant platforms. Requires an enterprise master key (`sk_live_v1_master_*`).

### Quick Provision

Create a fully configured workspace in a single call:

```typescript
const client = new Sendly('sk_live_v1_master_YOUR_KEY');

// Inherit verification from an existing workspace (fastest)
const result = await client.enterprise.provision({
  name: 'Acme Insurance - Austin',
  sourceWorkspaceId: 'ws_verified',
  creditAmount: 5000,
  creditSourceWorkspaceId: 'SOURCE_WORKSPACE_ID',
  keyName: 'Production',
  keyType: 'live',
  generateOptInPage: true
});

console.log(result.workspace.id);
console.log(result.key?.key);  // shown once
console.log(result.optInPage?.url);  // hosted opt-in page
```

Three provisioning modes:

| Mode | Params | Description |
|------|--------|-------------|
| **Inherit** | `sourceWorkspaceId` | Shares toll-free number from verified workspace |
| **Inherit + New Number** | `sourceWorkspaceId` + `inheritWithNewNumber: true` | Copies business info, purchases new number |
| **Fresh** | `verification: { ... }` | Full business details, new number + carrier approval |

### Workspace Management

```typescript
// Create
const ws = await client.enterprise.workspaces.create({ name: 'Acme Insurance' });

// List
const { workspaces } = await client.enterprise.workspaces.list();

// Get details
const detail = await client.enterprise.workspaces.get('ws_xxx');

// Delete
await client.enterprise.workspaces.delete('ws_xxx');
```

### Verification

```typescript
// Submit full verification
await client.enterprise.workspaces.submitVerification('ws_xxx', {
  businessName: 'Acme Insurance LLC',
  website: 'https://acme.com',
  entityType: 'PRIVATE_PROFIT',
  brn: '12-3456789',
  brnType: 'EIN',
  brnCountry: 'US',
  address: { street: '100 Main St', city: 'Austin', state: 'TX', zip: '78701', country: 'US' },
  contact: { firstName: 'Jane', lastName: 'Doe', email: 'jane@acme.com', phone: '+15551234567' },
  useCase: 'Policy renewal reminders',
  sampleMessages: 'Your policy renews on 3/15.'
});

// Inherit from verified workspace (shares toll-free number)
await client.enterprise.workspaces.inheritVerification('ws_new', {
  sourceWorkspaceId: 'ws_verified'
});

// Inherit + new number: use provision() with inheritWithNewNumber instead
await client.enterprise.provision({
  name: 'Acme Insurance - Austin',
  sourceWorkspaceId: 'ws_verified',
  inheritWithNewNumber: true
});
```

### Credits & API Keys

```typescript
// Transfer credits
await client.enterprise.workspaces.transferCredits('ws_dest', {
  sourceWorkspaceId: 'ws_source',
  amount: 5000
});

// Create workspace API key
const key = await client.enterprise.workspaces.createKey('ws_xxx', {
  name: 'Production',
  type: 'live'
});
console.log(key.key); // shown once

// Revoke a key
await client.enterprise.workspaces.revokeKey('ws_xxx', 'key_abc');
```

### Webhooks & Analytics

```typescript
// Set enterprise webhook
await client.enterprise.webhooks.set({ url: 'https://yourapp.com/webhooks' });

// Analytics
const overview = await client.enterprise.analytics.overview();
const messages = await client.enterprise.analytics.messages({ period: '30d' });
const delivery = await client.enterprise.analytics.delivery();
```

Full enterprise docs: [sendly.live/docs/enterprise](https://sendly.live/docs/enterprise)

## Support

- 📚 [Documentation](https://sendly.live/docs)
- 💬 [Discord](https://discord.gg/sendly)
- 📧 [support@sendly.live](mailto:support@sendly.live)

## License

MIT
