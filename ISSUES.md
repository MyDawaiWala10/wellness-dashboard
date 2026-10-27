# Known Issues & Bugs

## BEFORE_DEPLOYMENT

**Read this section before pushing `WellnessBackend` to main.** Render
auto-deploys on commit to main, so pushing *is* deploying. Two of these will
take the API down or mislead staff if they're skipped.

---

### BD-1. Confirm `JWT_REFRESH_SECRET` exists on Render

**Importance:** Blocker. Skipping this takes the whole API down.  
**Applies to:** the #9 fix on branch `fix/known-issues-cleanup`  
**Owner:** whoever holds the Render dashboard

The #9 fix makes the backend refuse to boot when a JWT secret is missing, instead of silently signing tokens with a string that's in the git history. That's the correct behaviour, but it means a missing env var is now a hard startup failure rather than a quiet vulnerability.

- `JWT_SECRET` is **provably already set**. `userAuth` verified with `process.env.JWT_SECRET!` and no fallback, so if it were missing, every authenticated request would already be failing and the dashboard would be unusable. It isn't, so it's set.
- `JWT_REFRESH_SECRET` is **not proven**. It had the same fallback on *both* the sign and the verify side, so production may have been quietly running on `"vivo123refresh"` this whole time and still working fine.

Do this, in order:

1. Check the Render service env vars for `JWT_REFRESH_SECRET`. If it's absent, add one (`openssl rand -hex 32`) **before** pushing, or the service will boot-loop.
2. Expect a **one-off logout for everyone** if that variable is newly added or its value changes. Existing refresh tokens are signed with the old secret and become invalid. Warn staff, or do it outside business hours.

---

### BD-2. Update the owner guide the moment this deploys

**Importance:** Important. It's a factual claim staff will read and act on.  
**Applies to:** [docs/team/owner-guide.md](docs/team/owner-guide.md), Settings section and the "Things to watch out for" table

The guide currently tells the owner that the **therapist revenue-split save is broken** and to use per-therapist overrides instead. That's true of what's live right now, and stops being true the second this deploys. Two spots to edit, both say the same thing.

Since then the global split has been **removed entirely** (see BD-5). The guide should now say: each therapist's split is set by an Admin or Super Admin in the therapist drawer's Earnings tab, applies to sessions completed from then on, and therapists never see it.

This is the exact failure mode the 2026-09-17 documentation pass was cleaning up (entries sitting at "Open" long after the code was fixed), so it's worth doing in the same sitting as the deploy rather than "later".

---

### BD-3. Decide on #19 before trusting the new permission wiring

