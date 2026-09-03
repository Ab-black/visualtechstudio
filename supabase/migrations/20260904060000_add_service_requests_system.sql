create table if not exists public.service_requests (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    email text not null,
    phone text,
    company text,
    service text,
    budget text,
    project_details text,
    status text not null default 'new' check (status in ('new', 'reviewing', 'contacted', 'in_progress', 'completed', 'declined')),
    email_status text not null default 'pending' check (email_status in ('pending', 'sent', 'failed')),
    email_sent_at timestamptz,
    email_error text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.service_request_files (
    id uuid primary key default gen_random_uuid(),
    request_id uuid not null references public.service_requests(id) on delete cascade,
    file_name text not null,
    file_path text not null,
    mime_type text,
    file_size bigint,
    created_at timestamptz not null default now()
);

create index if not exists service_requests_created_at_idx on public.service_requests (created_at desc);
create index if not exists service_requests_status_idx on public.service_requests (status);
create index if not exists service_request_files_request_id_idx on public.service_request_files (request_id);

create or replace function public.set_service_request_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists service_requests_updated_at on public.service_requests;
create trigger service_requests_updated_at
before update on public.service_requests
for each row execute function public.set_service_request_updated_at();

alter table public.service_requests enable row level security;
alter table public.service_request_files enable row level security;

drop policy if exists service_requests_admin_all on public.service_requests;
create policy service_requests_admin_all
on public.service_requests
for all
to public
using (public.is_admin())
with check (public.is_admin());

drop policy if exists service_request_files_admin_all on public.service_request_files;
create policy service_request_files_admin_all
on public.service_request_files
for all
to public
using (public.is_admin())
with check (public.is_admin());

insert into storage.buckets (id, name, public)
values ('request-attachments', 'request-attachments', false)
on conflict (id) do update set public = excluded.public;

drop policy if exists request_attachments_admin_select on storage.objects;
create policy request_attachments_admin_select
on storage.objects
for select
to authenticated
using (bucket_id = 'request-attachments' and public.is_admin());

drop policy if exists request_attachments_admin_insert on storage.objects;
create policy request_attachments_admin_insert
on storage.objects
for insert
to authenticated
with check (bucket_id = 'request-attachments' and public.is_admin());

drop policy if exists request_attachments_admin_update on storage.objects;
create policy request_attachments_admin_update
on storage.objects
for update
to authenticated
using (bucket_id = 'request-attachments' and public.is_admin())
with check (bucket_id = 'request-attachments' and public.is_admin());

drop policy if exists request_attachments_admin_delete on storage.objects;
create policy request_attachments_admin_delete
on storage.objects
for delete
to authenticated
using (bucket_id = 'request-attachments' and public.is_admin());
