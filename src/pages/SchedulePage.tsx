import { useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { EventCard } from "../components/Checkout";
import { fetchScheduleEvents, type ScheduleEvent } from "../lib/scheduleApi";

export default function SchedulePage() {
  const navigate = useNavigate();

  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchScheduleEvents()
      .then((rows) => {
        if (cancelled) return;
        setEvents(rows);
        setError(null);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setEvents([]);
        setError(e instanceof Error ? e.message : "Failed to load events");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredEvents = useMemo(
    () =>
      events.filter(
        (e) =>
          e.name.toLowerCase().includes(search.toLowerCase()) ||
          e.dateLabel.toLowerCase().includes(search.toLowerCase())
      ),
    [events, search]
  );

  return (
    <main className="page-content schedule-page">
      <div className="container">
        <h1 className="page-title">Schedule</h1>
        <p className="page-subtitle">
          Weekly lunch deliveries to Westwood High School
        </p>
        <p className="schedule-alt-link">
          <Link to="/schedule2">Try calendar view (week / month)</Link>
        </p>

        <div className="schedule-filters">
          <div className="search-wrap">
            <input
              type="search"
              placeholder="Search events…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="schedule-search"
            />
          </div>
        </div>

        {loading && <p className="admin-loading">Loading events…</p>}
        {error && !loading && <p className="admin-fetch-error">{error}</p>}
        {!loading && !error && filteredEvents.length === 0 && (
          <p className="admin-empty">No active events found in Supabase.</p>
        )}
        <div className="event-cards">
          {filteredEvents.map((ev) => (
            <EventCard
              key={ev.id}
              event={ev}
              onOrder={() =>
                navigate("/schedule/order", { state: { event: ev } })
              }
            />
          ))}
        </div>
      </div>
    </main>
  );
}
