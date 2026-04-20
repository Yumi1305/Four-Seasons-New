import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  getCalendarWeek,
  getCalendarMonth,
  formatDate,
  formatMonthYear,
  formatDayShort,
  formatDayNum,
  isSameDay,
} from "../constants";
import { fetchScheduleEvents, type ScheduleEvent } from "../lib/scheduleApi";

function compactEventLabel(name: string): string {
  return name.replace(/Westwood High School\s*[–-]\s*/, "Westwood – ");
}

type CompactEventCardEvent = ScheduleEvent;

function CompactEventCard({
  event,
  onOrder,
}: {
  event: CompactEventCardEvent;
  onOrder: (event: CompactEventCardEvent) => void;
}) {
  return (
    <div className="calendar-event-card">
      <span className="calendar-event-name">{compactEventLabel(event.name)}</span>
      <button
        type="button"
        className="btn-primary btn-order btn-order-compact"
        onClick={() => onOrder(event)}
      >
        Order
      </button>
    </div>
  );
}

export default function Schedule2Page() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState("week");
  const [cursorDate, setCursorDate] = useState(() => new Date());
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const weekDays = useMemo(
    () => (viewMode === "week" ? getCalendarWeek(cursorDate) : null),
    [viewMode, cursorDate]
  );
  const monthDays = useMemo(
    () => (viewMode === "month" ? getCalendarMonth(cursorDate) : null),
    [viewMode, cursorDate]
  );

  const weekEvents = useMemo(
    () => (weekDays ? events.filter((e) => weekDays.some((d) => isSameDay(d, e.date))) : []),
    [weekDays, events]
  );
  const monthEvents = useMemo(
    () => (monthDays ? events.filter((e) => monthDays.some((d) => isSameDay(d, e.date))) : []),
    [monthDays, events]
  );

  const getEventsForDay = (date: Date, eventsList: CompactEventCardEvent[]) =>
    eventsList.filter((e) => isSameDay(e.date, date));

  const goPrev = () => {
    const d = new Date(cursorDate);
    if (viewMode === "week") d.setDate(d.getDate() - 7);
    else d.setMonth(d.getMonth() - 1);
    setCursorDate(d);
  };
  const goNext = () => {
    const d = new Date(cursorDate);
    if (viewMode === "week") d.setDate(d.getDate() + 7);
    else d.setMonth(d.getMonth() + 1);
    setCursorDate(d);
  };
  const goToday = () => setCursorDate(new Date());

  const handleOrder = (ev: CompactEventCardEvent) => {
    navigate("/schedule/order", { state: { event: ev } });
  };

  const weekStart = viewMode === "week" && weekDays?.length ? weekDays[0] : null;
  const weekEnd = viewMode === "week" && weekDays?.length ? weekDays[6] : null;
  const weekLabel =
    weekStart && weekEnd
      ? `${formatDate(weekStart)} – ${formatDate(weekEnd)}`
      : "";

  return (
    <main className="page-content schedule-page schedule2-page">
      <div className="container">
        <h1 className="page-title">Schedule</h1>
        <p className="page-subtitle">
          Weekly lunch deliveries to Westwood High School
        </p>

        <div className="calendar-toolbar">
          <div className="calendar-view-toggle">
            <button
              type="button"
              className={viewMode === "week" ? "active" : ""}
              onClick={() => setViewMode("week")}
            >
              Week
            </button>
            <button
              type="button"
              className={viewMode === "month" ? "active" : ""}
              onClick={() => setViewMode("month")}
            >
              Month
            </button>
          </div>
          <div className="calendar-nav">
            <button type="button" onClick={goPrev} aria-label="Previous">
              ‹
            </button>
            <span className="calendar-nav-label">
              {viewMode === "week" ? weekLabel : formatMonthYear(cursorDate)}
            </span>
            <button type="button" onClick={goNext} aria-label="Next">
              ›
            </button>
          </div>
          <button type="button" className="calendar-today" onClick={goToday}>
            Today
          </button>
        </div>
        {loading && <p className="admin-loading">Loading events…</p>}
        {error && !loading && <p className="admin-fetch-error">{error}</p>}

        {!loading && !error && viewMode === "week" && weekDays && (
          <div className="calendar-week-grid">
            {weekDays.map((day: Date) => (
              <div key={day.toISOString()} className="calendar-day-cell">
                <div className="calendar-day-header">
                  <span className="calendar-day-name">{formatDayShort(day)}</span>
                  <span className="calendar-day-num">{formatDayNum(day)}</span>
                  <span className="calendar-day-full">{formatDate(day)}</span>
                </div>
                <div className="calendar-day-events">
                  {getEventsForDay(day, weekEvents).map((ev: CompactEventCardEvent) => (
                    <CompactEventCard
                      key={ev.id}
                      event={ev}
                      onOrder={handleOrder}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && !error && viewMode === "month" && monthDays && (
          <>
            <div className="calendar-month-headers">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label) => (
                <div key={label} className="calendar-month-header-cell">
                  {label}
                </div>
              ))}
            </div>
            <div className="calendar-month-grid">
              {monthDays.map((day: Date, i: number) => {
                const isCurrentMonth = day.getMonth() === cursorDate.getMonth();
                const events = getEventsForDay(day, monthEvents);
                return (
                  <div
                    key={i}
                    className={`calendar-month-cell ${
                      !isCurrentMonth ? "other-month" : ""
                    }`}
                  >
                    <div className="calendar-month-day-num">
                      {formatDayNum(day)}
                    </div>
                    <div className="calendar-month-events">
                      {events.map((ev: CompactEventCardEvent) => (
                        <CompactEventCard
                          key={ev.id}
                          event={ev}
                          onOrder={handleOrder}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
