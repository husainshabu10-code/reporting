# ASHARA MUBARAKAH IT Readiness Master Tracker

Internal React/Next.js dashboard for tracking ASHARA MUBARAKAH IT preparation across cities, workstreams, owners, risks, documents, and readiness status.

## Run locally

```bash
npm install
npm run dev
```

Open the local URL shown by Next.js, usually `http://localhost:3000`.

## Shared Supabase database

Task, city, contact, activity, equipment, and chart configuration data can now be shared through Supabase instead of being kept only in one browser.

1. Create a Supabase project.
2. Run `docs/supabase-schema.sql` in the Supabase SQL editor.
3. Add these environment variables locally and in Vercel:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
NEXT_PUBLIC_TRACKER_USER_NAME=Unknown user
```

`NEXT_PUBLIC_SUPABASE_ANON_KEY` also works as a fallback if your Supabase project still labels the browser key as `anon`. The server API also accepts `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, or the `VITE_SUPABASE_*` names. When the variables are present, the dashboard loads from Supabase, writes edits/imports to Supabase through the shared API, listens for realtime changes when browser keys are available, and falls back to polling every 3 seconds. If the variables are missing or Supabase is unavailable, the app uses local browser storage only as a temporary fallback.

## Build check

```bash
npm run build
```

## City names

Placeholder city names are defined in `src/lib/asharaTrackerData.ts`:

```ts
export const INITIAL_CITIES = ["Nairobi", "Mombasa", "Daresalam", "Mumbai", "Surat", "Pune", "Nagpur", "Colombo"];
```

Replace those values with the actual city names before first use, or add cities from the dashboard using **Add City + Default Tasks**. Existing shared data is loaded from Supabase when configured. Use **Add City + Default Tasks** for runtime changes, or update the constants before first seeding a fresh database.

## Export for Asana or Excel

Use **Export Visible CSV** for the current filtered view or **Export Full CSV** for the complete task list. The CSV includes all custom fields and can be opened in Excel or mapped into Asana custom fields.

## Backend / Asana API path

The app keeps a clean `TrackerTask` data model in `src/lib/asharaTrackerData.ts` and syncs it through `src/lib/sharedTrackerStore.ts`. For Asana, map each exported field to a project custom field and sync `id`, `status`, `owner`, dates, document reference, and remarks through the Asana API.
