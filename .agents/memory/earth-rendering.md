---
name: Earth logo rendering
description: Why the photographic interactive logo avoids a native GL renderer.
---
Use bundled photographic sphere-view atlases for the small interactive Earth logo.

**Why:** The user rejected illustrated SVG terrain in favor of a satellite-photo appearance. Pre-rendered sphere views preserve that appearance and rotation while remaining compatible with Expo Go and web without native GL dependencies.

**How to apply:** Preserve photographic terrain and cross-platform compatibility when improving its appearance. Do not revert to illustrated polygons or rotate a single flat photo like a wheel. Reconsider the renderer if a larger 3D experience is requested.