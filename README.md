# ASHARA MUBARAKAH IT Event Preparation Dashboard

Standalone Phase 2 dashboard for event IT preparation reporting.

## Phase 1 Scope Built

- Supabase-ready schema for password auth, roles, areas, task templates, live tasks, daily reports, uploads, verification, requests, in-app notifications, and future exports/logs.
- Supabase email/password login with no SMTP or magic-link dependency.
- Role and area access foundation for Super Admin, Admin, Area Admin, Verifier, Report User, and Viewer.
- Fixed zone types: CMZ, Central Office, Relay Zone.
- Admin area management.
- Task Template import from the Day Plan sheet of `.xlsx` files, with `.csv` fallback.
- Apply selected templates to areas as Live Tasks.
- User daily report screen with draft/submission, status, remarks, quantity fields, uploads, escalation points, and supporting personnel.
- Basic verification queue and reject/needs-correction flow.
- Basic requests tab.
- In-app notification foundation through `in_app_notifications`.
- Basic admin dashboard where completion counts only `Verified Completed` tasks.

## Phase 2 Scope Built

- Area Admin can create report users only for assigned areas; those users stay `Pending Approval`.
- Admin and assigned Verifier approval paths activate pending report users.
- Request forwarding to verifiers with verifier recommendation/comment return to admin.
- Multi-level task verification rules: one verifier, all verifiers, and sequential verification.
- Configurable in-app reminder rules stored in `reminders`.
- Editable Form Builder for task-type fields.
- Editable Global Fields / Options, including team types, units, request/reminder types, and activity categories.
- Activity Log settings and activity log table for key Phase 2 actions.

## Later Phases Not Built Yet

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
SUPABASE_SERVICE_ROLE_KEY=your-server-only-service-role-key
```

`NEXT_PUBLIC_SUPABASE_ANON_KEY` also works as a fallback.

The service role key is required only on the server for admin-created users, Super Admin password resets, approvals, and forced password changes. Never expose it in frontend code.

In Supabase Auth settings, disable email confirmation so admin-created password users can sign in without receiving any email. Do not configure SMTP for this app.

## Important Notes

- The UI is intentionally separate from the existing AM IT website, but keeps the same visual language: green/gold palette, rounded cards, compact tabs, filters, badges, progress cards, and responsive dashboards.
- City is not part of the Phase 1 or Phase 2 workflow. The database keeps a nullable `city` column on `areas` so it can be added later without rebuilding.
- Excel import needs the `xlsx` package. It reads the `Day Plan` sheet when present and imports only the active template fields. Dependencies and risk are stored only as hidden reference.
- User onboarding is no-email: Admin or Area Admin creates credentials, copies the temporary password once, and the user must change that password on first login.
- After first-login setup, passwords can be changed only by the signed-in user from Profile / Access or reset by Super Admin. A Super Admin reset sets the new password directly and does not force another change on next login.
