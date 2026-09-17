# MDW Wellness: Admin Dashboard

The back-office dashboard for the MDW Wellness therapy/booking platform. Staff use it to
manage inbound enquiries through a sales funnel, book and track appointments, maintain the
therapist roster and service catalogue, and view business analytics.

This is the **admin frontend**. It talks to a separate REST API (the WellnessBackend service)
for most data, and reads a shared MongoDB directly for a few customer-facing views. Public
bookings made on the patient website (mdw-wellness) flow into the same backend and appear
here under **Enquiries**.

---

## Tech stack

| Area        | Choice                                                        |
| ----------- | ------------------------------------------------------------ |
| Framework   | Next.js 16 (App Router, Turbopack), React 19, TypeScript 5   |
| Data        | TanStack Query (server state) + Next.js Server Actions       |
| Tables      | TanStack Table v8                                            |
| Styling     | Tailwind CSS 4, shadcn/ui (Radix primitives), `next-themes`  |
| Forms       | React Hook Form + Zod v4                                     |
| Local state | Zustand                                                      |
| Uploads     | UploadThing (therapist profile pics + certificates)         |
| Dates       | date-fns                                                     |
| Toasts      | sonner                                                       |

---

## Getting started

### Prerequisites

- Node.js 20+
- Access to the WellnessBackend API (local or the deployed Render URL)
- A MongoDB connection string (used directly by the customer/analytics views)

### Install & run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Scripts

| Command         | What it does                          |
| --------------- | ------------------------------------- |
| `npm run dev`   | Dev server (Turbopack)                |
| `npm run build` | Production build                      |
| `npm run start` | Serve the production build            |
| `npm run lint`  | ESLint                                |

---

## Environment variables

Create a `.env.local` in the project root:

```bash
# REST API base (WellnessBackend), used by all server actions
BACKEND_BASE_URL=https://your-backend.onrender.com

# Shared MongoDB, read directly by customer/analytics views
MONGODB_URI=mongodb+srv://...

# App URL (used for absolute links / OAuth callbacks)
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Google OAuth
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# File uploads (therapist images & certificates)
UPLOADTHING_TOKEN=...
```

> Server actions read `BACKEND_BASE_URL` via `base_url` in `src/constant/index.ts`.
> `NEXT_PUBLIC_*` vars are exposed to the browser; everything else stays server-side.

---

## Project structure

```
src/
├── app/
│   ├── (protected)/dashboard/   # authenticated app shell + routes
│   │   ├── page.tsx             #   /dashboard            : analytics home
│   │   ├── enquiries/           #   /dashboard/enquiries  : lead funnel
│   │   ├── appointments/        #   /dashboard/appointments
│   │   ├── customers/           #   /dashboard/customers
│   │   ├── alltherapist/        #   /dashboard/alltherapist
│   │   ├── services/            #   /dashboard/services   : service catalogue
│   │   └── settings/            #   /dashboard/settings   : users & profile
│   └── auth/login/              # /auth/login
├── actions/                     # Next.js server actions (call the backend)
│   ├── enquiries/  appointments/  therapist/  services/  user/  admin/
├── data/                        # TanStack Query hooks per domain
├── components/
│   ├── pages/                   # feature UIs (one folder per dashboard page)
│   └── ui/                      # shadcn/ui primitives
├── type/schema.ts               # Zod schemas + shared types
└── constant/index.ts           # roles, permissions, base_url
```

---

## Core features

### Enquiries (lead funnel)
The heart of the app. Inbound leads, whether created here manually (**New Enquiry**) or
submitted from the public patient site, move through a funnel:

```
Enquiry → Reached out → Consult booked → Consult done →
Physio slot → Confirmed → Paid (Ongoing) → Completed
```

- Split into **Needs first contact** (nobody has reached out) and **Attended** (in progress).
- A **stale highlight** turns rows amber when a lead has been waiting too long
  (24h untouched in the top section, 48h without an update in the bottom).
- Click any row to open a detail drawer with the funnel stepper, slot pickers,
  payment capture, an activity log, and status overrides.
- Duplicate-phone guard: a new enquiry is blocked if the phone already has an
  **open** lead, so the same person can't create duplicate records.

### Appointments
Book, view, edit, and cancel therapy appointments; therapists see their own schedule.

### Customers
Read-only view of people who have booked, with a per-customer bookings drawer.

### Therapists
Manage the therapist roster, including profile pictures and certificate uploads
(via UploadThing) shown in a detail drawer with an image lightbox.

### Services
CRUD for the service catalogue (name, price, category, HSN/SAC code). Service IDs
(`SRV-####`) are auto-allocated by the backend.

### Settings
Manage staff users and edit your own profile.

---

## Auth & roles

Routes under `app/(protected)` require authentication. Roles are defined in
`src/constant/index.ts`:

`SUPER_ADMIN`, `ADMIN`, `THERAPIST`, `STAFF`, `CUSTOMER_CARE`

Permissions are checked via `hasPermission(role, permission)`. The role/permission map
currently grants full access to all roles; tighten `ROLE_PERMISSIONS` when finer-grained
control is needed.

---

## More docs

- [docs/api-reference.md](docs/api-reference.md): every server action, the backend endpoint it calls, and known quirks
- [docs/data-model.md](docs/data-model.md): the Mongoose models field by field
- [docs/team/owner-guide.md](docs/team/owner-guide.md): plain-English tour for non-technical staff
- [docs/dashboard-flowchart.md](docs/dashboard-flowchart.md): flowcharts of the main user journeys

---

## Related services

- **WellnessBackend**: the REST API this dashboard calls (`BACKEND_BASE_URL`).
- **mdw-wellness**: the public patient-facing booking site; its bookings land here
  as enquiries via the backend's public endpoint.

---

## Deploy

Deploys to [Vercel](https://vercel.com). Set the same environment variables in the
Vercel project settings (Production + Preview), then connect the repo for automatic
deploys on push.
