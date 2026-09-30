---
name: Native Live scope
description: User-selected platform boundary for live broadcasting.
---
The user chose live broadcasting inside the installed mobile app, rather than browser-first streaming, after being told Expo Go cannot run the required native streaming SDK.

**Why:** Native broadcasting is an intentional product choice, not an accidental incompatibility to solve by replacing it with a browser-only implementation.

**How to apply:** Preserve the installed-native target and keep ordinary Expo Go use safe. Treat backend room/security checks and browser fallback checks as distinct from physical-device camera, audio, playback, and chat verification; they do not prove native broadcasting works end to end.