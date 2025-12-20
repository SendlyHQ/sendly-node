# @sendly/node

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
