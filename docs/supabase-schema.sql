-- ASHARA MUBARAKAH IT Event Preparation Reporting Dashboard
-- Phase 2 schema with foundations for later phases.
-- Run in the Supabase SQL editor. Auth uses Supabase email/password with email confirmation disabled.

create extension if not exists "pgcrypto";

create table if not exists public.event_settings (
  id text primary key default 'default',
  event_start_date date not null,
  preparation_start_date date not null,
  day_1_date date generated always as (preparation_start_date) stored,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id text primary key,
  email text not null unique,
  full_name text not null,
  role text not null check (role in ('super_admin','admin','area_admin','verifier','report_user','viewer')),
  status text not null default 'pending_approval' check (status in ('active','pending_approval','disabled')),
  must_change_password boolean not null default true,
  created_by text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists must_change_password boolean not null default true;

create table if not exists public.roles (
  id text primary key,
  name text not null unique,
  description text not null default '',
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.permissions (
  id text primary key,
  role_id text not null references public.roles(id) on delete cascade,
  permission_key text not null,
  allowed boolean not null default true,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (role_id, permission_key)
);

create table if not exists public.zone_types (
  id text primary key,
  name text not null unique check (name in ('CMZ','Central Office','Relay Zone')),
  display_order integer not null default 0,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.areas (
  id text primary key,
  zone_type_id text not null references public.zone_types(id),
  name text not null,
  code text not null default '',
  city text,
  active boolean not null default true,
  daily_deadline time not null default '20:00',
  reminder_time time not null default '18:30',
  escalation_time time not null default '21:00',
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.area_access (
  id text primary key,
  profile_id text not null references public.profiles(id) on delete cascade,
  area_id text not null references public.areas(id) on delete cascade,
  role text not null check (role in ('area_admin','verifier','report_user','viewer','admin','super_admin')),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, area_id, role)
);

create table if not exists public.task_types (
  id text primary key,
  name text not null unique,
  active boolean not null default true,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.task_templates (
  id text primary key,
  prep_day integer not null check (prep_day between 1 and 20),
  priority_level text not null default 'Medium',
  main_objective text not null default '',
  workstream text not null default '',
  task_details text not null,
  responsible_team text not null default '',
  follow_up_questions text not null default '',
  required_equipment text not null default '',
  expected_output text not null default '',
  testing_required text not null default '',
  hidden_reference jsonb not null default '{}'::jsonb,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.live_tasks (
  id text primary key,
  template_id text not null references public.task_templates(id),
  area_id text not null references public.areas(id) on delete cascade,
  task_type text not null,
  prep_day integer not null check (prep_day between 1 and 20),
  start_date date,
  due_date date,
  actual_completion_date date,
  priority text not null default 'Medium',
  required_quantity numeric,
  unit text,
  assigned_profile_ids text[] not null default '{}',
  assigned_verifier_ids text[] not null default '{}',
  verification_required boolean not null default true,
  verification_rule text not null default 'one_verifier' check (verification_rule in ('one_verifier','all_verifiers','sequential')),
  evidence_note text,
  active boolean not null default true,
  not_applicable boolean not null default false,
  delay_reason text,
  revised_due_date date,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (template_id, area_id)
);

create table if not exists public.daily_reports (
  id text primary key,
  area_id text not null references public.areas(id) on delete cascade,
  report_date date not null,
  prep_day integer not null check (prep_day between 1 and 20),
  status text not null default 'Not Started',
  general_remark text not null default '',
  submitted_by text references public.profiles(id),
  submitted_at timestamptz,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (area_id, report_date)
);

create table if not exists public.task_updates (
  id text primary key,
  live_task_id text not null references public.live_tasks(id) on delete cascade,
  daily_report_id text not null references public.daily_reports(id) on delete cascade,
  updated_by text not null references public.profiles(id),
  status text not null check (status in ('Pending','In Progress','Completed','Issue Found')),
  verification_status text not null default 'Not Submitted',
  remarks text not null default '',
  completed_quantity numeric,
  user_role_standing text not null default '',
  escalation_points jsonb not null default '[]'::jsonb,
  supporting_personnel jsonb not null default '[]'::jsonb,
  correction_comment text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.task_files (
  id text primary key,
  live_task_id text not null references public.live_tasks(id) on delete cascade,
  task_update_id text not null references public.task_updates(id) on delete cascade,
  file_name text not null,
  file_type text not null default '',
  file_size bigint not null default 0,
  storage_path text,
  review_locked boolean not null default false,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.task_verifiers (
  id text primary key,
  live_task_id text not null references public.live_tasks(id) on delete cascade,
  verifier_id text not null references public.profiles(id) on delete cascade,
  sequence_order integer not null default 1,
  active boolean not null default true,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (live_task_id, verifier_id)
);

create table if not exists public.verification_logs (
  id text primary key,
  live_task_id text not null references public.live_tasks(id) on delete cascade,
  task_update_id text not null references public.task_updates(id) on delete cascade,
  verifier_id text not null references public.profiles(id),
  action text not null check (action in ('verified','rejected','comment')),
  comment text not null default '',
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.requests (
  id text primary key,
  request_type text not null,
  area_id text not null references public.areas(id) on delete cascade,
  related_live_task_id text references public.live_tasks(id),
  title text not null,
  details text not null default '',
  quantity_requested numeric,
  priority text not null default 'Medium',
  required_by_date date,
  attachment_name text,
  requested_by text not null references public.profiles(id),
  status text not null default 'Under Review',
  decision_remarks text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.request_reviews (
  id text primary key,
  request_id text not null references public.requests(id) on delete cascade,
  reviewer_id text not null references public.profiles(id),
  comment text not null default '',
  recommendation text not null default '',
  completed boolean not null default false,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.form_fields (
  id text primary key,
  task_type text not null,
  field_key text not null,
  label text not null,
  required boolean not null default false,
  visible boolean not null default true,
  display_order integer not null default 0,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.global_options (
  id text primary key,
  option_group text not null,
  value text not null,
  active boolean not null default true,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (option_group, value)
);

create table if not exists public.reminders (
  id text primary key,
  area_id text references public.areas(id) on delete cascade,
  reminder_type text not null,
  deadline_time time,
  reminder_time time,
  escalation_time time,
  recipients jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop table if exists public.notification_logs;

create table if not exists public.in_app_notifications (
  id text primary key,
  user_id text not null references public.profiles(id) on delete cascade,
  area_id text references public.areas(id) on delete cascade,
  title text not null,
  message text not null default '',
  type text not null,
  is_read boolean not null default false,
  related_task_id text references public.live_tasks(id) on delete cascade,
  related_request_id text references public.requests(id) on delete cascade,
  related_daily_report_id text references public.daily_reports(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.activity_logs (
  id text primary key,
  category text not null,
  actor_id text references public.profiles(id),
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.report_exports (
  id text primary key,
  export_type text not null,
  requested_by text references public.profiles(id),
  area_id text references public.areas(id),
  storage_path text,
  status text not null default 'queued',
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists areas_zone_type_idx on public.areas(zone_type_id);
create index if not exists area_access_profile_idx on public.area_access(profile_id);
create index if not exists area_access_area_idx on public.area_access(area_id);
create index if not exists task_templates_day_idx on public.task_templates(prep_day);
create index if not exists task_templates_workstream_idx on public.task_templates(workstream);
create index if not exists live_tasks_area_idx on public.live_tasks(area_id);
create index if not exists live_tasks_day_idx on public.live_tasks(prep_day);
create index if not exists daily_reports_area_date_idx on public.daily_reports(area_id, report_date);
create index if not exists task_updates_live_task_idx on public.task_updates(live_task_id);
create index if not exists requests_area_status_idx on public.requests(area_id, status);
create index if not exists verification_logs_verifier_idx on public.verification_logs(verifier_id);
create index if not exists in_app_notifications_user_idx on public.in_app_notifications(user_id, is_read, created_at);

insert into storage.buckets (id, name, public)
values ('task-evidence', 'task-evidence', false)
on conflict (id) do update set public = false;

create or replace function public.current_profile_id()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select id from public.profiles
  where (
      id = auth.uid()::text
      or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  limit 1
$$;

create or replace function public.current_profile_role()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select role from public.profiles
  where id = public.current_profile_id() and status = 'active'
  limit 1
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(public.current_profile_role() in ('super_admin','admin'), false)
$$;

create or replace function public.has_area_access(target_area_id text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.is_admin()
    or (
      public.current_profile_role() is not null
      and exists (
      select 1 from public.area_access aa
      where aa.profile_id = public.current_profile_id()
        and aa.area_id = target_area_id
      )
    )
$$;

create or replace function public.can_manage_area_users(target_area_id text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.is_admin()
    or (
      public.current_profile_role() in ('area_admin','verifier')
      and exists (
        select 1 from public.area_access aa
        where aa.profile_id = public.current_profile_id()
          and aa.area_id = target_area_id
          and aa.role in ('area_admin','verifier')
      )
    )
$$;

create or replace function public.has_live_task_access(target_task_id text, target_intent text default 'view')
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  with task_scope as (
    select
      lt.id,
      lt.area_id,
      lower(regexp_replace(trim(coalesce(nullif(lt.data->>'workstream', ''), 'General')), '[[:space:]]+', ' ', 'g')) as workstream,
      lt.assigned_profile_ids,
      lt.assigned_verifier_ids
    from public.live_tasks lt
    where lt.id = target_task_id
  )
  select public.is_admin()
    or exists (
      select 1
      from task_scope lt
      where (target_intent <> 'verify' and public.current_profile_id() = any(lt.assigned_profile_ids))
         or (target_intent <> 'update' and public.current_profile_id() = any(lt.assigned_verifier_ids))
         or (target_intent = 'verify' and public.current_profile_id() = any(lt.assigned_verifier_ids))
    )
    or exists (
      select 1
      from task_scope lt
      join public.area_access aa on aa.area_id = lt.area_id and aa.profile_id = public.current_profile_id()
      cross join lateral (select coalesce(aa.data->'data', aa.data, '{}'::jsonb) as scope) scope_data
      cross join lateral (
        select case
          when target_intent = 'verify' or aa.role = 'verifier' then coalesce(scope_data.scope->'verificationWorkstreams', scope_data.scope->'workstreams')
          else scope_data.scope->'workstreams'
        end as workstreams
      ) scope_workstreams
      where (
        (
          aa.role = 'area_admin'
          and (
            (
              target_intent <> 'verify'
              and coalesce((scope_data.scope->>'canViewTasks')::boolean, true)
              and (target_intent <> 'update' or coalesce((scope_data.scope->>'canUpdateTasks')::boolean, true))
            )
            or (
              target_intent = 'verify'
              and coalesce((scope_data.scope->>'canVerify')::boolean, false)
            )
          )
        )
        or (
          aa.role = 'report_user'
          and target_intent <> 'verify'
          and coalesce((scope_data.scope->>'canViewTasks')::boolean, true)
          and (target_intent <> 'update' or coalesce((scope_data.scope->>'canUpdateTasks')::boolean, true))
        )
        or (
          aa.role = 'viewer'
          and target_intent = 'view'
          and coalesce((scope_data.scope->>'canViewTasks')::boolean, true)
        )
        or (
          aa.role = 'verifier'
          and target_intent <> 'update'
          and coalesce((scope_data.scope->>'canVerify')::boolean, true)
        )
      )
      and (
        scope_workstreams.workstreams is null
        or exists (
          select 1
          from jsonb_array_elements_text(scope_workstreams.workstreams) ws(value)
          where lower(regexp_replace(trim(ws.value), '[[:space:]]+', ' ', 'g')) = lt.workstream
        )
      )
    )
$$;

alter table public.event_settings enable row level security;
alter table public.profiles enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.zone_types enable row level security;
alter table public.areas enable row level security;
alter table public.area_access enable row level security;
alter table public.task_types enable row level security;
alter table public.task_templates enable row level security;
alter table public.live_tasks enable row level security;
alter table public.daily_reports enable row level security;
alter table public.task_updates enable row level security;
alter table public.task_files enable row level security;
alter table public.task_verifiers enable row level security;
alter table public.verification_logs enable row level security;
alter table public.requests enable row level security;
alter table public.request_reviews enable row level security;
alter table public.form_fields enable row level security;
alter table public.global_options enable row level security;
alter table public.reminders enable row level security;
alter table public.in_app_notifications enable row level security;
alter table public.activity_logs enable row level security;
alter table public.report_exports enable row level security;

grant usage on schema public to authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated, service_role;

drop policy if exists "Admins manage settings" on public.event_settings;
drop policy if exists "Authenticated read settings" on public.event_settings;
drop policy if exists "Users read own profile or admins read all" on public.profiles;
drop policy if exists "Admins manage profiles" on public.profiles;
drop policy if exists "Area managers read area profiles" on public.profiles;
drop policy if exists "Area admins create pending report users" on public.profiles;
drop policy if exists "Verifiers approve area users" on public.profiles;
drop policy if exists "Admins manage roles" on public.roles;
drop policy if exists "Authenticated read roles" on public.roles;
drop policy if exists "Admins manage permissions" on public.permissions;
drop policy if exists "Authenticated read zone types" on public.zone_types;
drop policy if exists "Admins manage zone types" on public.zone_types;
drop policy if exists "Area access read areas" on public.areas;
drop policy if exists "Admins manage areas" on public.areas;
drop policy if exists "Users read own area access" on public.area_access;
drop policy if exists "Admins manage area access" on public.area_access;
drop policy if exists "Area managers read managed access" on public.area_access;
drop policy if exists "Area admins create report user access" on public.area_access;
drop policy if exists "Authenticated read task types" on public.task_types;
drop policy if exists "Admins manage task types" on public.task_types;
drop policy if exists "Admins manage templates" on public.task_templates;
drop policy if exists "Area users read applied templates" on public.task_templates;
drop policy if exists "Area users read live tasks" on public.live_tasks;
drop policy if exists "Admins manage live tasks" on public.live_tasks;
drop policy if exists "Area users read reports" on public.daily_reports;
drop policy if exists "Area users write reports" on public.daily_reports;
drop policy if exists "Area users update reports" on public.daily_reports;
drop policy if exists "Admins delete reports" on public.daily_reports;
drop policy if exists "Area users read task updates" on public.task_updates;
drop policy if exists "Area users write task updates" on public.task_updates;
drop policy if exists "Area users update task updates" on public.task_updates;
drop policy if exists "Area users read files" on public.task_files;
drop policy if exists "Area users add files" on public.task_files;
drop policy if exists "Admins manage files" on public.task_files;
drop policy if exists "Area users read task verifiers" on public.task_verifiers;
drop policy if exists "Admins manage task verifiers" on public.task_verifiers;
drop policy if exists "Assigned verifiers and admins read verification logs" on public.verification_logs;
drop policy if exists "Assigned verifiers create verification logs" on public.verification_logs;
drop policy if exists "Area users read requests" on public.requests;
drop policy if exists "Area users create requests" on public.requests;
drop policy if exists "Admins manage requests" on public.requests;
drop policy if exists "Reviewers read assigned requests" on public.requests;
drop policy if exists "Reviewers update assigned requests" on public.requests;
drop policy if exists "Admins manage request reviews" on public.request_reviews;
drop policy if exists "Reviewer reads own request reviews" on public.request_reviews;
drop policy if exists "Reviewers create own request reviews" on public.request_reviews;
drop policy if exists "Reviewers update own request reviews" on public.request_reviews;
drop policy if exists "Authenticated read form fields" on public.form_fields;
drop policy if exists "Admins manage form fields" on public.form_fields;
drop policy if exists "Authenticated read global options" on public.global_options;
drop policy if exists "Admins manage global options" on public.global_options;
drop policy if exists "Admins manage reminders" on public.reminders;
drop policy if exists "Users read own notifications" on public.in_app_notifications;
drop policy if exists "Users create own notifications" on public.in_app_notifications;
drop policy if exists "Users update own notifications" on public.in_app_notifications;
drop policy if exists "Admins manage notifications" on public.in_app_notifications;
drop policy if exists "Admins read activity logs" on public.activity_logs;
drop policy if exists "Admins manage activity logs" on public.activity_logs;
drop policy if exists "Admins manage exports" on public.report_exports;
drop policy if exists "Area users read task evidence" on storage.objects;
drop policy if exists "Authenticated upload task evidence" on storage.objects;
drop policy if exists "Admins manage task evidence" on storage.objects;

create policy "Admins manage settings" on public.event_settings for all using (public.is_admin()) with check (public.is_admin());
create policy "Authenticated read settings" on public.event_settings for select using (auth.role() = 'authenticated');

create policy "Users read own profile or admins read all" on public.profiles for select using (id = public.current_profile_id() or public.is_admin());
create policy "Admins manage profiles" on public.profiles for all using (public.is_admin()) with check (public.is_admin());
create policy "Area managers read area profiles" on public.profiles for select using (
  created_by = public.current_profile_id()
  or exists (
    select 1
    from public.area_access target_access
    where target_access.profile_id = profiles.id
      and public.can_manage_area_users(target_access.area_id)
  )
);
create policy "Area admins create pending report users" on public.profiles for insert with check (
  public.current_profile_role() = 'area_admin'
  and role = 'report_user'
  and status = 'pending_approval'
  and created_by = public.current_profile_id()
);
create policy "Verifiers approve area users" on public.profiles for update using (
  public.current_profile_role() = 'verifier'
  and
  exists (
    select 1
    from public.area_access target_access
    where target_access.profile_id = profiles.id
      and public.can_manage_area_users(target_access.area_id)
  )
) with check (
  role = 'report_user'
  and status in ('active','pending_approval','disabled')
);

create policy "Admins manage roles" on public.roles for all using (public.is_admin()) with check (public.is_admin());
create policy "Authenticated read roles" on public.roles for select using (auth.role() = 'authenticated');
create policy "Admins manage permissions" on public.permissions for all using (public.is_admin()) with check (public.is_admin());

create policy "Authenticated read zone types" on public.zone_types for select using (auth.role() = 'authenticated');
create policy "Admins manage zone types" on public.zone_types for all using (public.is_admin()) with check (public.is_admin());

create policy "Area access read areas" on public.areas for select using (public.has_area_access(id));
create policy "Admins manage areas" on public.areas for all using (public.is_admin()) with check (public.is_admin());

create policy "Users read own area access" on public.area_access for select using (profile_id = public.current_profile_id() or public.is_admin());
create policy "Admins manage area access" on public.area_access for all using (public.is_admin()) with check (public.is_admin());
create policy "Area managers read managed access" on public.area_access for select using (public.can_manage_area_users(area_id));
create policy "Area admins create report user access" on public.area_access for insert with check (
  public.current_profile_role() = 'area_admin'
  and role = 'report_user'
  and public.can_manage_area_users(area_id)
  and exists (
    select 1 from public.profiles p
    where p.id = profile_id
      and p.created_by = public.current_profile_id()
      and p.role = 'report_user'
  )
);

create policy "Authenticated read task types" on public.task_types for select using (auth.role() = 'authenticated');
create policy "Admins manage task types" on public.task_types for all using (public.is_admin()) with check (public.is_admin());

create policy "Admins manage templates" on public.task_templates for all using (public.is_admin()) with check (public.is_admin());
create policy "Area users read applied templates" on public.task_templates for select using (
  public.is_admin()
  or exists (
    select 1 from public.live_tasks lt
    where lt.template_id = id
      and public.has_area_access(lt.area_id)
  )
);

create policy "Area users read live tasks" on public.live_tasks for select using (public.has_live_task_access(id, 'view'));
create policy "Admins manage live tasks" on public.live_tasks for all using (public.is_admin()) with check (public.is_admin());

create policy "Area users read reports" on public.daily_reports for select using (public.has_area_access(area_id));
create policy "Area users write reports" on public.daily_reports for insert with check (public.has_area_access(area_id));
create policy "Area users update reports" on public.daily_reports for update using (public.has_area_access(area_id)) with check (public.has_area_access(area_id));
create policy "Admins delete reports" on public.daily_reports for delete using (public.is_admin());

create policy "Area users read task updates" on public.task_updates for select using (
  public.has_live_task_access(live_task_id, 'view') or public.has_live_task_access(live_task_id, 'verify')
);
create policy "Area users write task updates" on public.task_updates for insert with check (
  updated_by = public.current_profile_id()
  and public.has_live_task_access(live_task_id, 'update')
);
create policy "Area users update task updates" on public.task_updates for update using (
  public.is_admin()
  or (updated_by = public.current_profile_id() and public.has_live_task_access(live_task_id, 'update'))
  or exists (
    select 1 from public.live_tasks lt
    where lt.id = live_task_id
      and public.has_live_task_access(lt.id, 'verify')
  )
) with check (
  public.is_admin()
  or (updated_by = public.current_profile_id() and public.has_live_task_access(live_task_id, 'update'))
  or exists (
    select 1 from public.live_tasks lt
    where lt.id = live_task_id
      and public.has_live_task_access(lt.id, 'verify')
  )
);

create policy "Area users read files" on public.task_files for select using (
  exists (select 1 from public.live_tasks lt where lt.id = live_task_id and public.has_area_access(lt.area_id))
);
create policy "Area users add files" on public.task_files for insert with check (
  exists (select 1 from public.live_tasks lt where lt.id = live_task_id and public.has_area_access(lt.area_id))
);
create policy "Admins manage files" on public.task_files for all using (public.is_admin()) with check (public.is_admin());

create policy "Area users read task verifiers" on public.task_verifiers for select using (
  exists (select 1 from public.live_tasks lt where lt.id = live_task_id and public.has_area_access(lt.area_id))
);
create policy "Admins manage task verifiers" on public.task_verifiers for all using (public.is_admin()) with check (public.is_admin());

create policy "Assigned verifiers and admins read verification logs" on public.verification_logs for select using (
  public.is_admin() or verifier_id = public.current_profile_id()
);
create policy "Assigned verifiers create verification logs" on public.verification_logs for insert with check (
  public.is_admin() or verifier_id = public.current_profile_id()
);

create policy "Area users read requests" on public.requests for select using (public.has_area_access(area_id) or requested_by = public.current_profile_id());
create policy "Area users create requests" on public.requests for insert with check (requested_by = public.current_profile_id() and public.has_area_access(area_id));
create policy "Admins manage requests" on public.requests for all using (public.is_admin()) with check (public.is_admin());
create policy "Reviewers read assigned requests" on public.requests for select using (
  exists (
    select 1 from public.request_reviews rr
    where rr.request_id = requests.id
      and rr.reviewer_id = public.current_profile_id()
  )
);
create policy "Reviewers update assigned requests" on public.requests for update using (
  exists (
    select 1 from public.request_reviews rr
    where rr.request_id = requests.id
      and rr.reviewer_id = public.current_profile_id()
  )
) with check (
  exists (
    select 1 from public.request_reviews rr
    where rr.request_id = requests.id
      and rr.reviewer_id = public.current_profile_id()
  )
);

create policy "Admins manage request reviews" on public.request_reviews for all using (public.is_admin()) with check (public.is_admin());
create policy "Reviewer reads own request reviews" on public.request_reviews for select using (reviewer_id = public.current_profile_id() or public.is_admin());
create policy "Reviewers create own request reviews" on public.request_reviews for insert with check (reviewer_id = public.current_profile_id());
create policy "Reviewers update own request reviews" on public.request_reviews for update using (reviewer_id = public.current_profile_id()) with check (reviewer_id = public.current_profile_id());

create policy "Authenticated read form fields" on public.form_fields for select using (auth.role() = 'authenticated');
create policy "Admins manage form fields" on public.form_fields for all using (public.is_admin()) with check (public.is_admin());
create policy "Authenticated read global options" on public.global_options for select using (auth.role() = 'authenticated');
create policy "Admins manage global options" on public.global_options for all using (public.is_admin()) with check (public.is_admin());
create policy "Admins manage reminders" on public.reminders for all using (public.is_admin()) with check (public.is_admin());
create policy "Users read own notifications" on public.in_app_notifications for select using (user_id = public.current_profile_id() or public.is_admin());
create policy "Users create own notifications" on public.in_app_notifications for insert with check (user_id = public.current_profile_id());
create policy "Users update own notifications" on public.in_app_notifications for update using (user_id = public.current_profile_id()) with check (user_id = public.current_profile_id());
create policy "Admins manage notifications" on public.in_app_notifications for all using (public.is_admin()) with check (public.is_admin());
create policy "Admins read activity logs" on public.activity_logs for select using (public.is_admin());
create policy "Admins manage activity logs" on public.activity_logs for all using (public.is_admin()) with check (public.is_admin());
create policy "Admins manage exports" on public.report_exports for all using (public.is_admin()) with check (public.is_admin());

create policy "Area users read task evidence" on storage.objects for select using (
  bucket_id = 'task-evidence'
  and exists (
    select 1 from public.live_tasks lt
    where lt.id = split_part(name, '/', 1)
      and public.has_area_access(lt.area_id)
  )
);
create policy "Authenticated upload task evidence" on storage.objects for insert with check (
  bucket_id = 'task-evidence'
  and auth.role() = 'authenticated'
  and exists (
    select 1 from public.live_tasks lt
    where lt.id = split_part(name, '/', 1)
      and public.has_area_access(lt.area_id)
  )
);
create policy "Admins manage task evidence" on storage.objects for all using (
  bucket_id = 'task-evidence' and public.is_admin()
) with check (
  bucket_id = 'task-evidence' and public.is_admin()
);

insert into public.zone_types (id, name, display_order, data)
values
  ('zone-1', 'CMZ', 1, '{"id":"zone-1","name":"CMZ","displayOrder":1}'::jsonb),
  ('zone-2', 'Central Office', 2, '{"id":"zone-2","name":"Central Office","displayOrder":2}'::jsonb),
  ('zone-3', 'Relay Zone', 3, '{"id":"zone-3","name":"Relay Zone","displayOrder":3}'::jsonb)
on conflict (id) do nothing;

insert into public.event_settings (id, event_start_date, preparation_start_date)
values ('default', '2026-06-21', '2026-06-01')
on conflict (id) do nothing;
