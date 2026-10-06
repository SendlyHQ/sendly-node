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
  to: '+15125550123',
  text: 'Hello from Sendly!'
});

console.log(`Message sent: ${message.id}`);
console.log(`Status: ${message.status}`);
```

## Prerequisites for Live Messaging

Before sending live SMS messages, you need:

1. **Business Verification** - Complete verification in the [Sendly dashboard](https://sendly.live/dashboard)
   - **International**: Instant approval (just provide Sender ID)
   - **US/Canada**: Requires carrier approval

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
- ✅ Automatic retries with exponential backoff on network errors, timeouts, `408` and `5xx`
- ✅ Automatic idempotency keys on POSTs (except `sendBatch`, which the API dedupes by content), reused on every retry, so a retried send never charges twice
- ✅ Rate limits surfaced as a typed `RateLimitError` with `retryAfter` (an ordinary
  `429` is raised at once so you decide; only the brief key-check `429` is waited out for you)
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
  to: '+15125550123',
  text: 'Check out our new features!'
});

// Transactional message (bypasses quiet hours)
const otp = await sendly.messages.send({
  to: '+15125550123',
  text: 'Your verification code is: 123456',
  messageType: 'transactional'
});

// International: sent from your verified sender ID, or from a number you own
// for that country
const intl = await sendly.messages.send({
  to: '+447700900123',
  text: 'Hello from MyApp!'
});
console.log(intl.from, intl.senderType); // e.g. 'MYAPP', 'alphanumeric'

// From a specific number you own. A +1 number reaches US/Canada (and other +1
// countries); to anywhere else your sender ID is used and the response has a
// `warning`.
const owned = await sendly.messages.send({
  to: '+15125550123',
  text: 'Your order has shipped!',
  from: '+15125550199'
});
```

`from` takes a number you own. The sender ID for international sends is the
one on your verification, not a value you pass: any other `from` is ignored
for an international destination (the response carries a `warning` saying
which sender was used) and refused with `400 invalid_from_number` for US and
Canada.

### Listing Messages

```typescript
// Get recent messages (default limit: 50, max 100)
const { data: messages, pagination } = await sendly.messages.list();
console.log(`${messages.length} of ${pagination?.total}`);

// The last 10 delivered messages
const { data: delivered } = await sendly.messages.list({
  status: 'delivered',
  limit: 10,
  offset: 0,
});

// Iterate through messages
for (const msg of delivered) {
  console.log(`${msg.to}: ${msg.status}`);
}

// Page through everything without managing offsets yourself
for await (const msg of sendly.messages.listAll({ status: 'failed', limit: 100 })) {
  console.log(msg.id, msg.error);
}
```

`pagination` carries `total` (every message matching the filter), `limit`,
`offset`, `page`, `totalPages` and `hasMore`. `count` is only the number of
rows on this page. `listAll()` follows `hasMore` for you and applies `status`
and `offset` to every page.

### Getting a Message

```typescript
const message = await sendly.messages.get('4a7c1e2f-9b3d-4c8a-91f2-7d5e6a0b3c19');

console.log(`Status: ${message.status}`);
console.log(`Delivered: ${message.deliveredAt}`);
```

### Scheduling Messages

```typescript
// Schedule a message for future delivery
const scheduled = await sendly.messages.schedule({
  to: '+15125550123',
  text: 'Your appointment is tomorrow!',
  scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 5 minutes to 5 days ahead
});

console.log(`Scheduled: ${scheduled.id}`);
console.log(`Will send at: ${scheduled.scheduledAt}`);

// List scheduled messages
const { data: scheduledMessages } = await sendly.messages.listScheduled();

// Get a specific scheduled message (scheduled ids are schd_ prefixed, sent
// message ids are bare UUIDs — the SDK rejects anything that isn't a UUID or
// a msg_/schd_/batch_ id before it sends)
const msg = await sendly.messages.getScheduled(scheduled.id);

// Cancel a scheduled message (refunds credits)
const result = await sendly.messages.cancelScheduled(scheduled.id);
console.log(`Refunded: ${result.creditsRefunded} credits`);
```

### Batch Messages

```typescript
// Preview the batch first (dry run): validates and prices without sending
const preview = await sendly.messages.previewBatch({
  messages: [
    { to: '+15125550123', text: 'Hello User 1!' },
    { to: '+447700900123', text: 'Hello UK!' }
  ]
});
console.log(`Sendable: ${preview.sendable} of ${preview.total}`);
console.log(`Credits needed: ${preview.creditsNeeded} (balance ${preview.creditBalance})`);
for (const blocked of preview.blockedMessages ?? []) {
  console.log(`${blocked.to}: ${blocked.reason}`);
}

// Send multiple messages in one API call (up to 10,000)
if (preview.canSend) {
  const batch = await sendly.messages.sendBatch({
    messages: [
      { to: '+15125550123', text: 'Hello User 1!' },
      { to: '+447700900123', text: 'Hello UK!' }
    ]
  });

  console.log(`Batch ID: ${batch.batchId}`);
  console.log(`Status: ${batch.status}`); // 'processing' while a live batch sends
  console.log(`Skipped: ${batch.optedOutSkipped} opted out, ${batch.invalidSkipped} invalid`);

  // Get the outcome: sent, delivered and failed counts, and every message
  const result = await sendly.messages.getBatch(batch.batchId);
  console.log(result.sent, result.delivered, result.failed, result.creditsReserved, result.creditsRefunded);
}

// List batches (without their messages; call getBatch for those)
const { data: batches } = await sendly.messages.listBatches({ status: 'completed' });
```

`canSend` is the field to check before sending. A live send skips recipients
who opted out, but rejects the whole batch if any other message is blocked
(for example an unsupported destination or restricted content), so `canSend`
is false in that case even though `sendable` is above zero. It is also false when
the balance does not cover `creditsNeeded` (a test key's sends are free, so
that check is skipped) or the key lacks the `sms:send` scope. The preview also
returns `byCountry`, `duplicates`, `compliance` and `warnings`.

A live `sendBatch` usually answers while the batch is still `processing`, with
an empty `messages` array; `getBatch` returns the outcome. `queued` and
`createdAt` on the send result are deprecated (the send never returns them):
read them from `getBatch`.

### Group MMS

```typescript
// Send a group MMS to 2-8 recipients (US/Canada only). Every recipient sees
// the others and replies fan out to the whole group. Requires an MMS-enabled,
// 10DLC-registered number you own (omit `from` to use your default sender).
const group = await sendly.messages.sendGroup({
  to: ['+14155550101', '+14155550102'],
  text: 'Hey team - quick sync at noon?'
});

console.log(group.id);                // 4a7c1e2f-9b3d-4c8a-91f2-7d5e6a0b3c19
console.log(group.status);            // 'sent' (or 'delivered' when simulated)
console.log(group.to);                // ['+14155550101', '+14155550102']
console.log(group.group_message_id);  // grp_xxx (present on live sends)

// Live sends also list each recipient with its own delivery status
for (const r of group.recipients ?? []) {
  console.log(`${r.phoneNumber}: ${r.status}`);
}
```

`to` is always the list of numbers. `recipients` is present on a live send
only; a simulated send (test key, or before your verification is approved)
has `simulated: true` and a `message` explaining why.

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

### Rate Limits

Requests are counted per API key in a fixed 60-second window: **60/minute**
on a test key, **600/minute** on a live key, and **3000/minute** on an
enterprise master key.

```typescript
// After any API call, you can check rate limit status
await sendly.messages.send({ to: '+15125550123', text: 'Hello!' });

const rateLimit = sendly.getRateLimitInfo();
if (rateLimit) {
  console.log(`${rateLimit.remaining}/${rateLimit.limit} requests remaining`);
  console.log(`Resets in ${rateLimit.reset} seconds`);
}
```

Going over the limit raises `RateLimitError` with `retryAfter` in seconds. The
SDK does **not** wait out an ordinary `429` for you: it throws straight away so
you can decide whether to back off, shed load, or queue. Check `code` first,
because one `429` must not be retried as it is:

```typescript
try {
  await sendly.messages.send({ to: '+15125550123', text: 'Hello!' });
} catch (error) {
  if (error instanceof RateLimitError) {
    if (error.code === 'too_many_failed_key_attempts') {
      // Repeated wrong API keys from this address locked it out.
      // Fix the key. Until retryAfter has passed, even the right key can be refused.
      throw error;
    }
    await new Promise((r) => setTimeout(r, error.retryAfter * 1000));
  }
}
```

The `RateLimitError` codes:

- `rate_limit_exceeded`: the per-key request limit above. Thrown at once.
- `too_many_failed_key_attempts`: too many requests with a wrong API key came
  from your address. Thrown at once. Retrying does not help: fix the key; until
  `retryAfter` seconds pass, a correct key can still be refused.
- `too_many_concurrent_verifications`: too many first-time key checks were
  running at once from your address. The request never ran, so the SDK waits
  its `retryAfter` (1 second) and sends it again with the same idempotency
  key; you only see this error once `maxRetries` run out.

Network errors, request timeouts, `408` and `5xx` responses are retried
automatically too (up to `maxRetries`, with exponential backoff and jitter).
Three WhatsApp calls throw a `5xx`, a timeout or a network error at once
instead: `whatsapp.signup.create` with a `businessAccountId`,
`whatsapp.signup.verify` and `whatsapp.senders.uploadProfilePhoto`, because
repeating them can start a new charged signup or use up a verification
attempt. They still wait out a `429 too_many_concurrent_verifications`, which
never ran.
Every other `4xx` is a final answer and is thrown on the first attempt,
including a `409` conflict, a `410` expired code and the `429
max_attempts_exceeded` from `verify.check`.

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

The client throws at construction time if the key is not shaped
`sk_test_v1_…` / `sk_live_v1_…`, or if `baseUrl` is plain `http://` for
anything other than this machine (`localhost`, `*.localhost`, `127.0.0.0/8`,
`[::1]`).

## Idempotency

