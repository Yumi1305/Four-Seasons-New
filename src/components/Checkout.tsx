import { useEffect, useRef, useState } from "react";
import { getSquareConfig } from "../lib/squareConfig";

declare global {
  interface Window {
    Square?: {
      payments: (appId: string, locationId: string) => {
        card: () => Promise<{
          attach: (selector: string) => Promise<void>;
          tokenize: () => Promise<{
            status: string;
            token?: string;
            errors?: Array<{ message?: string }>;
          }>;
        }>;
      };
    };
  }
}

interface SquareCardInstance {
  tokenize: () => Promise<{
    status: string;
    token?: string;
    errors?: Array<{ message?: string }>;
  }>;
}

export interface EventCardEvent {
  name: string;
  dateLabel: string;
}

export function EventCard({
  event,
  onOrder,
}: {
  event: EventCardEvent;
  onOrder: (event: EventCardEvent) => void;
}) {
  return (
    <div className="event-card">
      <div className="event-card-content">
        <h3>{event.name}</h3>
        <p className="event-date">{event.dateLabel}</p>
        <button className="btn-primary btn-order" onClick={() => onOrder(event)}>
          Order
        </button>
      </div>
    </div>
  );
}

const ORDER_ITEM_PLACEHOLDER_IMG =
  "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&q=80";

export interface OrderFormItemData {
  id?: string;
  name: string;
  /** Optional — pricing is now event-driven (main vs extra), not per-dish. */
  price?: number | string;
  image?: string;
  isNewItem?: boolean;
}

export interface OrderFormItemProps<T extends OrderFormItemData = OrderFormItemData> {
  item: T;
  selected: boolean;
  onSelect: (item: T) => void;
  /** When true, render the card as non-interactive (used when max picks reached). */
  disabled?: boolean;
  /** Optional badge shown when selected (e.g. "Main" or "+$2"). */
  badge?: string;
}

export function OrderFormItem<T extends OrderFormItemData>({
  item,
  selected,
  onSelect,
  disabled,
  badge,
}: OrderFormItemProps<T>) {
  const img = item.image && String(item.image).trim() !== "" ? item.image : ORDER_ITEM_PLACEHOLDER_IMG;
  const className = [
    "order-form-item",
    selected ? "selected" : "",
    disabled ? "disabled" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <button
      type="button"
      className={className}
      onClick={() => onSelect(item)}
      disabled={disabled}
    >
      {item.isNewItem ? (
        <span className="order-form-item-new" aria-label="New item">
          New item!
        </span>
      ) : null}
      {badge ? (
        <span className="order-form-item-badge" aria-label={badge}>
          {badge}
        </span>
      ) : null}
      <div className="order-form-item-info">
        <span className="order-form-item-name">{item.name}</span>
      </div>
      <div
        className="order-form-item-image"
        style={{ backgroundImage: `url(${img})` }}
      />
    </button>
  );
}

export interface CheckoutOrderItem {
  id: string;
  name: string;
  price: number;
}

export interface CheckoutOrder {
  eventId?: string;
  eventName?: string;
  eventDateLabel?: string;
  main?: CheckoutOrderItem | null;
  side1?: CheckoutOrderItem | null;
  side2?: CheckoutOrderItem | null;
  /** Customer name (required for scheduled lunch orders) */
  customerName?: string;
  /** Customer grade (required for scheduled lunch orders) */
  grade?: string;
}

