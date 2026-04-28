import { useState, useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { OrderFormItem, CheckoutModal } from "../components/Checkout";
import { isMobileUA, type EventDish } from "../constants";
import { type ScheduleDish, type ScheduleEvent } from "../lib/scheduleApi";
import {
  EVENT_BASE_PRICE,
  EVENT_EXTRA_PRICE,
  EVENT_MAX_DISHES,
  priceForDishAt,
  priceForDishCount,
} from "../lib/eventPricing";

interface OrderData {
  eventId?: string;
  eventName?: string;
  eventDateLabel?: string;
  lunchSlot: "A" | "B";
  main: EventDish;
  side1: EventDish | null;
  side2: EventDish | null;
  customerName: string;
  grade: string;
}

const GRADE_OPTIONS = ["6", "7", "8", "9", "10", "11", "12", "Staff"];

/** Convert a schedule dish + its position in the cart into an EventDish with the right price. */
function toEventDish(d: ScheduleDish, index: number): EventDish {
  return {
    id: d.id,
    name: d.name,
    price: priceForDishAt(index),
    image: d.image,
    isNewItem: d.isNewItem,
  };
}

export default function ScheduleOrderPage() {
  const { state } = useLocation() as { state?: { event?: ScheduleEvent } };
  const navigate = useNavigate();
  const event = state?.event;

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [grade, setGrade] = useState("");
  const [checkoutOrder, setCheckoutOrder] = useState<OrderData | null>(null);

  const isMobile = useMemo(() => isMobileUA(), []);
  const dishes = event?.dishes ?? [];

  const dishById = useMemo(() => {
    const map = new Map<string, ScheduleDish>();
    for (const d of dishes) map.set(d.id, d);
    return map;
  }, [dishes]);

  const selectedDishes = useMemo(
    () =>
      selectedIds
        .map((id) => dishById.get(id))
        .filter((d): d is ScheduleDish => Boolean(d)),
    [selectedIds, dishById]
  );

  const total = priceForDishCount(selectedDishes.length);
  const canCheckout = selectedDishes.length >= 1 && customerName.trim() !== "" && grade !== "";

  const toggleDish = (id: string) => {
    setSelectedIds((prev) => {
      const i = prev.indexOf(id);
      if (i >= 0) return prev.filter((x) => x !== id);
      if (prev.length >= EVENT_MAX_DISHES) return prev;
      return [...prev, id];
    });
  };

  const handleCheckout = () => {
    if (!canCheckout) return;
    const [first, second, third] = selectedDishes;
    if (!first) return;

    const orderData: OrderData = {
      eventId: event?.eventId ?? event?.id,
      eventName: event?.name,
      eventDateLabel: event?.dateLabel,
      lunchSlot: event?.slot ?? "A",
      main: toEventDish(first, 0),
      side1: second ? toEventDish(second, 1) : null,
      side2: third ? toEventDish(third, 2) : null,
      customerName: customerName.trim(),
      grade,
    };
    if (isMobile) {
      navigate("/schedule/checkout", { state: { order: orderData } });
    } else {
      setCheckoutOrder(orderData);
    }
  };

  if (!event) {
    return (
      <main className="page-content schedule-page">
        <div className="container">
          <p>No event selected. <Link to="/schedule">Back to Schedule</Link></p>
        </div>
      </main>
    );
  }

  const remaining = EVENT_MAX_DISHES - selectedDishes.length;

  return (
    <main className="page-content schedule-page">
      <div className="container">
        <h1 className="page-title">Order for event</h1>
        <h2 className="order-event-name">{event.name}</h2>
        <p className="order-form-date">{event.dateLabel}</p>

        <div className="order-form-section">
          <div className="order-form">
            <div className="order-form-customer">
              <h3>Your info *</h3>
              <label className="order-form-field">
                <span>Name</span>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Full name"
                  required
                />
              </label>
              <label className="order-form-field">
                <span>Grade</span>
                <select
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  required
                >
                  <option value="">Select grade</option>
                  {GRADE_OPTIONS.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </label>
            </div>

            <h3>Pick your dishes *</h3>
            <p className="order-form-help">
              Choose up to {EVENT_MAX_DISHES}. Your first pick is the main
              (${EVENT_BASE_PRICE}); each additional is +${EVENT_EXTRA_PRICE}.
              {remaining > 0
                ? ` You can add ${remaining} more.`
                : " You've picked the maximum."}
            </p>
            <div className="order-form-grid">
              {dishes.map((d) => {
                const pickIdx = selectedIds.indexOf(d.id);
                const isSelected = pickIdx >= 0;
                const atLimit = !isSelected && selectedDishes.length >= EVENT_MAX_DISHES;
                return (
                  <OrderFormItem
                    key={d.id}
                    item={d}
                    selected={isSelected}
                    onSelect={() => {
                      if (atLimit) return;
                      toggleDish(d.id);
                    }}
                    disabled={atLimit}
                    badge={isSelected ? (pickIdx === 0 ? "Main" : `+$${EVENT_EXTRA_PRICE}`) : undefined}
                  />
                );
              })}
            </div>

            <button
              className="btn-primary btn-checkout"
              onClick={handleCheckout}
              disabled={!canCheckout}
            >
              Checkout
            </button>
          </div>

          <aside className="order-summary">
            <h3>Order summary</h3>
            {selectedDishes.length === 0 ? (
              <p className="order-summary-empty">
                Pick a dish to start your order.
              </p>
            ) : (
              <ul className="order-summary-items">
                {selectedDishes.map((d, i) => (
                  <li key={d.id}>
                    <span className="order-summary-name">
                      {i === 0 ? `${d.name} (main)` : d.name}
                    </span>
                    <span className="order-summary-price">
                      {i === 0 ? `$${EVENT_BASE_PRICE}` : `+$${EVENT_EXTRA_PRICE}`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div className="order-summary-total">
              <span>Total</span>
              <span>${total.toFixed(2)}</span>
            </div>
          </aside>
        </div>

        {checkoutOrder && !isMobile && (
          <CheckoutModal
            order={checkoutOrder}
            onClose={() => setCheckoutOrder(null)}
            isMobile={false}
          />
        )}
      </div>
    </main>
  );
}
