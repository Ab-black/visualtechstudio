-- Free prompts: title and category become optional; outcome images/video are stored as a list of files in the public-assets bucket.
alter table public.free_prompts alter column title drop not null;
alter table public.free_prompts alter column category drop not null;
alter table public.free_prompts alter column category drop default;
alter table public.free_prompts add column if not exists media jsonb not null default '[]'::jsonb;
alter table public.free_prompts drop constraint if exists free_prompts_media_is_array;
alter table public.free_prompts add constraint free_prompts_media_is_array check (jsonb_typeof(media) = 'array');
