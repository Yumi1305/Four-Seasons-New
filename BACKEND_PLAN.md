# Backend plan: Four Seasons scheduled orders & analytics

This doc outlines how to build the backend so the admin page can show scheduled orders and you can run analytics (popular dishes, orders over time, customer frequency).

---

## 1. Stack choice: Supabase vs Firebase vs other

| | Supabase | Firebase | Custom (Node + DB) |
|--|----------|----------|--------------------|
| **You’ve used it** | Yes | — | — |
| **Auth** | Built-in (email, magic link, etc.) | Built-in | You build (e.g. Supabase Auth or JWT) |
| **DB** | Postgres (SQL, RLS) | Firestore (NoSQL) | Your choice |
| **Real-time** | Realtime subscriptions | Firestore listeners | Polling or WebSockets |
| **Charts/analytics** | SQL + your API or Edge Functions | Aggregation queries / Cloud Functions | SQL + your API |
| **Best for** | Structured data, reporting, RLS | Fast prototyping, real-time | Full control |

**Recommendation:** **Supabase** — you already know it, Postgres is a good fit for “orders + items + customers” and for analytics (aggregations, time series, popular dishes). Use Supabase Auth for admin later if you want to replace the password gate.

---

## 2. Data model (Supabase / Postgres)

### Core tables

**`customers`**  
Identify repeat customers by name + grade (no login required for students).

- `id` (uuid, PK)
- `name` (text)
- `grade` (text)
- `created_at`, `updated_at`
- Optional: `email`, `phone` later

**`orders`**  
One row per scheduled order (after payment or on submit, depending on flow).

- `id` (uuid, PK)
- `customer_id` (FK → customers) or denormalized: `customer_name`, `customer_grade` (if you don’t want to create customer until first order)
- `event_id` (text) — e.g. `a-2025-03-10...` from frontend
- `event_name` (text) — e.g. "Westwood High School – Lunch A"
- `event_date_label` (text) — e.g. "Mon, 3/10/25"
- `lunch_slot` (text or enum) — `"A"` or `"B"` (derive from `event_name` in backend)
- `main_id`, `main_name`, `main_price` (or FK to menu_items)
- `side1_id`, `side1_name`, `side1_price` (nullable)
- `side2_id`, `side2_name`, `side2_price` (nullable)
- `amount_cents` (int)
- `status` (text) — e.g. `pending`, `paid`, `fulfilled`, `cancelled`
- `payment_id` (text, nullable) — Square payment ID if you use it
- `created_at`, `updated_at`

**`order_items`** (optional but good for analytics)  
One row per line item so you can aggregate “how many times was dish X ordered”.

- `id` (uuid, PK)
- `order_id` (FK → orders)
- `menu_item_id` (text) — e.g. `main1`, `main2`
- `name` (text)
- `price_cents` or `price` (number)
- `quantity` (int, default 1)
- `role` (text) — `main`, `side1`, `side2`
- `created_at`

Then “popular dishes” = aggregate by `menu_item_id` or `name`; “orders over time” = aggregate by `created_at` (day/week/month).

**`menu_items`** (optional reference table)

- `id` (text, PK) — e.g. `main1`
- `name`, `price`, `category` (main/side), etc.

You can start without this and store item names/prices only on orders; add later for consistency.

---

## 3. Auth for admin (owner / authorized users)

**Current:** Frontend uses `VITE_ADMIN_PASSWORD` and sessionStorage. Good for a single shared password.

**Better (Supabase):**

- Create a table `admin_users` or use Supabase Auth users with a custom claim / metadata like `role: 'admin'`.
- Only allow access to “list orders” and “analytics” APIs if the user is logged in and is an admin.
- Frontend: replace password form with Supabase Auth (e.g. email+password or magic link); call your API with the Supabase JWT; backend verifies JWT and role.

**Firebase:** Use Firebase Auth + custom claims for `admin: true` and protect Firestore/Cloud Functions by checking the claim.

---

## 4. API endpoints (your backend)

Your backend can be **Supabase Edge Functions**, **Vercel/Netlify serverless**, or a **small Node/Express** app. It should:

### 4.1 Payment endpoint (already called by frontend)

- **POST** `VITE_SQUARE_PAYMENT_API_URL` (e.g. `/api/payment` or `/api/orders/pay`)
- Body (from frontend): `nonce`, `amount`, `orderId`, `eventName`, `eventDateLabel`, `customerName`, `grade`, `items: { main, side1, side2 }`
- Backend:
  1. Create or find `customer` by name+grade (or create new).
  2. Create `order` (and optionally `order_items`) with status `pending`.
  3. Call Square API to create payment with `nonce`, `amount`, idempotency key (e.g. `orderId`).
  4. On success: update order to `paid`, set `payment_id`.
  5. Return 200 or 4xx with a clear message.

So **`VITE_SQUARE_PAYMENT_API_URL`** = this endpoint. No access token in the frontend; backend uses Square access token (env var) to create the payment.

### 4.2 List scheduled orders (for admin page)

