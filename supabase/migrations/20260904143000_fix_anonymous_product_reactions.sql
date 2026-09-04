drop function if exists public.toggle_product_reaction(uuid, uuid, text);
drop function if exists public.toggle_product_reaction(uuid, text, text);

alter table public.products add column if not exists dislike_count integer not null default 0;
alter table public.product_likes add column if not exists visitor_key text;
alter table public.product_likes alter column user_id drop not null;

drop index if exists public.product_likes_product_visitor_idx;
create unique index if not exists product_likes_product_visitor_idx
on public.product_likes(product_id, visitor_key)
where visitor_key is not null;

create or replace function public.toggle_product_reaction(
  p_product_id uuid,
  p_visitor_key text,
  p_reaction text
)
returns table(reaction text, total_like_count integer, total_dislike_count integer)
language plpgsql security definer set search_path = public
as $$
declare
  v_existing text;
  v_like integer;
  v_dislike integer;
  v_result text;
begin
  if p_product_id is null or p_visitor_key is null or length(trim(p_visitor_key)) < 16 or length(p_visitor_key) > 128 or p_reaction not in ('like','dislike') then
    raise exception 'invalid reaction request';
  end if;
  if not exists (select 1 from public.products p where p.id=p_product_id and p.status='published') then
    raise exception 'product not available';
  end if;
  select pl.reaction into v_existing from public.product_likes pl where pl.product_id=p_product_id and pl.visitor_key=p_visitor_key for update;
  if v_existing is null then
    insert into public.product_likes(product_id,visitor_key,user_id,reaction) values(p_product_id,p_visitor_key,null,p_reaction);
    if p_reaction='like' then
      update public.products p set like_count=coalesce(p.like_count,0)+1,updated_at=now() where p.id=p_product_id;
    else
      update public.products p set dislike_count=coalesce(p.dislike_count,0)+1,updated_at=now() where p.id=p_product_id;
    end if;
    v_result:=p_reaction;
  elsif v_existing=p_reaction then
    delete from public.product_likes pl where pl.product_id=p_product_id and pl.visitor_key=p_visitor_key;
    if p_reaction='like' then
      update public.products p set like_count=greatest(coalesce(p.like_count,0)-1,0),updated_at=now() where p.id=p_product_id;
    else
      update public.products p set dislike_count=greatest(coalesce(p.dislike_count,0)-1,0),updated_at=now() where p.id=p_product_id;
    end if;
    v_result:=null;
  else
    update public.product_likes pl set reaction=p_reaction where pl.product_id=p_product_id and pl.visitor_key=p_visitor_key;
    if p_reaction='like' then
      update public.products p set like_count=coalesce(p.like_count,0)+1,dislike_count=greatest(coalesce(p.dislike_count,0)-1,0),updated_at=now() where p.id=p_product_id;
    else
      update public.products p set dislike_count=coalesce(p.dislike_count,0)+1,like_count=greatest(coalesce(p.like_count,0)-1,0),updated_at=now() where p.id=p_product_id;
    end if;
    v_result:=p_reaction;
  end if;
  select p.like_count,p.dislike_count into v_like,v_dislike from public.products p where p.id=p_product_id;
  return query select v_result,coalesce(v_like,0),coalesce(v_dislike,0);
end;
$$;

revoke all on table public.product_likes from anon, authenticated;
grant execute on function public.toggle_product_reaction(uuid,text,text) to anon, authenticated;