POSTs carry an automatically generated `Idempotency-Key`, and the SDK sends the
same key on every retry of that call: after a timeout, a network error, a `408`,
a `5xx` or the key-check `429`. The exception is `sendBatch`, which sends a key
only when you pass `idempotencyKey`; without one, the API dedupes a retried
batch by its content. On the endpoints that deduplicate (sends, batch, group,
schedule, conversation replies, draft approval, verify, number purchase, credit
transfers, enterprise provisioning, WhatsApp signup and template
creation, calls, and RCS and short-code writes), a retry of a request that
already reached the API returns the original result instead of sending and
charging again. The API never records a `5xx` or a `429` under a key, so a
retry after one of those runs the request again; a `2xx` or any other `4xx`
is recorded and replayed. Uploads also carry a key, but the API does not
deduplicate them, so a retried upload can store the file twice. You do not
have to do anything to get this.

Pass your own key when the guarantee needs to outlive the process — a job queue
that re-runs after a crash, or your own retry loop:

```typescript
await sendly.messages.send(
  { to: '+15125550123', text: 'Your order has shipped!' },
  { idempotencyKey: `order-4821-shipped` }
);
```

Reusing a key within 24 hours returns the original response. Reusing it with a
different body returns `422 idempotency_key_mismatch`, so derive keys from
something stable in your domain, like an order id. `sendBatch` sends no
automatic key, because the API already deduplicates identical batches by their
contents.

Full details: https://sendly.live/docs/idempotency

## Webhooks

Manage webhook endpoints to receive real-time delivery status updates.

```typescript
// Create a webhook endpoint
const webhook = await sendly.webhooks.create({
  url: 'https://acme.example/webhooks/sendly',
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
  url: 'https://new-endpoint.acme.example/webhook',
  events: ['message.delivered', 'message.failed', 'message.sent']
});

// Test a webhook (sends a test event). It resolves only when your endpoint
// accepted the event; otherwise it throws a ValidationError (400) whose
// message says why.
const testResult = await sendly.webhooks.test('whk_xxx');
console.log(testResult.message, testResult.statusCode, testResult.responseTimeMs);

// Rotate webhook secret. Deliveries are signed with the new secret as soon as
// this returns, so let your endpoint accept both secrets while you deploy it.
const rotation = await sendly.webhooks.rotateSecret('whk_xxx');
console.log(`New secret: ${rotation.secret}`, rotation.rotatedAt);

// View delivery history, newest first (filter by status, page with limit/offset)
const deliveries = await sendly.webhooks.getDeliveries('whk_xxx', { status: 'failed', limit: 50 });
for (const d of deliveries) {
  console.log(d.id, d.eventType, d.httpStatus, d.errorMessage);
}

// Retry a failed delivery
await sendly.webhooks.retryDelivery('whk_xxx', 'del_yyy');

// The event types you can subscribe to, with what each one reports
const eventTypes = await sendly.webhooks.listEventTypeDetails();
console.log(eventTypes.map((e) => `${e.type}: ${e.description}`));

// Delete a webhook
await sendly.webhooks.delete('whk_xxx');
```

Webhook ids are `whk_` prefixed and delivery ids `del_` prefixed; the SDK
checks both before sending the request, so a mistyped id throws locally rather
than round-tripping. `create` throws a `ValidationError` before sending when
the URL is missing or not `https://` or `events` is empty, and `update` does
the same for a URL that is not `https://`. `listEventTypes()` returns just the
names.

### Recovering from an outage

Repeated failures trip a circuit breaker and deliveries stop. Once your
endpoint is healthy again, reset the circuit, then replay what was missed:

```typescript
// 1. Close the circuit (otherwise replay/backfill answer 409)
await sendly.webhooks.resetCircuit('whk_xxx');

// 2. Replay deliveries we recorded but could not deliver. Each replay keeps
//    the original event_id, so your handler can dedupe on it.
const replay = await sendly.webhooks.redeliver('whk_xxx', {
  since: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(), // at most 7 days back
  eventTypes: ['message.delivered', 'message.failed'],
  statuses: ['failed', 'cancelled'],  // default
  limit: 5000,                        // default 1000, max 10000
});
console.log(replay.requeued, replay.truncated, replay.deliveryIds.length);

// 3. Backfill events that never got an audit row at all. They carry the
//    event id the original dispatch would have used, so dedupe on event.id.
const filled = await sendly.webhooks.backfill('whk_xxx', {
  since: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(), // at most 7 days back
});
console.log(filled.synthesized, filled.byType);
```

### Verifying Webhook Signatures

Every delivery carries `X-Sendly-Signature` (`sha256=<hex>`) and
`X-Sendly-Timestamp`. The signed string is `<timestamp>.<raw body>`, so you
must pass **both** the signature and the timestamp, and you must hand the
verifier the **raw request body** — a body that has already been through
`JSON.parse` and re-serialized will not match.

Signing secrets are returned once, at webhook creation, and start with
`whsec_`.

```typescript
import { Webhooks } from '@sendly/node';

const webhooks = new Webhooks(process.env.SENDLY_WEBHOOK_SECRET!); // whsec_...

// In your webhook handler (express.raw({ type: 'application/json' }))
app.post('/webhooks/sendly', (req, res) => {
  const signature = req.headers['x-sendly-signature'] as string;
  const timestamp = req.headers['x-sendly-timestamp'] as string;
  const payload = req.body.toString('utf8'); // raw body, not parsed JSON

  try {
    const event = webhooks.parse(payload, signature, timestamp);

    switch (event.type) {
      case 'message.delivered':
        console.log(`Message ${event.data.object.id} delivered`);
        break;
      case 'message.failed':
        console.log(`Message ${event.data.object.id} failed: ${event.data.object.error}`);
        break;
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('Invalid signature');
    res.status(401).send('Invalid signature');
  }
});
```

The same thing is available as free functions, if you would rather not hold an
instance. Note the argument order — **payload, signature, secret, timestamp** —
and that `timestamp` is last and optional in the signature but required in
practice, because Sendly always signs with one:

```typescript
import { verifyWebhookSignature, parseWebhookEvent, WebhookSignatureError } from '@sendly/node';

const ok = verifyWebhookSignature(
  payload,                                     // raw body string
  req.headers['x-sendly-signature'] as string,
  process.env.SENDLY_WEBHOOK_SECRET!,
  req.headers['x-sendly-timestamp'] as string, // omit and verification WILL fail
  300,                                         // max age in seconds (default 300)
);

// Or verify and parse in one step (throws WebhookSignatureError)
const event = parseWebhookEvent(
  payload,
  req.headers['x-sendly-signature'] as string,
  process.env.SENDLY_WEBHOOK_SECRET!,
  req.headers['x-sendly-timestamp'] as string,
);
```

The statics `Webhooks.verifySignature(payload, signature, secret)` and
`Webhooks.parseEvent(...)` are deprecated. They take no timestamp, so they
cannot verify a real Sendly delivery, and are kept only for older code that
signs payloads itself. Use the instance methods or the free functions above.

The events a webhook may subscribe to are the members of the `WebhookEventType`
union, except two retired values, `message.queued` and `message.undelivered`:
the API never emits them and rejects them in a subscription.

### Lifecycle Events

`WebhookEvent.data.object` is typed as a message, which is right for `message.*` and
wrong for everything else. Lifecycle events — `rcs_*`, `whatsapp_*`, `call.*`,
`brand.*`, `campaign.*`, `assignment.*`, `number.*`, `port*` and `contact.*` — carry a
different object entirely, so the message fields you reach for are `undefined` at
runtime. Read those with `webhookObject<T>(event)`, which hands you `data.object` as
the shape you declare.

```typescript
import { Webhooks, webhookObject, type WebhookEvent } from '@sendly/node';

const webhooks = new Webhooks(process.env.SENDLY_WEBHOOK_SECRET!);

interface RcsAgentObject {
  agent_id: string;
  name: string;
  stage: string;
}

interface NumberObject {
  id: string;
  phone: string;
  status: string;
  country_code: string | null;
}

app.post('/webhooks/sendly', (req, res) => {
  let event: WebhookEvent;
  try {
    event = webhooks.parse(
      req.body, // raw body string, not parsed JSON
      req.headers['x-sendly-signature'] as string,
      req.headers['x-sendly-timestamp'] as string
    );
  } catch {
    return res.status(401).send('Invalid signature');
  }

  switch (event.type) {
    case 'message.delivered':
      // message.* events: data.object really is a message
      console.log(`Message ${event.data.object.id} delivered`);
      break;

    case 'rcs_agent.live': {
      const agent = webhookObject<RcsAgentObject>(event);
      console.log(`RCS agent ${agent.agent_id} (${agent.name}) is ${agent.stage}`);
      break;
    }

    case 'number.activated': {
      const number = webhookObject<NumberObject>(event);
      console.log(`${number.phone} activated (${number.id})`);
      break;
    }
  }

  res.status(200).send('OK');
});
```

`webhookObject` is a cast, not a validator: it returns `data.object` under the type you
name and does not check the payload against it. Note also that `data.object.id` is the
id of whatever the event is about — a contact id on `contact.auto_flagged`, a
phone-number id on `number.activated`. Only treat it as a message id on `message.*`.

## Account & Credits

```typescript
// Get account information, plus the key's workspace, verification and limits
const account = await sendly.account.get();
console.log(`Email: ${account.email}`);
console.log(account.organization?.name, account.verification?.status);
console.log(account.apiKey?.type, account.apiKey?.scopes);

// Check credit balance
const credits = await sendly.account.getCredits();
console.log(`Available: ${credits.availableBalance} credits`);
console.log(`Reserved (scheduled): ${credits.reservedBalance} credits`);
console.log(`Total: ${credits.balance} credits`);

// View credit transaction history, newest first
const transactions = await sendly.account.getCreditTransactions({ limit: 20 });
for (const tx of transactions) {
  console.log(`${tx.type}: ${tx.amount} credits (balance ${tx.balanceAfter}) - ${tx.description}`);
}

// Only one type of transaction
const refunds = await sendly.account.getCreditTransactions({ type: 'refund' });

// List API keys
const keys = await sendly.account.listApiKeys();
for (const key of keys) {
  console.log(`${key.name}: ${key.prefix}*** (${key.type})`);
}

// Get API key usage stats
const usage = await sendly.account.getApiKeyUsage('key_xxx');
console.log(`Requests: ${usage.summary.totalRequests}`);
console.log(`Credits used: ${usage.summary.totalCredits}`);

// Create a new API key: a test key unless you pass type 'live'. A live key
// needs a verified business (403 verification_required) and a credit balance
// (402 credits_required). A key can grant only scopes it holds itself; leave
// out scopes and the new key gets the calling key's.
const { apiKey, key } = await sendly.account.createApiKey('Production Key', {
  type: 'live',
  scopes: ['sms:send', 'sms:read'],
  expiresAt: '2027-01-01T00:00:00Z',
});
console.log(`New key: ${key}`); // Only shown once!
console.log(`Key ID: ${apiKey.id}`, apiKey.permissions, apiKey.expiresAt);

// Rename an API key
await sendly.account.renameApiKey('key_xxx', 'Production Key');

// Revoke an API key
await sendly.account.revokeApiKey('key_xxx');

// Move credits to another workspace you control
await sendly.account.transferCredits({
  targetOrganizationId: '9b2f4c1e-7d3a-4e5b-8c6f-0a1b2c3d4e5f', // workspace id
  amount: 5000,
});

// Rotate an API key — issues a new key and keeps the old one working for a
// grace period (gracePeriodHours: 24-168, default 24) so you can roll callers
// over without downtime. The new secret is shown only once.
const { newKey, oldKey, message } = await sendly.account.rotateApiKey('key_xxx', {
  gracePeriodHours: 72
});
console.log(`New key: ${newKey.key}`); // Save this - shown once!
console.log(message);                  // "Old key will expire in 72 hours"
```

