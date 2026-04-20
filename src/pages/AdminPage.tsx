import { useState, useEffect, useMemo } from "react";
import {
  fetchOrders,
  fetchEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  type AdminEvent,
  type SaveEventDishInput,
} from "../lib/adminApi";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../lib/supabaseClient";
import {
  EventMenuOptionRow,
  type CatalogMenuRow,
  type EventFormDish,
} from "../components/EventMenuOptionRow";
import {
  EVENT_BASE_PRICE,
  EVENT_EXTRA_PRICE,
  EVENT_MAX_DISHES,
} from "../lib/eventPricing";

/** Shape of a scheduled order from the backend API */
export interface ScheduledOrder {
  id: string;
  eventId: string;
  eventName: string;
  eventDate?: string;
  eventDateLabel: string;
  lunchSlot?: "A" | "B" | "Both";
  customerName: string;
  grade: string;
  main?: { id: string; name: string; price: number };
  side1?: { id: string; name: string; price: number } | null;
  side2?: { id: string; name: string; price: number } | null;
  createdAt: string;
  status?: string;
}

/** 8pm (20:00) the day before the event = cutoff for editing without warning */
function getEditCutoff(eventDateStr: string): Date {
  const d = new Date(eventDateStr + "T00:00:00");
  d.setDate(d.getDate() - 1);
  d.setHours(20, 0, 0, 0);
  return d;
}

function isPastCutoff(eventDateStr: string): boolean {
  return new Date() > getEditCutoff(eventDateStr);
}

function newDishRow(): EventFormDish {
  return {
    rowId: crypto.randomUUID(),
    name: "",
    isNewItem: false,
    menuItemId: null,
  };
}

/** Local event editor shape (row ids for React; pricing is fixed per `eventPricing.ts`). */
type EventFormState = {
  eventDate?: string;
  name?: string;
  slot?: "A" | "B" | "Both";
  dishes: EventFormDish[];
};

