create table if not exists public.room_spectators (
  room_id uuid not null references public.rooms(id) on delete cascade,
  guest_id uuid not null,
  joined_at timestamptz not null default now(),
  primary key (room_id, guest_id)
);

create table if not exists public.room_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  guest_id uuid not null,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists room_messages_room_id_created_at_idx
on public.room_messages(room_id, created_at);