## Verify (OTP)

Send a one-time code, check it, and read the verification back. Sandbox keys
return the code on the response so you can test without a handset.

```typescript
// Send a code
const verification = await sendly.verify.send({
  to: '+15125550123',
  appName: 'MyApp',
  codeLength: 6,      // 4-10, default 6
  timeoutSecs: 300,   // 60-3600, default 300
});
console.log(verification.id, verification.expiresAt);
if (verification.sandboxCode) console.log('Test code:', verification.sandboxCode);

// Check what the user typed. Only a correct code resolves; a wrong, expired or
// used-up code throws, and none of these is retried by the SDK
try {
  const result = await sendly.verify.check(verification.id, { code: '123456' });
  console.log('Phone verified at', result.verifiedAt);
} catch (error) {
  if (error instanceof SendlyError && error.code === 'invalid_code') {
    // 400, a ValidationError
    console.log(`${error.response?.remaining_attempts} attempts left`);
  } else if (error instanceof SendlyError && error.code === 'expired') {
    console.log('Code expired (410): send a new one');
  } else if (error instanceof SendlyError && error.code === 'max_attempts_exceeded') {
    console.log('Too many wrong codes (429): send a new one');
  } else {
    throw error;
  }
}

// Resend, fetch, and list
await sendly.verify.resend(verification.id);
const record = await sendly.verify.get(verification.id);
console.log(record.deliveryStatus, record.attempts, record.maxAttempts);

const { verifications, pagination } = await sendly.verify.list({ limit: 10 });
const verified = verifications.filter((v) => v.status === 'verified');
console.log(verified.length, pagination.hasMore);
```

### Hosted verification sessions

Hand the phone-number-and-code UI to Sendly: create a session, send the user to
`url`, then validate the token you get back on your success URL.

```typescript
const session = await sendly.verify.sessions.create({
  successUrl: 'https://acme.example/verified',
  cancelUrl: 'https://acme.example/cancelled',
  brandName: 'Acme',
  brandColor: '#0B6E4F',
  metadata: { userId: 'u_123' },
});
console.log(session.url, session.expiresAt);

// On your success URL, validate the token
const check = await sendly.verify.sessions.validate({ token: 'tok_from_query' });
if (check.valid) console.log(check.phone, check.verifiedAt, check.metadata);
```

## Templates

Reusable message bodies with `{{variables}}`. Presets ship with the account;
your own start as drafts and must be published before the Verify API can use
them.

```typescript
// Presets and your own templates
const { templates: presets } = await sendly.templates.presets();
const { templates } = await sendly.templates.list();

// Create, preview, publish
const template = await sendly.templates.create({
  name: 'My OTP',
  text: 'Your {{app_name}} code is {{code}}',
});
const preview = await sendly.templates.preview(template.id, {
  app_name: 'MyApp',
  code: '123456',
});
console.log(preview.previewText);   // "Your MyApp code is 123456"
console.log(preview.characterCount, preview.segmentCount); // 25, 1
const published = await sendly.templates.publish(template.id);
console.log(published.status);      // 'published'

// Clone a preset to customise it, update, delete
const mine = await sendly.templates.clone('tpl_preset_otp', { name: 'My Custom OTP' });
await sendly.templates.update(mine.id, { text: 'Your {{app_name}} code: {{code}}' });
await sendly.templates.delete(mine.id);

// Draft one with AI from a description
const generated = await sendly.templates.generate({
  description: 'Appointment reminder for a dental clinic',
});
console.log(generated.text, generated.variables);
```

## Campaigns

Bulk sends to a contact list, with a cost preview before you commit.

```typescript
const campaign = await sendly.campaigns.create({
  name: 'Welcome Campaign',
  text: 'Hi {{name}}! Thanks for joining {{brand_name}}.',
  contactListIds: ['lst_xxx'], // one list per campaign
});

// What it will cost, and whether you can afford it
const preview = await sendly.campaigns.preview(campaign.id);
console.log(preview.recipientCount, preview.estimatedCredits, preview.hasEnoughCredits);
console.log(`Skipped: ${preview.optedOutCount} opted out, ${preview.landlineCount} landlines`);

// Send now...
const sent = await sendly.campaigns.send(campaign.id);
console.log(`Sent ${sent.sentCount} of ${sent.recipientCount} in batch ${sent.batchId}`);
const outcome = await sendly.messages.getBatch(sent.batchId); // delivery results

// ...or schedule a draft in a timezone
const draft = await sendly.campaigns.clone(campaign.id);
await sendly.campaigns.schedule(draft.id, {
  scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  timezone: 'America/New_York',
});

// Follow it, cancel a scheduled one
const current = await sendly.campaigns.get(draft.id);
console.log(current.status); // 'scheduled'
await sendly.campaigns.cancel(draft.id);

// List with paging
const { campaigns, total } = await sendly.campaigns.list({ status: 'completed', limit: 10 });
```

A campaign fills two placeholders when it sends: `{{name}}` (the contact's
name) and `{{brand_name}}` (your brand name). Any other placeholder in `text`
reaches recipients as typed, and a template that uses one is refused. A
campaign targets one list, so passing more than one id in `contactListIds`
throws a `ValidationError` before any request is made.

`send()` resolves to a `CampaignSendResult`: the batch the messages went out
in, with `batchId`, `status`, `recipientCount`, `sentCount`, `failedCount`,
`creditsUsed`, `creditsRefunded`, `optedOutSkipped` and `invalidSkipped`. Call
`campaigns.get(id)` for the campaign itself. A sent campaign's status is
`completed`; `sent` and `paused` are in `CampaignStatus` but never returned.

## Contacts & Lists

```typescript
// Contacts
const contact = await sendly.contacts.create({
  phoneNumber: '+15125550123',
  name: 'Jordan Reed',
  email: 'jordan@acme.example',
  metadata: { plan: 'pro' },
});
const { contacts, total } = await sendly.contacts.list({ search: 'jordan', limit: 50 });
await sendly.contacts.update(contact.id, { name: 'Jordan R.' });
await sendly.contacts.delete(contact.id);

// Bulk import
const imported = await sendly.contacts.import({
  contacts: [
    { phone: '+15125550123', name: 'Sam', optedInAt: '2026-05-01T12:00:00Z' },
    { phone: '+15125550124', name: 'Alex' },
  ],
  listId: 'lst_xxx',
});
console.log(imported.imported, imported.skippedDuplicates, imported.errors);

// Lists
const list = await sendly.contacts.lists.create({ name: 'VIPs' });
const { addedCount } = await sendly.contacts.lists.addContacts(list.id, [contact.id]);
await sendly.contacts.lists.removeContact(list.id, contact.id);
const { lists } = await sendly.contacts.lists.list();
```

### List health

Contacts that fail with a terminal bad-number error, or that a carrier lookup
reports as non-SMS-capable, are flagged with an `invalidReason`
(`landline`, `invalid_number`, `non_sms_capable`) and skipped by future
campaigns. Clear a flag you disagree with — the clearance survives later
lookups.

```typescript
// Run a carrier lookup (asynchronous; watch contacts.lookup_completed)
await sendly.contacts.checkNumbers({ listId: 'lst_xxx', force: false });

// Clear flags, one or in bulk (ids OR listId, never both; max 10,000 ids)
await sendly.contacts.markValid('cnt_xxx');
const { cleared } = await sendly.contacts.bulkMarkValid({ listId: 'lst_xxx' });
```

## Conversations, Labels & Drafts

Inbound replies are threaded per phone number. Conversations carry unread
counts, tags, labels, and an AI reply suggester.

```typescript
// List and read threads
const { data: conversations, pagination } = await sendly.conversations.list({ status: 'active' });
const thread = await sendly.conversations.get(conversations[0].id, {
  includeMessages: true,
  messageLimit: 50,
});
console.log(thread.unreadCount, thread.messages?.data.length);

// Reply, then housekeeping
await sendly.conversations.reply(thread.id, { text: 'On our way!' });
await sendly.conversations.markRead(thread.id);
await sendly.conversations.close(thread.id);
await sendly.conversations.reopen(thread.id);
await sendly.conversations.update(thread.id, { tags: ['vip'], metadata: { crmId: 'c_1' } });

// AI: suggested replies, and the thread packaged for your own model
const { suggestions } = await sendly.conversations.suggestReplies(thread.id);
const { context, tokenEstimate } = await sendly.conversations.getContext(thread.id);

// Labels
const label = await sendly.labels.create({ name: 'Billing', color: '#0B6E4F' });
await sendly.conversations.addLabels(thread.id, [label.id]);
await sendly.conversations.removeLabel(thread.id, label.id);
const { data: labels } = await sendly.labels.list();

// Drafts — queue a reply for a human to approve
const draft = await sendly.drafts.create({ conversationId: thread.id, text: 'Proposed reply' });
await sendly.drafts.update(draft.id, { text: 'Better reply' });
await sendly.drafts.approve(draft.id);      // sends it
await sendly.drafts.reject(draft.id, 'Wrong tone');
const { data: drafts } = await sendly.drafts.list({ status: 'pending' });

// Auto-label rules — label or close threads by AI intent/sentiment
await sendly.rules.create({
  name: 'Escalate angry complaints',
  conditions: { intent: 'complaint', sentiment: 'negative', sentimentConfidenceMin: 0.8 },
  actions: { addLabels: [label.id], closeConversation: false },
});
const { data: rules } = await sendly.rules.list();
```

