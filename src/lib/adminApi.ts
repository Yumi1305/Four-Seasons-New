import { callEdgeFunction } from "./edgeFunctions";

export interface AdminEventDish {
  id: string;
  name: string;
  imageUrl?: string | null;
  isNewItem?: boolean;
}

export interface AdminEvent {
  id: string;
  eventDate: string;
  name: string;
  slot: "A" | "B" | "Both";
  /** Ordered dishes for the event. First dish is treated as the main on order. */
  dishes: AdminEventDish[];
  createdAt?: string;
  updatedAt?: string;
}

/** Payload for create/update event. Pricing is fixed; only identity is sent. */
export interface SaveEventDishInput {
  /** Existing menu_items.id when chosen from catalog, omitted for new custom dishes. */
  menuItemId?: string;
  name: string;
  isNewItem?: boolean;
}

export type SaveEventPayload = {
  eventDate?: string;
  name?: string;
  slot?: "A" | "B" | "Both";
  dishes: SaveEventDishInput[];
};

function normalizeSlot(slot: SaveEventPayload["slot"]): "A" | "B" | "Both" {
  return slot === "A" || slot === "B" || slot === "Both" ? slot : "Both";
}

/** Ensures required fields are present in JSON (JSON.stringify drops `undefined`). */
function normalizeEventBody(body: SaveEventPayload): SaveEventPayload {
  return {
    ...body,
    eventDate: body.eventDate ?? "",
    name: body.name ?? "",
    slot: normalizeSlot(body.slot),
    dishes: Array.isArray(body.dishes) ? body.dishes : [],
  };
}

export async function fetchOrders(): Promise<unknown[]> {
  const data = await callEdgeFunction<unknown>("orders", { method: "GET" });
  return Array.isArray(data) ? data : [];
}

export async function fetchEvents(): Promise<AdminEvent[]> {
  try {
    const data = await callEdgeFunction<unknown>("events", { method: "GET" });
    return Array.isArray(data) ? (data as AdminEvent[]) : [];
  } catch {
    return [];
  }
}

export async function createEvent(body: SaveEventPayload): Promise<AdminEvent> {
  return callEdgeFunction<AdminEvent>("events", {
    method: "POST",
    body: normalizeEventBody(body),
  });
}

export async function updateEvent(
  id: string,
  body: SaveEventPayload,
  opts?: { force?: boolean }
): Promise<AdminEvent> {
  const path = opts?.force ? `events/${encodeURIComponent(id)}?force=1` : `events/${encodeURIComponent(id)}`;
  return callEdgeFunction<AdminEvent>(path, {
    method: "PATCH",
    body: normalizeEventBody(body),
  });
}

export async function deleteEvent(id: string): Promise<void> {
  await callEdgeFunction<unknown>(`events/${encodeURIComponent(id)}`, { method: "DELETE" });
}
