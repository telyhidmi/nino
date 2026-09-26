---
name: Earth logo rendering
description: Why the interactive logo uses spherical SVG projection rather than a native GL renderer.
---
Use lightweight spherical projection for the small interactive Earth logo.

**Why:** The globe must work in Expo Go on iOS and Android as well as the web preview without adding native GL dependencies for a tiny decorative element.

**How to apply:** Preserve this compatibility when improving its appearance. Reconsider the renderer only if a larger, more detailed 3D experience is requested.