## Media (MMS)

Upload a file, then attach its URL to a message. On SMS/MMS, `mediaUrls` only
accepts URLs returned by `media.upload()` (max 10 per message); any other URL is
refused with `invalid_request`.

```typescript
import { readFileSync } from 'node:fs';

const media = await sendly.media.upload(readFileSync('photo.jpg'), {
  filename: 'photo.jpg',
  contentType: 'image/jpeg',
});
console.log(media.id, media.url, media.sizeBytes);

await sendly.messages.send({
  to: '+15125550123',
  text: 'Check this out!',
  mediaUrls: [media.url],
});
```

## Business Upgrade (toll-free entity upgrade)

Move a workspace onto a properly registered business entity: pre-flight the
candidate details, start the upgrade (which reserves a new toll-free number and
submits it for carrier review), then follow it. The workspace is addressed by
its id (a UUID).

```typescript
const workspaceId = '9b2f4c1e-7d3a-4e5b-8c6f-0a1b2c3d4e5f';

// The preflight checks only what you pass; it fills nothing in from the
// workspace's record. Pass every field the upgrade will use (address,
// contact, use case, useCaseSummary, additionalInformation, ...), or the
// verdict is 'blocked' for the missing ones.
const report = await sendly.businessUpgrade.preflight({
  businessName: 'Acme Holdings LLC',
  brn: '12-3456789',
  brnType: 'EIN',
  brnCountry: 'US',
  entityType: 'PRIVATE_PROFIT',
});
console.log(report.verdict); // 'ready', 'warnings' or 'blocked'
for (const issue of report.issues) console.log(issue.field, issue.message);

const started = await sendly.businessUpgrade.start(
  workspaceId,
  {
    businessName: 'Acme Holdings LLC',
    brn: '12-3456789',
    brnType: 'EIN',
    brnCountry: 'US',
    entityType: 'PRIVATE_PROFIT',
  },
  { einDoc: { buffer: pdfBuffer, filename: 'ein.pdf' } },
);
console.log(started.pendingVerificationId, started.status); // ..., 'provisioning'

// The new number and verification are set up in the background: poll status
const { pending } = await sendly.businessUpgrade.status(workspaceId);
console.log(pending?.status, pending?.tollFreeNumber, pending?.rejectionReason);
await sendly.businessUpgrade.cancel(workspaceId);
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
const link = await sendly.links.create({ url: 'https://acme.example/welcome' });
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

// Poll until the brand is verified (or failed, with failureReasons). It can
// pass through awaiting_review (Sendly reviews it first), changes_requested
// and provisioning before the carriers see it as pending.
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

  // Poll until carriers approve. "awaiting_review" means Sendly reviews it
  // first; "changes_requested" comes with a reviewNote saying what to change.
  const { data: approved } = await sendly.tenDlc.getCampaign(campaign.id);
  console.log(approved.status); // "pending" -> "active"
  if (approved.status === 'changes_requested') console.log(approved.reviewNote);
  console.log(approved.throughput?.tier); // e.g. "Standard"

  // 3. Assign a number you own — it can send once the assignment is Active
  const { data: assignment } = await sendly.tenDlc.assignNumber(
    campaign.id,
    '+15125550123',
  );
  console.log(assignment.status); // "Under review" -> "Active"
}

// List everything
const { data: brands } = await sendly.tenDlc.listBrands();
const { data: campaigns } = await sendly.tenDlc.listCampaigns();
const { data: assignments } = await sendly.tenDlc.listAssignments();
```

## Short Codes

A short code is a 5 or 6 digit US sender, not a separate channel — sends bill
as ordinary SMS credits. Getting one is an application, not a purchase: you
fill it in, Sendly reviews it, the carrier forms are signed, Sendly files them,
and each carrier certifies the code separately (an 8-12 week clock). The digits
are assigned at the end, so `shortCode` is `null` until then.

Reads need the `short_codes:read` scope and writes `short_codes:write`. There
is no `create` method — the first `update()` creates the application, and a
workspace has at most one open application at a time.

```typescript
// Where the application stands, what it still needs, and the price
const view = await sendly.shortCodes.application.get();
console.log(view.application.reviewStatus);   // 'draft'
console.log(view.quote.setupCents, view.quote.monthlyCents, view.quote.minimumTermMonths); // 99900, 115000, 3
console.log(view.billing?.setupFee.status);   // 'unpaid' until you submit
console.log(view.billing?.lease.state);       // 'not_started' until the code goes live
console.log(view.missingDocuments);           // carrier forms still outstanding
console.log(view.verification?.state);        // the business verification it needs
for (const c of view.carriers.byCarrier ?? []) console.log(c.label, c.status);
if (!view.editable) console.log(view.lockMessage);

// Save answers (creates the application on the first call). Fields Sendly or
// the carriers own — the digits, status, review state — are ignored and named
// back in ignoredFields.
await sendly.shortCodes.application.update({
  useCase: 'Delivery alerts for Acme orders',
  optInFlow: 'Customers tick a box at checkout on acme.example',
  messageFrequency: '4 messages per month',
  sampleMessages: ['Acme: order #4821 is out for delivery. Reply STOP to opt out.'],
  helpResponse: 'Acme: email help@acme.example for support.',
  stopConfirmation: 'You are unsubscribed from Acme alerts.',
  privacyPolicyUrl: 'https://acme.example/privacy',
  termsUrl: 'https://acme.example/terms',
  codeType: 'random',      // or 'vanity' (costs more, subject to availability)
  orderType: 'new',        // or 'migration' from another provider
});

// Dry-run the carrier rules without changing anything. Unsaved answers can be
// passed in and are checked on top of what is saved.
const { ok, issues } = await sendly.shortCodes.application.check();
for (const issue of issues) console.log(issue.path, issue.message);

// Submit to Sendly for review. This charges the one-time $999 setup fee to the
// workspace's card on file, so it needs acceptTerms: the fee now, the monthly
// lease from go-live and the 3-month minimum. Submitting twice is safe and
// charges once.
try {
  const submitted = await sendly.shortCodes.application.submit({ acceptTerms: true });
  console.log(submitted.application.reviewStatus); // 'awaiting_review'
  console.log(submitted.payment);                  // { status: 'paid', charged: true }
} catch (err) {
  if (err instanceof SendlyError && err.code === 'payment_requires_authentication') {
    console.log('Confirm the payment at', err.response?.checkoutUrl);
  } else throw err;
}

// The codes leased to the workspace
const { shortCodes } = await sendly.shortCodes.list();
const sendable = shortCodes.filter((code) => code.status === 'active');
console.log(shortCodes.map((code) => `${code.shortCode ?? 'pending'}: ${code.status} (${code.reviewStatus})`));
for (const code of shortCodes) {
  const pastDue = code.billing?.lease.pastDue;
  if (pastDue) console.log(code.shortCode, 'owes', pastDue.amountCents, 'sending pauses', pastDue.pauseAt);
}
```

Review states move `draft` → `awaiting_review` → `approved_for_filing` →
`filed`, with `changes_requested` bouncing it back to you (editable again) and
`rejected` ending it. The code itself is `requested`, then `provisioning`,
`parked` (leased, not yet certified), `active` — the only status that can send —
and `suspended` or `cancelled`.

Refusals: `short_codes_not_enabled` (404) when short codes are not switched on
for the account, `short_code_locked` (409) once the application is with Sendly
or the carriers, and `short_code_invalid_application` (422) with an `errors`
array naming every field, including `acceptTerms`. Submit answers 402 when the
setup fee can't be charged, and the application stays a draft:
`payment_method_required` (no card on file), `payment_failed` (declined) or
`payment_requires_authentication` (the bank wants it confirmed; open
`error.response.checkoutUrl`). `short_code_payment_in_progress` (409) means
another payment is still running.

The lease is charged to the card monthly from the day the code goes live, with
a 3-month minimum; `billing.lease` says where it stands. The
`short_code.action_required`, `short_code.filed`, `short_code.rejected`,
`short_code.live`, `short_code.suspended`, `short_code.reactivated`,
`short_code.payment_succeeded` and `short_code.payment_failed` webhooks track it
without polling.

## WhatsApp

Connect a number you own to WhatsApp ($19 one-time, no monthly fee), create
Meta-reviewed message templates, and send on the `whatsapp` channel.
Connecting the first number always ends with a human step: hand the
`connectUrl` to your user - they open it in a browser and log in with
Facebook to link their WhatsApp Business Account. Further numbers can join
that account by code, without Facebook. Free-form text and media only deliver inside an open 24-hour
window (the recipient messaged you in the last 24h); an approved template
works anytime.

Sends go through `messages.send` with `channel: "whatsapp"` and need
`sms:send`, not `whatsapp:write`. Reads (`signup.get`, templates, the window,
senders, sender profiles and conversational components) need `whatsapp:read`
and accept test keys. Signup (with `verify` and `resend`), template
create/edit/delete and sender edits (profile, photo, conversational
components, calling) need `whatsapp:write` and a live key (otherwise 403
`whatsapp_requires_live_key`). Sends need a live key too. In a team
workspace, connecting and sender edits need an owner or admin
(`settings:write`), and template writes need an owner, admin or member
(`templates:write`). A missing role returns 403 `insufficient_permissions`.

WhatsApp is enabled per person: the user who owns the API key, not the
workspace. While it is off, sends return 403 `whatsapp_not_enabled` and the
`/api/v1/whatsapp/*` management routes return 404 `not_found`.

