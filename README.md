# Ashara IT Readiness Master Tracker

Internal React/Next.js dashboard for tracking Ashara IT preparation across cities, workstreams, owners, risks, documents, and readiness status.

## Run locally

```bash
npm install
npm run dev
```

Open the local URL shown by Next.js, usually `http://localhost:3000`.

## Build check

```bash
npm run build
```

## City names

Placeholder city names are defined in `src/lib/asharaTrackerData.ts`:

```ts
export const INITIAL_CITIES = ["City 1", "City 2", "City 3"];
```

Replace those values with the actual city names before first use, or add cities from the dashboard using **Add City + Default Tasks**. Existing browser data is stored in localStorage, so use **Reset Demo Data** after changing the constants if you want to regenerate the default local demo set.

## Export for Asana or Excel

Use **Export Visible CSV** for the current filtered view or **Export Full CSV** for the complete task list. The CSV includes all custom fields and can be opened in Excel or mapped into Asana custom fields.

## Backend / Asana API path

The app keeps a clean `TrackerTask` data model in `src/lib/asharaTrackerData.ts`. To connect a backend later, replace the localStorage load/save calls in `src/components/DashboardApp.tsx` with API calls, keeping the same task field names. For Asana, map each exported field to a project custom field and sync `id`, `status`, `owner`, dates, document reference, and remarks through the Asana API.
