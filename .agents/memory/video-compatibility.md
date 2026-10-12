---
name: Video preview compatibility
description: Codec choice for bundled demo clips across native Expo and browser preview.
---
Select video formats using actual browser support, not a blanket web-versus-native assumption.

**Why:** An earlier preview run appeared to reject H.264, but a later Chromium playback check successfully played all MP4 clips. Forcing WebM for every browser also excludes browsers without VP8 support. Preview behavior is not a reliable universal codec rule.

**How to apply:** Keep both formats available, check browser codec support, and verify playback time advances rather than relying only on a screenshot. Test native playback separately.

Preserve original user uploads when preparing browser-compatible playback. Tests must not modify or delete existing user uploads.

**Why:** The user explicitly required preservation. Inspection of the failing uploaded clips identified HEVC in QuickTime containers, not a blanket MP4 incompatibility. Native-friendly input can still fail browser demuxing.

**How to apply:** Inspect the actual codec/container before changing playback. Generate separate derivatives and test with newly created QA media. A standards-compatible output codec is not proof of playback on a physical iPhone or Android device.

Do not gate an active remote player's initial play request on its ready/canplay notification.

**Why:** Expo's browser player can remain at metadata preload while waiting for play; readiness-gated startup left uploaded videos displaying preparation indefinitely despite successful media responses. Requesting play during loading resolved the verified feed and return-navigation failure.

**How to apply:** Keep visibility, manual pause, seeking, and failure gates, but allow active playback requests while buffering. Bound preparation with a retry state. Close test browser sessions after video checks; one retained session exhausted workspace memory and delayed otherwise healthy startup.

The user repeated that play/replay should feel like TikTok, not a standard video player.

**Why:** Updating only the feed left standard player controls in profile and recording previews, making the experience inconsistent.

**How to apply:** Keep inline autoplay, looping, and tap-to-pause/resume consistent across viewing surfaces, including local media previews; do not reintroduce native player toolbars there.