# Notifications (`/notifications`)

Store Manager page for branch 801. It lists every alert, newest first; each one links to its follow-up action.
New alerts arrive **live** over Server-Sent Events (SSE): no reload, and the sidebar and header badges update too.

Requirements: **S10** (alerts with a follow-up link) · **SM5 / SM6** (checkpoint alerts) · **S7** (waste risk) ·
**G2** (branch from the session) · **NFR5** (audit log).

## What is on the page

| Block | Source |
|---|---|
| Type chips (any mix), **Unread only**, **Mark all as read**, Live indicator | `NotificationList` (client state) |
| One card per alert: icon, type chip, title, unread dot, body, follow-up button, time (Bangkok) | `getNotifications()` + live alerts from the stream |
| Unread badges in the sidebar and header bell | `NotificationStreamProvider` (same stream) |

## Alert types

| Type | Raised by | Follow-up | De-dupe |
|---|---|---|---|
| `SHORTAGE_RISK` | alert engine: a SKU sells out before close | View stock & order → `/` | once per SKU per Bangkok day |
| `WASTE_RISK` | alert engine: waste risk ≥ the category's `wasteRiskPct` | Open promotion → `/promotions` | once per SKU per day |
| `PROMOTION` | `pushDiscount` (discount pushed to the simulated POS) | View promotion status → `/promotions` | once per SKU per day |
| `STALE_DATA` | `GET /api/ingest/freshness`: no load for 90 min | View data sync → `/` | once per hour |
| `SYSTEM` | (demo seed only for now) | Review thresholds → `/thresholds` | once per day |

The engine uses the **same rule as the dashboard Top Risk table** (`riskSkus()` in `lib/dashboard/risk.ts`),
so the bell and the dashboard always agree.

## How an alert is created

Everything goes through **`createAlert()`** (`src/lib/alerts/create.ts`):

1. De-dupe: skip if the same (branch, type, SKU) exists inside `dedupeSince()`.
2. One transaction: insert the `alert` row and an `audit_log` row with action `ALERT_CREATE` (NFR5).
3. After the commit: `emitAlert(storeNo)` wakes the open SSE streams.

`alert.message` holds `"title\nbody"` (no schema change). `splitMessage()` reads it back; older one-line rows use the
type label as title.

Triggers:

| Where | When |
|---|---|
| `confirmOrder` (dashboard) | after the order and the manager's Left-now counts are saved → `evaluateAlerts()` |
| `pushDiscount` (promotions) | after the push is saved → PROMOTION alert |
| `GET /api/ingest/freshness` | data older than 90 min → STALE_DATA alert |
| `POST /api/alerts/evaluate` | Power Automate schedule at the checkpoint times (`x-api-key: INGEST_API_KEY`) → `evaluateAlerts()` |

Alerts are a **best-effort side effect**: if one fails, the order or push is still saved and the error is logged.

## Live updates (SSE)

```
Browser tab                              Next.js (Node)                         Neon
NotificationStreamProvider ──GET /api/notifications/stream?after=<id>──►  route.ts
  (one EventSource per tab)  ◄── retry / alert / unread / : ping ──────   ├─ poll every 5 s ── alert.id > cursor ──► alert
                                                                           └─ wake early on emitAlert() (same process)
```

| Event | `id` | `data` |
|---|---|---|
| `alert` | alert id | `NotificationDto` (JSON) |
| `unread` | — | `{ "count": n }`, sent when the count changes |
| `: ping` (comment) | — | every 15 s, keeps proxies from closing the connection |

Design decisions:

- **SSE, not WebSocket:** data only flows server → browser; plain HTTP, cookies sent automatically,
  reconnect built into `EventSource`, works in a Route Handler.
- **The database is the source of truth.** The pooled Neon URL can't `LISTEN/NOTIFY`, and alerts can be written by
  another process, so the stream polls `id > cursor`. The in-process bus only makes same-process alerts instant.
- **Resume without gaps:** the SSE `id` is the alert id. On reconnect the browser sends `Last-Event-ID`;
  the stream sends only newer rows, oldest first.
- **One connection per tab:** the provider in the dashboard layout owns the `EventSource`; the page and both badges read its context.
- **Auth:** `proxy.ts` skips `/api`, so the route checks the session cookie itself and returns **401** (never a redirect).
  `storeNo` always comes from the cookie (G2).
- **Read state is optimistic:** the UI updates at once, the server action runs in the background, and the next
  `unread` event corrects any drift. **Mark all as read** only marks alerts up to the newest one the manager could see.

## Actions (`actions.ts`)

| Action | Effect |
|---|---|
| `markRead(id)` | sets `read_at` (only this branch's alert, only if unread), wakes streams |
| `markAllRead(upToId)` | sets `read_at` on this branch's unread alerts with `id ≤ upToId`, wakes streams |

## Files

```
src/app/(dashboard)/notifications/
  page.tsx                               server: first 50 alerts
  actions.ts                             markRead, markAllRead
  _components/NotificationList.tsx       chips, Unread only, Mark all (client)
  _components/NotificationCard.tsx       one alert row
  _components/NotificationsEmptyState.tsx
src/app/api/notifications/stream/route.ts   SSE stream
src/app/api/alerts/evaluate/route.ts        engine endpoint for Power Automate
src/components/notifications/
  NotificationStreamProvider.tsx         the one EventSource + useNotifications()
  UnreadBadge.tsx                        sidebar + header badge
src/lib/alerts/
  meta.ts      label, colour, follow-up per type     (pure)
  message.ts   title + body in one column            (pure)
  view.ts      DTO, filter, merge, read overrides, time format (pure)
  sse.ts       SSE wire format, resume cursor        (pure)
  rules.ts     risks → drafts, de-dupe window        (pure)
  bus.ts       in-process wake-up (server only)
  create.ts    createAlert() (server only)
  engine.ts    evaluateAlerts() (server only)
  queries.ts   reads (server only)
```

## Known limitations

- **De-dupe isn't atomic:** two `createAlert()` calls at the same instant could both insert. A unique index would fix
  it but needs a schema change (Leader). Low risk for one branch with checkpoints hours apart.
- **The bus is per process.** On several server instances, an alert from another instance shows up on the next
  5 s poll instead of instantly. Nothing is lost.
- **Serverless time limits** (e.g. Vercel) cut long streams; the browser reconnects and resumes from `Last-Event-ID`.
- Opening `/api/notifications/stream` without `?after=` or `Last-Event-ID` replays the oldest 50 alerts
  (the app always sends `after`).
- Demo rows count toward de-dupe: after `db:seed:demo`, SC220 / ST068 / SB078 won't raise a second alert today.

## Testing

```bash
npm test     # Vitest — src/lib/alerts/{message,view,sse,rules}.test.ts (44 tests)
```

Try the engine by hand (dev server running):

```bash
curl -s -X POST -H "x-api-key: <INGEST_API_KEY>" localhost:3000/api/alerts/evaluate
```

The first run returns `created > 0` if there are risks; a second run returns `created: 0` (de-dupe).

Watch the stream (copy the `session` cookie from DevTools):

```bash
curl -N -b "session=<value>" "localhost:3000/api/notifications/stream?after=0"
```

The manual checklist is in [README-testing.md](../../../../README-testing.md), section 5.