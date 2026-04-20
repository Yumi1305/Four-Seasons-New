-- Classify event offerings by role (main/side) without relying on menu_categories "Main"/"Side"
-- for items chosen from the full restaurant menu.

ALTER TABLE public.event_menu_items
  ADD COLUMN IF NOT EXISTS role text;

ALTER TABLE public.event_menu_items
  ADD COLUMN IF NOT EXISTS show_as_new boolean NOT NULL DEFAULT false;

UPDATE public.event_menu_items emi
SET role = 'side'
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE emi.menu_item_id = mi.id
  AND mc.name = 'Side';

UPDATE public.event_menu_items emi
SET role = 'main'
WHERE emi.role IS NULL;

ALTER TABLE public.event_menu_items
  ALTER COLUMN role SET NOT NULL;

ALTER TABLE public.event_menu_items
  ALTER COLUMN role SET DEFAULT 'main';

ALTER TABLE public.event_menu_items
  DROP CONSTRAINT IF EXISTS event_menu_items_role_check;

ALTER TABLE public.event_menu_items
  ADD CONSTRAINT event_menu_items_role_check CHECK (role IN ('main', 'side'));

COMMENT ON COLUMN public.event_menu_items.role IS 'Whether this row is a main or a side for the event (independent of menu_items.category).';
COMMENT ON COLUMN public.event_menu_items.show_as_new IS 'Show “New item!” on the customer order UI when true.';
