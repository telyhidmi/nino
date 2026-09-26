# Nino — One World, One Voice

Native iOS and Android social app for connecting across countries and languages.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

_Populate as you build — short repo map plus pointers to the source-of-truth file for DB schema, API contracts, theme files, etc._

## Architecture decisions

_Populate as you build — non-obvious choices a reader couldn't infer from the code (3-5 bullets)._

## Product

_Describe the high-level user-facing capabilities of this app once they exist._

## User preferences

- Follow the uploaded Nino references closely; do not invent a different visual style. Use dark teal surfaces, luminous turquoise accents, Poppins/Cairo typography, and Arabic RTL.
- Deliver Phase 1 (welcome, language, authentication, profile setup) for review before continuing to feed, translation, messaging, or live-room phases.
- Three reference composites were supplied; the Google Doc mentions five. The separate onboarding reference was not supplied, so do not claim a pixel-exact onboarding match.
- Google Doc description was read before the conversation moved; its exact-reference requirement and five-tab navigation take precedence over the PDF's looser design guidance.

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
