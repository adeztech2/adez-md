-- Run this in Supabase: Dashboard → SQL Editor → New Query → paste → Run

create table if not exists users (
  jid text primary key,
  name text,
  first_seen timestamptz default now(),
  last_seen timestamptz default now(),
  message_count integer default 0
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  jid text not null,
  sender text,
  body text,
  command text,
  created_at timestamptz default now()
);

create table if not exists settings (
  key text primary key,
  value text
);
