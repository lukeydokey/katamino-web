alter table public.rooms
add column if not exists turn_time_seconds integer not null default 0;
