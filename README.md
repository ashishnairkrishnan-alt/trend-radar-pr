# Trend Radar — Pernod Ricard Middle East

AI-powered social listening tool that scrapes Instagram and TikTok trends, scores them by brand relevance using Claude AI, and sends a weekly email digest every Monday morning.

---

## Tech Stack

| Layer | Tool |
|---|---|
| Framework | Next.js 14 (App Router, TypeScript) |
| Database | Supabase (PostgreSQL) |
| Scraping | Apify (TikTok + Instagram actors) |
| AI Scoring | Anthropic Claude (claude-sonnet-4-6) |
| Email | Resend |
| Hosting | Vercel (with built-in cron) |
| Styling | Tailwind CSS |

---

## Setup Instructions

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy `.env.example` to `.env.local` and fill in all values:

```bash
cp .env.example .env.local
```

| Variable | Where to get it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase project → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase project → Settings → API |
| `ANTHROPIC_API_KEY` | console.anthropic.com |
| `APIFY_API_KEY` | apify.com → Settings → Integrations |
| `APIFY_WEBHOOK_SECRET` | Any random secret string you choose |
| `RESEND_API_KEY` | resend.com → API Keys |
| `RESEND_FROM_EMAIL` | A verified sender in your Resend account |
| `NEXT_PUBLIC_APP_URL` | Your Vercel deployment URL |

### 3. Create Supabase tables

Go to your Supabase project → SQL Editor and run the contents of:

```
supabase/schema.sql
```

This creates `raw_trends`, `scored_trends`, and `digest_log` tables.

### 4. Configure recipients

Edit `lib/config.ts` → `DIGEST_RECIPIENTS` array with your team's email addresses.

### 5. Run locally

```bash
npm run dev
```

Open http://localhost:3000

### 6. Test with mock data

Hit this URL to seed 10 mock trends and score them with Claude:

```
http://localhost:3000/api/ingest/test
```

The dashboard will populate automatically.

---

## Deployment (Vercel)

1. Push to GitHub
2. Import into Vercel
3. Add all environment variables in Vercel project settings
4. Deploy — cron jobs in `vercel.json` activate automatically on Vercel

### Cron Schedule

| Job | Schedule | Time (GST UTC+4) |
|---|---|---|
| Apify scraper run | `0 22 * * 0` (Sun 10pm UTC) | Mon 2am GST |
| Weekly digest email | `0 4 * * 1` (Mon 4am UTC) | Mon 8am GST |

---

## How It Works

```
Sunday 10pm UTC
    └─ Vercel cron → /api/cron/scrape
        └─ Triggers 3 Apify actors (TikTok + 2x Instagram)
            └─ Apify webhook → /api/ingest
                └─ Normalise + store in raw_trends
                    └─ Claude scoring → scored_trends

Monday 4am UTC
    └─ Vercel cron → /api/cron/digest
        └─ /api/digest
            └─ Top 10 trends from scored_trends
                └─ Resend email → recipients
                    └─ digest_log entry
```

---

## Project Structure

```
app/
  page.tsx              # Dashboard (trend grid + filters)
  history/page.tsx      # Past digests browser
  settings/page.tsx     # Recipients, keywords, brand config
  api/
    ingest/route.ts     # Apify webhook receiver
    ingest/test/route.ts # Mock data seeder (GET)
    digest/route.ts     # Email generation + send
    cron/scrape/route.ts # Triggers Apify actors
    cron/digest/route.ts # Triggers digest

lib/
  supabase.ts           # DB client (browser + server)
  config.ts             # Recipients, brands, keywords
  scorer.ts             # Claude AI scoring engine
  apify.ts              # Actor triggers + data normalisation
  email.ts              # Resend integration + HTML template

components/
  TrendCard.tsx         # Single trend display card
  BrandScoreBars.tsx    # 4-brand score bar visualisation
  FilterPills.tsx       # Brand + platform filter UI
  DigestPreview.tsx     # iframe email preview
  Skeleton.tsx          # Loading skeleton states

types/
  index.ts              # TypeScript types for all entities

supabase/
  schema.sql            # Database schema (run in Supabase SQL editor)
```

---

## Scoring Model

Claude (`claude-sonnet-4-6`) evaluates each trend against four brand identities:

| Brand | Identity |
|---|---|
| **Chivas Regal** | Premium, sophisticated, slow moments, success, gifting, brotherhood |
| **Absolut Vodka** | Bold, creative, artistic, expressive, inclusive, party |
| **Jameson** | Social, relaxed, approachable, everyone's welcome, Irish warmth |
| **Beefeater Gin** | Vibrant, city energy, London nightlife, colorful, gin culture |

Each trend receives scores 1–5 per brand, plus `top_brand`, `opportunity_note`, and `content_angle`.

---

## Manual Triggers

| Endpoint | Purpose |
|---|---|
| `GET /api/ingest/test` | Seed 10 mock trends + score them |
| `POST /api/digest` | Send digest right now |
| `GET /api/cron/scrape` | Start Apify scrapers now |
| `GET /api/cron/digest` | Trigger digest via cron endpoint |
