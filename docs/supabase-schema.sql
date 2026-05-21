-- ASHARA MUBARAKAH IT / Event Preparation shared database schema.
-- Run this once in the Supabase SQL editor for the project used by the website.

create table if not exists public.ashara_tasks (
  id text primary key,
  city text not null default '',
  workstream text not null default '',
  area text not null default '',
  task_name text not null default '',
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ashara_cities (
  id text primary key,
  name text not null unique,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ashara_contacts (
  id text primary key,
  city text not null default '',
  name text not null default '',
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ashara_equipment (
  id text primary key,
  city text not null default '',
  workstream text not null default '',
  equipment_name text not null default '',
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ashara_activity (
  id text primary key,
  occurred_at timestamptz not null default now(),
  action text not null default '',
  item text not null default '',
  user_name text not null default '',
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ashara_chart_configs (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ashara_tasks_city_idx on public.ashara_tasks (city);
create index if not exists ashara_tasks_workstream_idx on public.ashara_tasks (workstream);
create index if not exists ashara_tasks_area_idx on public.ashara_tasks (area);
create index if not exists ashara_tasks_identity_idx on public.ashara_tasks (city, workstream, area, task_name);
create index if not exists ashara_activity_occurred_at_idx on public.ashara_activity (occurred_at desc);

alter table public.ashara_tasks replica identity full;
alter table public.ashara_cities replica identity full;
alter table public.ashara_contacts replica identity full;
alter table public.ashara_equipment replica identity full;
alter table public.ashara_activity replica identity full;
alter table public.ashara_chart_configs replica identity full;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'ashara_tasks') then
    alter publication supabase_realtime add table public.ashara_tasks;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'ashara_cities') then
    alter publication supabase_realtime add table public.ashara_cities;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'ashara_contacts') then
    alter publication supabase_realtime add table public.ashara_contacts;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'ashara_equipment') then
    alter publication supabase_realtime add table public.ashara_equipment;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'ashara_activity') then
    alter publication supabase_realtime add table public.ashara_activity;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'ashara_chart_configs') then
    alter publication supabase_realtime add table public.ashara_chart_configs;
  end if;
end $$;

alter table public.ashara_tasks enable row level security;
alter table public.ashara_cities enable row level security;
alter table public.ashara_contacts enable row level security;
alter table public.ashara_equipment enable row level security;
alter table public.ashara_activity enable row level security;
alter table public.ashara_chart_configs enable row level security;

grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete on public.ashara_tasks to anon, authenticated, service_role;
grant select, insert, update, delete on public.ashara_cities to anon, authenticated, service_role;
grant select, insert, update, delete on public.ashara_contacts to anon, authenticated, service_role;
grant select, insert, update, delete on public.ashara_equipment to anon, authenticated, service_role;
grant select, insert, update, delete on public.ashara_activity to anon, authenticated, service_role;
grant select, insert, update, delete on public.ashara_chart_configs to anon, authenticated, service_role;

alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated, service_role;

-- Temporary open policies for an internal dashboard without authentication.
-- Replace these with authenticated policies before using sensitive production data.
drop policy if exists "Internal read tasks" on public.ashara_tasks;
drop policy if exists "Internal write tasks" on public.ashara_tasks;
create policy "Internal read tasks" on public.ashara_tasks for select using (true);
create policy "Internal write tasks" on public.ashara_tasks for all using (true) with check (true);

drop policy if exists "Internal read cities" on public.ashara_cities;
drop policy if exists "Internal write cities" on public.ashara_cities;
create policy "Internal read cities" on public.ashara_cities for select using (true);
create policy "Internal write cities" on public.ashara_cities for all using (true) with check (true);

drop policy if exists "Internal read contacts" on public.ashara_contacts;
drop policy if exists "Internal write contacts" on public.ashara_contacts;
create policy "Internal read contacts" on public.ashara_contacts for select using (true);
create policy "Internal write contacts" on public.ashara_contacts for all using (true) with check (true);

drop policy if exists "Internal read equipment" on public.ashara_equipment;
drop policy if exists "Internal write equipment" on public.ashara_equipment;
create policy "Internal read equipment" on public.ashara_equipment for select using (true);
create policy "Internal write equipment" on public.ashara_equipment for all using (true) with check (true);

drop policy if exists "Internal read activity" on public.ashara_activity;
drop policy if exists "Internal write activity" on public.ashara_activity;
create policy "Internal read activity" on public.ashara_activity for select using (true);
create policy "Internal write activity" on public.ashara_activity for all using (true) with check (true);

drop policy if exists "Internal read chart configs" on public.ashara_chart_configs;
drop policy if exists "Internal write chart configs" on public.ashara_chart_configs;
create policy "Internal read chart configs" on public.ashara_chart_configs for select using (true);
create policy "Internal write chart configs" on public.ashara_chart_configs for all using (true) with check (true);
