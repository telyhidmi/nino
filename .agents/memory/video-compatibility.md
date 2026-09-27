---
name: Video preview compatibility
description: Codec choice for bundled demo clips across native Expo and browser preview.
---
Keep browser-compatible WebM alternatives alongside H.264 MP4 demo clips.

**Why:** The preview Chromium rejected H.264 footage during video integration, while native playback needs a broadly supported mobile format.

**How to apply:** Check browser codec support before diagnosing a video failure as an Expo player issue; verify native and browser asset choices separately.