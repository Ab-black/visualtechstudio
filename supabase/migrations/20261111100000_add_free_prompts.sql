-- Free prompts: copyable prompts managed from the dashboard and shown on /free-prompts/.
-- Same access model as projects: the public sees published rows only; only admins can write.
create table if not exists public.free_prompts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  category text not null default 'Other',
  description text,
  prompt_text text not null,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists free_prompts_status_created_idx on public.free_prompts (status, created_at desc);

create or replace function public.set_free_prompt_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists free_prompts_updated_at on public.free_prompts;
create trigger free_prompts_updated_at
before update on public.free_prompts
for each row execute function public.set_free_prompt_updated_at();

alter table public.free_prompts enable row level security;

drop policy if exists free_prompts_public_select on public.free_prompts;
create policy free_prompts_public_select on public.free_prompts
  for select using (status = 'published' or public.is_admin());

drop policy if exists free_prompts_admin_insert on public.free_prompts;
create policy free_prompts_admin_insert on public.free_prompts
  for insert with check (public.is_admin());

drop policy if exists free_prompts_admin_update on public.free_prompts;
create policy free_prompts_admin_update on public.free_prompts
  for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists free_prompts_admin_delete on public.free_prompts;
create policy free_prompts_admin_delete on public.free_prompts
  for delete using (public.is_admin());
