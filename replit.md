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

## Artifacts

### ROSA (`artifacts/rosa-app`) — preview at `/`
A full lifestyle web app for women. Frontend-only React + Vite app, all data stored in localStorage.

**Features:**
- Intro animation with ROSA wordmark + tagline
- Sign In (email/phone/guest) + Gender selection
- Home dashboard with weather (OpenMeteo API), daily quotes, mood quick-log
- Mood Tracker — log daily mood, get activity/food/workout suggestions
- Period Tracker — cycle logging, ovulation prediction, calendar view, PMS suggestions
- Partner Sharing — connect via code, privacy settings, surprise trip planner
- Wishlist — items with links, priority, gift quiz
- Milestones — countdowns & "days since" trackers with shareable cards
- Travel & Places — bucket list destinations, seasonal weekend suggestions, Maps links
- Outfit Planner — calendar-based outfit planning with weather advice
- Reminders Calendar — full calendar with typed reminders (bills, birthdays, etc.)
- Health & Fitness — BMI calculator, home workouts, yoga, meditation, gym workout library
- Quotes — daily quote by personality tags, notification support
- Support — mailto-based contact form to developer
- Settings — profile, gender, personality tag preferences

**Tech:**
- React + Vite + TailwindCSS + shadcn/ui
- Framer Motion for animations
- Playfair Display (serif) + Inter (sans) fonts
- Deep rose / blush / cream / gold palette
- All state persisted via localStorage

### API Server (`artifacts/api-server`) — preview at `/api`
Express 5 backend. Currently minimal (health check only).

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