```typescript
// 1. Connect a number (a person must finish the connect URL in a browser)
const signup = await sendly.whatsapp.signup.create({
  phoneNumber: '+15125550123',
});
console.log(`Open ${signup.connectUrl} and log in with Facebook`);
// ...poll sendly.whatsapp.signup.get(signup.id) until status === 'active'.
// After the Facebook step it stays 'registering' while WhatsApp activates the
// number. Activation usually takes a few minutes but can take hours. If it
// hasn't finished about 6 hours after the session began, the session fails
// with registration_timeout and the fee is refunded. 'failed' comes with
// failureReasons. If the connection fails, the $19 fee is refunded
// automatically; once a number has connected, a later disconnect gets
// nothing back.

// 2. Create a template (Meta reviews it, usually 24-48h). category is
// required (UTILITY, AUTHENTICATION or MARKETING) with no default, and an
// update can't change it.
const template = await sendly.whatsapp.templates.create({
  sender: '+15125550123',
  name: 'order_shipped',
  language: 'en_US',
  category: 'UTILITY',
  body: 'Hi {{1}}, your order {{2}} has shipped!',
  examples: { '1': 'Sam', '2': '#4821' },
});
// ...poll sendly.whatsapp.templates.list() until its status === 'APPROVED'
// (a rejected template should be edited with templates.update() and
// resubmitted - deleting locks its name for ~30 days). A `header` is fixed
// text: one containing {{n}} is refused with template_header_variable_unsupported.

// 3. Send - free-form inside an open 24h window, template anytime
const { open } = await sendly.whatsapp.window({
  from: '+15125550123',
  to: '+15125550142',
});
const message = open
  ? await sendly.messages.send({
      channel: 'whatsapp',
      to: '+15125550142',
      from: '+15125550123',
      text: 'Your table is ready!',
    })
  : await sendly.messages.send({
      channel: 'whatsapp',
      to: '+15125550142',
      from: '+15125550123',
      template: {
        name: 'order_shipped',
        language: 'en_US',
        variables: { '1': 'Sam', '2': '#4821' },
      },
    });
console.log(message.whatsapp.kind); // 'text' or 'template'

// Media with a caption (window-bound, one attachment per message)
await sendly.messages.send({
  channel: 'whatsapp',
  to: '+15125550142',
  from: '+15125550123',
  text: 'Here is the menu',
  mediaUrls: ['https://acme.example/menu.jpg'],
});

// List your connected senders
const { senders } = await sendly.whatsapp.senders.list();
for (const s of senders) {
  console.log(`${s.phoneNumber} (${s.displayName}) - ${s.status}`);
}

// Read and update a sender's business profile (what recipients see)
const profile = await sendly.whatsapp.senders.getProfile('+15125550123');
console.log(profile.displayName, profile.about);

await sendly.whatsapp.senders.updateProfile('+15125550123', {
  about: 'Fresh roasts daily',            // max 139 chars
  description: 'Small-batch coffee, roasted in-house every morning.', // max 512
  website: 'https://acme.example',
});

// Profile photo: a JPEG or PNG up to 5 MB, square, at least 192 px wide
await sendly.whatsapp.senders.uploadProfilePhoto(
  '+15125550123',
  fs.readFileSync('logo.png'),
  { contentType: 'image/png' },
);
await sendly.whatsapp.senders.deleteProfilePhoto('+15125550123');

// Ice breakers (up to 4) and "/" commands (up to 30). Each list you pass
// replaces the stored one; [] clears it.
await sendly.whatsapp.senders.updateConversationalComponents('+15125550123', {
  iceBreakers: ['What are your hours?', 'Book a table'],
  commands: [{ command: 'menu', description: "See today's menu" }],
});
const { iceBreakers, commands } =
  await sendly.whatsapp.senders.getConversationalComponents('+15125550123');

// Let WhatsApp users call the number. Calls must be on for the number first
// (voice_not_enabled otherwise); they ring like phone calls. There is no API
// for placing WhatsApp calls.
await sendly.whatsapp.senders.setCalling('+15125550123', { enabled: true });

// Add another number to an account you already connected: no Facebook step.
// Same $19 fee, refunded if it fails. WhatsApp sends the number a 6-digit code.
const account = senders.find((s) => s.status === 'active' && s.businessAccountId);
const added = await sendly.whatsapp.signup.create({
  phoneNumber: '+15125550124',
  businessAccountId: account!.businessAccountId!,
  verificationMethod: 'sms', // or 'voice'
});
// added.status === 'verifying'. signup.get() returns verificationCode once the
// text reaches the number; or enter the code yourself.
const pending = await sendly.whatsapp.signup.get(added.id);
if (pending.verificationCode) {
  await sendly.whatsapp.signup.verify(added.id, pending.verificationCode);
}
// No code? Ask again (30 seconds apart; leaving out the method sends a text)
await sendly.whatsapp.signup.resend(added.id, 'voice');
```

`senders.list()` items also carry `businessAccountId` (null while `pending`),
`businessName` (null while `pending`, or when the account has no business
name on file), `callingEnabled`, and `outboundCallingAllowed`, which is false
for +1, +20, +84 and +234 numbers. A signup that is `verifying` carries
`verificationMethod` and `verificationAttemptsRemaining`; after 5 wrong codes
it fails with `verification_failed` and the fee is refunded. Calls carry
`channel` (`phone`, `whatsapp` or `browser`).

`verificationCode` comes only from `signup.get()`. Until a code has been
submitted, it is the newest code that has arrived since the signup started, so
after a resend it still shows the earlier code until the new one arrives. Once
WhatsApp has checked a code, only a code that arrived after the last
submission or resend is returned. A submission answered with 502
`whatsapp_verification_unavailable` is not counted, so the same unchecked code
can come back, and submitting it again is safe.

Pricing: free-form text or media inside the 24-hour window costs 1 credit
each for the first 1,000 per sending number per calendar month (UTC), then
the destination's utility template price; countries without a listed price
use the default utility price of 12 credits. Templates are priced by category
and destination country; countries without a listed price use 33
(marketing), 12 (utility) and 12 (authentication) credits. A failed send
gives its slot back.

`sendly.whatsapp.window()` returns exactly `{ open, expiresAt }`. With no
window on record, `open` is false and `expiresAt` is null; after a window
has expired, `open` is false and `expiresAt` is the past expiry.

Refusals worth handling:

- `whatsapp_unavailable` (503): only `signup.create` returns it, while
  WhatsApp connections are temporarily unavailable. Nothing is charged; the
  body carries `retryAfter: 3600` (read it as `error.response.retryAfter`)
  and the response a `Retry-After: 3600` header. The SDK retries it like any
  `5xx` before throwing. No send returns it.
- `whatsapp_signup_limit_reached` (429): 5 failed, charged signups in 24
  hours. Final; try again the next day.
- `whatsapp_window_closed` (422): free-form text or media outside the 24-hour
  window. Send an approved template instead.
- `whatsapp_send_failed`: a `422` when WhatsApp refused the message (final;
  cached under the idempotency key and replayed for 24 hours), or a `502`
  when the message provably never reached the carrier, so it was not sent
  and is safe to send again. A `502` is never cached, and the SDK retries it
  with the same idempotency key.
- `whatsapp_send_unconfirmed` (409): the outcome is unknown. The message was
  marked failed and refunded but may still be delivered, so check before
  sending it again (it could arrive twice). It is not retried automatically.
- `whatsapp_not_enabled` (403) on sends while WhatsApp is off for the key's
  owner, and `whatsapp_requires_live_key` (403) for a test key on a send or
  a write.
- `whatsapp_sender_not_connected` (404) from `templates.create`, checked
  before anything else.
- `template_*` codes (400, thrown as a `SendlyError`) when `templates.create`
  or `update` fails its pre-flight checks: `template_category_invalid`
  (category missing or not one of the three),
  `template_authentication_otp_button_required`,
  `template_authentication_no_links` (a link in the body or a URL button on
  an authentication template) and `template_header_variable_unsupported`.
  A marketing template without an opt-out button only gets a warning.
- Profile photo: `file_required` and `whatsapp_profile_photo_invalid` (400),
  `whatsapp_profile_photo_too_large` (413), `whatsapp_profile_update_failed`
  (502). Conversational components: `invalid_request` (400) with the reason,
  `whatsapp_conversational_components_fetch_failed` and
  `whatsapp_conversational_components_update_failed` (502). Calling:
  `voice_not_enabled` (409), `whatsapp_calling_unavailable` (422, WhatsApp
  only allows calling once the account may message 2,000 people a day and
  the display name is approved), `whatsapp_calling_update_failed` (502).
- Adding a number by code: `whatsapp_business_account_not_found` (404),
  `display_name_required` (400), `whatsapp_signup_in_progress` and
  `whatsapp_already_enabled` (409), and `whatsapp_verification_start_failed`
  (422 refused, 502 unreachable; the fee is refunded either way). A Facebook
  `signup.create` for a number being added by code gets
  `whatsapp_verification_in_progress` (409). `verify`:
  `invalid_verification_code` (400, not 6 digits),
  `whatsapp_verification_code_invalid` (422, with
  `error.response.attemptsRemaining`), `whatsapp_verification_failed` (409,
  too many wrong codes), `whatsapp_verification_busy` (409, retry),
  `whatsapp_verification_unavailable` and `whatsapp_activation_pending`
  (502). `resend`: `whatsapp_verification_resend_too_soon` (429, wait
  `error.response.retryAfter` seconds) and
  `whatsapp_verification_resend_failed` (422 or 502). Both answer
  `signup_not_active` (409) once the signup stops waiting for a code, and
  `signup_not_found` (404). The SDK never retries a `5xx`, a timeout
  or a network error from `signup.create` with a `businessAccountId` or from
  `verify`; it retries `resend` like any other call.

## RCS

Send branded, verified-sender messages on Android: rich cards, suggestion
chips, and read receipts. Sending as your brand requires an RCS agent (the
verified identity recipients see). Registration is self-serve, from the
dashboard or the API: draft a brand and an agent, submit them for review
(Sendly reviews first, then the carrier network), test on invited devices,
then request launch. Text messages automatically fall back to SMS when the
recipient's device or network doesn't support RCS (billed as SMS; suggestion
chips are dropped); rich cards have no SMS form and respond 422 instead.
Sending requires a live API key.

### Registering an agent

Reads need the `rcs:read` scope and writes `rcs:write`. Every brand and
agent field is optional while drafting; required-field checks run at
`submit`, which lists each gap in `error.response.errors`. Logo, hero, and
call-to-action media must be public `https://` URLs - uploading assets is
dashboard-only. RCS registration is available to US businesses for now.

