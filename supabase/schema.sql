-- Hearth database setup.
-- Paste this whole file into Supabase → SQL Editor → New query, then press Run.
-- It is safe to run more than once.

-- One row per person holding their whole workspace (areas, pages, tasks, habits) as JSON.
create table if not exists public.workspaces (
  user_id    uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  data       jsonb       not null,
  version    bigint      not null default 1,
  updated_at timestamptz not null default now()
);

-- Keep updated_at honest.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists workspaces_touch on public.workspaces;
create trigger workspaces_touch
  before update on public.workspaces
  for each row execute function public.touch_updated_at();

-- Row Level Security: each signed-in person can only ever see and change their own row.
alter table public.workspaces enable row level security;

drop policy if exists "Read own workspace" on public.workspaces;
create policy "Read own workspace" on public.workspaces
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Create own workspace" on public.workspaces;
create policy "Create own workspace" on public.workspaces
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "Update own workspace" on public.workspaces;
create policy "Update own workspace" on public.workspaces
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Delete own workspace" on public.workspaces;
create policy "Delete own workspace" on public.workspaces
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Visitors who are not signed in get nothing at all.
revoke all on public.workspaces from anon;
grant select, insert, update, delete on public.workspaces to authenticated;
