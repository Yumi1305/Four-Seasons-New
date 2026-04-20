-- Refactor event menus from {mains, sides} to a single ordered list of dishes.
-- Pricing for school lunch is fixed: $10 first dish, +$2 for each additional
-- (max 3). So per-row price overrides and main/side roles are no longer needed.

-- 1. Wipe legacy event data (per owner instruction).
delete from public.event_menu_items;
delete from public.events;

-- 2. Drop columns that no longer apply.
alter table public.event_menu_items
  drop constraint if exists event_menu_items_role_check;
alter table public.event_menu_items
  drop column if exists role;
alter table public.event_menu_items
  drop column if exists override_price_cents;

-- 3. Add stable display ordering. Owner can rearrange dishes in the editor.
alter table public.event_menu_items
  add column if not exists position smallint not null default 1;

create index if not exists event_menu_items_event_position_idx
  on public.event_menu_items(event_id, position);

comment on column public.event_menu_items.position is
  'Display order of dishes within the event (1-based).';