```typescript
// 1. Draft a brand - prefill it from business details already on file
const dossier = await sendly.rcs.dossier.get();
const { brand } = await sendly.rcs.brands.create({
  ...dossier.brand,
  displayName: 'Acme Coffee',
  legalName: 'Acme Coffee LLC',
  legalEntityType: 'LIMITED_LIABILITY_COMPANY',
  organizationType: 'PRIVATE_PROFIT',
  websiteUrl: 'https://acme.example',
  ein: '12-3456789',
  address: { line1: '100 Main St', city: 'Chicago', state: 'IL', postalCode: '60601', countryCode: 'US' },
  contact: { firstName: 'Sam', lastName: 'Lee', email: 'sam@acme.example', phoneNumber: '+13125550100' },
});

// 2. Draft the agent recipients will see
const { agent } = await sendly.rcs.agents.create({
  brandId: brand.id,
  displayName: 'Acme Coffee',
  useCase: 'MULTI_USE',
  basics: {
    description: 'Order updates and support for Acme Coffee customers',
    logoUrl: 'https://acme.example/rcs/logo.png', // public https URL
    heroUrl: 'https://acme.example/rcs/hero.png',
    brandColor: '#0B6E4F',
    privacyPolicyUrl: 'https://acme.example/privacy',
    termsAndConditionsUrl: 'https://acme.example/terms',
  },
});

// 3. Submit for review - an idempotency key means a retry never re-notifies reviewers
const { stage } = await sendly.rcs.agents.submit(agent.id, {
  idempotencyKey: `rcs-submit-${agent.id}`,
});
console.log(stage); // "in_review"

// Poll for progress: in_review -> brand_verification -> agent_review -> testing -> ...
const { agent: current } = await sendly.rcs.agents.get(agent.id);
console.log(current.customerStage, current.reviewNote);

// 4. Once the stage is 'testing': invite your devices and fill in the campaign
await sendly.rcs.agents.setTestDevices(agent.id, [
  { phoneNumber: '+13125550100', label: "Sam's Pixel" },
]);
await sendly.rcs.agents.update(agent.id, {
  campaign: {
    companyOverview: 'Acme Coffee runs 12 cafes and an online store.',
    agentOverview: 'Order confirmations, pickup alerts, and support replies',
    interactions: [{ interactionType: 'TRANSACTIONAL_UPDATES', description: 'Order status' }],
    messageExamples: [
      'Acme Coffee: order #4821 is being roasted. Reply STOP to opt out.',
      'Your order #4821 is ready for pickup!',
      'Thanks for visiting - reply HELP for support.',
    ],
    consentSettings: {
      optInMethods: [{ methodType: 'WEBSITE', description: 'Checkout checkbox' }],
      callToAction: 'Text me order updates',
      callToActionUrl: 'https://acme.example/checkout',
      callToActionMediaUrl: 'https://acme.example/rcs/opt-in.png',
      doubleOptIn: false,
      optInMessage: 'Welcome to Acme Coffee updates. Reply STOP to opt out.',
      helpResponse: 'Acme Coffee: email help@acme.example for support.',
      optOutResponse: 'You have been unsubscribed from Acme Coffee updates.',
    },
  },
});

// 5. Request launch - the agent can reach everyone once the stage is 'live'
await sendly.rcs.agents.requestLaunch(agent.id, { testUrl: 'https://acme.example/rcs-test' });

// Everything at a glance
const registration = await sendly.rcs.registration.get();
console.log(registration.stage, registration.agent?.displayName);
```

### Sending

```typescript
// Your registered agents ('testing' or 'approved' agents are sendable)
const { agents } = await sendly.rcs.agents.list();
console.log(agents[0].name, agents[0].status, agents[0].sendable);

// Optionally pre-flight a recipient (live carrier-backed probe)
const { capable, features } = await sendly.rcs.capability({
  to: '+15125550123',
});

// Text with suggestion chips - falls back to SMS for non-RCS recipients
const message = await sendly.messages.send({
  channel: 'rcs',
  to: '+15125550123',
  text: 'Your table is ready!',
  suggestions: [
    { reply: { text: 'On my way', postbackData: 'omw' } },
    { action: { text: 'View menu', postbackData: 'menu', url: 'https://acme.example/menu' } },
  ],
});

// The response tells you which leg delivered
if (message.channel === 'rcs') {
  console.log(message.rcs.agentName); // delivered over RCS
} else {
  console.log(message.fellBackTo);            // 'sms'
  console.log(message.rcs.suggestionsDropped); // true - chips have no SMS form
}

// Rich card (RCS-capable recipients only - no SMS form)
await sendly.messages.send({
  channel: 'rcs',
  to: '+15125550123',
  card: {
    title: 'Your order has shipped',
    description: 'Arriving Thursday',
    mediaUrl: 'https://acme.example/package.jpg', // public JPEG/PNG/GIF
    orientation: 'vertical',
    suggestions: [
      { action: { text: 'Track it', postbackData: 'track', url: 'https://acme.example/track' } },
    ],
  },
});

// Opt out of the SMS fallback to get a 422 for non-RCS recipients instead
await sendly.messages.send({
  channel: 'rcs',
  to: '+15125550123',
  text: 'Your table is ready!',
  fallbackToSms: false,
});
```

## Voice Calls

Place phone calls that one of your workspace's AI agents handles, follow
them while they ring and run, read the transcript, hang up early, and fetch
recordings. Reads need the `calls:read` scope and writes `calls:write`;
writes need a live API key. Destinations are US and Canadian numbers.

