create table if not exists public.product_likes (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  visitor_key text not null,
  created_at timestamptz not null default now(),
  unique (product_id, visitor_key)
);

create index if not exists product_likes_product_id_idx on public.product_likes(product_id);

alter table public.product_likes enable row level security;

create or replace function public.toggle_product_like(p_product_id uuid, p_visitor_key text)
returns table (liked boolean, like_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_liked boolean;
  v_count integer;
begin
  if p_product_id is null or p_visitor_key is null or length(trim(p_visitor_key)) < 16 or length(p_visitor_key) > 128 then
    raise exception 'invalid like request';
  end if;

  if not exists (select 1 from public.products where id = p_product_id and status = 'published') then
    raise exception 'product not available';
  end if;

  if exists (select 1 from public.product_likes where product_id = p_product_id and visitor_key = p_visitor_key) then
    delete from public.product_likes where product_id = p_product_id and visitor_key = p_visitor_key;
    update public.products
      set like_count = greatest(coalesce(like_count, 0) - 1, 0), updated_at = now()
      where id = p_product_id;
    v_liked := false;
  else
    insert into public.product_likes(product_id, visitor_key) values (p_product_id, p_visitor_key);
    update public.products
      set like_count = coalesce(like_count, 0) + 1, updated_at = now()
      where id = p_product_id;
    v_liked := true;
  end if;

  select coalesce(like_count, 0) into v_count from public.products where id = p_product_id;
  return query select v_liked, v_count;
end;
$$;

revoke all on public.product_likes from anon, authenticated;
grant execute on function public.toggle_product_like(uuid, text) to anon, authenticated;
