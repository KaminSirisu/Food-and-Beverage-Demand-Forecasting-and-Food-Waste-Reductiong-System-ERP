This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Pages

| Page | Docs |
|---|---|
| Waste & Auto-Promotion Engine (`/promotions`) | [src/app/(dashboard)/promotions/README.md](src/app/(dashboard)/promotions/README.md) |
| Notifications (`/notifications`) | [src/app/(dashboard)/notifications/README.md](src/app/(dashboard)/notifications/README.md) |

## Demo mode (T1)

Replays real 2023 D365 days as if they were today. Use a **Neon demo branch** so the shared database keeps its full history.

1. `.env`: point `DATABASE_URL` / `DIRECT_URL` at the demo branch and set `NEXT_PUBLIC_DEMO_TODAY="2023-05-03"`. Restart `npm run dev`.
2. Daily files for branch 801 go in `data/daily/Sales_Entry_YYYY-MM-DD.xlsx` (gitignored, split from the monthly exports).
3. During the demo day, press **Simulate Data Ingestion** (header): it loads that day's sales **up to the current clock time**
   through the normal pipeline (import log, daily totals, alert check). Press it again later to add the newer sales.
   Without a day file it copies the same weekday last week.
   Turn on **Live** next to it to repeat that every minute, so each sale arrives at its real time and stock goes down on screen.
4. Tomorrow's forecast runs by itself: after a D365 file upload (trigger, L7), and from Simulate once at the first sync
   of the day (provisional) and again after 13:30 (the official decision). By hand if needed:
   `npx tsx --env-file=.env src/lib/forecast/run-forecast.ts --date <tomorrow> --neon`
5. Next day: change `NEXT_PUBLIC_DEMO_TODAY` (the dev server reloads `.env`), **or** set `NEXT_PUBLIC_DEMO_ANCHOR` to the
   real day that shows as the demo day: from then on the demo moves one day forward each real day
   (anchor 2026-11-26 + demo 2023-05-05 → 27 Nov shows 6 May). Keep the dashboard open with **Live** on.

Stock and waste have no D365 feed yet (open decision), so they are **estimated** (`src/lib/orders/estimate.ts`):
stock = delivered (confirmed order, else the forecast) − sold so far; waste = 1-day items left unsold at close.
A manager's "Left now" count always wins. The Report icon opens the **Data Import Log** (`/imports`).

## Testing

```bash
npm test            # unit tests (Vitest)
npm run test:e2e    # UI tests (Playwright) — run `npm run db:seed && npm run db:seed:demo` first
```

Setup details and the step-by-step **manual test** checklist: [README-testing.md](README-testing.md).

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