export function CheckoutModal({
  order,
  onClose,
  isMobile,
}: {
  order: CheckoutOrder;
  onClose: () => void;
  isMobile: boolean;
}) {
  const { main, side1, side2 } = order;
  const subtotal =
    (main?.price || 0) + (side1?.price || 0) + (side2?.price || 0);
  const [tip, setTip] = useState(0);
  const [status, setStatus] = useState("idle");
  const cardInstanceRef = useRef<SquareCardInstance | null>(null);
  const total = subtotal + tip;
  const config = getSquareConfig();

  useEffect(() => {
    if (!config.applicationId || !config.locationId) return;
    if (!window.Square) return;

    let mounted = true;
    (async () => {
      try {
        const payments = window.Square!.payments(
          config.applicationId,
          config.locationId
        );
        const card = await payments.card();
        if (mounted && document.getElementById("card-container")) {
          await card.attach("#card-container");
          cardInstanceRef.current = card;
        }
      } catch (e) {
        console.error("Square card init:", e);
      }
    })();

    return () => {
      mounted = false;
      cardInstanceRef.current = null;
    };
  }, [config.applicationId, config.locationId]);

  const handlePay = async () => {
    if (!config.applicationId || !config.locationId) {
      alert(
        "Square is not configured. Add VITE_SQUARE_APPLICATION_ID and VITE_SQUARE_LOCATION_ID to your .env file."
      );
      return;
    }
    if (!cardInstanceRef.current) {
      alert("Payment form is still loading. Please wait.");
      return;
    }

    setStatus("processing");
    try {
      const result = await cardInstanceRef.current.tokenize();
      if (result.status !== "OK" || !result.token) {
        throw new Error(result.errors?.[0]?.message || "Tokenization failed");
      }

      if (config.paymentApiUrl) {
        const res = await fetch(config.paymentApiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nonce: result.token,
            amount: Math.round(total * 100),
            orderId: order.eventId,
            eventName: order.eventName,
            eventDateLabel: order.eventDateLabel,
            customerName: order.customerName,
            grade: order.grade,
            items: {
              main: order.main ? { id: order.main.id, name: order.main.name } : null,
              side1: order.side1 ? { id: order.side1.id, name: order.side1.name } : null,
              side2: order.side2 ? { id: order.side2.id, name: order.side2.name } : null,
            },
          }),
        });
        if (!res.ok) throw new Error("Payment failed");
      } else {
        alert(
          "Payment token received. To complete payments, set VITE_SQUARE_PAYMENT_API_URL and implement a backend endpoint that creates a Square payment."
        );
      }

      setStatus("success");
      setTimeout(onClose, 1500);
    } catch (err) {
      setStatus("idle");
      alert((err instanceof Error ? err.message : "Payment failed. Please try again.") || "Payment failed. Please try again.");
    }
  };

  const content = (
    <div className="checkout-content">
      {isMobile && (
        <button type="button" className="checkout-back" onClick={onClose}>
          ← Back
        </button>
      )}
      <h2>Order Details</h2>
      {(order.customerName != null || order.grade != null) && (
        <p className="checkout-customer">
          {[order.customerName, order.grade].filter(Boolean).join(" · ")}
        </p>
      )}
      <ul className="checkout-items">
        {main && (
          <li>
            1. {main.name} (main) <span>${main.price.toFixed(2)}</span>
          </li>
        )}
        {side1 && (
          <li>
            2. {side1.name} <span>+${side1.price.toFixed(2)}</span>
          </li>
        )}
        {side2 && (
          <li>
            3. {side2.name} <span>+${side2.price.toFixed(2)}</span>
          </li>
        )}
      </ul>
      <div className="checkout-tip">
        <label>Add tip</label>
        <div className="tip-options">
          {[0, 1, 2, 3].map((t) => (
            <button
              key={t}
              type="button"
              className={tip === t ? "active" : ""}
              onClick={() => setTip(t)}
            >
              ${t}
            </button>
          ))}
        </div>
      </div>
      <div className="checkout-total">
        <span>Total</span>
        <span>${total.toFixed(2)}</span>
      </div>
      <div id="card-container" className="square-card-container" />
      <button
        className="btn-primary btn-pay"
        onClick={handlePay}
        disabled={status === "processing"}
      >
        {status === "processing" ? "Processing…" : "Pay with Square"}
      </button>
      <button type="button" className="checkout-close" onClick={onClose}>
        Close
      </button>
    </div>
  );

  if (isMobile) {
    return (
      <div className="checkout-page">
        <div className="checkout-page-inner">{content}</div>
      </div>
    );
  }

  return (
    <div className="checkout-overlay" onClick={onClose}>
      <div className="checkout-modal" onClick={(e) => e.stopPropagation()}>
        {content}
      </div>
    </div>
  );
}
