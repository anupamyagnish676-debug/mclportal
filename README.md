# MCL Internship Portal — Connected to Supabase

This version is wired to a **real Supabase PostgreSQL database**. Since you already
built and verified the entire backend (tables, trigger, RLS policies, storage buckets,
and admin user) step by step, this app should connect on the first try.

## 1. Install dependencies

```bash
npm install
```

## 2. Add your Supabase keys

Copy the example env file:

```bash
cp .env.local.example .env.local
```

Open `.env.local` and replace the placeholders with your real values from
**Supabase → Settings → API**:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...   (the anon / public key)
SUPABASE_SERVICE_ROLE_KEY=eyJ...        (the service_role / secret key)
```

`RESEND_API_KEY` can stay blank for now — the joining-letter email step will just be
skipped silently if it's not set, so you can test everything else without it.

**Important:** after editing `.env.local`, you must restart the dev server
(`Ctrl+C` then `npm run dev` again) — Next.js only reads env vars at startup.

## 3. Run it

```bash
npm run dev
```

Open **http://localhost:3000** → redirects to `/login`.

Log in with the admin account you created earlier:
- Email: `admin@mcl.com`
- Password: `Admin@1234`

## What's different from before (the fixes)

The earlier version got stuck on "Signing in..." with no error shown. This version
fixes that by:

1. **Validating env vars before any Supabase call** — if `.env.local` still has
   placeholder text, you get a clear error message immediately instead of a silent hang.
2. **Using `.maybeSingle()` instead of `.single()`** when fetching a profile —
   `.single()` throws an error if zero rows come back, which was likely contributing
   to silent failures. `.maybeSingle()` returns `null` cleanly instead.
3. **Surfacing every Supabase error in the UI** — login, attendance, assignments,
   materials, and LoR submission all show the exact error message if something fails,
   instead of failing silently.
4. **RLS policies use a `security definer` helper function** (`get_my_role()`) to avoid
   the infinite-recursion bug that happens when a policy on `profiles` queries
   `profiles` again to check the role.

## Creating more users

Once logged in as admin, go to **Create User** in the sidebar to add mentors, employees,
and students. This calls `/api/create-user`, which uses the Supabase service role key
to create the auth user and set their `profiles.role` correctly (the auto-trigger
creates the row with `role='student'` by default, then this route updates it).

## Workflow recap

1. Admin creates employee, mentor, and student accounts
2. Employee submits a student's LoR via **Review LoR** (student must already have an account)
3. Admin approves/rejects in **Applications** — approval optionally emails a joining letter
4. Admin assigns mentor to student directly in Supabase for now (a "assign mentor" UI
   button can be added next if you want — currently this is done by updating
   `internships.mentor_id` via SQL Editor or a future admin UI)
5. Mentor marks attendance, creates assignments, uploads materials
6. Student views progress, submits assignments
7. Admin issues certificate from **Interns** page once attendance/assignments are done,
   and can deactivate access at any time

## Troubleshooting

If you see an error on login or any page, the message itself will tell you what's wrong
(missing env var, RLS blocking a query, etc.) — paste that exact message back to me and
I'll give you the precise fix, the same way we debugged the database step by step.
