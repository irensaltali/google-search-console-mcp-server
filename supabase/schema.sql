create table if not exists public.gsc_google_accounts (
  id uuid primary key default gen_random_uuid(),
  subscriber_id text not null unique,
  supabase_user_id uuid,
  google_user_id text,
  google_email text,
  provider_refresh_token_ciphertext text not null,
  scopes text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_connected_at timestamptz not null default now()
);

create table if not exists public.gsc_mutation_audit_logs (
  id uuid primary key default gen_random_uuid(),
  subscriber_id text not null,
  tool_name text not null,
  target text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists gsc_mutation_audit_logs_subscriber_created_idx
  on public.gsc_mutation_audit_logs (subscriber_id, created_at desc);

alter table public.gsc_google_accounts enable row level security;
alter table public.gsc_mutation_audit_logs enable row level security;

revoke all on table public.gsc_google_accounts from anon, authenticated;
revoke all on table public.gsc_mutation_audit_logs from anon, authenticated;

create policy "No client access to Google account tokens"
  on public.gsc_google_accounts
  for all
  to anon, authenticated
  using (false)
  with check (false);

create policy "No client access to mutation audit logs"
  on public.gsc_mutation_audit_logs
  for all
  to anon, authenticated
  using (false)
  with check (false);

-- This server uses the Supabase secret key for backend-only access.
-- Do not expose these tables directly to browser clients.
