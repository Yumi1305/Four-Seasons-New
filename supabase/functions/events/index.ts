import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Mirror of `src/lib/eventPricing.ts`. Used for cents math when persisting
// menu_items. Pricing on order is computed by the order/payment flow.
const EVENT_BASE_PRICE_CENTS = 1000;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(s: string): boolean {
  return UUID_RE.test(String(s).trim());
}

function normalizeSlotInput(raw: unknown): string {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  const lower = s.toLowerCase();
  if (lower === "a") return "A";
  if (lower === "b") return "B";
  if (lower === "both") return "Both";
  return s;
}

function slotFlagsFromSlot(slot: string): { has_slot_a: boolean; has_slot_b: boolean } {
  const s = String(slot).trim();
  if (s === "A") return { has_slot_a: true, has_slot_b: false };
  if (s === "B") return { has_slot_a: false, has_slot_b: true };
  if (s === "Both") return { has_slot_a: true, has_slot_b: true };
  return { has_slot_a: true, has_slot_b: false };
}

function slotLabelFromFlags(hasA: boolean, hasB: boolean): "A" | "B" | "Both" {
  if (hasA && hasB) return "Both";
  if (hasA) return "A";
  if (hasB) return "B";
  return "A";
}

function getEditCutoff(eventDate: string): Date {
  const d = new Date(eventDate + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - 1);
  d.setUTCHours(20, 0, 0, 0);
  return d;
}

// deno-lint-ignore no-explicit-any
type SB = any;

/** Custom event-only dishes live under a single category so menu_items.category_id stays valid. */
async function ensureEventDishCategory(supabase: SB) {
  const name = "Event Dishes";
  const { data, error } = await supabase
    .from("menu_categories")
    .select("*")
    .eq("name", name)
    .maybeSingle();
  if (error) throw error;
  if (data) return data;

  const { data: inserted, error: insertErr } = await supabase
    .from("menu_categories")
    .insert({ name })
    .select("*")
    .single();
  if (insertErr) throw insertErr;
  return inserted;
}

async function ensureCustomMenuItem(supabase: SB, categoryId: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Custom dish missing a name");

  const { data, error } = await supabase
    .from("menu_items")
    .select("*")
    .eq("category_id", categoryId)
    .eq("name", trimmed)
    .maybeSingle();
  if (error) throw error;
  if (data) return data;

  const { data: inserted, error: insertErr } = await supabase
    .from("menu_items")
    .insert({
      category_id: categoryId,
      name: trimmed,
      price_cents: EVENT_BASE_PRICE_CENTS,
      is_available: true,
    })
    .select("*")
    .single();
  if (insertErr) throw insertErr;
  return inserted;
}

/** Use existing menu_items row by id, or create one under "Event Dishes" for custom names. */
async function resolveDish(
  supabase: SB,
  // deno-lint-ignore no-explicit-any
  dish: any,
  fallbackCategoryId: string,
): Promise<{ id: string }> {
  const raw =
    dish.menuItemId !== undefined && dish.menuItemId !== null && String(dish.menuItemId).trim() !== ""
      ? String(dish.menuItemId).trim()
      : dish.id !== undefined && dish.id !== null && String(dish.id).trim() !== ""
        ? String(dish.id).trim()
        : "";

  if (raw && isUuid(raw)) {
    const { data, error } = await supabase
      .from("menu_items")
      .select("id")
      .eq("id", raw)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error(`Menu item not found: ${raw}`);
    return { id: data.id };
  }

  const item = await ensureCustomMenuItem(supabase, fallbackCategoryId, String(dish.name ?? ""));
  return { id: item.id };
}

async function getDishesForEvent(supabase: SB, eventId: string) {
  const { data, error } = await supabase
    .from("event_menu_items")
    .select("menu_item_id, position, show_as_new, menu_items(name, image_url)")
    .eq("event_id", eventId)
    .order("position", { ascending: true });
  if (error) throw error;

  // deno-lint-ignore no-explicit-any
  return (data ?? []).map((row: any) => ({
    id: row.menu_item_id,
    name: row?.menu_items?.name ?? "",
    imageUrl: row?.menu_items?.image_url ?? null,
    isNewItem: Boolean(row?.show_as_new),
  }));
}

