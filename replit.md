# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **AI**: Replit AI Integrations (OpenAI gpt-5.4, no key needed)

## Artifacts

### ROSA (`artifacts/rosa-app`) — preview at `/`
A luxurious full-featured lifestyle web app for women. "An app made for women, by women" — founded by Aiswarya Saji.

**Pages / Features:**
- Intro animation — ROSA wordmark, founder tagline ("Built by Aiswarya Saji — a woman who struggled just like you")
- Sign In — email-only verification + gender identity selection. **Persistent login**: "Remember me on this device" checkbox (default ON, 30 days) — otherwise session lasts 1 day. Sessions are signed v2 tokens (HMAC + tokenVersion + deviceId + exp), stored obfuscated in localStorage (remember-me) or sessionStorage. Each verified login creates a row in `trusted_devices` (Settings → Trusted Devices shows them, lets user revoke individually or "Sign out of all devices" — which bumps `tokenVersion` so every old token is instantly invalid).
- Home — weather (OpenMeteo), daily quote, quick-access grid (12 sections), trial/subscription banners, founder note
- Mood Tracker — daily mood logging, activity/food/workout suggestions
- Period Tracker — cycle logging, ovulation, calendar, PMS suggestions
- Partner Sharing — connect via code, privacy settings (granular, per-feature control)
- Wishlist — items with links, priority, gift quiz
- Milestones — countdowns & "days since" with photo support (Premium), emoji, notes, shareable cards
- Travel & Places — bucket list, seasonal weekend suggestions, Maps links
- Outfit Planner — calendar-based outfit planning with weather
- Food Planner (Premium) — diet plan selector, calorie tracker (manual entry, quick-add), water tracking, history log
- Reminders Calendar — full calendar with typed reminders
- Health & Fitness — BMI, home/yoga/gym/meditation workouts with step-by-step guides + YouTube video links, gym scheduling (Premium), weight journey tracker (Premium), health conditions/disabilities input
- Quotes — daily quote by personality, notification support
- Surveys — 4 reflective surveys (wellness, body image, relationships, goals)
- Subscription — 31-day free trial, $5/mo or $50/yr simulated subscription, premium gating
- Support — mailto contact form
- Settings — profile, gender, personality tags, partner privacy (per-feature toggles), timezone detection, 24h time toggle, subscription status card

**AI Chatbot (Premium):**
- Floating chat button (bottom-right)
- Streaming SSE responses from backend → OpenAI gpt-5.4
- ROSA persona — warm, empathetic mental/emotional support companion
- Persists conversation history in PostgreSQL
- Non-premium: tapping the button routes to subscription page

**Subscription System:**
- 31-day free trial from account creation
- Simulated $5/month or $50/year plans (stored in localStorage)
- Premium gates: AI chatbot, food planner, gym scheduling, weight journey, outfit suggestions, photo milestones, things-to-do/travel
- Trial countdown shown in sidebar and home banner

**Tech:**
- React + Vite + TailwindCSS + shadcn/ui
- Framer Motion for animations
- Playfair Display (serif) + Inter (sans) fonts
- Deep rose / blush / cream / gold palette
- Most state: localStorage; chatbot history: PostgreSQL

### API Server (`artifacts/api-server`) — preview at `/api`
Express 5 backend with AI chatbot endpoints.

**Routes:**
- `GET /api/healthz` — health check
- `GET/POST /api/openai/conversations` — manage chat conversations
- `GET/DELETE /api/openai/conversations/:id` — get/delete conversation
- `GET /api/openai/conversations/:id/messages` — list messages
- `POST /api/openai/conversations/:id/messages` — send message (SSE streaming response)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## DB Schema

- `conversations` — chat conversation metadata (id, title, created_at)
- `messages` — chat messages (id, conversation_id, role, content, created_at)

## Environment Variables

- `DATABASE_URL` — PostgreSQL connection
- `AI_INTEGRATIONS_OPENAI_BASE_URL` — Replit AI proxy URL (auto-set)
- `AI_INTEGRATIONS_OPENAI_API_KEY` — Replit AI proxy key (auto-set)

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
