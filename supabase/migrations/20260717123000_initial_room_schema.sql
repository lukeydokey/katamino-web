create extension if not exists pgcrypto;

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  status text not null default 'waiting',
  created_at timestamptz not null default now()
);

create table if not exists public.room_players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  guest_id uuid not null,
  seat text not null,
  ready boolean not null default false,
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (room_id, guest_id),
  unique (room_id, seat)
);

create table if not exists public.room_games (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null unique references public.rooms(id) on delete cascade,
  state_json jsonb not null,
  version integer not null default 1,
  updated_at timestamptz not null default now(),
  winner_guest_id uuid,
  finished_reason text,
  deadline_at timestamptz
);

create index if not exists room_players_room_id_idx on public.room_players(room_id);
create index if not exists room_games_room_id_idx on public.room_games(room_id);
