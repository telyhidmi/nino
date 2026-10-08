---
name: Creator AI boundaries
description: Consent, truthfulness, and browser constraints for AI content assistance.
---
Creator assistance must be user-triggered, with explicit disclosure before sending selected media previews and caption context. Suggestions never automatically replace text or publish a post.

**Why:** The user requested visual recognition and social captions, not background scanning or automatic posting.

**How to apply:** Disclose that video assistance sees sparse still frames, not audio or the full clip. Do not claim inferred recording countries or identities. Preserve manual posting when AI fails.

Browser decoders can stall on detached video elements even while an existing preview plays. Prefer a decoded preview or attached decoder, preserve playback state, and provide cancellation plus elapsed-time checks rather than relying only on timeout callbacks.

**Why:** Browser testing found that separate frame extraction stalled before any model request and that timers did not reliably reflect wall-clock time. Supported WebM eventually generated correct suggestions; unsupported H.264 failed locally.

**How to apply:** Treat codec support and frame extraction as separate from AI endpoint health. Test media decoding on physical devices before claiming native support is verified.
