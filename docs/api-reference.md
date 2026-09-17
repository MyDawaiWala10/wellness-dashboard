# API Reference

What every server action in `src/actions/` calls on the backend, and what each backend
route actually does. Written from the code as of 2026-09-17 (backend repo:
`C:\workspace\WellnessBackend`), not from the older patch docs in `scripts/` - several of
those describe changes as "pending" that have since shipped.

For field-by-field model shapes, see [data-model.md](data-model.md). For a plain-English
tour of what staff see on screen, see [team/owner-guide.md](team/owner-guide.md).

## Contents

- [How requests are made](#how-requests-are-made)
- [Auth & session](#auth--session)
- [Enquiries & appointments](#enquiries--appointments)
- [Therapists / doctors](#therapists--doctors)
- [Therapist leaves & week-off](#therapist-leaves--week-off)
- [Customers](#customers)
- [Services](#services)
- [Session rates](#session-rates)
- [Specializations](#specializations)
- [Clinic settings](#clinic-settings)
- [Invoices](#invoices)
- [Analytics](#analytics)
- [Admin / users / settings](#admin--users--settings)

---

## How requests are made

Every server action goes through `fetchWithAuth` (`src/lib/fetchwithauth.ts`), which attaches
the `accessToken`/`refreshToken` cookies, and on a 401 does a single silent refresh via
`POST /api/users/refresh-token` before retrying. `base_url` comes from
`resolveBackendBaseUrl()` (`src/constant/index.ts`): `BACKEND_BASE_URL` →
`BACKEND_BASE_URL_LOCAL` → `http://localhost:10000` in dev → `""` otherwise. If none of
those resolve in production, requests silently become relative paths - worth checking
first if a deployed environment starts throwing fetch errors.

Almost every route only requires `userAuth` (a valid JWT). Role is not checked at the
route level except on the three `/admin/*` user routes. Practically, `PERMISSIONS` and
`ROLE_PERMISSIONS` exist in `src/constant/index.ts` but every role currently maps to
`["*"]` - the permission system is scaffolded but not yet differentiating anyone. Treat
"requires SUPER_ADMIN" notes below as UI-level gating, not server-enforced, unless stated
otherwise.

---

## Auth & session

| Action | Calls | Notes |
|---|---|---|
| `Login` (`src/actions/user/login.ts`) | `POST /api/users/login` | Public. Backend signs a 5h access token and 30d refresh token, but the frontend action re-sets its own cookies with different lifetimes: 15 min access, 7 days refresh. See gotcha below. |
| `logoutAction` (`src/actions/user/logout.ts`) | `POST /api/users/logout` | Best-effort; clears local cookies regardless of the backend call's outcome. |
| refresh (internal, in `fetchwithauth.ts` and `middleware.ts`) | `POST /api/users/refresh-token` | Sets a fresh access cookie at 5h maxAge - consistent between the two call sites, just not with the login action (see below). |
| `changePassword` (`src/actions/user/change-password.ts`) | `PUT /api/users/change-password` | Requires current password match, new password ≥ 8 chars. Clears the stored refresh token, forcing re-login everywhere. |
| `forgotPassword` (`src/actions/user/forgot-password.ts`) | `POST /api/users/forgot-password` | Public. See [Password reset flow](#password-reset-flow) below. |
| `resetPassword` (`src/actions/user/reset-password.ts`) | `POST /api/users/reset-password` | Public. See below. |
| `updateProfile` (`src/actions/user/update-profile.ts`) | `PUT /api/users/complete-profile` | Self-service profile edit. If the caller is a THERAPIST, syncs name/email/phone onto the linked `Doctor` record too. |

**Cookie lifetime mismatch:** the backend issues a 5h access / 30d refresh JWT pair, but
`login.ts` overwrites those with its own 15min/7day cookie `maxAge`s right after login.
The JWTs themselves stay valid for their original lifetimes - only the *browser cookie*
expires early - so a session that should coast for 30 days on the refresh token in
practice gets cut to 7, and the access cookie forces a silent refresh far more often than
necessary in the first 15 minutes. Nobody's hit this as a bug report yet, but it's real
and worth fixing next time auth is touched.

**JWT secrets** (`userController.ts` `generateAccessToken`/`generateRefreshToken`) fall
back to hardcoded strings (`"vivo123"` / `"vivo123refresh"`) if `JWT_SECRET` /
`JWT_REFRESH_SECRET` are unset. `middlewares/userAuth.ts` verifies with
`process.env.JWT_SECRET!` and no fallback - so if the env var is ever missing in an
environment, tokens get signed with the fallback and then fail verification, and every
authenticated request 401s. Set both env vars everywhere this runs; don't rely on the
fallback.

### Password reset flow

Self-service, email-OTP based, no WhatsApp component (that was considered and shelved).

1. `forgotPassword(userEmail)` → `POST /api/users/forgot-password` (public). Backend always
   replies with the same generic "if that email is registered..." message whether or not
   the account exists, to avoid leaking which emails are registered. If it does exist, a
   6-digit OTP is generated, bcrypt-hashed, stored with a 10-minute expiry, and emailed via
   `lib/mailer.ts` (`sendPasswordResetEmail`, over `SMTP_HOST/PORT/USER/PASS`).
2. `resetPassword({userEmail, otp, newPassword})` → `POST /api/users/reset-password`
   (public). Validates the OTP against the bcrypt hash and the expiry, requires the new
   password to be ≥ 8 chars, then saves it and clears the stored refresh token (signs the
   user out everywhere).

There's no resend-throttling and no attempt-count lockout on OTP guesses - calling
`forgotPassword` again just overwrites the previous OTP, and `resetPassword` can be
retried with different codes indefinitely inside the 10-minute window. `bcrypt.compare`'s
latency is the only friction. Fine for the current traffic level; worth a rate limit if
this ever needs to withstand real brute-forcing.

---

## Enquiries & appointments

There's no separate "enquiries" collection or endpoint. An enquiry **is** an
`AppointmentBooking` document at `status: "enquiry"` - the Enquiries page, the Follow-ups
page, and the Appointments page all read the same collection and slice it differently on
the client. `src/actions/enquiries/create-enquiry.ts` just calls the same
`POST /api/appointments` that appointment booking uses, with `status: "enquiry"` forced in
the body.

| Action | Calls | Notes |
|---|---|---|
| `createEnquiry` | `POST /api/appointments` | Authenticated dashboard path (`addAppointmentsDetails` → `createBooking`), distinct from the *public* booking-site path below. |
| `addAppointments` (`book-appointment.ts`) | `POST /api/appointments` | Same endpoint as above; the frontend inspects the response body for `success:false` even on an HTTP 200, since the backend can respond that way. |
| `getAllAppointments` | `GET /api/appointments?role=&id=&email=` | The query params are dead weight - the backend reads the role/id from the verified JWT (`req.user`), not the query string, specifically because the query string is spoofable. Back-office roles see everything; a THERAPIST sees only their own (matched by `Doctor.userId` or email); anyone else gets 403. |
| `updateAppointment` | `PUT /api/appointments/:id` | Very load-bearing endpoint - see below. |
| `deleteAppointment` | `DELETE /api/appointments/:id` | Hard delete, no cleanup of the linked Customer or Invoice. Deleting a booking that already has an invoice leaves that invoice pointing at nothing. |
| `addAppointmentRecommendation` | `POST /api/appointments/:id/recommendations` | Add-on service proposal (e.g. therapist recommends an extra session/product mid-visit). |
| `sendAddonOtp` / `confirmAppointmentRecommendation` | `POST .../recommendations/otp`, `.../recommendations/confirm` | 4-digit OTP gate, bcrypt-hashed, 15-min expiry, pinned to one specific add-on. The plaintext code comes back in the response for staff to relay by voice/WhatsApp - there's no SMS/push delivery. |
| `setAddonPaymentStatus` | `POST .../recommendations/payment` | Marks an add-on collected. No OTP needed here (only confirming the add-on itself needs one). |
| `sendVisitOtp` / `verifyVisitOtp` | `POST .../visit-otp/send`, `.../visit-otp/verify` | Same OTP pattern, gates session completion (see `completeSession` below). |
| `completeSession` | `POST /api/appointments/:id/complete-session` | Rejects with 400 if the visit OTP hasn't been verified - it's a hard gate, not just a UI nudge. Atomically increments `sessionsCompleted` against the package total, flips to `status: "completed"` once the ceiling is hit. Also mirrors the visit note onto the matching `Customer` record by a name+phone lookup - if the name doesn't match closely enough, the note is dropped silently (caught, logged, not surfaced). |
| `createPaymentLink` | `POST /api/appointments/:id/pay-link` | Mints a `payToken` once and reuses it - idempotent, confirmed in the controller not just by comment. |
| `getTherapistSessionCounts` | `GET /api/appointments/therapist-session-counts` | Aggregated per-doctor totals, used by the earnings page. |

**Funnel stages are not one enum.** The `status` field only has five values -
`enquiry / scheduled / ongoing / completed / cancelled`. Everything in between ("reached
out", "consult booked", "physio slot assigned", "payment received") is a separate
boolean/timestamp pair layered on top (`executiveReachedOut`, `consultationSlot`,
`physioAssignmentConfirmed`, `paymentReceived`, etc.) - see
[data-model.md](data-model.md#appointmentbooking--the-enquiryappointment-funnel) for the
full field list. If you're writing code against "the funnel stage," you're deriving it
from this combination of fields, not reading a single status string.

**`updateAppointment` carries most of the funnel's business rules:**
- Strips server-owned fields (OTP hashes/expiries, `sessionNotes`) from whatever the
  client sends, so a stale draft can't silently undo a fresh OTP verification.
- Enforces an "executive lock": a lead's `reachedOutBy` owner is the only non-admin who
  can edit it without supplying an `overrideReason`.
- **Pay-before-therapist gate**: you cannot assign/change a `doctorId` unless
  `paymentReceived` is already true. This is duplicated in `createBooking` too (see
  below) - it's enforced in two places, not one, so if it's ever loosened it needs
  loosening in both.
- Checks the target therapist's `weekOffDays` and any `TherapistLeave` overlap for the
  slot date before allowing an assignment.

**Public booking path.** `POST /api/appointments/public` (no auth, rate-limited by IP) is
what the patient-facing website hits. It goes through the exact same `createBooking()`
service function as the dashboard's `POST /api/appointments`, so the two paths share every
validation rule. The public path additionally folds repeat submissions from the same
phone+name into the existing open lead (bumps a `repeatCount`, logs it) instead of
creating a duplicate row. `GET /api/appointments/pay/:token` (also public) backs the
`/pay/<token>` payment page - it deliberately returns a minimal payload (booking, line
items, amount due) and nothing else (no phone, email, notes, or activity log).

**Multi-session courses auto-generate their own follow-up rows.** When a booking has
`bookingKind: "course"` with `totalSessions > 1` and a `sessionIntervalDays`, creating the
first session spawns the rest as separate `AppointmentBooking` documents (own `ENQ-####`
ids, linked back via `packageOriginId`), spaced by the interval, with the quoted price
split evenly across them. A clash on a later date only logs a warning - it doesn't block
the booking.

---

## Therapists / doctors

| Action | Calls | Notes |
|---|---|---|
| `addTherapist` | `POST /api/therapist` | Creates a `User` (role THERAPIST) and a `Doctor` in one call. If the `Doctor` save fails, the just-created `User` is deleted to avoid an orphan login. |
| `getAllTherapist` | `GET /api/therapist` | No role filtering - any authenticated user sees the full roster. |
| `updateTherapist` / `updateTherapistSuperAdmin` | `PUT /api/therapist/:id` / `PUT /api/therapist/super-update/:id` | Two different edit paths with different behavior - see below. |
| `deleteTherapist` / `deleteTherapistSuperAdmin` | `DELETE /api/therapist/:id` / `.../super-delete/:id` | The plain delete blocks (409) if the therapist has any appointments and only deactivates the linked `User`. The super-admin delete hard-deletes both the `User` and `Doctor`, plus any `TherapistLeave` rows. |
| `getPersonalAppointments` | `GET /api/therapist/:id` | Returns that doctor's appointments. No check that the caller *is* that therapist - any authenticated user can query any `doctorId` this way. |

**The two update paths aren't equivalent.** The plain `updateTherapist` path
(`updateDoctorDetails` controller) writes straight to the `Doctor` document with no
uniqueness check on email/phone, and does **not** touch the linked `User` login record.
`updateTherapistSuperAdmin` does both: validates email/phone uniqueness first, then
updates `Doctor` and syncs the change onto `User`. In practice, a non-super-admin editing
a therapist's email or phone through the regular Settings/Therapist UI can leave that
therapist's login details silently out of sync with their roster profile.

---

## Therapist leaves & week-off

| Action | Calls | Notes |
|---|---|---|
| `getTherapistLeaves(doctorId)` | `GET /api/therapist-leaves/:doctorId` | **Bug:** the controller (`getLeaves`) only reads `req.query.doctorId`/`req.query.date`, never `req.params.doctorId`. This route silently returns every therapist's leaves, not just the one requested. The per-therapist "availability" tab is affected by this today. |
| `getAllTherapistLeaves(date?)` | `GET /api/therapist-leaves?date=` | Works as intended (goes through the query-string path the controller actually reads). |
| `createTherapistLeave` | `POST /api/therapist-leaves` | `endDate` defaults to `startDate` for a single-day leave. |
| `deleteTherapistLeave` | `DELETE /api/therapist-leaves/:id` | |
| `updateWeekOffDays(doctorId, days)` | `PATCH /api/therapist-leaves/week-off/:doctorId` | Despite living under `/therapist-leaves`, this writes to the **Doctor** model's `weekOffDays` field, not to a `TherapistLeave` document. Leaves (date ranges) and week-off (recurring weekday pattern) are two different storage locations sharing one route prefix. |

---

## Customers

There's no dedicated "customers" collection driving the Customers page directly - the
page derives customer rows client-side by grouping `AppointmentBooking` records by
phone+name (`deriveCustomers` in `src/data/customer/customer.ts`), then enriches each
group with a matching `Customer` document if one exists. The `Customer` collection itself
mainly exists to hold freeform notes and a stable `customer_id`.

| Action | Calls | Notes |
|---|---|---|
| `createCustomer` | `POST /api/customers` | Identity is phone+name (case-insensitive), not phone alone - the model comment explains one household number can serve multiple patients. If a match already exists, this returns the existing record with `duplicate: true` rather than creating or overwriting anything. |
| `getCustomers(q?)` | `GET /api/customers?q=` | Digit query matches phone exactly; otherwise a regex match on name or `customer_id`, capped at 50 results. No `q` returns the 500 most recent. |
| `getCustomerByPhone` | `GET /api/customers?q=<phone>` | Thin wrapper around the same endpoint. |
| `addCustomerNote` / `editCustomerNote` (`update-customer-notes.ts`) | `PATCH /api/customers/:customerId` | Body shape is `{notes: {add: note}}` or `{notes: {edit: note}}`. Edits are matched by the `(at, by)` timestamp+author pair - there's no per-note id, so two notes from the same author at the exact same timestamp string would collide. Called directly from `customer-detail-drawer.tsx`; there's no dedicated mutation hook for these three actions. |

No delete route exists for customers.

---

## Services

| Action | Calls | Notes |
|---|---|---|
| `addService` | `POST /api/services` | Allocates `SRV-####` server-side. |
| `getAllServices` | `GET /api/services` | |
| `updateService` | `PUT /api/services/:serviceId` | `serviceId` is stripped from the body before writing, so it's immutable once created. |
| `deleteService` | `DELETE /api/services/:serviceId` | Blocks with 409 (and a preview list) if any appointment or invoice still references the service - the one reference-integrity check across all the CRUD domains in this app. |

The page is fully wired to the backend today - `src/data/service/service.ts` has a
docstring confirming the earlier mock-store version was retired. If you're reading
`operator.md` and it still says otherwise, that entry is stale.

`hsnCode` is required by the frontend Zod schema but not by the Mongoose model - a
service saved by some other path (a script, a future admin tool) could end up without one
even though the UI never lets that happen today.

`price`, `recommendedPrice`, and `category` are marked deprecated in both the model and
the Zod schema, kept around during the T31 pricing migration. Don't build new features on
them.

---

## Session rates

| Action | Calls | Notes |
|---|---|---|
| `getSessionRates` | `GET /api/session-rates` | Singleton row (`key: "global"`), auto-created empty on first read. |
| `updateSessionRates(tiers)` | `PUT /api/session-rates` | Full-replace - the editor always sends the whole tier table, not a diff. |

A tier is `{from, to, rate}`; `to: null` means open-ended. A course of N sessions is
priced by whichever tier's `[from, to]` range contains N, at `rate` per session.

---

## Specializations

| Action | Calls | Notes |
|---|---|---|
| `addSpecialization({value, label})` | `POST /api/specializations` | `value` is normalized to lowercase/trimmed; duplicates 409. |
| `getSpecializations` | `GET /api/specializations` | |

The backend also exposes `DELETE /api/specializations/:id`, but no frontend action calls
it - there's no delete button in the UI. It works if you script it, but it's not reachable
from the dashboard. If you do delete one that's still referenced on a therapist's profile,
nothing cascades or blocks it - the string just becomes a dangling reference.

---

## Clinic settings

| Action | Calls | Notes |
|---|---|---|
| `getClinicSettings` | `GET /api/clinic-settings` | Singleton (`key: "global"`), defaults `{bookingGapMinutes: 60, therapistSplitPercent: 60}`. |
| `updateClinicSettings(updates)` | `PUT /api/clinic-settings` | **Only `bookingGapMinutes` is actually persisted.** |

**This is a live bug, not a documentation nuance.** The Settings page's "therapist earnings
split" card calls this same endpoint with `{therapistSplitPercent: <n>}` and nothing else.
The controller reads `req.body.bookingGapMinutes`, gets `NaN`, and always responds 400.
The booking-gap card on the same page works fine and always has. Until the controller is
fixed to also read and `$set` `therapistSplitPercent`, that save button cannot succeed.

---

## Invoices

| Action | Calls | Notes |
|---|---|---|
| `createInvoice` | `POST /api/invoices` | Manual invoice creation from the Invoices page's "New invoice" sheet. |
| `getAllInvoices({q, type, paymentStatus})` | `GET /api/invoices?q=&type=&paymentStatus=` | Capped at the 100 most recent server-side; the UI paginates client-side on top of that. |
| `updateInvoice` | `PATCH /api/invoices/:invoiceId` | Editable: therapist name, session number, package fields, payment status, line items. `advance_paid` is not editable through this endpoint. Recomputes subtotal/total/balance from the line items and invalidates the cached PDF (`pdf_url` → null). |
| `voidInvoice(reason)` | `POST /api/invoices/:invoiceId/void` | Soft void - stamps who/when/why, 400s if already voided. |
| `generateInvoicePdf(id, {regenerate?})` | `POST /api/invoices/:invoiceId/pdf` | Returns the cached PDF URL unless `regenerate: true` is passed. |

Every invoice route 403s any role outside `SUPER_ADMIN / ADMIN / STAFF / CUSTOMER_CARE` -
this is the one domain with real back-office-only enforcement at the controller level.

**Invoices mostly generate themselves.** `maybeCreateInvoiceForAppointment` fires from
inside the appointment controller whenever `paymentReceived` flips true (not only when a
session is marked `completed`, which is what the Invoices page's own subtitle implies).
Once an invoice's `payment_status` is `"paid"`, later syncs from the appointment freeze
its money fields - only non-money facts like therapist name or address keep updating. A
genuine re-price after payment needs a void and a fresh invoice, not an edit.

---

## Analytics

| Action | Calls | Notes |
|---|---|---|
| `getAnalyticsData` (`src/actions/get-analytics.ts`) | `GET /api/metrics` | Backend aggregates doctor/patient/appointment counts on the fly from `Doctor` and `AppointmentBooking` - there's no dedicated analytics collection. |

**This endpoint is currently unused.** Neither the dashboard home page nor the
`/dashboard/analytics` page calls it - both derive their numbers client-side from the
enquiries/therapists/services queries they already have loaded. `useGetAnalyticsData` and
this action exist in the codebase with no caller. Either wire it in somewhere or treat it
as dead code the next time this area gets touched - right now it's neither.

---

## Admin / users / settings

| Action | Calls | Notes |
|---|---|---|
| `RegisterUser` (`admin/addUser.ts`) | `POST /api/users/admin/register-user` | Requires SUPER_ADMIN/ADMIN (server-enforced). |
| `editUser` (`admin/editUser.ts`) | `PATCH /api/users/admin/update-user` | Same role requirement. Blocks demoting the last remaining admin. Syncs to `Doctor` if the edited user is a THERAPIST. |
| `deleteUser` (`admin/deleteUser.ts`) | `DELETE /api/users/admin/delete-user` | Same role requirement. Blocks self-delete and blocks deleting the last admin. |
| `getAllUsers` (two implementations - see below) | `GET /api/users/getallusers` | No role check at all - any authenticated user, including a THERAPIST, can list every user's name/email/phone/role. |

**There are two independent `getAllUsers` actions** - `src/actions/admin/get-all-users.ts`
and `src/actions/user/get-all-users.ts` - hitting the identical endpoint with different
response shapes (one returns the raw `{users: [...]}`, the other flattens it). They're
used by different call sites (`settings.tsx` vs. the enquiry-drawer assignee picker) and
neither is wrong, but it's duplication worth collapsing into one the next time either file
is touched.

The backend's `getUserById` controller function is exported but never wired to a route -
it's dead code today.