async function replaceEventDishes(
  supabase: SB,
  eventId: string,
  // deno-lint-ignore no-explicit-any
  dishes: any[],
) {
  const cat = await ensureEventDishCategory(supabase);

  const rows: Array<{
    event_id: string;
    menu_item_id: string;
    position: number;
    show_as_new: boolean;
  }> = [];

  let position = 1;
  for (const d of dishes) {
    if (!d || !String(d.name ?? "").trim()) continue;
    const item = await resolveDish(supabase, d, cat.id);
    rows.push({
      event_id: eventId,
      menu_item_id: item.id,
      position,
      show_as_new: Boolean(d.isNewItem),
    });
    position += 1;
  }

  const { error: delErr } = await supabase
    .from("event_menu_items")
    .delete()
    .eq("event_id", eventId);
  if (delErr) throw delErr;

  if (rows.length) {
    const { error: insErr } = await supabase.from("event_menu_items").insert(rows);
    if (insErr) throw insErr;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return jsonResponse({ message: "Missing Authorization" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !supabaseAnonKey) {
    return jsonResponse({ message: "Missing SUPABASE_URL or SUPABASE_ANON_KEY" }, 500);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const url = new URL(req.url);
  const pathParts = url.pathname.replace(/^\/+/, "").split("/").filter(Boolean);
  const eventsIndex = pathParts.indexOf("events");
  const id = eventsIndex >= 0 && pathParts[eventsIndex + 1] ? pathParts[eventsIndex + 1] : null;

  const force = url.searchParams.get("force") === "1";

  try {
    if (req.method === "GET" && !id) {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("is_active", true)
        .order("event_date", { ascending: true });
      if (error) throw error;

      // deno-lint-ignore no-explicit-any
      const results: any[] = [];
      for (const ev of data ?? []) {
        // deno-lint-ignore no-explicit-any
        const e = ev as any;
        const slot = slotLabelFromFlags(Boolean(e.has_slot_a), Boolean(e.has_slot_b));
        const dishes = await getDishesForEvent(supabase, e.id);
        results.push({
          id: e.id,
          eventDate: e.event_date,
          name: e.title,
          slot,
          dishes,
          createdAt: e.created_at,
          updatedAt: e.updated_at,
        });
      }
      return jsonResponse(results, 200);
    }

    if (req.method === "POST" && !id) {
      const body = (await req.json()) as Record<string, unknown>;
      const eventDate = String(body.eventDate ?? body.event_date ?? "").trim();
      const title = String(body.name ?? body.title ?? "").trim();
      const slotRaw = normalizeSlotInput(body.slot);

      if (!eventDate || !title || !slotRaw) {
        return jsonResponse(
          { message: "Missing eventDate, name, or slot (use slot: A, B, or Both)" },
          400,
        );
      }
      if (slotRaw !== "A" && slotRaw !== "B" && slotRaw !== "Both") {
        return jsonResponse({ message: "Invalid slot (use A, B, or Both)" }, 400);
      }

      const { has_slot_a, has_slot_b } = slotFlagsFromSlot(slotRaw);

      const d = new Date(eventDate + "T00:00:00Z");
      d.setUTCHours(9, 0, 0, 0);

      const { data: insertedEvent, error: insertErr } = await supabase
        .from("events")
        .insert({
          title,
          event_date: eventDate,
          order_cutoff: d.toISOString(),
          has_slot_a,
          has_slot_b,
          is_active: true,
        })
        .select("*")
        .single();
      if (insertErr) throw insertErr;

      // deno-lint-ignore no-explicit-any
      const dishes = (body.dishes ?? []) as any[];
      await replaceEventDishes(supabase, insertedEvent.id, dishes);

      return jsonResponse(
        {
          id: insertedEvent.id,
          eventDate,
          name: title,
          slot: slotLabelFromFlags(has_slot_a, has_slot_b),
          dishes: await getDishesForEvent(supabase, insertedEvent.id),
        },
        201,
      );
    }

    if (req.method === "PATCH" && id) {
      const body = (await req.json()) as Record<string, unknown>;

      let eventDate = String(body.eventDate ?? body.event_date ?? "").trim();
      if (!eventDate) {
        const { data: existing, error: exErr } = await supabase
          .from("events")
          .select("*")
          .eq("id", id)
          .maybeSingle();
        if (exErr) throw exErr;
        // deno-lint-ignore no-explicit-any
        eventDate = String((existing as any)?.event_date ?? "");
      }
      if (!eventDate) return jsonResponse({ message: "Missing eventDate" }, 400);

      const pastCutoff = Date.now() > getEditCutoff(eventDate).getTime();
      if (pastCutoff && !force) {
        return jsonResponse({ message: "Edit cutoff passed" }, 409);
      }

      const title = String(body.name ?? body.title ?? "").trim();
      const slotRaw = normalizeSlotInput(body.slot);

      if (!title || !slotRaw) {
        return jsonResponse(
          { message: "Missing name or slot (use slot: A, B, or Both)" },
          400,
        );
      }
      if (slotRaw !== "A" && slotRaw !== "B" && slotRaw !== "Both") {
        return jsonResponse({ message: "Invalid slot (use A, B, or Both)" }, 400);
      }

      const { has_slot_a, has_slot_b } = slotFlagsFromSlot(slotRaw);

      const d = new Date(eventDate + "T00:00:00Z");
      d.setUTCHours(9, 0, 0, 0);

      const { data: updatedEvent, error: updErr } = await supabase
        .from("events")
        .update({
          title,
          event_date: eventDate,
          order_cutoff: d.toISOString(),
          has_slot_a,
          has_slot_b,
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select("*")
        .single();
      if (updErr) throw updErr;

      // deno-lint-ignore no-explicit-any
      const dishes = (body.dishes ?? []) as any[];
      await replaceEventDishes(supabase, updatedEvent.id, dishes);

      return jsonResponse(
        {
          id: updatedEvent.id,
          eventDate,
          name: title,
          slot: slotLabelFromFlags(has_slot_a, has_slot_b),
          dishes: await getDishesForEvent(supabase, updatedEvent.id),
        },
        200,
      );
    }

    if (req.method === "DELETE" && id) {
      const { error } = await supabase.from("events").delete().eq("id", id);
      if (error) throw error;
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    return jsonResponse({ message: "Method not allowed" }, 405);
  } catch (err) {
    return jsonResponse(formatError(err), 500);
  }
});

function formatError(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    return { message: err.message, name: err.name };
  }
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    return {
      message:
        typeof e.message === "string" && e.message
          ? e.message
          : JSON.stringify(e),
      code: e.code,
      details: e.details,
      hint: e.hint,
    };
  }
  return { message: String(err) };
}
