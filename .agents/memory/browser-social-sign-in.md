---
name: Browser social sign-in
description: Why web and native social-auth transports must stay separate.
---
Keep browser OAuth self-contained in a top-level tab; reserve Expo AuthSession for native flows.

**Why:** The embedded preview's popup callback failed to reconnect to its originating sign-in window. Cross-window state is not a reliable dependency in embedded browser contexts. Do not fix this by disabling redirect/state validation.

**How to apply:** Preserve Clerk's validated browser redirects when changing social auth. Browser checks verified Google initiation and orphan callback recovery, not a completed external-provider login or the embedded-preview handoff.