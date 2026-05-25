# Four Seasons — Web App

Marketing site + lunch-ordering platform for a family Chinese restaurant. The
public site shows the menu, hours, and a calendar of upcoming school-lunch
events; an admin can manage events and view incoming orders; customers can
order on a per-event basis with Square payments.

This document is the onboarding guide. Read it in order — sections build on
each other.

---

## 1. Tech stack

| Layer | Choice |
|------|--------|
| UI | React 19 + TypeScript, Vite, plain CSS (`src/styles.css`) |
| Routing | `react-router-dom` v7 |
| Auth | Supabase Auth (admin only — customers don't sign in) |
| DB | Supabase Postgres (RLS-enforced) |
| Server logic | Supabase Edge Functions (Deno) |
| Payments | Square Web Payments SDK (browser) + Square `/v2/payments` (server) |

There is **no separate Node backend**. Everything server-side runs as a
Supabase Edge Function.

---

## 2. Quick start

Assuming you already have Node 20+, `npm`, and the Supabase CLI installed.

```bash
# 1. Install JS dependencies
npm install

# 2. Create your env file (template below)
cp .env.development .env.development.local   # or fill in .env.development directly

# 3. Run the dev server
npm run dev
```

That's enough to see the public site. To touch admin / database / Edge
Functions you also need to be linked to the Supabase project:

```bash
supabase login
supabase link --project-ref uugfmwkxzxbwmectmgpg
```

Ask the project owner for credentials/access if your `supabase projects list`
doesn't show this ref.

### Required env vars

`.env.development` (Vite reads `VITE_*` and inlines them into the browser
bundle — never put secrets here):

```
VITE_SUPABASE_URL=https://<ref>.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...    # publishable / anon key, NOT service role
VITE_API_URL=https://<ref>.supabase.co/functions/v1   # base only — no trailing /events

VITE_SQUARE_APPLICATION_ID=sandbox-sq0idb-...
VITE_SQUARE_LOCATION_ID=L...
VITE_SQUARE_PAYMENT_API_URL=                 # set after the pay-order function is live
```

Server-side secrets live in Supabase, not in any `.env`:

```bash
supabase secrets set SQUARE_ACCESS_TOKEN=EAAAE...   # sandbox or production token
supabase secrets set SQUARE_ENV=sandbox             # 'sandbox' or 'production'
supabase secrets set SQUARE_LOCATION_ID=L...
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are
auto-injected into every Edge Function — don't set them yourself.

### npm scripts

```bash
npm run dev        # Vite dev server with HMR
npm run build      # tsc -b && vite build
npm run lint       # eslint
npm run preview    # serve the built bundle locally
```

There's no `npm test` yet (see "Known gaps" below).

---

## 3. Repo layout

```
src/
  App.tsx                  # routes
  main.tsx                 # mount + AuthProvider
  styles.css               # all CSS (single file, BEM-ish names)

  pages/
    HomePage.tsx           # / — hero, hours, links
    MenuPage.tsx           # /menu
    SchedulePage.tsx       # /schedule — list view
    Schedule2Page.tsx      # /schedule2 — calendar view
    ScheduleOrderPage.tsx  # /schedule/order — pick dishes for an event
    CheckoutPage.tsx       # /schedule/checkout — mobile checkout
    OrderPage.tsx          # /order — generic ordering (currently a stub)
    AdminPage.tsx          # /admin — orders + event editor
    AdminLoginPage.tsx     # /admin/login

  components/
    AdminRoute.tsx         # guards /admin (loading/unauth fallbacks)
    Checkout.tsx           # Square card form + checkout modal/page
    EventMenuOptionRow.tsx # one dish row in the admin event editor
    Header.tsx, Footer.tsx, HoursLink.tsx, HeroCarousel.tsx, ErrorBoundary.tsx

  contexts/
    AuthProvider.tsx       # session + isAdmin gate
    auth-context.ts        # context type (split from provider for fast refresh)

  hooks/
    useAuth.ts             # consumer hook for AuthContext

  lib/
    env.ts                 # validated VITE_* readers
    supabaseClient.ts      # singleton @supabase/supabase-js client
    edgeFunctions.ts       # callEdgeFunction<T>() wrapper
    adminApi.ts            # admin CRUD over /events and /orders
    scheduleApi.ts         # public read of upcoming events
    eventPricing.ts        # fixed pricing model ($10 main, +$2 each)
    squareConfig.ts        # reads Square VITE_* env

  constants.ts             # date helpers, shared types

supabase/
  config.toml
  functions/
    events/index.ts        # admin CRUD: GET (list), POST, PATCH, DELETE
    orders/index.ts        # admin GET (list)
    pay-order/index.ts     # public POST — runs payment + writes order   (in progress)
  migrations/
    *.sql                  # Postgres schema migrations
```

Notable supporting files:

- `BACKEND_PLAN.md` — original architecture brief (some details superseded by
  this README; kept for the data-model rationale and analytics plans).
- `vite.config.ts` — vanilla React plugin only.
- `tsconfig.app.json` / `tsconfig.node.json` — separate TS projects for
  app vs. tooling. `tsc -b` builds both.

---

## 4. Architecture overview

```
              ┌────────────────────────────────────────────┐
              │                Browser                      │
              │ React app (public + admin pages)            │
              │ Square Web Payments SDK (returns nonce)     │
              └────────┬──────────────────────┬─────────────┘
                       │                      │
            anon key + │           anon key + │
       user JWT (admin)│         (no JWT) for │
                       │       customer order │
                       ▼                      ▼
        ┌────────────────────────┐  ┌────────────────────────┐
        │ Edge Function: events  │  │ Edge Function: pay-order│
        │ Edge Function: orders  │  │ (uses service-role key) │
        │ (RLS via user JWT)     │  │ + Square /v2/payments   │
        └──────────┬─────────────┘  └────────────┬────────────┘
                   │                              │
                   ▼                              ▼
        ┌──────────────────────────────────────────────────┐
        │             Supabase Postgres                    │
        │ events / event_menu_items / orders / order_items │
        │ menu_items / menu_categories / admin_users       │
        └──────────────────────────────────────────────────┘
```

Two access patterns intentionally coexist:

- **Admin paths** (`events`, `orders`) forward the logged-in admin's JWT to
  Postgres so RLS authorizes per-user. The Edge Function is just a thin layer.
- **Public payment path** (`pay-order`) accepts unauthenticated customers and
  uses the **service role key** (server-only) to insert into `orders` /
  `order_items`. RLS is bypassed deliberately — but only for the specific
  rows the function constructs from the validated request.

---

## 5. Auth model

- **Customers don't sign in.** They land on `/schedule`, pick an event, fill
  name + grade, pay. No account, no email/password.
- **Admins sign in via Supabase Auth.** The `admin_users` table maps
  `auth_id` (a Supabase user UUID) to admin permissions. `AuthProvider`:
  1. Reads the session from Supabase.
  2. Looks up the user in `admin_users`. If missing → `signOut()`.
  3. Sets `isAdmin` only when the lookup succeeds.
- `AdminRoute` shows a loading state while the gate resolves and redirects to
  `/admin/login` if unauthorized.
- Admin tokens are forwarded as `Authorization: Bearer <jwt>` to Edge
  Functions; the function passes the same header into `createClient(...)` so
  RLS sees the real user.

---

## 6. Database schema (high level)

Authoritative source = `supabase/migrations/*.sql`. The current shape:

### Menu (catalog)
- `menu_categories(id, name, …)`
- `menu_items(id, category_id, name, price_cents, image_url, is_available, …)`

### Events (per-event lunch offerings)
- `events(id, title, event_date, order_cutoff, has_slot_a, has_slot_b, is_active, …)`
- `event_menu_items(event_id, menu_item_id, position, show_as_new)`

After the **dish refactor** migration (`20260420000000_event_dishes_refactor.sql`),
each event has a single ordered list of dishes (no main/side split). Pricing
is **fixed** by `eventPricing.ts`:

> First dish chosen = the **main** at $10. Each additional dish = +$2.
> Maximum 3 dishes per order ($14 max).

Custom one-off dishes the owner adds in the editor are stored under an
auto-managed category named `Event Dishes` in `menu_items`, so the
foreign-key constraint stays valid without polluting the public menu.

### Orders
- `orders(id, event_id, lunch_slot, customer_name, customer_email?,
  customer_phone?, status, square_payment_id?, square_order_id?,
  total_cents, main, side_1?, side_2?, grade, created_at, updated_at)`
- `order_items(id, order_id, menu_item_id?, item_name, quantity,
  unit_price_cents)`

`lunch_slot` is an enum: `'A' | 'B'` (no `'Both'` — one slot per order).
`order_status` is an enum: `'pending' | 'paid' | 'cancelled' | 'refunded' | 'failed'`.
`grade` is `text` (so `'Staff'` works alongside `'6'..'12'`).

`main`, `side_1`, `side_2` are denormalized text snapshots so the admin list
doesn't need a join. `order_items` is the source of truth for analytics
(line-item counts, popular dishes, etc.).

### Admin
- `admin_users(id, auth_id, …)` — every row authorizes one Supabase Auth
  user as an admin.

### RLS
RLS is on by default on every table. The pattern: tables admins write to
have policies tied to membership in `admin_users`; tables that customers can
write to (currently none — `pay-order` uses service role) have
policies-or-service-role.

---

## 7. Edge Functions

All Deno. All deployed via `supabase functions deploy <name>`. They share
this skeleton:

```ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = { /* see existing functions */ };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { status: 204, headers: corsHeaders });

  // 1. method guard
  // 2. parse + validate body
  // 3. do the thing
  // 4. return jsonResponse(...)
});
```

### `events` (admin CRUD)

`GET|POST|PATCH|DELETE /functions/v1/events[/<id>]`

Requires a logged-in admin's `Authorization` header. Body shape:

```ts
{ eventDate: "YYYY-MM-DD", name: string, slot: "A"|"B"|"Both",
  dishes: { menuItemId?: string, name: string, isNewItem?: boolean }[] }
