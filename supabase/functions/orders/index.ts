import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function formatEventDateLabel(eventDate: string): string {
  // event_date is typically YYYY-MM-DD
  const d = new Date(eventDate + "T00:00:00Z");
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "numeric",
    day: "numeric",
    year: "2-digit",
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "GET") {
    return jsonResponse({ message: "Method not allowed" }, 405);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ message: "Missing Authorization" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !supabaseAnonKey) {
      return jsonResponse({ message: "Missing SUPABASE_URL or SUPABASE_ANON_KEY" }, 500);
    }

    // Pass the user's JWT through to Supabase so RLS policies can authorize.
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data, error } = await supabase
      .from("orders")
      .select(
        "*, events(title,event_date), order_items(item_name,quantity,unit_price_cents,menu_item_id, menu_items:menu_item_id(menu_categories(name)))"
      )
      .order("created_at", { ascending: false });

    if (error) throw error;

    const rows = (data ?? []).map((o: Record<string, unknown>) => {
      const ev = (o as any).events as { title?: string; event_date?: string } | undefined;
      const orderItems = ((o as any).order_items ?? []) as Array<any>;

      const fallbackItems = orderItems.map((it) => {
        const qty = Number(it.quantity ?? 1);
        const price = (Number(it.unit_price_cents ?? 0) / 100) * qty;
        return { id: it.menu_item_id ?? it.item_name, name: it.item_name, price };
      });

      const mains: Array<{ id: string | null; name: string; price: number }> = [];
      const sides: Array<{ id: string | null; name: string; price: number }> = [];

      const normalizeCat = (v: unknown): string => String(v ?? "").toLowerCase();
      const classify = (it: any): "main" | "side" | "unknown" => {
        const catName =
          it?.menu_items?.menu_categories?.name ??
          (Array.isArray(it?.menu_items?.menu_categories) ? it.menu_items.menu_categories?.[0]?.name : undefined) ??
          it?.menu_categories?.name ??
          "";
        const c = normalizeCat(catName);
        if (c.includes("main")) return "main";
        if (c.includes("side")) return "side";
        return "unknown";
      };

      for (const it of orderItems) {
        const qty = Number(it.quantity ?? 1);
        const price = (Number(it.unit_price_cents ?? 0) / 100) * qty;
        const entry = { id: it.menu_item_id ?? it.item_name, name: it.item_name, price };

        const kind = classify(it);
        if (kind === "main") mains.push(entry);
        else if (kind === "side") sides.push(entry);
        else {
          // If we can't classify, keep constraints: 1 main max, then sides.
          if (mains.length < 1) mains.push(entry);
          else sides.push(entry);
        }
      }

      // Enforce your constraints: min 1 main (if missing, fallback to first item).
      const main = mains[0] ?? fallbackItems[0];
      const side1 = sides[0] ?? fallbackItems[1] ?? null;
      const side2 = sides[1] ?? fallbackItems[2] ?? null;

      return {
        id: o.id,
        eventId: o.event_id,
        eventName: ev?.title ?? "",
        eventDate: ev?.event_date ?? undefined,
        eventDateLabel: ev?.event_date ? formatEventDateLabel(ev.event_date) : "",
        lunchSlot: o.lunch_slot,
        customerName: (o as any).customer_name ?? "",
        grade: (o as any).customer_grade ?? (o as any).grade ?? "",
        main,
        side1,
        side2,
        createdAt: o.created_at,
        status: o.status,
      };
    });

    return jsonResponse(rows, 200);
  } catch (err) {
    return jsonResponse(
      { message: err instanceof Error ? err.message : String(err) },
      500,
    );
  }
});
