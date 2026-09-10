-- Tag a logged order as a customer reorder.
alter table public.collections
  add column if not exists is_reorder boolean not null default false;