- **GET** `{VITE_API_URL}/orders`
- Auth: Admin only (e.g. `VITE_ADMIN_PASSWORD` sent in header, or later Supabase JWT).
- Query params (optional): `from`, `to` (date), `lunch_slot`, `status`.
- Response: JSON array of orders in the shape expected by `AdminPage` (see `ScheduledOrder` in `src/pages/AdminPage.tsx`).

So **`VITE_API_URL`** = base URL of this backend (e.g. `https://your-api.vercel.app` or Supabase Edge Function URL). Admin page calls `GET ${VITE_API_URL}/orders`.

### 4.3 Analytics (for future charts)

- **GET** `/api/analytics/orders-over-time?from=...&to=...&groupBy=day|week|month`
- **GET** `/api/analytics/popular-dishes?from=...&to=...&limit=10`
- **GET** `/api/analytics/customers?orderBy=order_count&limit=20`

All admin-only. Implement with SQL (Supabase/Postgres) or Firestore aggregation.

---

## 5. Analytics you asked for (and a bit more)

| Need | How |
|------|-----|
| Which menu items ordered, how many times | Aggregate `order_items` by `menu_item_id` or `name` (count, sum quantity). |
| Timestamps for “orders over time” | Use `orders.created_at` (or `order_items.created_at`); group by day/week/month. |
| Charts: orders over time | Query above → return counts per period → feed your chart library (e.g. Recharts, Chart.js) on a new admin “Analytics” tab. |
| Customers and how many times each ordered | Join `orders` to `customers` (or group by `customer_name,customer_grade`), count orders per customer. |
| Who ordered what on which day / A or B lunch | Already in `orders`: `event_date_label`, `event_name`, `lunch_slot`, `customer_name`, `grade`, main/side1/side2. |

---

## 6. Extra things to consider

- **Idempotency:** Use `orderId` (or a dedicated idempotency key) when calling Square so duplicate submissions don’t double-charge.
- **Webhooks:** Square can send payment completion webhooks; you can update order status to `paid` in the webhook handler as a backup to the response of the create-payment call.
- **Order status:** `pending` → `paid` (after Square success) → `fulfilled` (when you mark it done) or `cancelled`.
- **Privacy:** Store only what you need (name, grade, order details). If you add email/phone later, keep them in `customers` and control who can see them (admin only).
- **Backup / exports:** Supabase (or any SQL DB) makes it easy to export CSV for bookkeeping or “orders by day” reports.

---

## 7. Frontend env vars (recap)

| Variable | Purpose |
|----------|---------|
| `VITE_SQUARE_APPLICATION_ID` | Square Web Payments SDK (browser). |
| `VITE_SQUARE_LOCATION_ID` | Square Web Payments SDK (browser). |
| `VITE_SQUARE_PAYMENT_API_URL` | Your backend payment endpoint (POST nonce + order details). |
| `VITE_API_URL` | **Base URL only**, e.g. `https://YOUR_PROJECT.supabase.co/functions/v1` — do **not** include `/orders` or `/events` (the app appends those). |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon (public) key. Sends as `Authorization: Bearer ...` so Edge Functions accept the request (fixes 401). |
| `VITE_ADMIN_PASSWORD` | Password for `/admin` until you switch to Supabase Auth. |

Backend env (not Vite): Square access token (secret), Supabase URL + anon/service key or DB URL, etc.

### 401 when fetching orders

- Set `VITE_API_URL` to the **functions root**: `https://YOUR_PROJECT_REF.supabase.co/functions/v1` (no trailing `/orders`).
- Add `VITE_SUPABASE_ANON_KEY` to `.env` (your project’s anon key from Supabase dashboard). The admin page sends it so the Edge Function request is authorized.

---

## 8. Events (admin-managed calendar)

Events are stored in the backend so the owner can add, edit, and delete them (with an 8pm-day-before cutoff warning for edits).

- **Table:** `events` — see `supabase/migrations/20250307000000_create_events.sql` (`event_date`, `name`, `slot` A/B, `main_options`, `side_options` jsonb).
- **Edge Function:** `events` — GET (list), POST (create), PATCH (update), DELETE. Deploy with `supabase functions deploy events`.
- **Orders:** For date filtering in admin, ensure `orders` has an `event_date` (date) column; the orders function maps it to `eventDate`.

## 9. Next steps

1. Create Supabase project; add tables above (start with `customers`, `orders`, optionally `order_items`).
2. Run migration for `events`: `supabase db push` or run the SQL in the Supabase SQL editor.
3. Deploy Edge Functions: `supabase functions deploy orders` and `supabase functions deploy events`.
4. Set `VITE_API_URL=https://YOUR_REF.supabase.co/functions/v1` and `VITE_SUPABASE_ANON_KEY=your_anon_key`.
5. Implement payment endpoint (create customer/order, call Square, update order).
6. Point `VITE_SQUARE_PAYMENT_API_URL` at your payment endpoint; test order flow and admin list.
7. Add analytics queries and (optional) an Analytics tab that calls `/api/analytics/...` and renders charts.
