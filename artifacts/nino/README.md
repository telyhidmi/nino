# Nino — One World, One Voice (Phase 1)

Friendly global social app connecting people across languages. Expo (SDK 57) + Expo Router.

## Phase 1 scope (built)
- Welcome splash: glossy Nino wordmark (globe "o"), animated SVG world-connection globe, multilingual greeting chips.
- App language selection: English (default), العربية (full RTL layout + Cairo font), Português, Español. Stored in AsyncStorage (`nino.appLanguage`, `nino.languageChosen`).
- Real Clerk auth (custom screens, Clerk Core v3 API): email/password sign-up with email code verification, sign-in (incl. client-trust email code), password reset via email code, sign-out.
- Profile setup: display name, country, native language, languages to understand, photo from the native image picker.
  Persisted to Clerk `user.unsafeMetadata`; photo uploaded with `user.setProfileImage`.
- Profile overview with edit and sign-out.
- Routing: `/` is public; signed-in users are redirected to `/setup` (incomplete) or `/profile` (complete).
- Missing `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` shows an explicit "Authentication is not configured" screen — no fake auth.

## Not built yet (later phases)
Real-time translation.

## Location permission and recording country
- Foreground location permission is required to use Nino. Denying or revoking it blocks access until permission is granted; there is no skip or continue-without-location option.
- Camera video recording checks permission before country lookup and again immediately before recording. A temporary location or geocoding failure does not block recording if foreground permission remains granted, but the resulting video has no recording country and is excluded from country Discover.
- Only a recognized country code and recording timestamp may be attached to camera videos. Coordinates are used transiently for country lookup and are never stored, uploaded, or logged. Photos and library videos have no recording country.
- Nino does not request background location or enable background location services. The native permission rationale in `app.json` requires a new installed build to update the operating system prompt.

## Native Live broadcasting
- Discover → Live now lists real backend broadcasts. Go Live is also available from the camera.
- Live video requires a freshly installed iPhone or Android build containing the LiveKit native SDK and the two Expo plugins in `app.json`. A Metro refresh or Expo Go cannot add these native modules. The browser and Expo Go stay usable and show an installed-build-required explanation instead of pretend video.
- No EAS configuration is needed or provided. Use the project's supported native publishing/build flow; iOS publishing is available through Replit Expo Launch. Android distribution requires an appropriate native build outside the browser preview.
- The backend must have its LiveKit service configured. SDK installation alone does not provision LiveKit, and service/connection errors are displayed.
- Camera and microphone permission and actual capture are checked before allocating a host room. Viewers never publish camera or microphone. Host controls include flip, mute, and end.
- Navigating away or backgrounding stops capture and disconnects; hosts also request room termination. A network interruption can delay server cleanup. Reconnection is automatic while the screen stays active.
- Chat uses reliable LiveKit data packets, authenticated participant identity, a 500-character limit, and a bounded 100-message in-memory history. Chat is not persisted or translated.
- Native device verification is still required for camera flipping, audio routing, permission denial, reconnects, and iOS/Android background handling. Those behaviors cannot be validated in the web preview.

## Paid / external services
- **Clerk** (Replit-managed) — authentication and profile image storage. Free tier covers development; production usage is subject to Clerk/Replit pricing (MAU-based).
- Future phases will likely need a translation/speech API and realtime video (paid).

## Run
- Development: the `dev` script injects `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=$CLERK_PUBLISHABLE_KEY` and keeps the `create-launch login` step. Start via the Replit workflow and scan the QR code with Expo Go.
- Production build: `pnpm --filter @workspace/nino run build` — `scripts/build.js` injects `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` and `EXPO_PUBLIC_CLERK_PROXY_URL`.
- Typecheck: `pnpm --filter @workspace/nino run typecheck`.
