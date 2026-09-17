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

The guide currently tells the owner that the **therapist revenue-split save is broken** and to use per-therapist overrides instead. That's true of what's live right now, and stops being true the second the #16 fix deploys. Two spots to edit, both say the same thing.

This is the exact failure mode the 2026-09-17 documentation pass was cleaning up (entries sitting at "Open" long after the code was fixed), so it's worth doing in the same sitting as the deploy rather than "later".

---

### BD-3. Decide on #19 before trusting the new permission wiring

**Importance:** Worth a decision, not strictly a blocker.  
**Applies to:** [#19](#19-therapist-edit-is-not-ownership-scoped), pre-existing

#10/#11 wired real role enforcement, which makes it tempting to assume therapist-facing routes are now locked down. `PUT /api/therapist/:id` is the exception: therapists legitimately need it for their own "My Profile", but the controller never checks the `:id` is theirs, so a therapist could edit another therapist's record.

This is pre-existing and not made worse by deploying, so it doesn't block. Just decide consciously whether it ships as-is rather than discovering the gap later and assuming the permission work covered it.

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
**Status:** Open (found 2026-09-18 while wiring #11)  
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
| 19 | Therapist edit is not ownership-scoped | Medium | Open |