export default function AdminPage() {
  const { session, loading: authLoading, signOut } = useAuth();
  const sessionToken = session?.access_token ?? null;

  const [orders, setOrders] = useState<ScheduledOrder[]>([]);
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"orders" | "events">("orders");

  // Orders filters
  const [filterDate, setFilterDate] = useState("");
  const [filterSlot, setFilterSlot] = useState<"all" | "A" | "B">("all");

  // Events UI
  const [eventForm, setEventForm] = useState<EventFormState | null>(null);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [lateEditConfirm, setLateEditConfirm] = useState("");
  const [eventError, setEventError] = useState("");
  const [eventsLoading, setEventsLoading] = useState(false);
  const [menuCatalog, setMenuCatalog] = useState<CatalogMenuRow[]>([]);

  useEffect(() => {
    if (!sessionToken || activeTab !== "events") return;
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from("menu_items")
        .select("id,name,price_cents,image_url")
        .eq("is_available", true)
        .order("name");
      if (cancelled) return;
      if (!error && data) setMenuCatalog(data as CatalogMenuRow[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionToken, activeTab]);

  useEffect(() => {
    if (!sessionToken) return;
    let cancelled = false;

    void (async () => {
      setLoading(true);
      setFetchError(null);
      try {
        const raw = await fetchOrders();
        if (cancelled) return;
        setOrders(
          (raw as ScheduledOrder[]).map((o) => {
            const r = o as ScheduledOrder & { eventDate?: string; lunchSlot?: "A" | "B" };
            return { ...o, eventDate: r.eventDate, lunchSlot: r.lunchSlot };
          })
        );
      } catch (e) {
        if (!cancelled) setFetchError(e instanceof Error ? e.message : "Failed to load orders");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionToken]);

  useEffect(() => {
    if (!sessionToken || activeTab !== "events") return;
    let cancelled = false;

    void (async () => {
      setEventsLoading(true);
      try {
        const list = await fetchEvents();
        if (!cancelled) setEvents(list);
      } catch {
        if (!cancelled) setEvents([]);
      } finally {
        if (!cancelled) setEventsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionToken, activeTab]);

  const filteredOrders = useMemo(() => {
    let list = [...orders];
    if (filterDate) {
      list = list.filter((o) => {
        const d = o.eventDate ?? "";
        return d === filterDate || (o.eventDateLabel && o.eventDateLabel.includes(filterDate));
      });
    }
    if (filterSlot !== "all") {
      list = list.filter((o) => {
        const slot = o.lunchSlot ?? (o.eventName?.includes("Lunch A") ? "A" : o.eventName?.includes("Lunch B") ? "B" : null);
        return slot === filterSlot;
      });
    }
    list.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    return list;
  }, [orders, filterDate, filterSlot]);

  const handleLogout = async () => {
    await signOut();
  };

  const handleAddEvent = () => {
    setEditingEventId(null);
    setEventForm({
      eventDate: new Date().toISOString().slice(0, 10),
      name: "Westwood High School",
      slot: "Both",
      dishes: [newDishRow(), newDishRow(), newDishRow()],
    });
    setLateEditConfirm("");
    setEventError("");
  };

  const handleEditEvent = (ev: AdminEvent) => {
    setEditingEventId(ev.id);
    setEventForm({
      eventDate: ev.eventDate,
      name: ev.name,
      slot:
        ev.slot === "A" || ev.slot === "B" || ev.slot === "Both" ? ev.slot : "Both",
      dishes: ev.dishes?.length
        ? ev.dishes.map((d) => ({
            rowId: crypto.randomUUID(),
            menuItemId: d.id,
            name: d.name,
            isNewItem: d.isNewItem ?? false,
          }))
        : [newDishRow(), newDishRow(), newDishRow()],
    });
    setLateEditConfirm("");
    setEventError("");
  };

  const handleSaveEvent = async () => {
    if (!eventForm) return;
    setEventError("");
    const eventDate = (eventForm.eventDate ?? "").trim();
    const name = (eventForm.name ?? "").trim();
    const slot =
      eventForm.slot === "A" || eventForm.slot === "B" || eventForm.slot === "Both"
        ? eventForm.slot
        : "Both";
    if (!eventDate) {
      setEventError("Choose an event date.");
      return;
    }
    if (!name) {
      setEventError("Enter an event name (e.g. school and lunch slot).");
      return;
    }
    const cleanedDishes: SaveEventDishInput[] = eventForm.dishes
      .filter((x) => x.name.trim())
      .map((x) => ({
        menuItemId: x.menuItemId || undefined,
        name: x.name.trim(),
        isNewItem: x.isNewItem,
      }));
    if (!cleanedDishes.length) {
      setEventError("Add at least one dish.");
      return;
    }
    const isLate = editingEventId && eventDate && isPastCutoff(eventDate);
    if (isLate && lateEditConfirm !== "CONFIRM") {
      setEventError('After cutoff: type CONFIRM to save.');
      return;
    }
    try {
      if (editingEventId) {
        await updateEvent(
          editingEventId,
          { eventDate, name, slot, dishes: cleanedDishes },
          { force: Boolean(isLate) }
        );
      } else {
        await createEvent({ eventDate, name, slot, dishes: cleanedDishes });
      }
      setEventForm(null);
      setEditingEventId(null);
      const list = await fetchEvents();
      setEvents(list);
    } catch (e) {
      setEventError(e instanceof Error ? e.message : "Failed to save");
    }
  };

  const handleDeleteEvent = async (id: string) => {
    if (!window.confirm("Delete this event? Existing orders for it will still exist.")) return;
    try {
      await deleteEvent(id);
      setEvents((prev) => prev.filter((e) => e.id !== id));
      if (editingEventId === id) {
        setEventForm(null);
        setEditingEventId(null);
      }
    } catch (e) {
      setEventError(e instanceof Error ? e.message : "Failed to delete");
    }
  };

  const updateDish = (idx: number, patch: Partial<EventFormDish>) => {
    setEventForm((prev) => {
      if (!prev) return prev;
      const current = prev.dishes.map((opt, i) => (i === idx ? { ...opt, ...patch } : opt));
      return { ...prev, dishes: current };
    });
  };

  const addDish = () => {
    setEventForm((prev) => {
      if (!prev) return prev;
      return { ...prev, dishes: [...prev.dishes, newDishRow()] };
    });
  };

  const removeDish = (idx: number) => {
    setEventForm((prev) => {
      if (!prev) return prev;
      const current = prev.dishes.filter((_, i) => i !== idx);
      return {
        ...prev,
        dishes: current.length ? current : [newDishRow()],
      };
    });
  };

  if (authLoading) {
    return (
      <main className="page-content admin-page">
        <div className="container admin-container">
          <div className="admin-panel admin-panel--muted">
            <p className="admin-muted-text">Loading…</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="page-content admin-page">
      <div className="container admin-container">
        <header className="admin-header">
          <div className="admin-header-text">
            <h1 className="admin-title">Dashboard</h1>
            <p className="admin-subtitle">
              Scheduled lunch orders and school events
            </p>
          </div>
          <button type="button" className="btn-admin-outline" onClick={handleLogout}>
            Sign out
          </button>
        </header>

        <div className="admin-tabs" role="tablist" aria-label="Admin sections">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "orders"}
            className={activeTab === "orders" ? "admin-tab active" : "admin-tab"}
            onClick={() => setActiveTab("orders")}
          >
            Orders
            <span className="admin-tab-hint">{orders.length} total</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "events"}
            className={activeTab === "events" ? "admin-tab active" : "admin-tab"}
            onClick={() => setActiveTab("events")}
          >
            Events
            <span className="admin-tab-hint">{events.length} scheduled</span>
          </button>
        </div>

        {activeTab === "orders" && (
          <section className="admin-panel" aria-labelledby="orders-heading">
            <div className="admin-panel-head">
              <h2 id="orders-heading" className="admin-panel-title">
                Scheduled orders
              </h2>
              <p className="admin-panel-desc">
                Filter by date or lunch slot. Newest orders appear first.
              </p>
            </div>
            <div className="admin-filters">
              <label className="admin-filter">
                <span>Date</span>
                <input
                  type="date"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                />
              </label>
              <label className="admin-filter">
                <span>Lunch slot</span>
                <select
                  value={filterSlot}
                  onChange={(e) => setFilterSlot(e.target.value as "all" | "A" | "B")}
                >
                  <option value="all">All</option>
                  <option value="A">A lunch</option>
                  <option value="B">B lunch</option>
                </select>
              </label>
            </div>

            {loading && <p className="admin-loading">Loading orders…</p>}
            {fetchError && (
              <div className="admin-alert admin-alert--error" role="alert">
                {fetchError}
              </div>
            )}
            {!loading && !fetchError && filteredOrders.length === 0 && (
              <p className="admin-empty">No orders match the filters.</p>
            )}
            {!loading && filteredOrders.length > 0 && (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Event</th>
                      <th>Name</th>
                      <th>Grade</th>
                      <th>Main</th>
                      <th>Side 1</th>
                      <th>Side 2</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.map((order) => (
                      <tr key={order.id}>
                        <td>{order.eventDateLabel}</td>
                        <td>{order.eventName}</td>
                        <td>{order.customerName}</td>
                        <td>{order.grade}</td>
                        <td>{order.main?.name ?? "—"}</td>
                        <td>{order.side1?.name ?? "—"}</td>
                        <td>{order.side2?.name ?? "—"}</td>
                        <td>{order.status ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {activeTab === "events" && (
          <section className="admin-events-section" aria-labelledby="events-heading">
            <div className="admin-panel-head admin-panel-head--inline">
              <div>
                <h2 id="events-heading" className="admin-panel-title">
                  Events
                </h2>
                <p className="admin-panel-desc">
                  Define which mains and sides appear on the schedule for each
                  date.
                </p>
              </div>
              <button type="button" className="btn-admin-primary" onClick={handleAddEvent}>
                + New event
              </button>
            </div>

            {eventError && (
              <div className="admin-alert admin-alert--error" role="alert">
                {eventError}
              </div>
            )}

            {eventForm && (
              <div className="admin-event-form-card">
                <h3>{editingEventId ? "Edit event" : "New event"}</h3>
                <div className="admin-event-form">
                  <label className="order-form-field">
                    <span>Event date</span>
                    <input
                      type="date"
                      value={eventForm.eventDate ?? ""}
                      onChange={(e) =>
                        setEventForm((f) =>
                          f ? { ...f, eventDate: e.target.value } : f
                        )
                      }
                    />
                  </label>
                  <label className="order-form-field">
                    <span>Name</span>
                    <input
                      type="text"
                      value={eventForm.name ?? ""}
                      onChange={(e) =>
                        setEventForm((f) => (f ? { ...f, name: e.target.value } : f))
                      }
                      placeholder="e.g. Westwood High School – Lunch A"
                    />
                  </label>
                  <label className="order-form-field">
                    <span>Slot</span>
                    <select
                      value={eventForm.slot ?? "Both"}
                      onChange={(e) =>
                        setEventForm((f) =>
                          f
                            ? {
                                ...f,
                                slot: e.target.value as "A" | "B" | "Both",
                              }
                            : f
                        )
                      }
                    >
                      <option value="A">A lunch</option>
                      <option value="B">B lunch</option>
                      <option value="Both">Both</option>
                    </select>
                  </label>

                  <div className="order-form-field admin-menu-editor">
                    <span>Dishes</span>
                    <p className="admin-menu-hint">
                      Add 3-4 dishes. Customers pick up to {EVENT_MAX_DISHES}: the
                      first is the main (${EVENT_BASE_PRICE}), each additional is
                      +${EVENT_EXTRA_PRICE}. Search the full menu, or click "Add
                      custom" for a one-off.
                    </p>
                    {eventForm.dishes.map((opt, idx) => (
                      <EventMenuOptionRow
                        key={opt.rowId}
                        value={opt}
                        catalog={menuCatalog}
                        index={idx}
                        onChange={(next) => updateDish(idx, next)}
                        onRemove={() => removeDish(idx)}
                      />
                    ))}
                    <button type="button" className="btn-secondary btn-sm" onClick={addDish}>
                      Add dish
                    </button>
                  </div>
                </div>
                {editingEventId && eventForm.eventDate && isPastCutoff(eventForm.eventDate) && (
                  <div className="admin-late-edit">
                    <p>It’s after 8pm the day before this event. Changes may affect orders already placed.</p>
                    <label className="order-form-field">
                      <span>Type CONFIRM to save</span>
                      <input
                        type="text"
                        value={lateEditConfirm}
                        onChange={(e) => setLateEditConfirm(e.target.value)}
                        placeholder="CONFIRM"
                      />
                    </label>
                  </div>
                )}
                <div className="admin-event-form-actions">
                  <button type="button" className="btn-primary" onClick={handleSaveEvent}>
                    Save
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => { setEventForm(null); setEditingEventId(null); }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {eventsLoading && <p className="admin-loading">Loading events…</p>}
            {!eventsLoading && events.length === 0 && !eventForm && (
              <p className="admin-empty">No events yet. Add one to show on the schedule.</p>
            )}
            {!eventsLoading && events.length > 0 && (
              <ul className="admin-events-grid">
                {events.map((ev) => (
                  <li key={ev.id} className="admin-event-card">
                    <button
                      type="button"
                      className="admin-event-card-main"
                      onClick={() => handleEditEvent(ev)}
                    >
                      <span className="admin-event-card-date">{ev.eventDate}</span>
                      <span className="admin-event-card-name">{ev.name}</span>
                      <span className="admin-event-card-slot">Slot {ev.slot}</span>
                    </button>
                    <button
                      type="button"
                      className="admin-event-card-delete"
                      aria-label={`Delete event ${ev.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleDeleteEvent(ev.id);
                      }}
                    >
                      Delete
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
