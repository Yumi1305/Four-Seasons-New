import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// ---------------------------------------------------------------------------
// CORS — required so the browser can reach this function from any origin.
// OPTIONS is the "preflight" the browser sends first to ask "is this allowed?"
// ---------------------------------------------------------------------------
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ---------------------------------------------------------------------------
// Pricing mirror — must match src/lib/eventPricing.ts exactly.
// We duplicate it here because Edge Functions can't import from src/.
// If you change the pricing model, update both files.
// ---------------------------------------------------------------------------
const BASE_PRICE_CENTS = 1000; // $10 — first dish (the "main")
const EXTRA_PRICE_CENTS = 200; //  $2 — each additional dish
const MAX_DISHES = 3;

function serverComputedTotal(dishCount: number): number {
  if (dishCount <= 0) return 0;
  const capped = Math.min(dishCount, MAX_DISHES);
  return BASE_PRICE_CENTS + (capped - 1) * EXTRA_PRICE_CENTS;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function formatError(err: unknown): Record<string, unknown> {
  if (err instanceof Error) return { message: err.message, name: err.name };
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    return {
      message: typeof e.message === "string" && e.message ? e.message : JSON.stringify(e),
      code: e.code,
      details: e.details,
      hint: e.hint,
    };
  }
  return { message: String(err) };
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------
Deno.serve(async (req) => {
  // Preflight — always return 204 with CORS headers so the browser proceeds.
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ message: "Method not allowed" }, 405);

  // Service-role key bypasses RLS — never expose this to the browser.
  // Supabase auto-injects SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY into every function.
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Square secrets — set via `supabase secrets set ...`, never in .env files.
  const squareAccessToken = Deno.env.get("SQUARE_ACCESS_TOKEN") ?? "";
  const squareEnv = Deno.env.get("SQUARE_ENV") ?? "sandbox";
  const squareLocationId = Deno.env.get("SQUARE_LOCATION_ID") ?? "";

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    // -----------------------------------------------------------------------
    // STEP 4 — Parse and validate the request body
    // -----------------------------------------------------------------------
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ message: "Invalid JSON body" }, 400);
    }

    // Pull every field we need, defaulting to empty string so the guards below
    // catch missing values cleanly instead of throwing on undefined.
    const nonce = String(body.nonce ?? "").trim();
    // The frontend sends `orderId` for the event UUID (legacy naming — see Checkout.tsx).
    const eventId = String(body.eventId ?? body.orderId ?? "").trim();
    const lunchSlot = String(body.lunchSlot ?? "").trim().toUpperCase();
    const customerName = String(body.customerName ?? "").trim();
    const grade = String(body.grade ?? "").trim();
    // Client-reported total — we verify this matches our server computation below.
    const clientTotalCents = Number(body.amount ?? -1);

    // Items: main is required, sides are optional.
    type ItemShape = { id?: string; name?: string } | null;
    const items = (body.items ?? {}) as Record<string, ItemShape>;
    const mainItem = items.main;
    const side1Item = items.side1 ?? null;
    const side2Item = items.side2 ?? null;

    // Required-field guards — return 400 with a clear message for each.
    if (!nonce) return jsonResponse({ message: "Missing: nonce" }, 400);
    if (!eventId) return jsonResponse({ message: "Missing: eventId" }, 400);
    if (lunchSlot !== "A" && lunchSlot !== "B")
      return jsonResponse({ message: "Invalid lunchSlot — must be 'A' or 'B'" }, 400);
    if (!customerName) return jsonResponse({ message: "Missing: customerName" }, 400);
    if (!grade) return jsonResponse({ message: "Missing: grade" }, 400);
    if (!mainItem?.name) return jsonResponse({ message: "Missing: items.main" }, 400);

    // Server-side price verification — this is the security-critical part.
    // Count non-null items; clamp at MAX_DISHES.
    const dishCount = [mainItem, side1Item, side2Item].filter(Boolean).length;
    const serverTotal = serverComputedTotal(dishCount);

    if (clientTotalCents !== serverTotal) {
      return jsonResponse(
        {
          message: `Total mismatch — client: ${clientTotalCents} cents, server: ${serverTotal} cents`,
        },
        400,
      );
    }

    // -----------------------------------------------------------------------
    // STEP 5 — Insert orders + order_items with status = 'pending'
    //
    // Why pending first? Because we need an order row to store the Square
    // payment ID on. We create it before charging so we don't charge and then
    // lose track of the payment if the DB write fails.
    // -----------------------------------------------------------------------
    const { data: orderRow, error: orderErr } = await supabase
      .from("orders")
      .insert({
        event_id: eventId,
        lunch_slot: lunchSlot,
        customer_name: customerName,
        grade,
        status: "pending",
        total_cents: serverTotal,
        // Denormalized text snapshots so the admin list doesn't need a join.
        main: mainItem.name,
        side_1: side1Item?.name ?? null,
        side_2: side2Item?.name ?? null,
      })
      .select("id")
      .single();

    if (orderErr) throw orderErr;
    const orderId = orderRow.id as string;

    // order_items is the analytic source of truth (line-item counts, etc.).
    const orderItemRows = [
      mainItem
        ? {
            order_id: orderId,
            menu_item_id: mainItem.id || null,
            item_name: mainItem.name,
            quantity: 1,
            unit_price_cents: BASE_PRICE_CENTS,
          }
        : null,
      side1Item
        ? {
            order_id: orderId,
            menu_item_id: side1Item.id || null,
            item_name: side1Item.name,
            quantity: 1,
            unit_price_cents: EXTRA_PRICE_CENTS,
          }
        : null,
      side2Item
        ? {
            order_id: orderId,
            menu_item_id: side2Item.id || null,
            item_name: side2Item.name,
            quantity: 1,
            unit_price_cents: EXTRA_PRICE_CENTS,
          }
        : null,
    ].filter(Boolean);

    if (orderItemRows.length > 0) {
      const { error: itemsErr } = await supabase.from("order_items").insert(orderItemRows);
      if (itemsErr) throw itemsErr;
    }

    // -----------------------------------------------------------------------
    // STEP 6 — Call Square /v2/payments
    //
    // The nonce is a single-use token Square's SDK gave the browser.
    // We exchange it here for an actual charge.
    // idempotency_key prevents double-charges if the request is retried.
    // -----------------------------------------------------------------------
    if (!squareAccessToken || !squareLocationId) {
      await supabase.from("orders").update({ status: "failed" }).eq("id", orderId);
      return jsonResponse({ message: "Square is not configured on this server" }, 503);
    }

    const squareBase =
      squareEnv === "production"
        ? "https://connect.squareup.com"
        : "https://connect.squareupsandbox.com";

    const squareRes = await fetch(`${squareBase}/v2/payments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${squareAccessToken}`,
        "Square-Version": "2024-06-04",
      },
      body: JSON.stringify({
        source_id: nonce,
        idempotency_key: crypto.randomUUID(), // unique per request — Square rejects duplicates
        amount_money: { amount: serverTotal, currency: "USD" },
        location_id: squareLocationId,
        note: `${customerName} · Grade ${grade} · Event ${eventId}`,
      }),
    });

    // deno-lint-ignore no-explicit-any
    const squareData = (await squareRes.json()) as Record<string, any>;

    // -----------------------------------------------------------------------
    // STEP 7 — Update order with payment result, return order ID
    // -----------------------------------------------------------------------
    if (!squareRes.ok || !squareData.payment?.id) {
      // Payment failed — mark the order so the admin can see it.
      await supabase.from("orders").update({ status: "failed" }).eq("id", orderId);
      const errMsg = JSON.stringify(squareData.errors ?? squareData);
      return jsonResponse({ message: `Payment declined: ${errMsg}` }, 402);
    }

    const payment = squareData.payment as { id: string; order_id?: string };

    await supabase
      .from("orders")
      .update({
        status: "paid",
        square_payment_id: payment.id,
        square_order_id: payment.order_id ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    // Return the order ID so the frontend can show a confirmation number.
    return jsonResponse({ orderId }, 200);
  } catch (err) {
    return jsonResponse(formatError(err), 500);
  }
});
