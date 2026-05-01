-- =================================================================
-- Trening — database-oppsett for Supabase
-- =================================================================
-- Lim hele dette skriptet inn i Supabase Dashboard → SQL Editor →
-- "New query" → kjør (Run / Cmd+Enter).
--
-- Det oppretter:
--   - user_data: én rad per bruker, hele datablokken som JSONB
--   - Row Level Security: hver bruker ser BARE sin egen rad
--   - GRANT: gir authenticated-rolle nødvendige rettigheter
-- =================================================================

create table if not exists public.user_data (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

-- Slå på Row Level Security
alter table public.user_data enable row level security;

-- Policies: bare eieren kan lese/skrive sin egen rad
drop policy if exists "user_data_select_own" on public.user_data;
create policy "user_data_select_own"
  on public.user_data for select
  using (auth.uid() = user_id);

drop policy if exists "user_data_insert_own" on public.user_data;
create policy "user_data_insert_own"
  on public.user_data for insert
  with check (auth.uid() = user_id);

drop policy if exists "user_data_update_own" on public.user_data;
create policy "user_data_update_own"
  on public.user_data for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Vi disablet auto-expose, så GRANT eksplisitt:
grant select, insert, update on public.user_data to authenticated;

-- Bonus: når en bruker slettes fra auth.users, fjernes data også via ON DELETE CASCADE.
