import { supabase } from "./supabaseClient";

export interface ScheduleDish {
  id: string;
  name: string;
  image?: string;
  /** Owner-flagged "New item!" badge for this event. */
  isNewItem?: boolean;
}

export interface ScheduleEvent {
  id: string;
  eventId: string;
  name: string;
  slot: "A" | "B";
  date: Date;
  dateLabel: string;
  eventDate: string;
  /** Ordered dish list. First selection at order time becomes the main. */
  dishes: ScheduleDish[];
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "numeric",
    day: "numeric",
    year: "2-digit",
  });
}

type EventMenuRow = {
  position: number | null;
  show_as_new: boolean | null;
  menu_items?: {
    id?: string;
    name?: string;
    image_url?: string | null;
  } | null;
};

function normalizeDishes(rows: EventMenuRow[]): ScheduleDish[] {
  return [...rows]
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((row) => {
      const img = row.menu_items?.image_url;
      return {
        id: row.menu_items?.id ?? crypto.randomUUID(),
        name: row.menu_items?.name ?? "Unknown item",
        image: img && String(img).trim() !== "" ? String(img) : undefined,
        isNewItem: Boolean(row.show_as_new),
      };
    });
}

export async function fetchScheduleEvents(): Promise<ScheduleEvent[]> {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("events")
    .select(
      "id,title,event_date,has_slot_a,has_slot_b,event_menu_items(position,show_as_new,menu_items(id,name,image_url))",
    )
    .eq("is_active", true)
    .gte("event_date", today)
    .order("event_date", { ascending: true });

  if (error) throw error;

  const events: ScheduleEvent[] = [];
  for (const row of data ?? []) {
    const r = row as {
      id?: string;
      title?: string;
      event_date?: string;
      has_slot_a?: boolean;
      has_slot_b?: boolean;
      event_menu_items?: EventMenuRow[];
    };
    const eventId = String(r.id ?? "");
    const title = String(r.title ?? "");
    const eventDate = String(r.event_date ?? "");
    if (!eventId || !eventDate) continue;

    const baseDate = new Date(`${eventDate}T00:00:00`);
    const dishes = normalizeDishes(r.event_menu_items ?? []);
    const hasA = Boolean(r.has_slot_a);
    const hasB = Boolean(r.has_slot_b);

    if (hasA) {
      events.push({
        id: `${eventId}-A`,
        eventId,
        name: `${title} - Lunch A`,
        slot: "A",
        date: baseDate,
        dateLabel: formatDate(baseDate),
        eventDate,
        dishes,
      });
    }
    if (hasB) {
      events.push({
        id: `${eventId}-B`,
        eventId,
        name: `${title} - Lunch B`,
        slot: "B",
        date: baseDate,
        dateLabel: formatDate(baseDate),
        eventDate,
        dishes,
      });
    }
  }
  return events;
}
