---
name: Browser social sign-in
description: Why web and native social-auth transports must stay separate.
---
Keep browser OAuth self-contained in a top-level tab; reserve Expo AuthSession for native flows.

**Why:** The embedded preview's popup callback failed to reconnect to its originating sign-in window. Cross-window state is not a reliable dependency in embedded browser contexts. Do not fix this by disabling redirect/state validation.

**How to apply:** Preserve Clerk's validated browser redirects when changing social auth. Browser checks verified Google initiation, browser-back/retry, disabled-provider rejection, and orphan callback recovery, not a completed external-provider login or the embedded-preview handoff.

Provider availability must follow each environment's Clerk configuration, not a shared hardcoded provider list.

**Why:** Apple was advertised in development even though Clerk allowed only Google. Development and production provider settings can differ; showing a button is not evidence that its provider is configured.

**How to apply:** Preserve configuration-driven filtering when changing auth UI. Never treat programmatic Clerk test login or a mocked callback as verification of external OAuth completion or signup transfer.