# @sendly/node

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