**Importance:** Worth a decision, not strictly a blocker.  
**Applies to:** [#19](#19-therapist-edit-is-not-ownership-scoped), pre-existing

#10/#11 wired real role enforcement, which makes it tempting to assume therapist-facing routes are now locked down. `PUT /api/therapist/:id` is the exception: therapists legitimately need it for their own "My Profile", but the controller never checks the `:id` is theirs, so a therapist could edit another therapist's record.

This is pre-existing and not made worse by deploying, so it doesn't block. Just decide consciously whether it ships as-is rather than discovering the gap later and assuming the permission work covered it.

---

### BD-4. Booking source colours: deploy the backend first

**Importance:** Important. Getting the order wrong silently loses data.  
**Applies to:** the booking-source feature (colour-coded booking IDs), both repos

The frontend now makes staff pick how each booking reached us (Online / WhatsApp / Walk-in / Via Therapist), and Via Therapist also records which therapist referred it.

- **Backend first is safe.** The new backend treats a missing source as WhatsApp, so the frontend that's currently live (which sends no source) keeps creating bookings normally.
- **Frontend first loses the referring therapist.** The chosen source would still save, since `source` was free text before. But the old backend's strict schema doesn't know `referredByDoctorId` / `referredByName`, so Mongoose silently drops them, and every Via Therapist booking made in that window loses its therapist for good.

---

### BD-5. Per-therapist earnings split: deploy backend, run the backfill, then frontend

**Importance:** Important. Skipping the backfill shows every existing therapist's cut as "-".  
**Applies to:** the per-therapist split feature, both repos

The global "Therapist earnings split" setting is gone. Each therapist now has their own split, set by Admin / Super Admin in the drawer's Earnings tab, and each booking locks in its therapist's split when it completes.

1. Deploy the backend.
2. Dry run, and check the counts look right: `npx tsx scripts/backfill-therapist-split.ts`
3. Apply: `npx tsx scripts/backfill-therapist-split.ts --apply`. This sets every therapist without a split to 60% (today's global value) and locks 60% onto every already-completed or already-paid-out booking, so no past number changes.
4. Deploy the frontend.

The script is safe to re-run; it only touches therapists and bookings that still have no split. Run against the local `.env` database on 2026-09-29, the dry run found 19 therapists and 0 completed bookings; production counts will differ.

---

### BD-6. Customer accounts (`/api/customer-app`): set the Render env vars, then deploy

**Importance:** Important. Without the env vars the new customer endpoints answer 503 (the dashboard and the public endpoints keep working). The deploy also changes two things on the existing public form and pay page.  
**Applies to:** the customer-accounts work in `WellnessBackend` (built and tested 2026-10-02, not committed yet), backend only  
**Owner:** whoever holds the Render dashboard

Phone OTP sign-in (MSG91), profile, profile photo, "my bookings" and booking while signed in, for Anjishnu's Customers' App. The patient website is not changed. Reference: `WellnessBackend/docs/api.md` (Customers' App section); the private notes are in `customer-app-docs/customer-app-api-uncensored.md`.

**Set on Render before (or with) the deploy:**

1. `CUSTOMER_JWT_SECRET`: a new random value, at least 32 characters, **not** equal to `JWT_SECRET` (`openssl rand -hex 32`). Without it, or if it's too short or reused, every `/api/customer-app` route answers 503 `Customer accounts aren't available right now.` and the boot log warns; the dashboard keeps working. Changing it later signs every customer out.
2. `MSG91_AUTH_TOKEN` and `MSG91_TEMPLATE_ID`: the same MSG91 account as the patient website. The template must be DLT-approved (without the template ID MSG91 accepts the send but never delivers it), and it should use a 6-digit OTP: the backend asks for 6 digits valid 10 minutes, and only accepts 6-digit codes. Without both, sign-in answers 503 `Phone sign-in isn't available right now.`
3. `CUSTOMER_APP_URL`: the exact browser origins of the Customers' App, comma-separated, scheme + host (+ port), no trailing slash, e.g. `https://app.example.com`. Only needed for a web app (native apps send no `Origin`). Anything unlisted gets 403 `Origin not allowed`.
4. `TRUST_PROXY`: the number of proxies in front of the app. **Check first:** look at `X-Forwarded-For` on a real request reaching Render and count the hops Render adds. Without it, the per-IP limits key on the first `X-Forwarded-For` entry, which a client can spoof; set too low, every customer shares one proxy IP and one budget. Per-phone, per-account and global limits don't depend on it. This one can only be checked after the deploy, so set it then (Render restarts on an env change).
5. `IDENTITY_DB`: leave unset (default `mdw`) unless the patient website's `MONGODB_DB` is something else; the two must match.
6. **Never** set `MSG91_DEMO_PHONE` / `MSG91_DEMO_OTP` on Render. They sign that phone in with a fixed code and no SMS, for local tests only.

**Indexes.** The deploy builds `customers.accountId` (unique, sparse) and `appointmentbookings.phonenumber`. Both already exist on production since 2026-10-02 (a local run built them before the local `.env` was switched to the Docker copy; no data was written), so there's nothing to wait for. The first app sign-in also asks for the `mdw.users` indexes (`phoneE164` unique, `email` unique sparse), which the patient website already created.

**Optional backfill.** Accounts get `products: ["wellness"]` on their first app sign-in; website-only accounts stay unlabelled. To label every existing account once:

1. Dry run, check the count: `npx tsx scripts/backfill-account-products.ts`
2. Apply: `npx tsx scripts/backfill-account-products.ts --apply`

Your local `.env` now points at the Docker copy (`wellness-dev-mongo`), so these only touch production if `DATABASE_URL` is pointed at production for that run.

**Behaviour changes on existing endpoints, from this deploy:**

- Public booking form (`POST /api/appointments/public`): a repeat is merged only into an open lead with status `enquiry`, the same phone, the same name and the same service. Before, it merged into any open `enquiry`/`scheduled`/`ongoing` lead on that phone + name. Staff may see more separate enquiries from one person.
- Public pay page (`GET /api/appointments/pay/:token`): a course follow-up row only shows its own confirmed add-ons as due, not its per-session share of the course price. A link on a follow-up with no add-ons now shows nothing due.
- An unknown browser origin gets 403 `Origin not allowed` instead of 500, and other 4xx errors from body parsing (bad JSON, oversized body) keep their status instead of becoming 500.

**After the deploy:** check the boot log has no `CUSTOMER_JWT_SECRET is unset...` or `MSG91 is not configured...` warning, then sign in once with your own phone. A live SMS was never part of the tests (they use the demo OTP).

**Evidence:** `node scripts/e2e-customer-app.ts` from `C:\workspace\WellnessBackend` (needs Docker; starts a throwaway `mongo:7` on port 27099, refuses any non-localhost database, cleans up) passed 55/55 on 2026-10-02. Unit tests: 285 passing. Typecheck: 5 errors, all pre-existing.

**Read [#20](#20-production-customersphone-has-a-unique-index) before announcing the app.** Production's unique index on `customers.phone` makes app profile saves and bookings fail for some existing customers.

---

## Critical

### 1. Therapist Profile Update Does Not Sync to Doctor Roster

**Severity:** High  
**Status:** Open  
**Affected Pages:** Settings (`/dashboard/settings`), All Therapist (`/dashboard/alltherapist`)

#### Description
When a therapist updates their profile via the Settings page "Edit Profile" dialog, the changes only update the `User` model. The linked `Doctor` model (therapist roster) is NOT updated. This causes data inconsistency between the two pages.

#### Steps to Reproduce
1. Login as a therapist (role: `THERAPIST`)
2. Go to `/dashboard/settings`
3. Click "Edit Profile" and change name/email/phone
4. Save changes
5. Go to `/dashboard/alltherapist`
6. Observe: The therapist's info is still the OLD values

#### Root Cause
The `completeProfile` endpoint (`PUT /api/users/complete-profile`) only updates the `User` model:

```typescript
// Backend: userController.ts - completeProfile
const updatedUser = await User.findByIdAndUpdate(
    userId,
    updateData,
    { new: true, runValidators: true }
).select("-userPassword");
// ^^^ Only updates User, NOT Doctor
```

The `Doctor` model has a `userId` field linking to the `User`, but `completeProfile` does not check for or update the linked Doctor record.

#### Expected Behavior
When a therapist's profile is updated, the changes should propagate to both:
- `User` model (login account)
- `Doctor` model (therapist roster)

#### Suggested Fix
In `completeProfile` controller, after updating the User, check if the user has role `THERAPIST` and update the linked Doctor:

```typescript
// After User.findByIdAndUpdate(...)
if (updatedUser.role === "THERAPIST") {
    await Doctor.findOneAndUpdate(
        { userId: userId },
        { 
            name: `${userfName} ${userlName}`.trim(),
            email: userEmail,
            phonenumber: userPhone,
        }
    );
}
```

#### Affected Code
- **Backend:** `C:\workspace\WellnessBackend\controllers\userController.ts` - `completeProfile` function (line 387-487)
- **Frontend:** `C:\workspace\backend-mdw\WellnessFrontend\src\actions\user\update-profile.ts`

---

### 2. Super Admin Edit User Does Not Update Doctor Roster

**Severity:** Medium  
**Status:** Fixed (confirmed 2026-09-17)  
**Affected Pages:** Settings (`/dashboard/settings`)

#### Description
When a super admin edits a therapist's info via the Settings page "Admin Members" table, it calls `PATCH /api/users/admin/update-user`. This entry claimed the endpoint only updated the `User` model, not the linked `Doctor`.

#### Verified against current code
`adminEditUserProfile` (`controllers/userController.ts:374-402`) already syncs `firstName`, `lastName`, `name`, `email`, `phonenumber`, and `isActive` to the linked `Doctor` document whenever the edited user's role is `THERAPIST`, with the sync failure caught and logged (not fatal to the request). This entry was still marked Open when it had already been fixed. It also has test coverage: `controllers/userController.test.ts`, describe block `adminEditUserProfile — Doctor sync`.

#### Left over from the fix (minor, not the original bug)
Two `console.log`/`console.error` debug lines are still in the sync block (lines 390, 397, 400) and should be cleaned up next time this function is touched, but they're not a functional issue.

---

### 20. Production `customers.phone` Has a Unique Index

**Severity:** High  
**Status:** Open (found on production 2026-10-02; pre-existing, not caused by the customer-accounts work; the fix is the owner's call)  
**Affected:** production database, `customers` collection, index `phone_1`

#### Description
The code treats one phone number as shared by several patients (a household): a customer is phone + name, and `models/customerModel.ts` declares `phone` indexed but **not** unique. Production still has an older **unique** index on `phone` (`phone_1`), which Mongoose never drops by itself. So a second patient with a different name on a phone that already has a customer can't be saved: duplicate key error.

#### Impact
- **Public form or dashboard booking** for a second person on a shared phone: the booking row is saved, then creating its customer fails, so the caller gets a 500 and the booking has no `customer_id` (and no invoice). A retry of the public form folds into that row.
- **Staff "Add customer"** with a new name on an existing phone: 500 with the raw Mongo error.
- **Customers' App (after BD-6):** anyone whose account name differs from the name staff used on the existing record for their phone. Sign-in works, but every `PATCH /me`, photo upload and booking answers 500.

The end-to-end harness runs on a fresh database, so it couldn't catch this.

#### Suggested Fix
Drop the index on production (`db.customers.dropIndex("phone_1")`), then restart the backend so Mongoose builds the non-unique `phone` index the schema declares. Nothing to clean up first: the unique index is why no duplicate phones exist yet. Every code path already handles several customers per phone (`Customer.find({ phone })` then match by name).

---

### 22. Patient Website OTP: 4-Digit Codes, No Verify Rate Limit

**Severity:** High (patient website, `C:\workspace\mdw`)  
**Status:** Open (noted 2026-10-02; the website was deliberately left unchanged in the customer-accounts work)  
**Affected Code:** the website's MSG91 OTP routes (`src/app/api/auth/otp`)

#### Description
The website and the new Customers' App backend share one MSG91 account and one set of customer accounts (`mdw.users`). The website still sends MSG91's default code length (4 digits) and has no rate limit on verify, so its 10,000 possible codes have no brake except whatever MSG91 applies itself (not checked). Taking over an account through the website takes over the same person's app account.

The backend side is fine: it asks MSG91 for 6-digit codes and only accepts exactly 6 digits, so a website code can't be guessed through the app, and its verify is limited (10 an hour and 30 a day per phone, 30 an hour per IP).

#### Suggested Fix
On the website: send `otp_length: 6` (and the same 10-minute expiry), accept only 6 digits, and rate-limit verify per phone and per IP like the backend does. Related, same file area: the website overwrites the account `name` and doesn't lowercase `email`, while the backend only fills an empty name and lowercases email, so the two writers disagree.

---

## Medium

### 3. User Table Filter Uses Wrong Column ID

**Severity:** Low  
**Status:** Open  
**Affected Pages:** Settings (`/dashboard/settings`)

#### Description
The user data table filter input has a bug where it references `userFname` (capital F) instead of `userfName` (lowercase f) for the column filter.

#### Code
```typescript
// Frontend: src/components/pages/setting/user-data-table.tsx - line 71
onChange={(event) =>
    table.getColumn("userFname")?.setFilterValue(event.target.value)
    //                  ^^^ Should be "userfName" (lowercase f)
}
```

The column is defined as `userfName` (lowercase) in `user-column.tsx`:
```typescript
// Frontend: src/components/pages/setting/user-column.tsx - line 300
{
    id: "userfName",  // lowercase f
    header: "Name",
    ...
}
```

#### Impact
Filtering by name in the Admin Members table does not work.

#### Suggested Fix
Change `"userFname"` to `"userfName"` in `user-data-table.tsx` line 71.

---

### 4. Optimistic Update Bug in Therapist Edit

**Severity:** Low  
**Status:** Open  
**Affected Pages:** All Therapist (`/dashboard/alltherapist`)

#### Description
The `useUpdateTherapist` hook does an optimistic update using `doctorId` as the key, but the update values object uses `doctorId` from the form. If the form doesn't include `doctorId`, the optimistic update won't match any row.

#### Code
```typescript
// Frontend: src/data/therapist/therapist.ts - line 108-110
queryClient.setQueryData(["therapists"], (old: any[]) => {
    if (!old) return old;
    return old.map((t) =>
        t.doctorId === newValues.doctorId ? { ...t, ...newValues } : t,
    );
});
```

If `newValues.doctorId` is undefined, no row gets updated optimistically (though the backend still processes correctly).

#### Impact
Minor UX issue - the table might briefly show stale data until the query refetches on settle.

---

### 21. Staff Dashboard Can't See the New Customer Fields

**Severity:** Medium  
**Status:** Partly fixed (2026-10-16: gender and age now show, see #24; city, pincode, emergency contact, photo and app login still open)  
**Affected Pages:** Customers (`/dashboard/customers`) and the booking drawers

#### Description
The Customers' App saves `gender`, `dob`, `city`, `pincode`, `emergencyContact` and `profilePhotoUrl` on the clinic's customer record, and `accountId` when the customer has an app login. No dashboard screen shows any of them, so staff calling a patient can't see their emergency contact or photo, or tell whether they use the app. `GET /api/customers/:customerId` already returns the whole record; the list (`GET /api/customers`) selects only the old fields (`customerController.ts`, `getCustomers`). So: widen that `.select` where the list needs them, plus the UI.

---

## Low

### 5. Gender Enum Mismatch Between User and Doctor Models

**Severity:** Low  
**Status:** Open  

#### Description
The `User` model and `Doctor` model use different gender enum values:

- **User model:** `"Male"`, `"Female"`, `"Other"`, `""` (capitalized)
- **Doctor model:** `"male"`, `"female"` (lowercase)

This inconsistency could cause issues if gender data is synced between models.

#### Affected Code
- `C:\workspace\WellnessBackend\models\userModel.ts` line 28-32
- `C:\workspace\WellnessBackend\models\doctorsModel.ts` line 19-22

---

### 6. Missing Validation on complete-profile for role Field

**Severity:** Low  
**Status:** Open  

#### Description
The `completeProfile` endpoint accepts a `gender` field but the frontend Settings page sends `gender` values like `"Male"` or `"Female"`. The User model accepts these, but if the data ever needs to sync to the Doctor model (which expects lowercase), there's a mismatch.

---

### 7. No Error Handling for Doctor Sync Failure

**Severity:** Low  
**Status:** Open  

#### Description
If a fix is implemented to sync User updates to the Doctor model, there's no error handling for cases where:
- The Doctor record doesn't exist (orphaned User)
- The Doctor update fails (database error)

The current code doesn't handle these edge cases, which could leave data in an inconsistent state.

---

---

## Backend Security Issues (from WellnessBackend/docs/known-issues.md)

### 8. Unguarded Admin Endpoints

**Severity:** Critical  
**Status:** Fixed (confirmed 2026-09-17)  
**Affected Routes:** `DELETE /api/users/admin/delete-user`, `POST /api/users/admin/register-user`, `PATCH /api/users/admin/update-user`

#### Description
Originally, these endpoints required only `userAuth`, so any authenticated user could call them regardless of role. As of `routes/userRoute.ts`, all three now have `requireRole("SUPER_ADMIN", "ADMIN")` wired in. This entry was still marked Open when it had already been fixed; verified directly against the current route file rather than trusting the doc.

#### Suggested Fix
~~Wire `requireRole("SUPER_ADMIN", "ADMIN")` middleware on these routes.~~ Done.

---

### 9. JWT Secret Fallbacks

**Severity:** Critical  
**Status:** Fixed (2026-09-18, branch `fix/known-issues-cleanup`)  
**Affected Code:** `lib/env.ts` (new), `controllers/userController.ts`, `middlewares/userAuth.ts`, `middlewares/superAdminAuth.ts`, `server.ts`

#### Description
If `JWT_SECRET` / `JWT_REFRESH_SECRET` were missing, the code silently signed tokens with `"vivo123"` / `"vivo123refresh"` - strings that are in this repo's git history, so anyone who read the repo could forge a valid token for any user id.

```typescript
jwt.sign({ id: userId }, process.env.JWT_SECRET || "vivo123", ...)
jwt.sign({ id: userId }, process.env.JWT_REFRESH_SECRET || "vivo123refresh", ...)
```

#### Fix
There were five raw reads of these vars across three files (two signing, three verifying). All now route through a single `lib/env.ts` whose getters throw instead of falling back, and `server.ts` calls `assertJwtSecrets()` right after `dotenv.config()` so a misconfigured deploy fails at boot rather than serving forgeable tokens. Tests: `lib/env.test.ts`.

#### Deploy note, read before shipping this
`JWT_SECRET` is provably already set in production: `userAuth` verified with `process.env.JWT_SECRET!` and no fallback, so if it were missing every authenticated request would already 401 and the dashboard would be unusable. `JWT_REFRESH_SECRET` is different - it had the same fallback on *both* the sign and verify side, so production may have been quietly running on `"vivo123refresh"` all along and still working. Two consequences:

1. Confirm `JWT_REFRESH_SECRET` exists on the Render service *before* deploying this, or the service will refuse to boot (which is the correct behaviour, but it's downtime).
2. If it was previously unset (or you change its value), every existing refresh token becomes invalid and everyone gets logged out once. Expect that, it's a one-off.

---

### 10. ROLES Grants Every Role Every Permission

**Severity:** High  
**Status:** Fixed (2026-09-18, branch `fix/known-issues-cleanup`)  
**Affected Code:** `lib/index.ts`

#### Description
Every role got every permission, so even wiring the guard (#11) couldn't differentiate anyone.

```typescript
export const ROLES = {
  SUPER_ADMIN: Object.values(PERMISSIONS),
  ADMIN: Object.values(PERMISSIONS),
  THERAPIST: Object.values(PERMISSIONS),   // <-- same as super admin
  STAFF: Object.values(PERMISSIONS),
  CUSTOMER_CARE: Object.values(PERMISSIONS),
};
```

#### Fix: therapist gets a real scope, back-office deliberately unchanged
`THERAPIST` now holds 7 of 17 permissions (dashboard view, appointment view/create/edit, therapist view/edit, export). The four back-office roles keep all 17, **on purpose**: they're identical in the product today and staff use those screens daily, so tightening them is a business decision, not a refactor (see the capability table in [docs/team/owner-guide.md](docs/team/owner-guide.md)). Differentiating STAFF from CUSTOMER_CARE remains unbuilt and undecided.

Two new permissions were added for domains that had no vocabulary at all: `SERVICE_MANAGE` (catalogue + session-rate pricing) and `SETTINGS_MANAGE` (clinic-wide numbers).

#### What the therapist grant was derived from
Not from what sounds tidy, from what their reachable screens actually call. Deliberately granted:

- `APPOINTMENT_EDIT` / `APPOINTMENT_CREATE`: completing sessions, visit OTPs, add-on recommendations, booking a recommended follow-up
- `THERAPIST_VIEW`: the roster read behind their home KPIs and earnings split
- `THERAPIST_EDIT`: their own "My Profile" record. `therapist-details-page.tsx` has **no role gate**, so denying this would break a therapist editing their own details

Endpoints deliberately left open to any authenticated user because therapists genuinely hit them:

| Endpoint | Why |
|---|---|
| `GET /api/services` | read mid-visit when recommending an add-on (`visit-tab.tsx`, 5 call sites) |
| `GET /api/clinic-settings` | earnings page reads `therapistSplitPercent` to show their own cut |
| `GET /api/customers` | the appointment history tab calls `getCustomerByPhone` |
| `GET /api/session-rates` | pricing is quoted from several screens |
| `POST /api/specializations` | reachable from their own profile edit |

Verified no UI regression: `login` returns a computed `permissions` array, but the frontend never reads it (it has its own map), so a therapist's shorter list changes nothing on screen.

---

### 11. checkPermissions Middleware Is Never Wired

**Severity:** High  
**Status:** Fixed (2026-09-18, branch `fix/known-issues-cleanup`)  
**Affected Code:** `middlewares/checkPermissions.ts`, `routes/serviceRoutes.ts`, `routes/sessionRateRoutes.ts`, `routes/clinicSettingsRoutes.ts`, `routes/DoctorsRoute.ts`, `routes/appointmentBookingRoutes.ts`

#### Description
The middleware was fully implemented (merges `ROLES[user.role]` with `user.customPermissions`, 403s on a missing permission) but had **zero imports anywhere in the backend**. Dead code.

#### Fix
Wired onto the six write routes that a therapist provably never calls, each checked against frontend usage first:

| Route | Guard |
|---|---|
| `POST/PUT/DELETE /api/services` | `SERVICE_MANAGE` |
| `PUT /api/session-rates` | `SERVICE_MANAGE` |
| `PUT /api/clinic-settings` | `SETTINGS_MANAGE` |
| `POST /api/therapist` | `THERAPIST_CREATE` |
| `DELETE /api/therapist/:id` | `THERAPIST_DELETE` |
| `DELETE /api/appointments/:id` | `APPOINTMENT_DELETE` |

Tests: `middlewares/checkPermissions.test.ts` asserts the boundary both ways (all four back-office roles still pass every gated permission; therapists are 403'd on each, allowed on their own job), plus 401 on no user and 403 on an unknown role. Also verified live against a real Express app: 10/10 route-level cases behaved as expected.

#### Correction to a common restatement of this issue
It's often summarised as "only one endpoint in the whole codebase is role-gated." That was never accurate. Before this fix there were already four enforcement sites: `requireRole` on the 3 `/admin/*` user routes, `superAdminAuth` on the 2 therapist super-routes, role-scoping inside `getAllAppointments`, and back-office checks in all 8 `invoiceController` handlers.

---

### 19. Therapist Edit Is Not Ownership-Scoped

**Severity:** Medium  
**Status:** Fixed (2026-10-16). Found 2026-09-18 while wiring #11. The fix covers every therapist write, not just this one: a therapist acts only on their own profile, leave and days off (`mayActOnTherapist`) and on bookings assigned to them (`mayActOnBooking`: booking save, add-on recommend / code / confirm, complete session, payment link, plus the existing payment and visit-code checks). They can't move or reassign a visit, switch themselves off or change their therapist ID, and a colleague's profile is read-only on screen.  
**Affected Code:** `controllers/DoctorController.ts` - `updateDoctorDetails`

#### Description
`PUT /api/therapist/:id` is correctly available to therapists (they edit their own "My Profile"), but the controller never checks that `:id` is *the caller's own* record. A therapist could edit another therapist's profile by sending a different `doctorId`.

This can't be fixed with a role permission, since it's the same permission for self and other; it needs an ownership check in the controller (resolve the caller's `Doctor` via `req.user`, compare to `:id`, 403 on mismatch). The UI never does this, so there's no evidence of it happening, but the endpoint allows it.

---

### 12. Invalid-Role Fallback Bug in adminRegisterUser

**Severity:** Medium  
**Status:** Fixed (confirmed 2026-09-17)  
**Affected Code:** `controllers/userController.ts:251-264`

#### Description
This entry claimed an invalid role silently fell back to `"CUSTOMER"` (not a valid enum value), crashing `save()` with a generic 500.

#### Verified against current code
`adminRegisterUser` now validates the role against an explicit `validRoles` list and returns a clean 400 ("Invalid role. Must be one of: ...") before ever reaching `save()`. The comment in the code even references this exact bug. This entry was still marked Open when it had already been fixed. Added a regression test: `controllers/userController.test.ts`, describe block `adminRegisterUser — role validation`.

---

### 13. addDoctor Error-Message String Can Crash

**Severity:** Medium  
**Status:** Fixed (confirmed 2026-09-17)  
**Affected Code:** `controllers/DoctorController.ts:13-30`

#### Description
This entry claimed the code called `.filter()` on `req.body` (an object, not an array), throwing a `TypeError` and returning a generic 500 instead of "missing fields".

#### Verified against current code
`addDoctor` has been rewritten since this was logged: no `.filter()` call exists anywhere in the function. It validates `name`/`email`/`phonenumber` and password length up front with clean 400 responses. This entry was still marked Open when it had already been fixed. Added a regression test: `controllers/DoctorController.test.ts`.

---

### 14. updateAppointment Returns Pre-Update Document

**Severity:** Low  
**Status:** Open  
**Affected Code:** `controllers/appointmentController.ts` lines 101-104

#### Description
`findByIdAndUpdate` defaults to returning the document **before** the update. The response says "updated successfully" but includes stale data. Add `{ new: true }` to return the updated document.

---

### 15. Doctor.gender Field Has Typo `requied`

**Severity:** Low  
**Status:** Open  
**Affected Code:** `models/doctorsModel.ts` line 15

#### Description
`requied` isn't a valid Mongoose schema option, so the field is effectively optional even though it was meant to be required.

---

## Backend Bugs

### 16. Therapist Revenue-Split Save Always Fails

**Severity:** Medium
**Status:** Fixed (2026-09-17, branch `fix/known-issues-cleanup`)
**Affected Pages:** Settings (`/dashboard/settings`, "Therapist Split" card)

#### Description
`updateClinicSettings` only ever read `req.body.bookingGapMinutes`. The Settings page's therapist-split card sends `{ therapistSplitPercent }` alone, so the controller always computed `Number(undefined)`, failed its `Number.isFinite` guard, and returned 400. The save button could never succeed.

#### Fix
The controller now validates and `$set`s whichever of `bookingGapMinutes` / `therapistSplitPercent` is present in the request body, independently, matching the frontend's `Partial<ClinicSettings>` contract.

#### Affected Code
- `controllers/clinicSettingsController.ts` (`updateClinicSettings`)
- New test: `controllers/clinicSettingsController.test.ts`

---

### 17. Per-Therapist Leave Lookup Returns Everyone's Leaves

**Severity:** Medium
**Status:** Fixed (2026-09-17, branch `fix/known-issues-cleanup`)
**Affected Pages:** Therapist List (per-therapist availability tab)

#### Description
`getLeaves` only read `req.query.doctorId`, never `req.params.doctorId`. The route `GET /api/therapist-leaves/:doctorId` (used to fetch one therapist's leave records) therefore ignored the path param and returned every therapist's leaves.

#### Fix
`getLeaves` now falls back to `req.params.doctorId` when no query param is given, so both call shapes (`GET /:doctorId` and `GET /?doctorId=`) filter correctly.

#### Affected Code
- `controllers/therapistLeaveController.ts` (`getLeaves`)
- New test: `controllers/therapistLeaveController.test.ts`

---

## UI/UX Issues

### 18. Account Menu Didn't Show Who You're Logged In As

**Severity:** Low
**Status:** Fixed (2026-09-17)
**Category:** UI/UX
**Affected Pages:** All dashboard pages (top-right account menu, `SlimSidebar.tsx`)

#### Description
Clicking the avatar in the top-right corner opened a menu that just said "My Account," with no name, email, or role shown, even though that information was already sitting in the client-side auth store. Standard account-menu UX shows who you're logged in as; this one didn't.

#### Fix
The dropdown now shows the user's full name, email, and role (title-cased, e.g. "Customer Care" instead of the raw `CUSTOMER_CARE`), pulled from the existing `useAuthStore` user object. No new data fetching needed, nothing added to the backend.

#### Affected Code
- `src/components/SlimSidebar.tsx` (`DropdownMenuLabel`, new `formatRole` helper)

---

### 23. "An Unexpected Response Was Received from the Server" After Sleep or a Wi-Fi Drop

**Severity:** Medium
**Status:** Fixed (2026-10-14)
**Category:** UI/UX
**Affected Pages:** Dashboard home, Enquiries, and every page that loads a list

#### Description
The enquiries list re-checks the server every 8 seconds, including while the tab is in the background (needed for the new-enquiry sound). When the computer slept or the network dropped for a moment, one of those checks failed (`net::ERR_NETWORK_IO_SUSPENDED` in the console). The dashboard then replaced the bookings it was already showing with a big "An unexpected response was received from the server" box, plus a red pop-up, even though nothing was wrong on the server. A tab left open across a new deploy can show the same message once, because it calls the previous build.

#### Fix
- A failed **background** refresh is now silent: the page keeps showing what it has, and the next check (within 8 seconds of the network coming back) refreshes it.
- The error box only appears when there is nothing to show at all, i.e. the **first** load failed (`isLoadingError` instead of `isError`).
- The 8-second enquiries check retries 3 times before giving up, so a short drop fixes itself.

#### Affected Code
- `src/providers/providers.tsx` (global query `onError`: no pop-up when data is already on screen)
- `src/data/enquiry/enquiry.ts` (`retry: 3`)
- Every page that passes `isError` to `QueryWrapper` now passes `isLoadingError`

---

### 24. Website Gender and Age Never Reached the Customer Record

**Severity:** High
**Status:** Fixed (2026-10-16)
**Category:** Data
**Affected Pages:** Enquiries (Lead info), Customers

#### Description
The website booking form started asking for gender and age on 2026-10-13, but only wrote them into the note text ("Gender: Female"). The backend's public booking endpoint didn't accept either field, bookings had no gender field, and the customer record (which already had space for gender and date of birth, from the Customers' App work) was only ever filled once, at the first booking, with name, phone, email and address. So Lead info showed Age as "-" and no screen showed gender. A half-wired change: the form was updated, the backend and dashboard were not.

#### Fix
- The customer record is the person. Every booking path (website, dashboard, app, invoices) goes through `ensureCustomerForAppointment`, which now fills the customer's **missing** email, address, gender and age from the booking and never overwrites them (the public form has no login, so anyone can type any number).
- Age is stored as a birth year (`birthYear`), so it never goes stale. An exact date of birth from the app wins.
- A new booking for a known customer takes their gender and age on first link, so returning customers show them too.
- Office corrections in Lead info (gender, age) also update the customer record. Therapists can't.
- The website sends `gender` and `age` as fields and no longer copies them into the note.
- Older leads: `scripts/backfill-gender-age-from-notes.ts` moves the note lines into the fields (dry run by default).

#### Affected Code
- Backend: `lib/personDetails.ts` (new), `lib/invoiceGeneration.ts`, `lib/bookingService.ts` (repeat folding), `controllers/appointmentController.ts` (public endpoint, PUT), `controllers/customerController.ts`, `models/customerModel.ts`, `models/appointmentsBookingModel.ts`, `lib/customerProfile.ts`
- Website: `src/lib/wellness-backend.ts`
- Dashboard: `src/lib/person.ts` (new), enquiry drawer Lead info, Customers drawer, `src/data/customer/customer.ts`

---

### 25. Checkout Raised a Duplicate Invoice Instead of Updating the Booking's (B1 #11)

**Severity:** High
**Status:** Fixed (2026-10-16); one stray invoice to void by hand (below)
**Category:** Money
**Affected Pages:** Invoices, booking Billing tab

#### Description
The invoice code treated every booking row as the one holding the money. A course's later sessions and add-on visits keep their money on the booking they belong to (`moneyRowFor`), but completing one synced the invoice against the visit's own row. That row had no invoice and was now "completed", so a brand-new invoice was raised for its share, while the booking's real invoice never updated. Add-ons recommended during a later session were also missing from the booking's invoice. In production this left **INV-2026-0054** ("Therapy ₹1,600, pending") on ENQ-0107, session 4 of ENQ-0104's course, which is already billed and fully paid on INV-2026-0052.

Separately, an invoice with money in but a balance left read "Pending", because the stored status is only paid or pending.

#### Fix
- Every invoice trigger (checkout, payment, booking save, add-on lock) resolves the booking that holds the money and updates its one invoice. That invoice bills add-ons from all of its visits; a visit never gets an invoice of its own.
- "Part paid" when money is in but a balance remains: dashboard list, drawer, Billing tab (one helper) and the PDF.
- Download button (B1 #10): top right of the invoice drawer, and next to Location and Call on the booking panel. Opens the PDF, made fresh when the numbers changed.

#### To do by hand
Void **INV-2026-0054** on the Invoices page, reason "Duplicate: session 4 of ENQ-0104 is billed on INV-2026-0052". Voiding keeps the GST invoice number on record; deleting would leave a gap.

#### Affected Code
- Backend: `lib/invoiceGeneration.ts` (`billedBooking`), `lib/invoicePdf.ts`, `lib/invoiceBilling.test.ts`
- Dashboard: `src/lib/invoice-status.ts`, `src/components/invoice-download-button.tsx`, invoice drawer, invoices list, Billing tab, booking summary strip

---

### 26. Visit Tab Demanded the Whole Package Price at the First Session

**Severity:** High
**Status:** Fixed (2026-10-22, branch `feat/visit-otp-roles`; verified on `localhost`, pending merge to `main`)
**Category:** Money
**Affected Pages:** booking drawer → Visit tab, step 4 "Payment"

#### Description
A multi-session package is billed per session (the backend only requires each session's paced share before that session can complete). But the Visit tab's Payment step pulled the **booking-wide** remaining due (`bookingLedger` → `price − paid`) instead of the **per-session share**. So on session 1 of a 4×₹1,600 course with nothing paid yet, it demanded the entire ₹6,400, not one ₹1,600 share. Frontend and backend disagreed: even if staff collected the full amount, the completion gate (`unpaidBeforeComplete`) only ever needed the single session's share.

Caught from a production report. The earlier `localhost` check used a partly-paid *later* session (session 3 of 3, ₹3,200 due = the 2 unpaid shares), which coincidentally equalled the whole remaining, masking the bug — the classic failure of only testing the happy/middle case.

#### Fix (frontend only)
Step 4 now derives its amount from the same source of truth as the collapsed visits-list header:
- `visitShort(visit, moneyParent)` — the paced per-session share (mirrors the backend's `paidNeededBeforeVisit` / `shortBeforeStart`: cumulative share owed up to this session − already paid, with the session index from the split-course position else the `sessionsCompleted` counter, **not** the repurposed `sessionNumber`).
- `visitAddonShort(visit)` — same-visit unpaid add-ons (add-ons are settled on the Billing tab, so the step only points there rather than rendering a ₹0 collect box when just add-ons remain).

The Record-payment cap, the QR amount, `paymentCleared`, the Finish hint and the disabled Complete button all use `bookingDue + addonDue`. `visit-tab.tsx` no longer imports `bookingLedger`.

Verified against ENQ-0129 (Therapy package, 4 sessions, ₹6,400 due, session 1, nothing paid): Step 4 now shows **₹1,600 due for this session**, the record form caps at ₹1,600, the QR bakes ₹1,600, and Complete stays disabled while unpaid.

#### Regression guard
New describe block in `src/lib/visit-groups.test.ts` — *"Visit payment gate (paced) — FE/BE parity"* — pins the session-1-unpaid case (1 share ≠ whole package) plus the counter-based, single-visit and add-on edge cases. Fixtures mirror the backend tests (`payments.realdoc.test.ts`, `addonVisits.test.ts`) with `KEEP IN SYNC` comments, since there's no automated cross-repo parity test.

#### Affected Code
- Dashboard: `src/components/pages/appointment/visit-tab.tsx` (step 4), `src/lib/visit-groups.ts` (`visitShort`, new `visitAddonShort`), `src/lib/visit-groups.test.ts`
- No backend change (already paced)

---

### 27. Newly-Assigned Appointments Didn't Appear on an Open Therapist Tab

**Severity:** Medium
**Status:** Fixed (2026-10-27, branch `feat/visit-otp-roles`; verified on `localhost`)
**Category:** Data freshness
**Affected Pages:** Appointments list, therapist dashboard, calendar

#### Description
The Appointments query was configured with `refetchOnWindowFocus: false` and **no polling** — only a 30s `staleTime`. Enquiries, by contrast, auto-refresh (8s poll). So when an admin (e.g. Kamraan) assigned a booking to a therapist, it did **not** show up on a therapist's already-open tab until a manual reload. The therapist could genuinely see "assigned things missing". (A `localhost` data check could not reproduce a *lost* assignment — all rows were correctly stamped — confirming the fault was the stale view, not the write path.)

#### Fix (frontend only)
`appointmentsQueryOptions` (`src/data/appointment/appointment.ts`) now mirrors the enquiries list: `refetchOnWindowFocus: true` plus `refetchInterval: 15 * 1000`. Newly-assigned records appear within ~15s with no reload. The 30s `staleTime` is kept so the drawer's write-ack `updateAppointment` refetch still doesn't re-hit the network on every open — and the live check confirmed the 15s interval is **not** masked by that `staleTime` (it fires well before staleness expires).

#### Verification
On `/dashboard/appointments` (the only interval query there is appointments; the shared enquiries poll runs alongside from the global notifier), the browser Resource-Timing timeline showed two clean periodicities: ~8.3s (enquiries) and ~15.3s (appointments). The ~0.3s over 15 is the request latency before the next timer starts.

#### Trade-off
The appointments payload (full list for back-office roles) now re-fetches every 15s instead of never. Accepted per explicit request.

#### Affected Code
- Dashboard: `src/data/appointment/appointment.ts` (`appointmentsQueryOptions`)
- No backend change

---

### 28. Called-but-Unreached Website Leads Never Reached Follow-ups

**Severity:** High
**Status:** Fixed (2026-10-27, `9f6afc9`, on `main`)
**Category:** Lead funnel
**Affected Pages:** Follow-ups, Enquiries, dashboard follow-up count

#### Description
`deriveStage` checked "has a booking type" (`booked`) before "tried to call, not reached" (`follow_up`). Website leads always arrive with a type, so a "no answer" on one never made it a follow-up. It also left "Needs first contact" (it had an attempt), so it vanished from every list. Found stuck: ENQ-0081, ENQ-0135. Present since 6797a0e (2026-07-17).

#### Fix and guard
Follow-up is checked before booked in `stage.ts`. Guard: `stage.test.ts` "deriveStage: follow-ups" (a lead with a type and an attempt is a follow-up).

---

### 29. Therapist's Appointments List Hid Today's Visits on Later Pages

**Severity:** Medium
**Status:** Fixed (2026-10-27, `097403e`, on `main`)
**Category:** Visibility
**Affected Pages:** Appointments (therapist)

#### Description
The list was sorted by when the booking was created. An older lead assigned today (ENQ-0081, created 23 Sep, visit tomorrow) sat on page 3, so the therapist reported "assigned sessions are missing". The data was correct; the order hid it.

#### Fix
Therapists open the list sorted by next visit (soonest first, nothing upcoming last). The office keeps newest first. "Next visit" is sortable for everyone.

---

### 30. Ticking "Reached out" Turned a Lead into a Scheduled Booking

**Severity:** High
**Status:** Fixed (2026-10-27, `4418a83`, on `main`)
**Category:** Lead funnel
**Affected Pages:** Enquiry drawer, Enquiries, Appointments

#### Description
The tick ran the funnel cascade, which flipped status `enquiry` to `scheduled`. The lead jumped to Appointments with no therapist or slot, and unticking only cleared the tick, leaving it off the Enquiries page. Found stuck: ENQ-0150 (launchman01), reset to `enquiry` in production on 2026-10-28 with an activity-log entry.

#### Fix and guard
`reachedOutPatch` in `stage.ts`: the tick never changes status; unticking a lead an older tick made "scheduled" (nothing booked) puts it back to `enquiry`. Guard: `stage.test.ts` "reachedOutPatch".

---

### 31. Appointments Page Listed Bookings with No Therapist

**Severity:** Medium
**Status:** Fixed (2026-10-27, `fd7e2d0`; verified on `localhost` as therapist only)
**Category:** Lead funnel
**Affected Pages:** Appointments, Enquiries, New appointment form

#### Description
The New appointment form can save a booking as `scheduled` with no therapist. The Appointments page listed every non-`enquiry` record, so ENQ-0152 showed there with "No therapist", contradicting the Enquiries drawer ("step 5 puts it on Appointments"). Affected: ENQ-0083, 0090, 0133, 0150, 0152. ENQ-0150 was on neither page.

#### Fix and guard
One rule, `hasTherapist` in `stage.ts`: Appointments shows only bookings with a therapist; Enquiries keeps every booking without one (package/add-on visits stay inside their booking). Saving without a therapist now says it went to Enquiries. Guard: `stage.test.ts` "hasTherapist". Not checked: office view (no office login).

---

### 32. Attended Section Buried a Lead Right After It Was Worked On

**Severity:** Medium
**Status:** Fixed (2026-10-27, `fd7e2d0`)
**Category:** Visibility
**Affected Pages:** Enquiries, Attended section

#### Description
Ticking "Reached out" on a Follow-up correctly moves it to Attended. But Attended was sorted by creation date and collapsed to the 5 newest, so an older lead (ENQ-0082 from 23 Sep, ENQ-0085 from 5 Oct) landed around row 50, behind "Show all". Its search box also only searched the 5 visible rows, so typing the name found nothing. Reported as "it vanished from everywhere".

#### Fix
Attended sorts by last update (matching its "Last updated" column), and a search looks through every attended lead. Checked against production data, read-only: ENQ-0082 row 52 to 1, ENQ-0085 row 50 to 2. Not checked in the browser (no office login).

---

### 33. Returning Customer's Details Not Carried onto a New Booking

**Severity:** Medium
**Status:** Fixed (2026-10-28, backend `17bcaa0`, dashboard `6a8a0cf`; unit-tested, not run against a real database)
**Category:** Data entry
**Affected Pages:** New Enquiry, Book new session, New appointment, website

#### Description
The backend copies gender and age from the customer record onto a new booking only when it links the customer for the first time (`ensureCustomerForAppointment`). The New appointment form sends `customer_id` up front, so the booking looked already linked and the copy was skipped (ENQ-0139 missed its customer's gender). Email and location were never copied. The New appointment form never filled Age on screen.

#### Fix and guard
- Backend: `createBooking` drops a client-sent `customer_id` (the server links by phone + name), and the first link now also fills a blank email and location from the customer record, never overwriting typed values. Course sessions 2+ take session 1's (possibly filled) location.
- Dashboard: picking a customer in New appointment fills Age from their record.
- Guards: `bookingService.test.ts` "createBooking: customer link"; `invoiceGeneration.test.ts` "a new booking also takes the customer's email and address".
- Not covered: first-time customers (nothing to copy); old customer records with no birth year or gender.

---

### 34. Appointments Stopped Refreshing in a Background Tab

**Severity:** Low
**Status:** Fixed (2026-10-27, `4b2b7dc`, on `main`)
**Category:** Data freshness
**Affected Pages:** Appointments, therapist new-booking alert

#### Description
The 15s refresh (#27) paused while the tab was hidden, so a therapist with the dashboard in a background tab would not hear a new assignment. Fixed with `refetchIntervalInBackground: true`, the same setting the office's new-lead sound uses.

---

### 35. Earnings Totals Row Sat One Column to the Left

**Severity:** Medium
**Status:** Fixed (2026-10-28, `d8e3aa0`; verified on `localhost` as therapist)
**Category:** Money display
**Affected Pages:** Earnings (therapist and admin)

#### Description
The Totals row had one cell fewer than the table has columns (no cell under Discount), so every total after Revenue sat one column left. A therapist's "Your Earnings" total (₹9,327 for therapist1234) showed under **Discount**; for admins the therapist total sat under Discount and the company total under Therapist Cut.

#### Fix
An empty Discount cell keeps each total under its column. Checked in the browser: Revenue ₹38,725 under Revenue, ₹9,327 under Your Earnings, 10 cells for 10 columns. Admin view checked by count only (12 cells for 12 columns), not in the browser (no office login).

---

### 36. Earnings Counts Visits That Haven't Happened Yet

**Severity:** High
**Status:** Fixed (2026-10-28, `9dccc19` rule, `d8e3aa0` page; verified on `localhost` as therapist)
**Category:** Money display
**Affected Pages:** Earnings, therapist drawer Earnings tab (both use `computeEarningsSummary`)

#### Description
`buildEarningRows` lists every non-cancelled booking, and `computeEarningsSummary` summed them all, so a scheduled future visit (often paid up front as part of a package) counted as earned before it happened, and "Sessions: Completed" counted every row. therapist1234 showed ₹9,327 earned and 49 sessions; only 15 were completed.

#### Fix and guard
One rule, `isEarned` in `src/lib/earnings.ts`: only completed sessions count. Every total (revenue, therapist payout, company, owed, sessions, average) uses earned rows only; the rest are summed separately as "Upcoming". The page shows an "Upcoming" card and tags those rows; the drawer tab shows an Upcoming figure. therapist1234 now: Earned ₹8,117 (15 completed), Upcoming ₹22,385 (34 visits). Guard: `earnings.test.ts` "computeEarningsSummary: earned vs upcoming". Admin view not checked in the browser (no office login).

---

## Summary

| # | Issue | Severity | Status |
|---|-------|----------|--------|
| 1 | Therapist self-update doesn't sync to Doctor | High | Open |
| 2 | Admin edit user doesn't sync to Doctor | Medium | Fixed |
| 3 | User table filter column ID mismatch | Low | Open |
| 4 | Optimistic update key mismatch | Low | Open |
| 5 | Gender enum mismatch between models | Low | Open |
| 6 | Missing validation on complete-profile | Low | Open |
| 7 | No error handling for Doctor sync failure | Low | Open |
| 8 | Unguarded admin endpoints | Critical | Fixed |
| 9 | JWT secret fallbacks | Critical | Fixed |
| 10 | ROLES grants every role every permission | High | Fixed (therapist scoped; back-office equal by decision) |
| 11 | checkPermissions middleware never wired | High | Fixed |
| 12 | Invalid-role fallback bug | Medium | Fixed |
| 13 | addDoctor error-message crash | Medium | Fixed |
| 14 | updateAppointment returns stale data | Low | Open |
| 15 | Doctor.gender typo `requied` | Low | Open |
| 16 | Therapist revenue-split save always fails | Medium | Fixed |
| 17 | Per-therapist leave lookup returns everyone's leaves | Medium | Fixed |
| 18 | Account menu didn't show name/email/role | Low | Fixed |
| 19 | Therapist edit is not ownership-scoped | Medium | Fixed |
| 20 | Production `customers.phone` has a unique index (second patient on a shared phone fails) | High | Open (owner's call to drop it) |
| 21 | Staff dashboard can't see the new customer fields | Medium | Partly fixed (gender, age) |
| 22 | Patient website OTP: 4-digit codes, no verify rate limit | High | Open (website) |
| 23 | "Unexpected response from the server" after sleep / Wi-Fi drop | Medium | Fixed |
| 24 | Website gender and age never reached the customer record | High | Fixed |
| 25 | Checkout raised a duplicate invoice instead of updating the booking's | High | Fixed (void INV-2026-0054 by hand) |
| 26 | Visit tab demanded the whole package price at the first session | High | Fixed (frontend only; pending merge) |
| 27 | Newly-assigned appointments didn't appear on an open therapist tab | Medium | Fixed (frontend only; 15s poll) |
| 28 | Called-but-unreached website leads never reached Follow-ups | High | Fixed |
| 29 | Therapist list hid today's visits on later pages | Medium | Fixed |
| 30 | Ticking "Reached out" turned a lead into a scheduled booking | High | Fixed (ENQ-0150 data reset 2026-10-28) |
| 31 | Appointments page listed bookings with no therapist | Medium | Fixed |
| 32 | Attended section buried a lead right after it was worked on | Medium | Fixed |
| 33 | Returning customer's details not carried onto a new booking | Medium | Fixed |
| 34 | Appointments stopped refreshing in a background tab | Low | Fixed |
| 35 | Earnings totals row sat one column to the left | Medium | Fixed |
| 36 | Earnings counts visits that haven't happened yet | High | Fixed |
