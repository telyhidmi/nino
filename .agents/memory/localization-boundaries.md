---
name: Localization boundaries
description: Interface translations must stay distinct from authored content and unavailable capabilities.
---

Translate interface labels, notices, accessibility text, and navigation, not user-authored or sample names, bios, captions, comments, or media attribution.

**Why:** The requested multilingual interface is not a content-translation service. Changing sample content with the app language would blur that distinction and could imply automatic translation or working live streams.

**How to apply:** Keep capability notices explicit about curated samples and unavailable features. When extending localization, preserve camera lifecycle and authentication behavior and check Arabic direction plus long-label wrapping separately from translation completeness.

Language selection must be optional at onboarding, with a supported device language as the initial default and saved manual choices respected. Continue must remain visible without scrolling through languages.

**Why:** The user said being required to choose a language and scroll down to continue was too difficult.

**How to apply:** Keep the language picker available for voluntary changes, but do not put it in the mandatory signup path. Scroll choices independently from the bottom action.