Calls are prepaid from your credit balance per started minute: an
agent-handled outbound call is 10 credits a minute (2 for the call, 8 for
the agent), and unanswered calls cost nothing. The `from` number must be
voice-enabled with an emergency address registered, in the dashboard (Calls →
Settings) or from code with [`sendly.voice.numbers`](#configure-voice);
`sendly.numbers.list()` shows `voiceEnabled` and `voiceMode` per number. Voice is being enabled workspace by workspace; until it is on
for yours, every call method responds `404 voice_not_enabled`.

```typescript
// Have an agent call someone (from is optional with one voice-enabled number)
const call = await sendly.calls.create({
  to: '+15125550142',
  agentId: '3c4d5e6f-7081-4293-a4b5-c6d7e8f90a1b',
  from: '+15125550123',
  context: 'You are calling Jordan to confirm the 3pm appointment on Tuesday.',
  metadata: { crmId: 'lead_8812' },
});
console.log(call.id, call.status); // "6f1c2d3e-...", "ringing"

// List calls, newest first, with filters and pagination
const { data, pagination } = await sendly.calls.list({
  status: 'completed',
  direction: 'outbound',
  limit: 20,
});
for (const c of data) {
  console.log(`${c.to} ${c.durationSecs}s ${c.creditsCharged} credits ${c.hangupClass}`);
}
if (pagination.hasMore) {
  await sendly.calls.list({ status: 'completed', limit: 20, offset: 20 });
}

// Retrieve a call; agent-handled calls include the transcript
const current = await sendly.calls.get(call.id);
for (const line of current.transcript ?? []) {
  console.log(`${line.speaker}: ${line.text}`);
}

// End a call early: ringing -> cancelled, active -> completed
await sendly.calls.hangup(call.id);

// Fetch the recording (Ogg/Opus). The signed URL is valid for five minutes.
// Agent calls are stereo: the agent on the left channel, the other party on the right.
const recording = await sendly.calls.recording(call.id);
if (recording.status === 'ready') {
  console.log(recording.url, recording.expiresAt); // audio/ogg
}
```

Refusals come back as `SendlyError` with a code: `agent_not_found` (404),
`agent_disabled` (409), `from_number_required` (400), `e911_required` (428,
register an emergency address first), `lines_busy` (409, retry shortly),
`daily_call_limit` (429), and `call_not_found` (404). A balance below one
minute at the agent rate throws `InsufficientCreditsError`. The
`call.started`, `call.completed` and `call.recording.ready` webhooks carry
the same call as a snake_case object (see [Lifecycle Events](#lifecycle-events)).

### Configure voice

Set up everything a call depends on from code: switch voice on for a number
and choose how it answers, register its emergency address, and create the AI
agents that talk. `sendly.voice` uses the same `calls:read` and `calls:write`
scopes, and writes need a live API key. In a team workspace, changing a
number or its emergency address needs a role that can change settings, and
managing agents needs a role that can manage API keys (each agent holds its
own scoped sending key); otherwise the API responds `403 forbidden`. Address
a number by its id or its E.164 phone number.

```typescript
// Pick a voice, then create an agent
const { data: voices } = await sendly.voice.voices.list();
console.log(voices.map((v) => `${v.id}: ${v.label}`)); // ["ashley: Ashley (US, warm)", ...]

const agent = await sendly.voice.agents.create({
  name: 'Front desk',
  voice: 'ashley',
  greeting: 'Thanks for calling Acme, how can I help?',
  instructions: 'Answer questions about opening hours and take a message for anything else.',
  tools: { sendSms: true },
});
console.log(agent.id, agent.canSendSms); // "3c4d5e6f-...", true

// Change only what you pass; tools keys you leave out keep their values
await sendly.voice.agents.update(agent.id, {
  greeting: 'Thanks for calling Acme. How can I help today?',
});

// Register the emergency address: required before a US or Canadian number
// can place calls, and $1.50 a month
await sendly.voice.numbers.registerEmergencyAddress('+15125550123', {
  street: '500 Example Ave',
  unit: 'Suite 2',
  city: 'Austin',
  state: 'TX',
  zip: '78701',
});

// Switch voice on and have the agent answer real callers
const number = await sendly.voice.numbers.update('+15125550123', {
  voiceEnabled: true,
  voiceMode: 'agent',
  agentId: agent.id,
});
console.log(number.voiceMode, number.ratePerMinute); // "agent", { inbound: 2, outbound: 2, agent: 10 }

// Ring the team in the dashboard instead, or switch voice off
await sendly.voice.numbers.update(number.id, { voiceMode: 'ring_dashboard' });
await sendly.voice.numbers.update(number.id, { voiceEnabled: false });

// Every number and agent in the workspace
const { data: numbers } = await sendly.voice.numbers.list();
const { data: agents } = await sendly.voice.agents.list();

// Delete an agent once no number answers with it; its sending key is revoked
await sendly.voice.agents.delete(agent.id);
```

Sent without `voiceEnabled`, `voiceMode: 'ring_dashboard'` or `'agent'`
switches voice on, with the same refusals as `voiceEnabled: true`, and
`'none'` switches it off; `voiceEnabled: false` always switches voice off. An
unknown voice id falls back to the default voice. Agents can't transfer calls yet:
with `tools.transferTo` set, a caller who asks for a person is told the
message will be passed on and the agent takes their name and number.

Refusals: `number_not_found` and `agent_not_found` (404); `invalid_request`
(400, thrown as `ValidationError`), `invalid_voice_mode`, `agent_required` and
`e911_not_applicable` (400); `agent_disabled` (409, switch the agent on
first); `agent_limit` (409, 20 agents per workspace); `agent_in_use` (409,
`error.response.numbers` lists the numbers the agent still answers);
`invalid_address` (400 for a missing or malformed field, 422 when the address
couldn't be validated, with a corrected one in `error.response.suggested`
when found); `voice_attach_failed` (502, try again); `carrier_refused` (502,
try again, unless the message says the number couldn't be found for emergency
registration: contact support); and `voice_unavailable` (503).

## Error Handling

The SDK provides typed error classes for different error scenarios:

```typescript
import Sendly, {
  SendlyError,
  AuthenticationError,
  RateLimitError,
  InsufficientCreditsError,
  ValidationError,
  NotFoundError,
  NetworkError,
  TimeoutError
} from '@sendly/node';

const sendly = new Sendly('sk_live_v1_xxx');

try {
  await sendly.messages.send({
    to: '+15125550123',
    text: 'Hello!'
  });
} catch (error) {
  if (error instanceof AuthenticationError) {
    console.error('Invalid API key:', error.message);
  } else if (error instanceof RateLimitError && error.code === 'too_many_failed_key_attempts') {
    console.error(`Locked out after repeated wrong API keys. Fix the key; the lockout ends in ${error.retryAfter} seconds`);
  } else if (error instanceof RateLimitError) {
    console.error(`Rate limited. Retry after ${error.retryAfter} seconds`);
  } else if (error instanceof InsufficientCreditsError) {
    console.error(`Not enough credits. Need ${error.creditsNeeded}, have ${error.currentBalance}`);
  } else if (error instanceof ValidationError) {
    console.error('Invalid request:', error.message);
  } else if (error instanceof NotFoundError) {
    console.error('Resource not found:', error.message);
  } else if (error instanceof TimeoutError) {
    console.error('Timed out after the configured timeout');
  } else if (error instanceof NetworkError) {
    console.error('Could not reach the API:', error.message);
  } else if (error instanceof SendlyError) {
    console.error(`API error [${error.code}]:`, error.message);
  } else {
    throw error;
  }
}
```

Every class above extends `SendlyError`, so a single `instanceof SendlyError`
catches the lot. `SendlyError` carries `code` (machine-readable),
`statusCode`, and `response` (the raw error body, including `errors[]` field
detail on validation failures such as `rcs_invalid_content`). `NetworkError`
and `TimeoutError` are raised by the client, not the API, and carry no
`statusCode`.

When the API answers with only a sentence (`{ "error": "sourceWorkspaceId is required" }`),
that sentence is the error's `message` and `code` comes from the status:
`invalid_request` (400 and 422, a `ValidationError`), `unauthorized`,
`insufficient_credits`, `forbidden`, `not_found` (a `NotFoundError`),
`conflict`, `rate_limit_exceeded`, otherwise `internal_error`.
`error.response` keeps the body as the API sent it. `validation_error` and
`invalid_code` errors are `ValidationError`s too. `SendlyErrorCode` accepts any
string, so a `switch` over `error.code` needs a `default` branch.

The SDK also validates locally before a request leaves: a malformed E.164
number, an empty message, a bad sender ID, a `limit` outside 1-100, a
malformed message/webhook/delivery id, or an id that is empty, `.` or `..`
(which would otherwise send the request to a different endpoint) throws
without a round trip. One error you may not expect is `invalid_response`: it
means something other than the Sendly API answered (a wrong `baseUrl`, a
proxy, a captive portal), and it is never retried.

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

const failed = await sendly.messages.send({
  to: SANDBOX_TEST_NUMBERS.INVALID,  // +15005550001 - resolves with status 'failed'; nothing is thrown
  text: 'Test message'
});
console.log(failed.status); // 'failed'
```

### Available Test Numbers

| Number | Behavior |
|--------|----------|
| `+15005550000` | Succeeds: status `delivered` |
| `+15005550001` | Fails: status `failed`, error "Invalid phone number" |
| `+15005550002` | Fails: status `failed`, error "Cannot route to destination" |
| `+15005550003` | Fails: status `failed`, error "Queue full, try again later" |
| `+15005550004` | Fails: status `failed`, error "Rate limit exceeded" |
| `+15005550006` | Fails: status `failed`, error "Carrier violation" |

The send itself resolves for every number (nothing is thrown); read the error
text from `sendly.messages.get(id)`.

## Message Status

| Status | Description |
|--------|-------------|
| `queued` | Message is queued for delivery |
| `sent` | Message was sent to carrier |
| `delivered` | Message was delivered |
| `read` | Recipient read it (RCS and WhatsApp only; SMS never reports one) |
| `failed` | Message delivery failed |
| `bounced` | Carrier rejected the message |
| `retrying` | A failed send is being retried |

The union is exported as `MessageStatus`. There is no `sending` status.

## Pricing Tiers

1 credit is $0.01, so the credit count is the per-segment price in cents.

| Tier | Example countries | Credits per SMS |
|------|-------------------|-----------------|
| Domestic | US, CA | 2 |
| Tier 1 | GB, AU, PL, SE, BR | 8 |
| Tier 2 | FR, JP, IT, IN, ES | 12 |
| Tier 3 | DE, NL, MX, BE | 16 |
| Tier 4 | UA, VN, PA, GE | 24 |
| Tier 5 | IL, MY, PH, ID | 48 |

A multi-segment message costs its tier's rate per segment, and enterprise
accounts can hold per-country or per-tier overrides, so the authoritative figure
for a specific send is the one `previewBatch()` returns.

The constants bundled with this package are a stale snapshot of that table: they
carry three tiers and 50 countries, and some countries sit in the wrong one
(India is listed under `tier1` but the API prices it at tier 2). Use them for a
rough domestic/international split, not to price a send.

```typescript
import { CREDITS_PER_SMS, SUPPORTED_COUNTRIES } from '@sendly/node';

console.log(CREDITS_PER_SMS.domestic); // 2 (US/Canada)
console.log(CREDITS_PER_SMS.tier1);    // 8
console.log(CREDITS_PER_SMS.tier2);    // 12
console.log(CREDITS_PER_SMS.tier3);    // 16

console.log(SUPPORTED_COUNTRIES.domestic); // ['US', 'CA']
console.log(SUPPORTED_COUNTRIES.tier1);    // ['GB', 'PL', 'PT', 'RO', 'CZ', ...]

// Every country in the bundled snapshot, flattened
import { ALL_SUPPORTED_COUNTRIES } from '@sendly/node';
console.log(ALL_SUPPORTED_COUNTRIES.length); // 50
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
validatePhoneNumber('+15125550123'); // OK
validatePhoneNumber('555-1234'); // Throws ValidationError

// Get country from phone number
getCountryFromPhone('+447700900123'); // 'GB'
getCountryFromPhone('+15125550123');  // 'US'

// Check if country is supported
isCountrySupported('GB'); // true
isCountrySupported('XX'); // false

// Estimate SMS segments
calculateSegments('Hello!'); // 1
calculateSegments('A'.repeat(200)); // 2
```

`calculateSegments` is an estimate: it treats any non-ASCII character as
needing UCS-2 (70 characters a segment) and does not count GSM-7 extension
characters twice. What you are billed for is the `segments` on the message
the API returns, and `creditsNeeded` from `previewBatch()` before a send.

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

- `messages` - Messages, MMS, group MMS, scheduling, batch, AI enhance
- `conversations` - Inbound threads, replies, AI suggestions
- `labels` - Conversation labels
- `drafts` - Reply drafts awaiting approval
- `rules` - Auto-label rules
- `webhooks` - Webhook endpoints, deliveries, replay and backfill
- `account` - Account, credits, API keys
- `verify` - OTP verification, plus `verify.sessions` (hosted flow)
- `templates` - Message templates
- `campaigns` - Bulk campaigns
- `contacts` - Contacts, plus `contacts.lists`
- `media` - Media upload for MMS
- `enterprise` - Workspaces, provisioning, analytics, billing
- `businessUpgrade` - Toll-free entity-upgrade flow
- `numbers` - Search, buy, update and release phone numbers
- `tenDlc` - 10DLC brands, campaigns, number assignments
- `shortCodes` - Short code application and leased codes
- `links` - Branded short links
- `whatsapp` - Signup, senders, templates, 24-hour window
- `rcs` - Brands, agents, registration, capability
- `calls` - Voice calls handled by AI agents
- `voice` - Voice configuration resource (numbers, agents, voices)

#### Methods

- `isTestMode()` - Returns `true` if using a test API key
- `getRateLimitInfo()` - Returns rate limit info from the most recent request
- `getBaseUrl()` - Returns configured base URL

### `sendly.messages`

#### `send(request: SendMessageRequest): Promise<Message>`

Send an SMS message.

#### `list(options?: ListMessagesOptions): Promise<MessageListResponse>`

List sent messages, filtered by `status`, with `pagination`.

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

#### `sendBatch(request: BatchMessageRequest, options?: IdempotentRequestOptions): Promise<BatchSendResponse>`

Send up to 10,000 messages in one API call. A live batch usually returns while still `processing`; `getBatch` has the outcome.

#### `previewBatch(request: BatchMessageRequest): Promise<BatchPreviewResponse>`

Dry-run a batch: what it costs, what is blocked and why, and `canSend`.

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

Send a test event to a webhook. Throws a `ValidationError` when the endpoint does not accept it.

#### `rotateSecret(id: string): Promise<WebhookSecretRotation>`

Rotate webhook secret.

#### `getDeliveries(id: string, options?: { limit?: number; offset?: number; status?: DeliveryStatus }): Promise<WebhookDelivery[]>`

Get delivery history for a webhook, newest first.

#### `retryDelivery(webhookId: string, deliveryId: string): Promise<void>`

Retry a failed delivery.

#### `listEventTypes(): Promise<WebhookEventType[]>`

List the event types a webhook can subscribe to.

#### `listEventTypeDetails(): Promise<WebhookEventTypeDetail[]>`

List the event types with a description of each.

### `sendly.account`

#### `get(): Promise<Account>`

Get account information.

#### `getCredits(): Promise<Credits>`

Get credit balance.

#### `getCreditTransactions(options?: { limit?: number; offset?: number; type?: string }): Promise<CreditTransaction[]>`

Get credit transaction history, newest first, optionally of one `type`.

#### `listApiKeys(): Promise<ApiKey[]>`

List API keys.

#### `getApiKey(id: string): Promise<ApiKey>`

Get an API key by ID.

#### `getApiKeyUsage(id: string): Promise<ApiKeyUsage>`

Get usage statistics for an API key.

#### `createApiKey(name: string, options?: { type?: 'test' | 'live'; scopes?: string[]; expiresAt?: string }): Promise<{ apiKey: ApiKey; key: string }>`

Create an API key (a test key unless `type` is `'live'`). The raw `key` is returned only once.

### `sendly.calls`

#### `create(request: CreateCallRequest, options?: IdempotentRequestOptions): Promise<Call>`

Place a phone call handled by an AI agent. Requires `calls:write` and a live key; returns the call while it rings.

#### `list(options?: ListCallsOptions): Promise<CallListResponse>`

List calls, newest first. Filters: `status`, `direction`, `kind`, `agentId`, `to`, `from`; pagination via `limit` (1-100) and `offset`.

#### `get(id: string): Promise<Call>`

Retrieve a call. Agent-handled calls include `transcript`.

#### `hangup(id: string, options?: IdempotentRequestOptions): Promise<Call>`

End a call. Ringing becomes `cancelled`, active becomes `completed`; an ended call is returned unchanged.

#### `recording(id: string): Promise<CallRecording>`

Fetch a call's recording status and, when `ready`, a signed `url` valid for five minutes. Agent calls are stereo: the agent on the left channel, the other party on the right.

### `sendly.voice`

#### `numbers.list(): Promise<VoiceNumberListResponse>`

List the workspace's active numbers with their voice settings, in the same order as the dashboard.

#### `numbers.get(number: string): Promise<VoiceNumber>`

Retrieve a number's voice settings by its id or E.164 phone number.

#### `numbers.update(number: string, request: UpdateVoiceNumberRequest, options?: IdempotentRequestOptions): Promise<VoiceNumber>`

Change `voiceEnabled`, `voiceMode` (`none`, `ring_dashboard` or `agent`) and `agentId`. Requires `calls:write` and a live key; turning voice on connects the number for calls, and `ring_dashboard` or `agent` sent without `voiceEnabled` turns it on.

#### `numbers.registerEmergencyAddress(number: string, request: RegisterEmergencyAddressRequest, options?: IdempotentRequestOptions): Promise<VoiceNumber>`

Register the number's emergency address (`street`, `unit`, `city`, `state`, `zip`, `country` defaulting to `US`). Required before a US or Canadian number places calls; $1.50 a month.

#### `agents.list(): Promise<VoiceAgentListResponse>`

List the workspace's AI agents with their call stats.

#### `agents.create(request: CreateVoiceAgentRequest, options?: IdempotentRequestOptions): Promise<VoiceAgent>`

Create an agent (up to 20 per workspace). Each agent gets its own scoped sending key.

#### `agents.get(id: string): Promise<VoiceAgent>`

Retrieve an agent.

#### `agents.update(id: string, request: UpdateVoiceAgentRequest, options?: IdempotentRequestOptions): Promise<VoiceAgent>`

Change any subset of the create fields; `tools` keys you leave out keep their values.

#### `agents.delete(id: string, options?: IdempotentRequestOptions): Promise<DeletedVoiceAgent>`

Delete an agent and revoke its sending key. Refused with `409 agent_in_use` while a number answers with it.

#### `voices.list(): Promise<VoiceListResponse>`

List the voices an agent can speak with.

## Enterprise

The Enterprise API lets you programmatically manage workspaces, verification, credits, and API keys for multi-tenant platforms. It requires an enterprise master key — an ordinary live key (`sk_live_v1_…`) that has been marked as your organization's master key in the dashboard; what distinguishes it is the flag on the key, not the prefix. A non-master key is refused with 403 `enterprise_required`, and a master key whose enterprise account is inactive with 403 `enterprise_inactive`. Master keys also get the higher rate limit of 3,000 requests a minute.

### Quick Provision

Create a fully configured workspace in a single call. Workspace ids are UUIDs:
the `workspace.id` that `provision()` or `workspaces.create()` returns.

```typescript
import Sendly from '@sendly/node';

const client = new Sendly('sk_live_v1_your_master_key');

const verifiedWorkspaceId = '3d1f8a2b-6c4e-4f7a-9b0d-2e5c7a9f1b3d'; // already verified
const fundingWorkspaceId = '7a9c2e4f-1b3d-4c5e-8f0a-6b8d0f2a4c6e';  // holds the credits

// Inherit verification from an existing workspace (fastest)
const result = await client.enterprise.provision({
  name: 'Acme Insurance - Austin',
  sourceWorkspaceId: verifiedWorkspaceId,
  creditAmount: 5000,
  creditSourceWorkspaceId: fundingWorkspaceId,
  keyName: 'Production',
  keyType: 'live',
  generateOptInPage: true
});

console.log(result.workspace.id);
console.log(result.key?.key);  // shown once
console.log(result.optInPage?.id, result.optInPage?.url);  // hosted opt-in page
```

A step that fails does not undo the others: `credits`, `optInPage`,
`legalPages`, `businessPage` and `webhook` each carry an `error` instead of
their fields when that step failed. A fresh `verification` needs `website`
only when you do not pass `generateBusinessPage: true`.

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
const detail = await client.enterprise.workspaces.get(ws.id);

// Provision up to 100 workspaces in one call
const bulk = await client.enterprise.workspaces.provisionBulk([
  { name: 'Acme Insurance - Dallas', sourceWorkspaceId: verifiedWorkspaceId },
  { name: 'Acme Insurance - Houston', sourceWorkspaceId: verifiedWorkspaceId, creditAmount: 1000, creditSourceWorkspaceId: fundingWorkspaceId },
]);
console.log(bulk.summary.succeeded, bulk.results.map((r) => `${r.name}: ${r.status}`));

// Delete a workspace. A workspace that still has phone numbers is refused
// with 409 workspace_has_numbers unless you ask for them to be released.
const dallas = bulk.results[0];
if (dallas.workspaceId) await client.enterprise.workspaces.delete(dallas.workspaceId, { releaseNumbers: true });
```

### Verification

```typescript
// Submit full verification
await client.enterprise.workspaces.submitVerification(ws.id, {
  businessName: 'Acme Insurance LLC',
  website: 'https://acme.example',
  entityType: 'PRIVATE_PROFIT',
  brn: '12-3456789',
  brnType: 'EIN',
  brnCountry: 'US',
  address: { street: '100 Main St', city: 'Austin', state: 'Texas', zip: '78701', country: 'US' },
  contact: { firstName: 'Jane', lastName: 'Doe', email: 'jane@acme.example', phone: '+15125550123' },
  useCase: 'Policy renewal reminders',
  sampleMessages: 'Your policy renews on 3/15.'
});

// Inherit from a verified workspace (shares its toll-free number)
const inherited = await client.enterprise.workspaces.inheritVerification(ws.id, {
  sourceWorkspaceId: verifiedWorkspaceId
});
console.log(inherited.status, inherited.tollFreeNumber);

// Or, instead of sharing the number: copy the business details, order the
// workspace its own toll-free number and submit the verification for it
const own = await client.enterprise.workspaces.inheritVerification(ws.id, {
  sourceWorkspaceId: verifiedWorkspaceId,
  purchaseNewNumber: true
});
console.log(own.newNumber, own.tollFreeNumber); // true, and the number ordered for it (null if none yet)

// Or the same at provisioning time
await client.enterprise.provision({
  name: 'Acme Insurance - Austin',
  sourceWorkspaceId: verifiedWorkspaceId,
  inheritWithNewNumber: true
});
```

`resubmitVerification` replaces `address` and `contact` as whole objects:
send every sub-field of one you change, or leave it out.

### Credits & API Keys

```typescript
// Transfer credits into ws from another workspace you own
await client.enterprise.workspaces.transferCredits(ws.id, {
  sourceWorkspaceId: fundingWorkspaceId,
  amount: 5000
});

// Create a workspace API key. name defaults to "API key" and scopes to every scope.
const key = await client.enterprise.workspaces.createKey(ws.id, {
  name: 'Production',
  type: 'live',
  scopes: ['sms:send', 'sms:read']
});
console.log(key.key); // shown once

// Revoke a key
await client.enterprise.workspaces.revokeKey(ws.id, key.id);
```

### Webhooks & Analytics

```typescript
// Register the enterprise webhook. Only the first registration returns the
// signing secret; later calls change the URL and filters and keep the secret.
const hook = await client.enterprise.webhooks.set({
  url: 'https://acme.example/webhooks',
  events: ['message.delivered', 'message.failed'], // omit for every event
  workspaces: [ws.id],                              // omit for every workspace
});
if (hook.signingSecret) console.log('Store this:', hook.signingSecret);

// Rotate the signing secret
const { secret } = await client.enterprise.webhooks.rotateSecret();

// Analytics
const overview = await client.enterprise.analytics.overview();
const messages = await client.enterprise.analytics.messages({ period: '30d' });
const delivery = await client.enterprise.analytics.delivery();
const credits = await client.enterprise.analytics.credits();
console.log(credits.totalBalance, credits.totalUsed, credits.workspaceCount);
```

Full enterprise docs: [sendly.live/docs/enterprise](https://sendly.live/docs/enterprise)

## Support

- 📚 [Documentation](https://sendly.live/docs)
- 💬 [Discord](https://discord.gg/sendly)
- 📧 [support@sendly.live](mailto:support@sendly.live)

## License

MIT
