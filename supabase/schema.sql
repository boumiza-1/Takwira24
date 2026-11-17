-- Takwira24 database schema
-- Run in Supabase SQL Editor. All user-owned rows are protected by RLS.

create extension if not exists pgcrypto;

create type public.sport_type as enum ('football','handball','basketball','volleyball');
create type public.match_status as enum ('open','full','in_progress','completed','cancelled');
create type public.invitation_status as enum ('pending','accepted','declined','cancelled');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  display_name text not null default 'Player',
  avatar_url text,
  bio text,
  city text,
  preferred_sport public.sport_type,
  position text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles(id) on delete cascade,
  sport public.sport_type not null,
  title text not null,
  venue text not null,
  area text not null,
  starts_at timestamptz,
  total_players int not null check (total_players between 2 and 30),
  skill_level text not null default 'مفتوح',
  status public.match_status not null default 'open',
  notes text,
  created_at timestamptz not null default now()
);

create table public.match_players (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete cascade,
  role text,
  slot_number int,
  confirmed boolean not null default false,
  goals int not null default 0 check (goals >= 0),
  assists int not null default 0 check (assists >= 0),
  created_at timestamptz not null default now(),
  unique(match_id, player_id),
  unique(match_id, slot_number)
);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  status public.invitation_status not null default 'pending',
  message text,
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  unique(match_id, recipient_id)
);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  media_url text not null,
  media_type text not null check (media_type in ('image','video')),
  caption text,
  created_at timestamptz not null default now()
);

create table public.stories (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  media_url text not null,
  expires_at timestamptz not null default now() + interval '24 hours',
  created_at timestamptz not null default now()
);

create table public.match_results (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null unique references public.matches(id) on delete cascade,
  home_score int not null default 0,
  away_score int not null default 0,
  summary text,
  recorded_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reported_user_id uuid references public.profiles(id) on delete cascade,
  post_id uuid references public.posts(id) on delete cascade,
  reason text not null,
  details text,
  created_at timestamptz not null default now(),
  check (reported_user_id is not null or post_id is not null)
);

create index matches_starts_at_idx on public.matches(starts_at);
create index matches_area_idx on public.matches(area);
create index match_players_match_idx on public.match_players(match_id);
create index invitations_recipient_status_idx on public.invitations(recipient_id, status);
create index posts_author_created_idx on public.posts(author_id, created_at desc);
create index stories_expires_idx on public.stories(expires_at);

alter table public.profiles enable row level security;
alter table public.matches enable row level security;
alter table public.match_players enable row level security;
alter table public.invitations enable row level security;
alter table public.posts enable row level security;
alter table public.stories enable row level security;
alter table public.match_results enable row level security;
alter table public.reports enable row level security;

create policy "Profiles are viewable by signed-in users" on public.profiles for select to authenticated using (true);
create policy "Users create their own profile" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "Users update their own profile" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

create policy "Signed-in users can view open matches" on public.matches for select to authenticated using (true);
create policy "Users create matches as themselves" on public.matches for insert to authenticated with check (auth.uid() = host_id);
create policy "Hosts update their matches" on public.matches for update to authenticated using (auth.uid() = host_id) with check (auth.uid() = host_id);
create policy "Hosts delete their matches" on public.matches for delete to authenticated using (auth.uid() = host_id);

create policy "Players can view match rosters" on public.match_players for select to authenticated using (true);
create policy "Players add themselves to roster" on public.match_players for insert to authenticated with check (auth.uid() = player_id);
create policy "Players or match host update roster" on public.match_players for update to authenticated using (
  auth.uid() = player_id or exists (select 1 from public.matches m where m.id = match_id and m.host_id = auth.uid())
);
create policy "Players leave roster" on public.match_players for delete to authenticated using (auth.uid() = player_id);

create policy "Users see invitations they sent or received" on public.invitations for select to authenticated using (auth.uid() = sender_id or auth.uid() = recipient_id);
create policy "Match hosts send invitations" on public.invitations for insert to authenticated with check (
  auth.uid() = sender_id and exists (select 1 from public.matches m where m.id = match_id and m.host_id = auth.uid())
);
create policy "Recipients respond to invitations" on public.invitations for update to authenticated using (auth.uid() = recipient_id) with check (auth.uid() = recipient_id);

create policy "Posts are viewable by signed-in users" on public.posts for select to authenticated using (true);
create policy "Users publish their own posts" on public.posts for insert to authenticated with check (auth.uid() = author_id);
create policy "Users delete their own posts" on public.posts for delete to authenticated using (auth.uid() = author_id);

create policy "Active stories are viewable by signed-in users" on public.stories for select to authenticated using (expires_at > now());
create policy "Users publish their own stories" on public.stories for insert to authenticated with check (auth.uid() = author_id);
create policy "Users delete their own stories" on public.stories for delete to authenticated using (auth.uid() = author_id);

create policy "Match results viewable by signed-in users" on public.match_results for select to authenticated using (true);
create policy "Match host records results" on public.match_results for insert to authenticated with check (
  auth.uid() = recorded_by and exists (select 1 from public.matches m where m.id = match_id and m.host_id = auth.uid())
);
create policy "Match host updates results" on public.match_results for update to authenticated using (
  exists (select 1 from public.matches m where m.id = match_id and m.host_id = auth.uid())
);

create policy "Users submit reports" on public.reports for insert to authenticated with check (auth.uid() = reporter_id);
create policy "Users view their own reports" on public.reports for select to authenticated using (auth.uid() = reporter_id);

-- Public sports-media buckets. Photos uploaded here will be visible to app users.
-- Only a signed-in user may write inside their own auth.uid()/ folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 5242880, array['image/jpeg','image/png','image/webp','image/gif']),
  ('player-media', 'player-media', true, 5242880, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do nothing;

create policy "Public can view avatars" on storage.objects for select to public using (bucket_id = 'avatars');
create policy "Public can view player photos" on storage.objects for select to public using (bucket_id = 'player-media');

create policy "Users upload own avatars" on storage.objects for insert to authenticated
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Users upload own photos" on storage.objects for insert to authenticated
with check (bucket_id = 'player-media' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Users remove their own avatars" on storage.objects for delete to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Users remove their own photos" on storage.objects for delete to authenticated
using (bucket_id = 'player-media' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- A joined player can also be invited; the primary join is unique per match.
-- Example policies must be reviewed for application roles before production.

