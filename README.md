# Keim OS

A mobile-first progressive web app (PWA) for managing 7 businesses and personal life —
unified scheduler, client manager, invoicing, and financial planning.

**Status: Phase 1 — Foundation** ✅

---

## Stack

- Next.js 15 (App Router) + TypeScript strict mode
- Tailwind CSS v4 + shadcn/ui
- Supabase (auth, database, storage)
- TanStack Query
- React Hook Form + Zod
- date-fns
- next-pwa

## Setup

### 1. Clone and install

```bash
git clone <your-repo-url>
cd keim-os
npm install
```

### 2. Configure environment variables

```bash
cp .env.local.example .env.local
```

Fill in `.env.local` with your values:

| Variable | Where to find it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase project → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase project → Settings → API (keep secret!) |
| `RESEND_API_KEY` | resend.com → API Keys |

### 3. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You should see the dashboard with the bottom navigation bar.

---

## Project Structure

```
src/
  app/
    (auth)/login/      ← public auth pages
    (app)/             ← protected app shell (bottom nav)
  components/
    ui/                ← shadcn/ui components
    layout/            ← BottomNav, headers, etc.
    forms/             ← reusable form components
  lib/
    supabase/          ← client, server, middleware helpers
    constants.ts       ← business definitions
    utils.ts           ← cn() and shared utils
  types/
    database.ts        ← Supabase generated types (Phase 2)
```

## Businesses

| ID | Name | Color |
|---|---|---|
| `b-keim-rewind-marketing` | B Keim Rewind Marketing | #0D9488 |
| `happily-ever-after-weddings` | Happily Ever After Weddings | #E11D48 |
| `remember-when-phone-booth` | Remember When Phone Booth | #B45309 |
| `brandon-keim-contract-work` | Brandon Keim Contract Work | #475569 |
| `brandon-keim-legal-work` | Brandon Keim Legal Work | #1E3A8A |
| `equipment-rental` | Equipment Rental | #EA580C |
| `keim-time` | Keim Time | #7C3AED |

---

## Roadmap

- **Phase 1** — Foundation (current): project setup, routing shell, business constants
- **Phase 2** — Auth + database schema: Supabase auth flows, tables, Row Level Security
- **Phase 3** — Features: calendar, clients, invoices, money dashboard
