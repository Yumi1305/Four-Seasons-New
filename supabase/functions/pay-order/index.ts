import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// MUST match src/lib/eventPricing.ts EVENT_BASE_PRICE_CENTS / EVENT_EXTRA_PRICE_CENTS
const BASE_PRICE_CENTS = 800;
const EXTRA_PRICE_CENTS = 200;
const MAX_DISHES = 3;

interface OrderItem {
  id?: string | null;
  name: string;
}

interface PayOrderBody {
  nonce: string;
  eventId: string;
  lunchSlot: string;
  customerName: string;
  grade: string;
  amount: number;
  items: {
    main?: OrderItem | null;
    side1?: OrderItem | null;
    side2?: OrderItem | null;
  };
}

function computeTotal(dishCount: number): number {
  if (dishCount <= 0) return 0;
  return BASE_PRICE_CENTS + (Math.min(dishCount, MAX_DISHES) - 1) * EXTRA_PRICE_CENTS;
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ message: "Method not allowed" }, 405);
  }

  let body: PayOrderBody;
  try {
    body = (await req.json()) as PayOrderBody;
  } catch {
    return jsonResponse({ message: "Invalid JSON" }, 400);
  }

  const nonce = String(body.nonce ?? "").trim();
  const eventId = String(body.eventId ?? "").trim();
  const lunchSlot = String(body.lunchSlot ?? "").trim().toUpperCase();
  const customerName = String(body.customerName ?? "").trim();
  const grade = String(body.grade ?? "").trim();
  const clientTotal = typeof body.amount === "number" ? Math.round(body.amount) : -1;

  const items = body.items ?? {};
  const mainItem = items.main ?? null;
  const side1 = items.side1 ?? null;
  const side2 = items.side2 ?? null;

  if (!nonce) return jsonResponse({ message: "Missing: nonce" }, 400);
  if (!eventId) return jsonResponse({ message: "Missing: eventId" }, 400);
  if (lunchSlot !== "A" && lunchSlot !== "B") return jsonResponse({ message: "lunchSlot must be A or B" }, 400);
  if (!customerName) return jsonResponse({ message: "Missing: customerName" }, 400);
  if (!grade) return jsonResponse({ message: "Missing: grade" }, 400);
  if (!mainItem?.name) return jsonResponse({ message: "Missing: items.main" }, 400);
  if (!Number.isInteger(clientTotal) || clientTotal < 0) {
    return jsonResponse({ message: "Missing or invalid: amount (expected positive integer cents)" }, 400);
  }

  const dishCount = [mainItem, side1, side2].filter(Boolean).length;
  const serverTotal = computeTotal(dishCount);

  if (serverTotal !== clientTotal) {
    return jsonResponse({
      message: `Total mismatch — client sent ${clientTotal} cents, server computed ${serverTotal} cents`,
    }, 400);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { data: event, error: eventErr } = await supabase
      .from("events")
      .select("id, is_active")
      .eq("id", eventId)
      .eq("is_active", true)
      .maybeSingle();

    if (eventErr) return jsonResponse({ message: "Could not verify event" }, 500);
    if (!event) return jsonResponse({ message: "Event not found or not active" }, 404);

    const { data: orderRow, error: orderErr } = await supabase
      .from("orders")
      .insert({
        event_id: eventId,
        lunch_slot: lunchSlot,
        customer_name: customerName,
        grade,
        status: "pending",
        total_cents: serverTotal,
        main: mainItem.name,
        side_1: side1?.name ?? null,
        side_2: side2?.name ?? null,
      })
      .select("id")
      .single();

    if (orderErr) return jsonResponse({ message: orderErr.message }, 500);

    const orderId: string = orderRow.id;

    const lineItems = [
      { order_id: orderId, menu_item_id: mainItem.id ?? null, item_name: mainItem.name, quantity: 1, unit_price_cents: BASE_PRICE_CENTS },
      side1 ? { order_id: orderId, menu_item_id: side1.id ?? null, item_name: side1.name, quantity: 1, unit_price_cents: EXTRA_PRICE_CENTS } : null,
      side2 ? { order_id: orderId, menu_item_id: side2.id ?? null, item_name: side2.name, quantity: 1, unit_price_cents: EXTRA_PRICE_CENTS } : null,
    ].filter(Boolean);

    const { error: itemsErr } = await supabase.from("order_items").insert(lineItems);
    if (itemsErr) {
      await supabase.from("orders").update({ status: "failed" }).eq("id", orderId);
      return jsonResponse({ message: itemsErr.message }, 500);
    }

    const squareToken = Deno.env.get("SQUARE_ACCESS_TOKEN") ?? "";
    const squareEnv = Deno.env.get("SQUARE_ENV") ?? "sandbox";
    const squareLocation = Deno.env.get("SQUARE_LOCATION_ID") ?? "";

    if (!squareToken || !squareLocation) {
      await supabase.from("orders").update({ status: "failed" }).eq("id", orderId);
      return jsonResponse({ message: "Payment provider not configured" }, 503);
    }

    const squareBase = squareEnv === "production"
      ? "https://connect.squareup.com"
      : "https://connect.squareupsandbox.com";

    const squareRes = await fetch(`${squareBase}/v2/payments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${squareToken}`,
        "Square-Version": "2024-06-04",
      },
      body: JSON.stringify({
        source_id: nonce,
        idempotency_key: orderId, // stable: retries reuse same key, preventing double charges
        amount_money: { amount: serverTotal, currency: "USD" },
        location_id: squareLocation,
        note: `${customerName} - Grade ${grade}`,
      }),
    });

    const squareData = await squareRes.json();

    if (!squareRes.ok || !squareData.payment?.id) {
      await supabase.from("orders").update({ status: "failed" }).eq("id", orderId);
      return jsonResponse({ message: `Payment failed: ${JSON.stringify(squareData.errors)}` }, 402);
    }

    await supabase.from("orders").update({
      status: "paid",
      square_payment_id: squareData.payment.id,
      square_order_id: squareData.payment.order_id ?? null,
      updated_at: new Date().toISOString(),
    }).eq("id", orderId);

    return jsonResponse({ message: orderId }, 200);
  } catch (err) {
    console.error("[pay-order] unhandled error:", err);
    return jsonResponse(
      { message: err instanceof Error ? err.message : "Internal server error" },
      500,
    );
  }
});
