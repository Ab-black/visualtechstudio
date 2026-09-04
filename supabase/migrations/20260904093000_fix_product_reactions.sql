alter table public.products add column if not exists dislike_count integer not null default 0;
alter table public.product_likes add column if not exists visitor_key text;
alter table public.product_likes alter column user_id drop not null;
update public.product_likes set visitor_key = coalesce(visitor_key, user_id::text) where visitor_key is null;
alter table public.product_likes drop constraint if exists product_likes_product_id_user_id_key;
create unique index if not exists product_likes_product_visitor_idx on public.product_likes(product_id, visitor_key) where visitor_key is not null;

create or replace function public.toggle_product_reaction(p_product_id uuid, p_visitor_key text, p_reaction text)
returns table (reaction text, like_count integer, dislike_count integer)
language plpgsql security definer set search_path = public
as $$
declare v_existing text; v_like integer; v_dislike integer; v_reaction text;
begin
 if p_product_id is null or p_visitor_key is null or length(trim(p_visitor_key)) < 16 or length(p_visitor_key) > 128 or p_reaction not in ('like','dislike') then raise exception 'invalid reaction request'; end if;
 if not exists(select 1 from public.products where id=p_product_id and status='published') then raise exception 'product not available'; end if;
 select pl.reaction into v_existing from public.product_likes pl where pl.product_id=p_product_id and pl.visitor_key=p_visitor_key for update;
 if v_existing is null then
  insert into public.product_likes(product_id,visitor_key,reaction) values(p_product_id,p_visitor_key,p_reaction);
  if p_reaction='like' then update public.products set like_count=coalesce(like_count,0)+1,updated_at=now() where id=p_product_id; else update public.products set dislike_count=coalesce(dislike_count,0)+1,updated_at=now() where id=p_product_id; end if;
  v_reaction:=p_reaction;
 elsif v_existing=p_reaction then
  delete from public.product_likes where product_id=p_product_id and visitor_key=p_visitor_key;
  if p_reaction='like' then update public.products set like_count=greatest(coalesce(like_count,0)-1,0),updated_at=now() where id=p_product_id; else update public.products set dislike_count=greatest(coalesce(dislike_count,0)-1,0),updated_at=now() where id=p_product_id; end if;
  v_reaction:=null;
 else
  update public.product_likes set reaction=p_reaction where product_id=p_product_id and visitor_key=p_visitor_key;
  if p_reaction='like' then update public.products set like_count=coalesce(like_count,0)+1,dislike_count=greatest(coalesce(dislike_count,0)-1,0),updated_at=now() where id=p_product_id; else update public.products set dislike_count=coalesce(dislike_count,0)+1,like_count=greatest(coalesce(like_count,0)-1,0),updated_at=now() where id=p_product_id; end if;
  v_reaction:=p_reaction;
 end if;
 select coalesce(like_count,0),coalesce(dislike_count,0) into v_like,v_dislike from public.products where id=p_product_id;
 return query select v_reaction,v_like,v_dislike;
end;
$$;
revoke all on public.product_likes from anon,authenticated;
grant execute on function public.toggle_product_reaction(uuid,text,text) to anon,authenticated;