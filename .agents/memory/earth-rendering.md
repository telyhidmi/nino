---
name: Earth logo rendering
description: Why the photographic interactive logo avoids a native GL renderer.
---
Use bundled photographic sphere-view frames for the small interactive Earth logo.

**Why:** The user rejected illustrated SVG terrain in favor of a satellite-photo appearance. Pre-rendered sphere views preserve that appearance and rotation while remaining compatible with Expo Go and web without native GL dependencies.

**How to apply:** Preserve photographic terrain and cross-platform compatibility when improving its appearance. Do not revert to illustrated polygons or rotate a single flat photo like a wheel. Prefer individually sized image frames over negative-offset sprite-sheet clipping: the latter appeared in web preview but the user reported no Earth on their device, so web screenshots alone do not establish native visibility. Reconsider the renderer if a larger 3D experience is requested.