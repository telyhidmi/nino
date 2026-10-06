---
name: Localization boundaries
description: Interface translations must stay distinct from authored content and unavailable capabilities.
---

Translate interface labels, notices, accessibility text, and navigation, not user-authored or sample names, bios, captions, comments, or media attribution.

**Why:** The requested multilingual interface is not a content-translation service. Changing sample content with the app language would blur that distinction and could imply automatic translation or working live streams.

**How to apply:** Keep capability notices explicit about curated samples and unavailable features. When extending localization, preserve camera lifecycle and authentication behavior and check Arabic direction plus long-label wrapping separately from translation completeness.