```

Pricing is **not** in the body — it's fixed. The function only persists
identity + display data.

PATCH supports `?force=1` to override the 8pm-day-before edit cutoff.

### `orders` (admin read)

`GET /functions/v1/orders` — returns the order list for the admin panel,
with denormalized customer/event/menu joins flattened into a friendly
shape.

### `pay-order` (in progress)

Public POST endpoint that:

1. Validates the payload (event id, slot, dish IDs, customer info, Square
   nonce, expected total).
2. Recomputes the total server-side from `eventPricing` constants and
   verifies it matches the client.
3. Inserts `orders` (`status='pending'`) and `order_items` rows using the
   service-role key.
4. Calls Square `/v2/payments` with `nonce` + `SQUARE_ACCESS_TOKEN`.
5. Updates the order to `paid` (and stores `square_payment_id`) on success,
   or `failed` on error.
6. Returns the new `order.id` to the client.

`SQUARE_ENV` selects the API base URL: `connect.squareupsandbox.com` for
`sandbox`, `connect.squareup.com` for `production`. Flipping environments
is a secret swap — no code change.

### Calling from the frontend

Use `callEdgeFunction(path, { method, body })` from `src/lib/edgeFunctions.ts`.
It:

- Resolves the admin's access token (refreshing if it's near expiry).
- Sets `apikey` (anon) and `Authorization: Bearer <token>` headers.
- Throws a useful error containing status + body for non-2xx responses.

---

## 8. Key user flows

### Admin: create / edit an event
1. `/admin/login` → `AuthProvider` checks `admin_users` membership.
2. `/admin` → "Events" tab calls `fetchEvents()` (GET `/events`).
3. "+ New event" / clicking a card opens the editor (`AdminPage` →
   `EventMenuOptionRow`). Owner picks dishes from the catalog or types
   custom ones.
4. Save → `createEvent()` / `updateEvent()` → POST/PATCH `/events`.
5. After cutoff, the editor requires typing `CONFIRM` and the API call
   is sent with `?force=1`.

### Customer: place an order
1. `/schedule` (list) or `/schedule2` (calendar) → `fetchScheduleEvents()`
   reads events directly from Postgres via the Supabase client (RLS-public).
2. Pick an event → `/schedule/order` (`ScheduleOrderPage`).
3. Toggle up to 3 dishes; the first becomes the main ($10), extras are +$2.
4. Submit → `Checkout` mounts the Square card form, tokenizes → POST to
   `pay-order` with `{ nonce, eventId, lunchSlot, dishIds, customer, ... }`.
5. On 200, customer sees a confirmation; the order appears in the admin
   "Orders" tab.

---

## 9. Conventions

### Code style
- TypeScript `strict` is on. No implicit `any`. We prefer explicit types on
  exported APIs; `as` casts only when you know more than the compiler.
- React: functional components only. No class components. Hooks rules
  enforced by ESLint.
- Don't add comments that just narrate code. Comments explain *why*, not
  *what*. Existing functions follow this rule — match the style.
- File naming: components `PascalCase.tsx`, libs/utilities `camelCase.ts`.
  One default export per page/component file.

### Imports & state
- Single `supabase` client from `lib/supabaseClient.ts`. Don't `createClient`
  elsewhere.
- Single `AuthProvider` wraps the app in `main.tsx`. Read auth via
  `useAuth()` — never re-create the provider.
- Env access goes through `lib/env.ts` (or `lib/squareConfig.ts`). They
  throw on missing values so misconfiguration fails fast.

### Edge Functions
- Always include the CORS preflight (`OPTIONS → 204`) and method guard.
- Always pass the user's `Authorization` header into `createClient` for
  admin-only functions, so RLS does the actual authz.
- Use `formatError()` (see `events/index.ts`) for error responses so
  Supabase / PostgREST errors expose `code`, `details`, `hint`.

### Database
- Schema changes go through migrations in `supabase/migrations/`. Never
  hand-edit the live DB unless you're also writing the matching migration.
- Migration filenames: `YYYYMMDDHHMMSS_<short_description>.sql`.

---

## 10. Common dev tasks

```bash
# Run the app
npm run dev

