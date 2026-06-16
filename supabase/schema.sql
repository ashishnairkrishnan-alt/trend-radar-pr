-- Trend Radar — Supabase Schema
-- Run this in your Supabase SQL editor to create all tables

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─── raw_trends ──────────────────────────────────────────────────────────────
create table if not exists raw_trends (
  id               uuid primary key default uuid_generate_v4(),
  platform         text not null check (platform in ('instagram', 'tiktok')),
  trend_name       text not null,
  trend_type       text not null check (trend_type in ('audio', 'format', 'hashtag')),
  emotional_hook   text not null,
  engagement_volume bigint default 0,
  spike_pct        numeric(8,2) default 0,
  raw_data         jsonb default '{}',
  source_url       text,
  processed        boolean default false,
  created_at       timestamptz default now()
);

create index if not exists raw_trends_processed_idx on raw_trends(processed);
create index if not exists raw_trends_created_at_idx on raw_trends(created_at desc);

-- ─── scored_trends ────────────────────────────────────────────────────────────
create table if not exists scored_trends (
  id               uuid primary key default uuid_generate_v4(),
  raw_trend_id     uuid references raw_trends(id) on delete cascade,
  trend_name       text not null,
  platform         text not null check (platform in ('instagram', 'tiktok')),
  trend_type       text not null check (trend_type in ('audio', 'format', 'hashtag')),
  emotional_hook   text not null,
  spike_pct        numeric(8,2) default 0,
  chivas_score     int not null check (chivas_score between 1 and 5),
  absolut_score    int not null check (absolut_score between 1 and 5),
  jameson_score    int not null check (jameson_score between 1 and 5),
  glenlivet_score  int not null check (glenlivet_score between 1 and 5),
  top_brand        text not null,
  opportunity_note text not null,
  content_angle    text not null,
  source_url       text,
  week_number      int not null,
  year             int not null,
  created_at       timestamptz default now()
);

-- Run these if tables already exist (adds source_url column):
-- alter table raw_trends add column if not exists source_url text;
-- alter table scored_trends add column if not exists source_url text;

create index if not exists scored_trends_week_year_idx on scored_trends(week_number, year);
create index if not exists scored_trends_top_brand_idx on scored_trends(top_brand);
create index if not exists scored_trends_platform_idx on scored_trends(platform);

-- ─── digest_log ──────────────────────────────────────────────────────────────
create table if not exists digest_log (
  id               uuid primary key default uuid_generate_v4(),
  sent_at          timestamptz default now(),
  recipient_count  int default 0,
  trend_count      int default 0,
  status           text not null default 'pending' check (status in ('sent', 'failed', 'pending'))
);

create index if not exists digest_log_sent_at_idx on digest_log(sent_at desc);

-- ─── Row Level Security (disable for server-side service role access) ─────────
alter table raw_trends enable row level security;
alter table scored_trends enable row level security;
alter table digest_log enable row level security;

-- Allow service role full access (used in API routes)
create policy "Service role full access" on raw_trends
  for all using (true) with check (true);

create policy "Service role full access" on scored_trends
  for all using (true) with check (true);

create policy "Service role full access" on digest_log
  for all using (true) with check (true);
