# ASHARA MUBARAKAH IT Event Preparation Dashboard

Standalone Phase 1 dashboard for event IT preparation reporting.

## Phase 1 Scope Built

- Supabase-ready schema for auth, roles, areas, task templates, live tasks, daily reports, uploads, verification, requests, notifications, and future exports/logs.
- Email magic-link login shell using Supabase Auth.
- Role and area access foundation for Super Admin, Admin, Area Admin, Verifier, Report User, and Viewer.
- Fixed zone types: CMZ, Central Office, Relay Zone.
- Admin area management.
- Task Template import from the Day Plan sheet of `.xlsx` files, with `.csv` fallback.
- Apply selected templates to areas as Live Tasks.
- User daily report screen with draft/submission, status, remarks, quantity fields, uploads, escalation points, and supporting personnel.
- Basic verification queue and reject/needs-correction flow.
- Basic requests tab.
- Email notification foundation through queued `notification_logs`.
- Basic admin dashboard where completion counts only `Verified Completed` tasks.

## Later Phases Not Built Yet

- Phase 2: area admin approval flow, advanced request forwarding, multi-level verification, configurable reminders, form builder editing, global field editing, activity log settings.
- Phase 3: PDF exports, Excel exports, viewer customization, presentation mode, advanced charts and filters.
- Phase 4: WhatsApp integration, optional merge with existing AM IT dashboard, advanced analytics.

## Run Locally

```bash
npm install
npm run dev
```

Open the local URL shown by Next.js, usually `http://localhost:3000`.

If Supabase variables are not configured, the app runs in local browser storage mode with demo users.

## Supabase Setup

1. Create a Supabase project.
2. Run `docs/supabase-schema.sql` in the Supabase SQL editor.
3. Add these variables locally and in deployment:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
```

`NEXT_PUBLIC_SUPABASE_ANON_KEY` also works as a fallback.

## Important Notes

- The UI is intentionally separate from the existing AM IT website, but keeps the same visual language: green/gold palette, rounded cards, compact tabs, filters, badges, progress cards, and responsive dashboards.
- City is not part of the Phase 1 workflow. The database keeps a nullable `city` column on `areas` so it can be added later without rebuilding.
- Excel import needs the `xlsx` package. It reads the `Day Plan` sheet when present and imports only the active template fields. Dependencies and risk are stored only as hidden reference.
