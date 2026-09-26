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
Feed, discover, live rooms, chat, real-time translation, Google/Apple sign-in.

## Paid / external services
- **Clerk** (Replit-managed) — authentication and profile image storage. Free tier covers development; production usage is subject to Clerk/Replit pricing (MAU-based).
- Future phases will likely need a translation/speech API and realtime video (paid).

## Run
- Development: the `dev` script injects `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=$CLERK_PUBLISHABLE_KEY` and keeps the `create-launch login` step. Start via the Replit workflow and scan the QR code with Expo Go.
- Production build: `pnpm --filter @workspace/nino run build` — `scripts/build.js` injects `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` and `EXPO_PUBLIC_CLERK_PROXY_URL`.
- Typecheck: `pnpm --filter @workspace/nino run typecheck`.
