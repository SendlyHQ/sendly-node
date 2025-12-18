/**
 * Example: Error Handling
 *
 * Run with: npx ts-node examples/error-handling.ts
 */

import Sendly, {
  SendlyError,
  AuthenticationError,
  RateLimitError,
  InsufficientCreditsError,
  ValidationError,
  NotFoundError,
  SANDBOX_TEST_NUMBERS,
} from '../src';

async function main() {
  const sendly = new Sendly(process.env.SENDLY_API_KEY || 'sk_test_v1_xxx');

  // Example 1: Handle all error types
  console.log('1. Comprehensive error handling:\n');

  try {
    await sendly.messages.send({
      to: SANDBOX_TEST_NUMBERS.INVALID, // This will fail
      text: 'Test message',
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      // API key is invalid, revoked, or expired
      console.log('   Authentication Error:');
      console.log(`   Code: ${error.code}`);
      console.log(`   Message: ${error.message}`);
      console.log('   Action: Check your API key\n');
    } else if (error instanceof RateLimitError) {
      // Too many requests
      console.log('   Rate Limit Error:');
      console.log(`   Message: ${error.message}`);
      console.log(`   Retry after: ${error.retryAfter} seconds`);
      console.log('   Action: Wait and retry\n');
    } else if (error instanceof InsufficientCreditsError) {
      // Not enough credits to send
      console.log('   Insufficient Credits Error:');
      console.log(`   Credits needed: ${error.creditsNeeded}`);
      console.log(`   Current balance: ${error.currentBalance}`);
      console.log('   Action: Purchase more credits\n');
    } else if (error instanceof ValidationError) {
      // Invalid request (bad phone number, etc.)
      console.log('   Validation Error:');
      console.log(`   Code: ${error.code}`);
      console.log(`   Message: ${error.message}`);
      console.log('   Action: Fix the request\n');
    } else if (error instanceof NotFoundError) {
      // Resource not found
      console.log('   Not Found Error:');
      console.log(`   Message: ${error.message}`);
      console.log('   Action: Check the resource ID\n');
    } else if (error instanceof SendlyError) {
      // Generic Sendly error
      console.log('   Sendly Error:');
      console.log(`   Code: ${error.code}`);
      console.log(`   Status: ${error.statusCode}`);
      console.log(`   Message: ${error.message}\n`);
    } else {
      // Unknown error (network issue, etc.)
      throw error;
    }
  }

  // Example 2: Simple try-catch with error code check
  console.log('2. Simple error code check:\n');

  try {
    await sendly.messages.send({
      to: '+invalid',
      text: 'Test',
    });
  } catch (error) {
    if (error instanceof SendlyError) {
      switch (error.code) {
        case 'invalid_request':
          console.log('   Bad request - check your input');
          break;
        case 'unauthorized':
        case 'invalid_api_key':
          console.log('   Authentication failed');
          break;
        case 'insufficient_credits':
          console.log('   Need more credits');
          break;
        case 'rate_limit_exceeded':
          console.log('   Slow down!');
          break;
        default:
          console.log(`   Error: ${error.code}`);
      }
    }
  }

  console.log('\n3. Retry with backoff (rate limit):\n');

  async function sendWithRetry(
    to: string,
    text: string,
    maxRetries = 3
  ): Promise<void> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const message = await sendly.messages.send({ to, text });
        console.log(`   Success on attempt ${attempt}: ${message.id}`);
        return;
      } catch (error) {
        if (error instanceof RateLimitError && attempt < maxRetries) {
          console.log(`   Rate limited, waiting ${error.retryAfter}s...`);
          await new Promise((r) => setTimeout(r, error.retryAfter * 1000));
        } else {
          throw error;
        }
      }
    }
  }

  try {
    await sendWithRetry(SANDBOX_TEST_NUMBERS.SUCCESS, 'Hello!');
  } catch (error) {
    console.log(`   Failed after retries: ${error}`);
  }

  console.log('\nDone!');
}

main().catch(console.error);
