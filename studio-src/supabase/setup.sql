-- Teewrath Studio — one-time Supabase setup.
-- Paste this whole file into: Supabase Dashboard → SQL Editor → New query → Run.
-- Safe to run more than once.

-- ── Posts ───────────────────────────────────────────────────────────────
create table if not exists public.posts (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,
  title         text not null default 'Untitled',
  excerpt       text not null default '',
  category      text not null default '',
  tags          text[] not null default '{}',
  cover_url     text,
  cover_alt     text not null default '',
  content_json  jsonb,
  content_html  text not null default '',
  reading_min   int  not null default 1,
  seo_title     text not null default '',
  seo_desc      text not null default '',
  status        text not null default 'draft' check (status in ('draft','published')),
  published_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists posts_touch on public.posts;
create trigger posts_touch before update on public.posts
  for each row execute function public.touch_updated_at();

alter table public.posts enable row level security;

-- Anyone can read published posts whose publish time has arrived
-- (set a future published_at to schedule a post).
drop policy if exists "public reads published" on public.posts;
create policy "public reads published" on public.posts
  for select using (status = 'published' and published_at <= now());

-- Only the author (confirmed email) can do anything else.
drop policy if exists "author full access" on public.posts;
create policy "author full access" on public.posts
  for all to authenticated
  using      ((auth.jwt() ->> 'email') = 'subroto.2003@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'subroto.2003@gmail.com');

-- ── Image storage ───────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('blog-images', 'blog-images', true)
on conflict (id) do update set public = true;

drop policy if exists "blog images are public" on storage.objects;
create policy "blog images are public" on storage.objects
  for select using (bucket_id = 'blog-images');

drop policy if exists "author manages blog images" on storage.objects;
create policy "author manages blog images" on storage.objects
  for all to authenticated
  using      (bucket_id = 'blog-images' and (auth.jwt() ->> 'email') = 'subroto.2003@gmail.com')
  with check (bucket_id = 'blog-images' and (auth.jwt() ->> 'email') = 'subroto.2003@gmail.com');