# Type-check + bundle
npm run build
npx tsc -b --noEmit                   # types only

# Push DB migrations
supabase db push

# Deploy a single Edge Function
supabase functions deploy events
supabase functions deploy orders
supabase functions deploy pay-order

# Inspect a deployed function's logs
supabase functions logs pay-order --tail

# Probe an Edge Function from the terminal
curl -sS -X GET https://<ref>.supabase.co/functions/v1/events \
  -H "apikey: <publishable_key>" \
  -H "Authorization: Bearer <publishable_key>"
```

---

## 11. Troubleshooting (real bugs we've already hit)

- **400 from `events` POST** with a message that doesn't exist anywhere in
  the repo → the deployed function is stale. `supabase functions deploy events`.
- **500 with `"[object Object]"`** → the catch block isn't unwrapping the
  Supabase error. Use `formatError()` (already in `events/`) — it surfaces
  `code` / `details` / `hint`.
- **`PGRST204 Could not find the 'X' column`** → schema drift. The Edge
  Function references a column that doesn't exist on the live DB. Either
  push the migration that adds it or run the matching `alter table` in the
  SQL editor.
- **`flushSync was called from inside a lifecycle method`** → don't call
  `flushSync` inside a `useEffect`. React 18+ batches state updates
  automatically; reset dependent state in the same handler that triggers
  the change (see `AuthProvider.applySession`).
- **Admin sees stale data after sign-out** → make sure your effect resets
  `isAdmin` / `loading` whenever the session changes, not only when it
  becomes non-null.

---

## 12. Known gaps / TODO

- `pay-order` Edge Function is in progress (Step 6 of the lesson).
- No automated tests yet. The fastest pragmatic add is a Vitest setup for
  pure utilities (`eventPricing`, `scheduleApi` parsers) plus a Supertest /
  Deno test for the Edge Functions.
- `OrderPage.tsx` is a stub for general (non-event) ordering — currently
  not linked from the nav.
- Analytics endpoints from `BACKEND_PLAN.md` (popular dishes, orders over
  time) aren't built.
- Row-Level Security policies should be reviewed end-to-end; we know the
  admin paths work, but a formal audit is overdue.

---

If anything in this doc is wrong or stale by the time you read it, fix it
and open a PR — keeping the README current is part of the job.
