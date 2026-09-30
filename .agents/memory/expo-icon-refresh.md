---
name: Expo icon refresh
description: Avoid stale loading icons when replacing branding in Expo Go.
---
Use a new descriptive asset filename when replacing an Expo app icon, then restart the managed Expo workflow.

**Why:** The user still saw the old loading icon in Expo Go after the original PNG was replaced in place and the server restarted. A stable asset URL can retain cached imagery.

**How to apply:** Fetch the native manifest with expo-platform headers for iOS and Android. Fetch its iconUrl and compare the returned bytes to the intended local image. A matching response proves the server serves the new icon, not that the user's device has refreshed. Ask the user to close the project and reopen it from the current QR code; native standalone icons still require a new build.