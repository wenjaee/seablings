-- Align bucket item categories with the PR2 six-bucket contract and remove legacy values.

do $$
declare
  constraint_name text;
begin
  if to_regclass('public.bucket_items') is null then
    raise notice 'Skipping bucket category migration because public.bucket_items does not exist.';
    return;
  end if;

  update bucket_items
  set category = case
    when lower(trim(category)) = 'bakery' then 'cafe'
    when lower(trim(category)) = 'bar' then 'nightlife'
    when lower(trim(category)) = 'other' then 'activity'
    when lower(trim(category)) in ('cafe', 'restaurant', 'nightlife', 'activity', 'culture', 'shopping') then lower(trim(category))
    else 'activity'
  end
  where category is not null
    and lower(trim(category)) <> all (array['cafe', 'restaurant', 'nightlife', 'activity', 'culture', 'shopping']);

  for constraint_name in
    select conname
    from pg_constraint
    where conrelid = 'bucket_items'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%category%'
  loop
    execute format('alter table bucket_items drop constraint if exists %I', constraint_name);
  end loop;

  if not exists (
    select 1 from pg_constraint where conrelid = 'bucket_items'::regclass and conname = 'bucket_items_category_prd_check'
  ) then
    alter table bucket_items
      add constraint bucket_items_category_prd_check
        check (category in ('cafe', 'restaurant', 'nightlife', 'activity', 'culture', 'shopping'));
  end if;
exception
  when duplicate_object then
    null;
end $$;
