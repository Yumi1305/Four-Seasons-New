import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, PATCH, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function formatEventDateLabel(eventDate: string): string {
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

  const url = new URL(req.url);
  const pathParts = url.pathname.replace(/^\/+/, "").split("/").filter(Boolean);
  const ordersIndex = pathParts.indexOf("orders");
  const id = ordersIndex >= 0 && pathParts[ordersIndex + 1] ? pathParts[ordersIndex + 1] : null;

  if (req.method !== "GET" && req.method !== "PATCH") {
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

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    if (req.method === "PATCH" && id) {
      // deno-lint-ignore no-explicit-any
      const body = (await req.json()) as any;
      if (typeof body.is_fulfilled !== "boolean") {
        return jsonResponse({ message: "is_fulfilled must be a boolean" }, 400);
      }
      const { error } = await supabase
        .from("orders")
        .update({ is_fulfilled: body.is_fulfilled, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (req.method === "GET") {
      // Use denormalized main/side_1/side_2 columns — they are the source of
      // truth and require no joins or category-name heuristics.
      const { data, error } = await supabase
        .from("orders")
        .select("*, events(title, event_date)")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const rows = (data ?? []).map((o: Record<string, unknown>) => {
        // deno-lint-ignore no-explicit-any
        const ev = (o as any).events as { title?: string; event_date?: string } | undefined;
        // deno-lint-ignore no-explicit-any
        const mainName: string | null = (o as any).main ?? null;
        // deno-lint-ignore no-explicit-any
        const side1Name: string | null = (o as any).side_1 ?? null;
        // deno-lint-ignore no-explicit-any
        const side2Name: string | null = (o as any).side_2 ?? null;

        return {
          id: o.id,
          eventId: o.event_id,
          eventName: ev?.title ?? "",
          eventDate: ev?.event_date ?? undefined,
          eventDateLabel: ev?.event_date ? formatEventDateLabel(ev.event_date) : "",
          lunchSlot: o.lunch_slot,
          // deno-lint-ignore no-explicit-any
          customerName: (o as any).customer_name ?? "",
          // deno-lint-ignore no-explicit-any
          grade: (o as any).grade ?? "",
          main: mainName ? { id: "", name: mainName, price: 8 } : undefined,
          side1: side1Name ? { id: "", name: side1Name, price: 2 } : null,
          side2: side2Name ? { id: "", name: side2Name, price: 2 } : null,
          createdAt: o.created_at,
          status: o.status,
          // deno-lint-ignore no-explicit-any
          isFulfilled: Boolean((o as any).is_fulfilled),
        };
      });

      return jsonResponse(rows, 200);
    }

    return jsonResponse({ message: "Method not allowed" }, 405);
  } catch (err) {
    return jsonResponse(
      { message: err instanceof Error ? err.message : String(err) },
      500,
    );
  }
});
