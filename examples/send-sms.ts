/**
 * Example: Sending SMS Messages
 *
 * Run with: npx ts-node examples/send-sms.ts
 */

import Sendly, { SANDBOX_TEST_NUMBERS } from '../src';

async function main() {
  // Initialize client with your API key
  const sendly = new Sendly(process.env.SENDLY_API_KEY || 'sk_test_v1_xxx');

  console.log(`Running in ${sendly.isTestMode() ? 'TEST' : 'LIVE'} mode\n`);

  // Example 1: Basic SMS
  console.log('1. Sending basic SMS...');
  const message1 = await sendly.messages.send({
    to: SANDBOX_TEST_NUMBERS.SUCCESS,
    text: 'Hello from Sendly! This is a test message.',
  });
  console.log(`   Message ID: ${message1.id}`);
  console.log(`   Status: ${message1.status}\n`);

  // Example 2: Transactional SMS (not held for quiet hours). The sender is
  // chosen for you; pass `from` only with a number you own.
  console.log('2. Sending transactional SMS...');
  const message2 = await sendly.messages.send({
    to: SANDBOX_TEST_NUMBERS.SUCCESS,
    text: 'Your verification code is: 123456',
    messageType: 'transactional',
  });
  console.log(`   Message ID: ${message2.id}`);
  console.log(`   From: ${message2.from} (${message2.senderType})\n`);

  // Example 3: Long message (multi-segment)
  console.log('3. Sending long message (multi-segment)...');
  const longText = 'This is a longer message that will be split into multiple segments. '.repeat(5);
  const message3 = await sendly.messages.send({
    to: SANDBOX_TEST_NUMBERS.SUCCESS,
    text: longText,
  });
  console.log(`   Message ID: ${message3.id}`);
  console.log(`   Text length: ${longText.length} characters`);
  console.log(`   Segments: ${message3.segments} (153 GSM-7 characters each)\n`);

  // Example 4: Check rate limit info
  console.log('4. Rate limit info:');
  const rateLimit = sendly.getRateLimitInfo();
  if (rateLimit) {
    console.log(`   Limit: ${rateLimit.limit} requests/minute`);
    console.log(`   Remaining: ${rateLimit.remaining}`);
    console.log(`   Resets in: ${rateLimit.reset} seconds\n`);
  }

  console.log('Done!');
}

main().catch(console.error);
