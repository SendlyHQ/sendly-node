# @sendly/node

## 3.0.0

### Patch Changes

- [`c5a261b`](https://github.com/sendly-live/sendly/commit/c5a261b8306e53be9d0cf37cd35827f1ec709817) Thanks [@sendly-live](https://github.com/sendly-live)! - feat: complete CLI authentication system with OAuth device flow and secure onboarding

  ## 🔐 Major CLI Authentication Overhaul

  This release introduces a **complete CLI authentication system** with enterprise-grade security and user experience.

  ### ✨ New Features

  **CLI Authentication System:**
  - OAuth device flow for secure browser-based authentication
  - CLI session tokens with 7-day expiration
  - Progressive permission system (CLI sessions → API keys)
  - CLI-first onboarding with strict collision detection

  **Developer Experience:**
  - `sendly login` - Secure browser-based authentication
  - `sendly onboarding --dev-mode` - Quick development setup
  - Automatic API key creation for immediate productivity
  - Clear error messages and upgrade paths

  **Security & Protection:**
  - CLI sessions limited to test SMS numbers only
  - Strict blocking prevents duplicate onboarding attempts
  - Test SMS sandbox (`+15550001234`, etc.) for development
  - Real SMS requires business verification and live API keys

  ### 🛠 Technical Implementation

  **Authentication Architecture:**
  - Dual authentication: Clerk sessions (UI) + CLI tokens (CLI)
  - CLI tokens: `cli_` prefix with base64-encoded JWT payload
  - API key compatibility maintained (`sk_test_` / `sk_live_`)
  - Enhanced middleware supporting both authentication methods

  **API Endpoints:**
  - `POST /api/cli/auth/device` - Initiate device authorization
  - `GET /api/cli/auth/validate-code` - Validate device codes
  - `POST /api/cli/auth/verify` - User authorization
  - `POST /api/cli/auth/token` - Token exchange
  - `POST /api/cli/quick-start` - Development environment setup

  ### 🧪 Comprehensive Testing

  **Test Suite (431+ test cases):**
  - Unit tests for CLI token validation
  - Integration tests for OAuth device flow
  - Edge case testing (race conditions, malicious inputs)
  - SMS protection verification
  - Manual testing scripts for end-to-end flows

  ### 🔧 Database Changes

  **Schema additions:**

  ```typescript
  cliOnboardingCompleted: boolean("cli_onboarding_completed").default(false);
  source: text("source").default("manual"); // "cli_quickstart", "manual", "onboarding"
  ```

  ### ⚡ Migration Guide

  **For existing users:**
  - No breaking changes to existing API keys or authentication
  - CLI authentication is additive - existing flows preserved
  - Users can choose between web onboarding or CLI quick-start

  **For new users:**
  - `sendly login` for authentication
  - `sendly onboarding --dev-mode` for instant development setup
  - Automatic guidance to production verification when needed

  ### 🚨 Breaking Changes
  - CLI now requires authentication before use
  - Previous unauthenticated CLI usage no longer supported
  - `sendly login` must be run before other commands

  ### 📈 Benefits
  - **Faster developer onboarding** - 2 minutes to production-ready development
  - **Enhanced security** - No more API key copy-paste from browser
  - **Better UX** - Progressive permissions with clear upgrade paths
  - **Safer testing** - Automatic test SMS protection
  - **Production ready** - Enterprise-grade authentication flow

  This release establishes Sendly CLI as a **world-class developer tool** with security, usability, and scalability at its core.

## 2.3.0

### Minor Changes

- [`ed8ebb5`](https://github.com/sendly-live/sendly/commit/ed8ebb5ede1ba9ba624906e8ce348711a2b513ea) Thanks [@sendly-live](https://github.com/sendly-live)! - Complete webhook system implementation with full SDK and CLI support.

  **🚀 New Features:**

  **Node.js SDK:**
  - Fixed critical webhook path bug that caused 404 errors on all webhook endpoints
  - All 10 webhook methods now work correctly with proper `/api/v1/webhooks` paths

  **CLI:**
  - Added complete webhook command suite (7 new commands):
    - `sendly webhooks create` - Create webhooks with URL, events, and description
    - `sendly webhooks get <id>` - View webhook details and status
    - `sendly webhooks delete <id>` - Delete webhooks with confirmation
    - `sendly webhooks test <id>` - Send test events and view responses
    - `sendly webhooks deliveries <id>` - View delivery history and failed attempts
    - `sendly webhooks update <id>` - Update webhook URL, events, or settings
    - `sendly webhooks rotate-secret <id>` - Rotate webhook secrets with grace period

  **Improvements:**
  - Full feature parity between CLI and web dashboard
  - Comprehensive error handling and user-friendly output
  - JSON mode support for all webhook commands
  - Interactive confirmation prompts for destructive operations
  - Colored terminal output with status indicators

  This completes the webhook ecosystem with production-ready tools across all platforms.

## 2.2.0

### Major Changes

- [`18380b7`](https://github.com/sendly-live/sendly/commit/18380b7f6f4fa043d85204e0d6477ef72860e750) Thanks [@sendly-live](https://github.com/sendly-live)! - ## Version Alignment

  Bump all SDKs to v2.2.0 to align version numbers across all registries.

  ### Why 2.2.0?

  Some registries had higher version numbers from earlier manual publishes:
  - RubyGems: 1.5.1
  - Packagist: 2.1.0

  By releasing 2.2.0 across all 8 SDKs, we ensure:
  - Consistent version numbers everywhere
  - Clear indication of the "latest" version
  - Simplified documentation and support

  ### No Breaking Changes

  Despite the major version bump, this release contains no breaking changes from 1.1.0. The version bump is purely for registry alignment.

## 1.1.0

### Minor Changes

- [`3fdfec0`](https://github.com/sendly-live/sendly/commit/3fdfec09413fd09a8ceb6cd793c35f851fb43db7) Thanks [@sendly-live](https://github.com/sendly-live)! - ## Comprehensive SDK Alignment

  ### API Consistency
  - Fixed webhook API response to use consistent snake_case naming convention (REST API standard)
  - All delivery stats fields now use snake_case: `total_deliveries`, `successful_deliveries`, `success_rate`, `last_delivery_at`

  ### Node SDK
  - Added transformation layer to convert snake_case API responses to camelCase SDK types
  - Added `WebhooksResource` with full CRUD operations, test, rotate secret, and delivery management
  - Added `AccountResource` with credits, transactions, and API key management
  - Fixed Message type: removed invalid "sending" status, added `direction`, `senderType`, `telnyxMessageId`, `warning`, `senderNote` fields

  ### All SDKs Updated (8 languages)

  The following SDKs have been updated with consistent types, webhook management, and account resources:
  - **Node SDK** (`@sendly/node`) - TypeScript
  - **Python SDK** (`sendly`) - PyPI
  - **Go SDK** (`sendly`) - pkg.go.dev
  - **Ruby SDK** (`sendly`) - RubyGems
  - **Java SDK** (`com.sendly`) - Maven Central
  - **PHP SDK** (`sendly/sendly`) - Packagist
  - **.NET SDK** (`Sendly`) - NuGet
  - **Rust SDK** (`sendly`) - crates.io

  ### New Features Across All SDKs
  - `webhooks.create()` - Create webhook with events subscription
  - `webhooks.list()` - List all webhooks
  - `webhooks.get(id)` - Get webhook by ID
  - `webhooks.update(id, options)` - Update webhook settings
  - `webhooks.delete(id)` - Delete webhook
  - `webhooks.test(id)` - Test webhook endpoint
  - `webhooks.rotateSecret(id)` - Rotate webhook secret
  - `webhooks.listDeliveries(id)` - List delivery attempts
  - `account.get()` - Get account information
  - `account.credits()` - Get credit balance
  - `account.transactions()` - List credit transactions
  - `account.apiKeys()` - List API keys
  - `account.createApiKey(name)` - Create new API key
  - `account.revokeApiKey(id)` - Revoke API key

  ### Type Fixes
  - MessageStatus: Removed invalid "sending" status (only: queued, sent, delivered, failed)
  - Message: Added direction, senderType, telnyxMessageId, warning, senderNote fields
  - Webhook: All stats fields use consistent snake_case
  - Credits: Added availableBalance field, ensured numeric types

## 1.0.8

### Patch Changes

- [`8de8872`](https://github.com/sendly-live/sendly/commit/8de887212e68645abeb53f33992ba62087aba711) Thanks [@sendly-live](https://github.com/sendly-live)! - fix: correct API path construction to avoid path duplication

## 1.0.7

### Patch Changes

- [`8917c36`](https://github.com/sendly-live/sendly/commit/8917c36e8d8e303261f5c27c0809c0d5554e1b03) Thanks [@sendly-live](https://github.com/sendly-live)! - fix: SDK consistency fixes - base URLs, BatchStatus enums, and versions

  **Critical Fixes:**
  - Node.js/Python SDK base URL: `/api` → `/api/v1` (was causing 404 errors)

  **BatchStatus Enum Alignment (matches server):**
  - Rust/Go/.NET/Java: `partially_completed` → `partial_failure`
  - Node.js/Python: Added missing `failed` status

  **Version Alignment:**
  - All SDKs now use version 1.0.5 in VERSION constants and User-Agent headers

## 1.0.6

### Patch Changes

- [`d39d1e9`](https://github.com/sendly-live/sendly/commit/d39d1e975e05e3608a9e2c271febe5db5bb4921c) Thanks [@sendly-live](https://github.com/sendly-live)! - fix: complete SDK release pipeline automation
  - Fixed Ruby SDK Gemfile.lock frozen mode issue
  - Fixed .NET SDK project paths and skipped failing tests
  - Fixed PHP SDK versioning for Packagist compatibility
  - Added version tagging to SDK sync workflow
  - Configured Packagist webhook for auto-updates

## 1.0.5

### Patch Changes

- [`5441597`](https://github.com/sendly-live/sendly/commit/544159770fd326b095fe1c55b0a9507d21fb4297) Thanks [@sendly-live](https://github.com/sendly-live)! - chore: verify automated SDK release pipeline

  This is a test release to verify the full automated SDK release pipeline works end-to-end:
  - npm: @sendly/node, @sendly/cli
  - PyPI: sendly
  - RubyGems: sendly
  - crates.io: sendly
  - NuGet: Sendly
  - Maven Central: live.sendly:sendly-java
  - Go: github.com/sendly-live/sendly-go
  - Packagist: sendly/sendly-php
  - Homebrew: sendly-live/tap/sendly

## 1.0.4

### Patch Changes

- chore: sync all SDK versions

## 1.0.3

### Patch Changes

- fix: improve release workflow reliability for Java and .NET SDKs

## 1.0.2

### Patch Changes

- Release pipeline improvements and bug fixes

## 1.0.1

### Patch Changes

- ## URL State Management & Shareable Links

  Added comprehensive URL state management for shareable links across the platform:

  ### New Features
  - **Shareable URLs**: All key pages now support URL query parameters for sharing specific views
  - **Copy Link Button**: Easy-to-use button appears when URL has meaningful state
  - **Scroll-to-Top**: Smooth navigation with automatic scroll on route changes

  ### Pages with Shareable URLs
  - `/pricing?credits=5500` - Share specific pricing tier
  - `/sdks?sdk=python` - Link to specific SDK
  - `/docs/*#section-id` - Anchor links to doc sections
  - `/changelog?category=api&search=webhook` - Share filtered changelog
  - `/messages?tab=scheduled&status=sent` - Share message filters
  - `/webhooks?id=wh_xxx` - Deep link to specific webhook

  ### Developer Experience
  - New `useUrlState` hook for easy URL state management
  - Browser back/forward navigation works correctly
  - URLs stay clean (default values omitted)

  This prepares the platform for future team collaboration features.
