import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BASE_PRICE_CENTS = 800; 
const EXTRA_PRICE_CENTS = 200; 
const MAX_DISHES = 3; 

function computeTotal(dishes){
  if (dishes <= 0){return 0}
  let numDishes = Math.min(dishes, MAX_DISHES); 
  return BASE_PRICE_CENTS + (numDishes - 1) * EXTRA_PRICE_CENTS; 
}

function jsonResponse(body, status){
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

Deno.serve(async(req) =>{
  if (req.method === "OPTIONS"){
    return new Response(null, { status: 204, headers: corsHeaders }); 
  }
  if (req.method !== "POST"){
    return jsonResponse({ message: "Method not allowed" }, 405); 
  }


  let body; 
  try{
    body = await req.json(); 
  } catch {
    return jsonResponse({message: "INVALID JSON"}, 400)
  }

  const nonce = String(body.nonce ?? "").trim(); 
  const eventId = String(body.eventId ?? "").trim();
  const lunchSlot    = String(body.lunchSlot   ?? "").trim().toUpperCase();
  const customerName = String(body.customerName ?? "").trim();
  const grade        = String(body.grade        ?? "").trim();
  const clientTotal  = Number(body.amount       ?? -1);

  const items = body.items ?? {}; 
  const mainItem = items.main ?? null; 
  const side1    = items.side1       ?? null;
  const side2    = items.side2       ?? null;

  if (!nonce) {return jsonResponse({message: "MISSING NOONCE"}, 400)}
  if (!eventId)                            return jsonResponse({ message: "Missing: eventId" }, 400);
  if (lunchSlot !== "A" && lunchSlot !== "B") return jsonResponse({ message: "lunchSlot must be A or B" }, 400);
  if (!customerName)                       return jsonResponse({ message: "Missing: customerName" }, 400);
  if (!grade)                              return jsonResponse({ message: "Missing: grade" }, 400);
  if (!mainItem?.name)                     return jsonResponse({ message: "Missing: items.main" }, 400);

  const dishCount = [mainItem, side1, side2].filter(Boolean).length; 
  const serverTotal = computeTotal(dishCount); 

  if (serverTotal !== clientTotal){
    return jsonResponse({
      message: `Total mismatch — you sent ${clientTotal} cents, server says ${serverTotal} cents`
    }, 400); 
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL"), 
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  )

  const {data: orderRow, error: orderErr} = await supabase
  .from("orders")
  .insert(
    {
      event_id:      eventId,
      lunch_slot:    lunchSlot,
      customer_name: customerName,
      grade,
      status:        "pending",
      total_cents:   serverTotal,
      main:          mainItem.name,
      side_1:        side1?.name ?? null,
      side_2:        side2?.name ?? null,
    }
  )
  .select("id")
  .single(); 

  if (orderErr){
    return jsonResponse({ message: orderErr.message }, 500)
  }

  const orderId = orderRow.id;
  const lineItems = [{ order_id: orderId, menu_item_id: mainItem.id ?? null, item_name: mainItem.name, quantity: 1, unit_price_cents: BASE_PRICE_CENTS }, 
    side1 ? { order_id: orderId, menu_item_id: side1.id ?? null, item_name: side1.name, quantity: 1, unit_price_cents: EXTRA_PRICE_CENTS } : null, 
    side2 ? { order_id: orderId, menu_item_id: side2.id ?? null, item_name: side2.name, quantity: 1, unit_price_cents: EXTRA_PRICE_CENTS } : null
  ].filter(Boolean); 

  const {error: itemsErr} = await supabase.from("order_items").insert(lineItems)
  if (itemsErr)return jsonResponse({ message: itemsErr.message }, 500)

  //Call square payment token
  const squareToken = Deno.env.get("SQUARE_ACCESS_TOKEN") ?? "";
  const squareEnv = Deno.env.get('SQUARE_ENV') ?? "sandbox"; 
  const squareLocation = Deno.env.get("SQUARE_LOCATION_ID") ?? ""; 

  if (!squareToken || !squareLocation){
    await supabase.from("orders").update({status: "failed"}).eq("id", orderId); 
    return jsonResponse({message: "no token or location"}, 503); 
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
        idempotency_key: crypto.randomUUID(), 
        amount_money: {amount: serverTotal, currency: "USD"}, 
        location_id: squareLocation, 
        note: `${customerName} - Grade ${grade}`

      })
    }
  )
  const squareData = await squareRes.json();

  //make calls to supabase based on square response, await response
  if (!squareRes.ok || !squareData.payment?.id){
    await supabase.from("orders").update({status: "failed"}).eq("id", orderId)
    return jsonResponse({message: `payment failed, ${JSON.stringify(squareData.errors)}`}, 402)
  }

  await supabase.from("orders").update({
    status: "paid", 
    square_payment_id: squareData.payment.id, 
    square_order_id: squareData.payment.order_id ?? null, 
    updated_at: new Date().toISOString()
  }).eq("id", orderId)

  return jsonResponse({message: `order approved! ${orderId}`}, 200)



})
