---
name: Video preview compatibility
description: Codec choice for bundled demo clips across native Expo and browser preview.
---
Select video formats using actual browser support, not a blanket web-versus-native assumption.

**Why:** An earlier preview run appeared to reject H.264, but a later Chromium playback check successfully played all MP4 clips. Forcing WebM for every browser also excludes browsers without VP8 support. Preview behavior is not a reliable universal codec rule.

**How to apply:** Keep both formats available, check browser codec support, and verify playback time advances rather than relying only on a screenshot. Test native playback separately.