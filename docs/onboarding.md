# Onboarding

Getting from a fresh clone to a running dashboard on your machine. Written from
what's actually in this repo and its backend sibling as of 2026-09-17, not from
what a typical Next.js project usually needs.

## Contents

- [The shape of this project](#the-shape-of-this-project)
- [Get access first](#get-access-first)
- [Clone and install](#clone-and-install)
- [Environment variables](#environment-variables)
- [Running it locally](#running-it-locally)
- [Getting a login](#getting-a-login)
- [Before you touch the database: the production trap](#before-you-touch-the-database-the-production-trap)
- [Tests and typechecking](#tests-and-typechecking)
- [Things in package.json that will confuse you](#things-in-packagejson-that-will-confuse-you)
- [Conventions](#conventions)
- [Where the rest of the knowledge lives](#where-the-rest-of-the-knowledge-lives)

## The shape of this project

Two separate git repos, two separate GitHub remotes:

- **WellnessFrontend** (this repo, `mdwwellness/wellness-dashboard`) - the Next.js
  admin dashboard.
- **WellnessBackend** (`mdwwellness/wellness-backend`) - the Express/Mongoose API.
  It's a sibling checkout, not a subfolder here. On this machine it lives at
  `C:\workspace\WellnessBackend`; ask whoever set up your environment where it
  should live on yours. It's also deployed separately on Render, and the
  frontend talks to whichever one `BACKEND_BASE_URL` points at.

`C:\workspace\mdw` (if you see it mentioned anywhere) is a completely
unrelated Supabase project for the public patient-facing site. It is not this
backend. Don't go looking for API routes there.

## Get access first

Nothing below works until someone gives you these. Ask before you start:

- GitHub org access to both `wellness-dashboard` and `wellness-backend`.
- A MongoDB Atlas connection string, or ask to be added to the existing
  cluster's Network Access list and get the string from whoever holds it.
  Both repos use the *same* database.
- A login to the dashboard itself. There's no self-service signup. See
  [Getting a login](#getting-a-login).
- The shared `UPLOADTHING_TOKEN` (used by both repos for file uploads and
  invoice PDFs).
- Render dashboard access, only if you'll be deploying, not for local dev.

You do **not** need Google OAuth credentials. `GOOGLE_CLIENT_ID` /
`GOOGLE_CLIENT_SECRET` are listed in the frontend's env vars but nothing in the
codebase actually reads them, no OAuth flow is wired up anywhere. Leave them
blank.

## Clone and install

```bash
git clone git@github.com:mdwwellness/wellness-dashboard.git
git clone git@github.com:mdwwellness/wellness-backend.git
cd wellness-dashboard && npm install
cd ../wellness-backend && npm install
```

## Environment variables

The frontend's env vars are documented in [README.md](../README.md#environment-variables);
the backend's in its own `.env.example`. Copy `.env.example` to `.env` in the
backend, and create `.env.local` in the frontend from the README's table.

Two things worth knowing before you fill them in:

- **`MONGODB_URI` in the frontend's `.env.local` is only used by the one-off
  scripts in `scripts/*.cjs`** (user maintenance tools), not by the app at
  runtime. If you're not running those scripts, you can leave it out.
- **The backend's `DATABASE_URL` almost certainly points at the real
  production Atlas cluster**, not a local or throwaway database. Read the
  next section before you run anything that writes to it.

## Running it locally

Backend first:

```bash
cd wellness-backend
npx tsx server.ts
```

Don't use `npm run dev` here, it's broken on Node 22 (`ts-node/esm` doesn't
load). `npm start` works too (it's `nodemon --exec tsx server.ts`, so it
restarts on file changes) - use that if you're actively editing backend code.
Defaults to port 10000.

Frontend:

```bash
cd wellness-dashboard
npm run dev
```

Runs on port 3000 (Turbopack). If `BACKEND_BASE_URL` isn't set in
`.env.local`, the frontend falls back to `http://localhost:10000` automatically
in development, so as long as the backend's running on its default port you
don't need to set it for local work.

## Getting a login

There's no public registration. Every account is created by an existing
admin, through Settings → Add User in the dashboard itself, or directly in
Mongo.

`scripts/create-user.cjs` exists for exactly this, but **it's hardcoded to
the project owner's personal email and password** - it's not a generic
"create yourself an account" tool. Running it as-is against the shared
database will just print "User already exists" and exit, since that user is
already there. Don't try to repurpose it by editing in your own details and
running it against the shared cluster without checking with the owner first;
ask an existing admin to add you through the UI instead.

## Before you touch the database: the production trap

Both repos' local env files can easily end up pointing at the **live
production MongoDB Atlas cluster**, because that's the connection string
everyone already has on hand. There is no local or staging database set up
by default.

Practically, this means:

- Anything you run locally that writes to the database, a script, a manual
  test, poking around with the app, is writing to the same data real staff
  are using.
- `"MongoDB connected"` in the backend's startup log looks identical whether
  it connected to production or to a local instance. It does not tell you
  which one you're on.
- If you genuinely need an isolated database (load-testing a migration,
  running destructive scripts, this kind of thing), spin up a local Mongo
  (`docker run -d --name mdw-test-mongo -p 27017:27017 mongo:7`) and point
  `DATABASE_URL` at `mongodb://127.0.0.1:27017/mdw-test` instead, then verify
  the app actually connected there (check `mongoose.connection.host` in a
  log line, or write a sentinel document and confirm the running app can see
  it) before trusting the run.

For day-to-day frontend work this usually doesn't matter, you're reading and
clicking, not running scripts. It matters the moment you're about to run
anything that writes.

## Tests and typechecking

Both repos use Vitest:

```bash
npm test           # run once
npm run test:watch # watch mode
```

Neither repo has a `typecheck` npm script. Run the compiler directly:

```bash
npx tsc --noEmit
```

The frontend also has `npm run lint` (ESLint). The backend doesn't have a
lint script at all.

## Things in package.json that will confuse you

The frontend's `package.json` has several dependencies with zero references
anywhere in `src/`: `@tanstack/react-router`, `@tanstack/react-start`,
`vite`, `prisma`, `resend`, `@react-email/components`, `@react-email/render`.
There's no `vite.config`, no `.prisma` schema, no email-sending code that
uses any of these. They're leftovers from something that never shipped or
got replaced. If you're wondering whether this project uses Vite or
TanStack's router instead of Next's, it doesn't, ignore them. Worth pruning
next time someone's touching dependencies, not urgent on its own.

## Conventions

- Branches: `type/short-name` (`feat/enquiries-dashboard`,
  `fix/known-issues-cleanup`, `docs/owner-guide`). Same convention in both
  repos.
- Commits: `type: what changed`, matching `git log` in either repo.
- Don't force-push or rewrite history on `main` in either repo.

## Where the rest of the knowledge lives

- [README.md](../README.md) - tech stack, project structure, core features.
- [docs/api-reference.md](api-reference.md) - every server action, the
  backend endpoint it calls, known quirks.
- [docs/data-model.md](data-model.md) - the Mongoose models field by field.
- [docs/dashboard-flowchart.md](dashboard-flowchart.md) - flowcharts of the
  main user journeys.
- [docs/team/owner-guide.md](team/owner-guide.md) - the plain-English tour,
  written for non-technical staff, but also the fastest way to understand
  what each screen is *for* before reading the code behind it.
- [ISSUES.md](../ISSUES.md) - known bugs, tracked with severity and status.
  Check it before you report something as new, and update it when you fix
  something.
