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
- Sign In — email-only verification + gender identity selection. **Persistent login**: "Remember me on this device" checkbox (default ON, 30 days) — otherwise session lasts 1 day. Sessions are signed v2 tokens (HMAC + tokenVersion + deviceId + exp), stored obfuscated in localStorage (remember-me) or sessionStorage. Each verified login creates a row in `trusted_devices` (Settings → Trusted Devices shows them, lets user revoke individually or "Sign out of all devices" — which bumps `tokenVersion` so every old token is instantly invalid). Sign-in also captures **marketing email consent** (Yes / Maybe later / Never) → persisted as `rosa_users.marketing_opt_in`. Editable any time from Settings → Email Preferences. Transactional email (verification codes) sender = `noreply@rosainclusive.lifestyle`; promotional sender (when broadcasts go out) = `news@rosainclusive.lifestyle` (same SendGrid account, different verified Single Sender) so unsubscribes never break login emails.
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
- `rosa_users` — user accounts (email PK, name, gender, pronouns, ...)
- `rose_wall_posts` — community feed posts (id, author_email, body, mood, is_anonymous, status, rose_count, comment_count)
- `rose_wall_roses` — likes (unique per (post_id, user_email))
- `rose_wall_comments` — moderated comments (status: live | blocked | deleted)
- `rose_wall_reports` — moderation queue rows (target_type, target_id, reporter_email, reason, status)

## Build plan progress (external 12-step spec)

- Step 1 (sign-in polish) — done
- Step 2 (onboarding polish) — done
- Step 3 (Rose Wall: auth'd, AI-moderated, DB-backed, Instagram-style feed) — done
  - Posts/comments go through Gemini moderation before going live; block message: "This post couldn't be shared as it goes against our community guidelines 🌹"
  - Rose toggle and comment-delete are transactional with parent-counter updates; rose toggle defends against double-click races via the unique (post_id, user_email) index
  - Reports rate-limited (20/hr) and validated against existing live targets
- Stripe payment fix (out-of-band): replaced the Replit-only `stripe-replit-sync` package with the standard Stripe SDK so payments work on Railway. Checkout/portal now require auth; customer email comes from `req.session.email` (never from a body field), so Stripe never sees "guest@rosa.app". Customer resolution is retrieve → list-by-email → create with idempotent rosa_users linkage. Webhook signatures return 400 (no Stripe retry); downstream errors return 500 (Stripe retries). Webhook handler maps stripeCustomerId / stripeSubscriptionId / subscriptionStatus / trialEndsAt onto rosa_users; falls back to subscription metadata to recover the user when customer linkage drifts. Webhooks are now configured manually in the Stripe dashboard at /api/stripe/webhook.
- Mobile-responsive overhaul (out-of-band): rewrote `app-layout.tsx` with three breakpoints — mobile (<md): top header bar with hamburger + ROSA brand + garden chip, slide-in drawer (Radix Sheet) listing every nav item, and a 5-tab bottom nav (Home, Rose Wall, Chat, Profile, Menu); tablet (md→lg): collapsed icon-only sidebar rail with hover tooltips + aria-labels on every collapsed link; desktop (lg+): full sidebar. The Chat tab dispatches a `rosa:toggle-chat` window event consumed by `FloatingChat` so a second tap dismisses the panel; the FAB is hidden on mobile via the `floating-chat-fab` class so users have one obvious entry point. The chat panel header also exposes an explicit X close button (`aria-label="Close chat"`) so mobile users can always dismiss it. `FloatingChat` is now lifecycle-safe end-to-end: a `mountedRef` + per-call `AbortController` guards both `initConversation()` and the streaming `sendMessage()`; the `[open]` effect aborts in-flight streams when the panel closes; the `clearChat()` reopen timer is cleaned up on unmount; speech recognition callbacks early-return after unmount; AbortError is treated as a silent no-op so closing mid-stream never surfaces a fake "I'm having a moment" error. Mic / TTS / Send icon buttons all have explicit `aria-label`s. The drawer auto-closes on route change and locks body scroll while open. Global CSS adds fluid `clamp()` headings, kills horizontal overflow, forces 16px inputs on mobile (no iOS keyboard zoom), respects `prefers-reduced-motion`, and adds `pb-safe`/`pt-safe` utilities for iPhone safe-area insets. Verified end-to-end at 375/390/800/1280 — drawer opens/closes from both hamburger and Menu tab, Chat tab opens/closes the floating panel, X dismisses, no horizontal scroll on /, /rose-wall, /mood, /home, /subscription, /settings.
- Step 4 (nicknames + handles) — next

## Environment Variables

- `DATABASE_URL` — PostgreSQL connection
- `AI_INTEGRATIONS_OPENAI_BASE_URL` — Replit AI proxy URL (auto-set)
- `AI_INTEGRATIONS_OPENAI_API_KEY` — Replit AI proxy key (auto-set)

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
