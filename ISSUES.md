# Known Issues & Bugs

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
**Status:** Open  
**Affected Pages:** Settings (`/dashboard/settings`)

#### Description
When a super admin edits a therapist's info via the Settings page "Admin Members" table, it calls `PATCH /api/users/admin/update-user`. This endpoint only updates the `User` model, NOT the linked `Doctor` model.

#### Steps to Reproduce
1. Login as SUPER_ADMIN
2. Go to `/dashboard/settings`
3. In "Admin Members" table, find a therapist (role: THERAPIST)
4. Click "Edit user" and change their name/email/phone
5. Save changes
6. Go to `/dashboard/alltherapist`
7. Observe: The therapist's info is still the OLD values

#### Root Cause
The `adminEditUserProfile` endpoint only updates the `User` model:

```typescript
// Backend: userController.ts - adminEditUserProfile
if (userfName !== undefined) user.userfName = userfName;
if (userlName !== undefined) user.userlName = userlName;
if (userEmail !== undefined) user.userEmail = userEmail;
if (userPhone !== undefined) user.userPhone = userPhone;
if (role !== undefined) user.role = role;
await user.save();
// ^^^ Only saves User, NOT Doctor
```

#### Expected Behavior
When an admin updates a therapist's info, the changes should propagate to both `User` and `Doctor` models.

#### Suggested Fix
After saving the User, check if the user has role `THERAPIST` and update the linked Doctor:

```typescript
await user.save();

// If this is a therapist, sync to Doctor model
if (user.role === "THERAPIST") {
    await Doctor.findOneAndUpdate(
        { userId: user._id.toString() },
        { 
            name: `${user.userfName} ${user.userlName}`.trim(),
            email: user.userEmail,
            phonenumber: user.userPhone,
        }
    );
}
```

#### Affected Code
- **Backend:** `C:\workspace\WellnessBackend\controllers\userController.ts` - `adminEditUserProfile` function (line 292-386)

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
**Status:** Open  
**Affected Routes:** `DELETE /api/users/admin/delete-user`, `POST /api/users/admin/register-user`

#### Description
Both endpoints require only `userAuth` — any authenticated user can call them regardless of role. A logged-in `THERAPIST` could delete a `SUPER_ADMIN` or create a new `SUPER_ADMIN` account.

#### Suggested Fix
Wire `requireRole("SUPER_ADMIN", "ADMIN")` middleware on these routes.

---

### 9. JWT Secret Fallbacks

**Severity:** Critical  
**Status:** Open  
**Affected Code:** `controllers/userController.ts` lines 10, 17

#### Description
If `JWT_SECRET` / `JWT_REFRESH_SECRET` are missing in production, the code silently signs tokens with `"vivo123"` / `"vivo123refresh"`. Anyone who knows these defaults can forge valid JWTs for any user ID.

```typescript
jwt.sign({ id: userId }, process.env.JWT_SECRET || "vivo123", ...)
jwt.sign({ id: userId }, process.env.JWT_REFRESH_SECRET || "vivo123refresh", ...)
```

#### Suggested Fix
Crash on startup if these env vars are unset. Remove the fallback strings.

---

### 10. ROLES Grants Every Role Every Permission

**Severity:** High  
**Status:** Open  
**Affected Code:** `lib/index.ts` lines 23-29

#### Description
Every role gets every permission. Even if `checkPermissions` middleware is wired, it won't differentiate between roles.

```typescript
export const ROLES = {
  SUPER_ADMIN: Object.values(PERMISSIONS),
  ADMIN: Object.values(PERMISSIONS),
  THERAPIST: Object.values(PERMISSIONS),
  STAFF: Object.values(PERMISSIONS),
  CUSTOMER_CARE: Object.values(PERMISSIONS),
};
```

#### Suggested Fix
Define real per-role permission grants.

---

### 11. checkPermissions Middleware Is Never Wired

**Severity:** High  
**Status:** Open  
**Affected Code:** `middlewares/checkPermissions.ts`

#### Description
The middleware is fully implemented but no route uses it. Every router file mounts only `userAuth`. This means any authenticated user can access any endpoint regardless of their role.

---

### 12. Invalid-Role Fallback Bug in adminRegisterUser

**Severity:** Medium  
**Status:** Open  
**Affected Code:** `controllers/userController.ts` lines 164-167

#### Description
If the caller passes an invalid role, the code falls back to `"CUSTOMER"`. But the User schema's role enum doesn't include `"CUSTOMER"` — the `save()` will throw a Mongoose validation error returned as a generic 500.

---

### 13. addDoctor Error-Message String Can Crash

**Severity:** Medium  
**Status:** Open  
**Affected Code:** `controllers/DoctorController.ts` line 26

#### Description
The code calls `.filter()` on `req.body` (an object, not an array), which throws `TypeError` and returns a generic 500 instead of "missing fields".

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

## Summary

| # | Issue | Severity | Status |
|---|-------|----------|--------|
| 1 | Therapist self-update doesn't sync to Doctor | High | Open |
| 2 | Admin edit user doesn't sync to Doctor | Medium | Open |
| 3 | User table filter column ID mismatch | Low | Open |
| 4 | Optimistic update key mismatch | Low | Open |
| 5 | Gender enum mismatch between models | Low | Open |
| 6 | Missing validation on complete-profile | Low | Open |
| 7 | No error handling for Doctor sync failure | Low | Open |
| 8 | Unguarded admin endpoints | Critical | Open |
| 9 | JWT secret fallbacks | Critical | Open |
| 10 | ROLES grants every role every permission | High | Open |
| 11 | checkPermissions middleware never wired | High | Open |
| 12 | Invalid-role fallback bug | Medium | Open |
| 13 | addDoctor error-message crash | Medium | Open |
| 14 | updateAppointment returns stale data | Low | Open |
| 15 | Doctor.gender typo `requied` | Low | Open |
