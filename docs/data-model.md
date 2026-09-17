# Data Model

The Mongoose models backing the dashboard (`C:\workspace\WellnessBackend\models\`), and
how the frontend's shared types in `src/type/schema.ts` line up with them. Written from
the actual model files as of 2026-09-17 - if you're cross-referencing an older doc or a
`scripts/*_BACKEND_PATCH.md` file in this repo, be aware several of those describe fields
as "pending" that are already live on the model.

For which endpoint reads/writes each field, see [api-reference.md](api-reference.md).

## Contents

- [User](#user)
- [Doctor (therapist)](#doctor-therapist)
- [AppointmentBooking - the enquiry/appointment funnel](#appointmentbooking--the-enquiryappointment-funnel)
- [Customer](#customer)
- [Service](#service)
- [Invoice](#invoice)
- [SessionRate](#sessionrate)
- [Specialization](#specialization)
- [ClinicSettings](#clinicsettings)
- [TherapistLeave](#therapistleave)

---

## User

Login accounts. One per person who can sign in - therapists have both a `User` (login)
and a `Doctor` (roster profile), linked by `Doctor.userId`.

| Field | Type | Notes |
|---|---|---|
| `userfName`, `userlName` | String, required | |
| `userEmail` | String, required, unique | Also used as the login identifier alongside phone. |
| `userPhone` | String, required, unique | |
| `userPassword` | String, required | Bcrypt-hashed in a `pre("save")` hook - never set it pre-hashed. |
| `gender` | enum `Male / Female / Other / ""` | default `""` |
| `dob` | Date | default `null` |
| `isProfileComplete` | Boolean | default `false` |
| `refreshToken` | String | default `null`. Cleared on logout, password change/reset, or role change - all of which force a fresh login. |
| `role` | enum `SUPER_ADMIN / ADMIN / THERAPIST / STAFF / CUSTOMER_CARE` | default `CUSTOMER_CARE`, stored uppercase |
| `customPermissions` | [String] | Currently redundant - every role already resolves to every permission (see [api-reference.md](api-reference.md#how-requests-are-made)), so this list has nothing to add on top. |
| `isActive` | Boolean | default `true`. Deactivating a therapist (rather than deleting) sets this to `false` to block login while keeping history intact. |
| `passwordResetOTP`, `passwordResetOTPExpires` | String / Date | Bcrypt-hashed OTP + 10-min expiry for the forgot-password flow. |

The five-role list is duplicated in four places with no shared source of truth: this
model's enum, `src/constant/index.ts` on the frontend, `lib/index.ts`'s `USER_ROLES` on
the backend, and a hardcoded array inside `adminRegisterUser`. If a role is ever renamed
or a new one added, all four need updating together.

---

## Doctor (therapist)

The therapist roster. Distinct from `User` - this is what shows up on the Therapists page
and drives scheduling.

| Field | Type | Notes |
|---|---|---|
| `doctorId` | String, required, unique | `THR-####`, allocated server-side. |
| `userId` | String | Links to the matching `User._id`, if the therapist has a login. |
| `name`, `firstName`, `lastName` | String | `firstName`/`lastName` default `""`. |
| `gender` | enum `male / female` | **Not actually enforced as required** - the schema option is misspelled `requied` instead of `required`, so Mongoose silently ignores it. Harmless today since the UI always sends a value, but worth fixing if this model is ever touched. |
| `email` | String, required | Not unique at the schema level - uniqueness is only checked in application code against both `Doctor` and `User`. |
| `phonenumber` | Number, required | |
| `specialization` | [String] | default `[]`. Free-text values matched against the `Specialization` list, not a hard foreign key. |
| `isActive` | Boolean | default `true` |
| `bio` | String | |
| `profileImage` | String | UploadThing URL |
| `certificates` | `[{label, url}]` | |
| `splitPercent` | Number, 0-100 | default `null`. Per-therapist override of the global `ClinicSettings.therapistSplitPercent` used for earnings math - `null` means "use the global rate." |
| `weekOffDays` | [Number], 0-6 | default `[]`. Recurring weekly days off (0=Sunday). This lives here, not on `TherapistLeave`, even though it's edited through the `/api/therapist-leaves/week-off/:doctorId` route. |

---

## AppointmentBooking - the enquiry/appointment funnel

The single largest and most central model. An enquiry, a booked appointment, and a
completed session are all the same document at different points in its life - there is no
separate `Enquiry` collection.

**`status`** is only five values: `enquiry / scheduled / ongoing / completed / cancelled`
(default `enquiry`). Everything else people think of as "funnel stages" is tracked as
separate fields layered on top of that status:

| Stage (informal) | Field(s) | Type |
|---|---|---|
| Enquiry logged | `status: "enquiry"` | - |
| Executive reached out | `executiveReachedOut`, `executiveReachedOutAt` | Boolean (default `false`), Date |
| Online consult booked | `consultationSlot: {date, time}` | subdocument |
| Consult completed | `consultationCompleted`, `consultationCompletedAt` | Boolean (default `false`), Date |
| Physio slot picked | `physioSlot: {date, time}`, `doctorId`, `doctor` | subdocument + String |
| Physio assignment confirmed | `physioAssignmentConfirmed`, `physioAssignmentConfirmedAt` | Boolean (default `false`), Date |
| Payment received | `paymentReceived`, `paymentAmount`, `paymentMethod`, `paymentReceivedAt` | Boolean, Number, enum `cash/upi/card/bank/other`, Date |
| In therapy | `status: "ongoing"` | set manually via `updateAppointment`, nothing derives it automatically |
| Therapist paid out | `therapistPaid`, `therapistPaidAt` | Boolean (default `false`), Date - this is the earnings page's payout toggle, stored directly on the booking rather than a separate ledger |
| Session complete | `status: "completed"`, `completedAt` | set by the `completeSession` controller once `sessionsCompleted >= total` |
| Cancelled | `status: "cancelled"` | an off-ramp from any stage |

Other fields worth knowing:

| Field | Type | Notes |
|---|---|---|
| `enquiryId` | String, unique | `ENQ-####`, allocated atomically on creation. |
| `customer_id` | String | Backfilled by `ensureCustomerForAppointment` once a matching/created `Customer` exists. |
| `payToken` | String, unique, sparse | The public `/pay/<token>` link's token. Minted once, reused - never regenerated. |
| `visitOtpHash`, `visitOtpExpiresAt`, `visitOtpVerified` | String, Date, Boolean | Gates `completeSession` - a visit can't be marked complete without this being verified first. |
| `addonOtpHash`, `addonOtpExpiresAt`, `addonOtpTarget` | String, Date, String | Same OTP pattern for confirming an add-on recommendation. `addonOtpTarget` pins the code to one specific `serviceId|recommendedAt` pair. |
| `appointmentKind` | enum `new / recommended` | default `"new"`. `"recommended"` is called out as legacy in the code comments on both the frontend schema and the backend model - new recommendation flows use `recommendedServices` instead (below). |
| `recommendedServices` | array of `{serviceId, serviceName, quotedPrice, status, paymentCollected, ...}` | Add-on services proposed mid-visit. Own `status` enum: `pending / confirmed`. |
| `discountAmount`, `discountType`, `discountCode`, `originalPrice`, `quotedPrice` | | `discountType` is `fixed` (default) or `percent`, capped at the original price / 100% respectively. |
| `sessionsCompleted`, `totalSessions`, `bookingKind`, `sessionIntervalDays`, `packageOriginId` | | Multi-session course tracking - `packageOriginId` links follow-up sessions back to the first one in the course. |
| `activityLog` | array | Append-only trail of who changed what and why (populated by `updateAppointment`'s override/reassign logic). |
| `statusNote` | String | Free-text reason attached to a status override. |

**A stale-doc warning worth repeating here too:** the frontend's `src/type/schema.ts`
still has comments like "persisted by the backend once it supports the field" next to
`paymentReceived` and `activityLog`. That's no longer true - the backend model already has
all of it. Those comments point at `scripts/ENQUIRY_BACKEND_PATCH.md` and
`scripts/FUNNEL_COMPLETION_BACKEND_PATCH.md`, both of which describe changes that have
since shipped.

---

## Customer

Holds a stable customer identity and freeform notes. The Customers *page* mostly derives
its rows from `AppointmentBooking` directly (see [api-reference.md](api-reference.md#customers))
- this model backs the parts that need to persist independently of any one booking.

| Field | Type | Notes |
|---|---|---|
| `customer_id` | String, unique, sparse | `CUST-####` |
| `name` | String, required, trimmed | |
| `phone` | Number, required, indexed | **Not unique** - deliberately. One phone number (a shared household line) can belong to more than one patient; identity is phone+name together, not phone alone. |
| `email`, `address` | String | default `""` |
| `notes` | array of `{at, by, userId, note}` | No `_id` per note - edits are matched by the `(at, by)` pair, so two notes from the same person at the exact same timestamp string could collide. Not a practical risk today, but a real gap if notes are ever written programmatically in bulk. |

---

## Service

The service catalogue.

| Field | Type | Notes |
|---|---|---|
| `serviceId` | String, unique, sparse | `SRV-####` |
| `name` | String, required, trimmed | |
| `description` | String | |
| `originalPrice`, `discountedPrice` | Number, min 0 | Current pricing fields. |
| `hsnCode` | String | Required by the frontend Zod schema, **not** required at the Mongoose level - a service created outside the normal UI flow could end up without one. |
| `isPackage`, `packageUnit`, `packageCount` | Boolean, enum `sessions/weeks/months`, Number | Defines multi-session packages. |
| `price`, `recommendedPrice`, `category` | Number, Number, String | **Deprecated**, kept only until the T31 pricing migration fully lands. Don't wire new features to these. |

---

## Invoice

| Field | Type | Notes |
|---|---|---|
| `invoice_id` | String, unique, sparse | `INV-YYYY-####`, sequence resets yearly. |
| `appointment_id` | ObjectId ref `AppointmentBooking`, unique, sparse | At most one invoice per appointment. |
| `enquiry_id`, `customer_id`, `customer_name`, `customer_phone` | String/Number | `customer_phone` is a Number, matching the `Customer.phone` type. |
| `invoice_type` | enum | `package_purchase / therapy_session / therapy_addon_standalone / online_consultation / vitals_subscription` (`vitals_subscription` is reserved - not offered in the UI yet). |
| `package_type`, `package_ref`, `package_name`, `session_number` | | Optional package context. |
| `therapist_name`, `therapist_id`, `address` | String | `address` is a home-visit location snapshot at time of billing. |
| `line_items` | `[{description, price}]` | |
| `locked_addon_items` | `[{serviceId, recommendedAt, description, price, paymentCollected}]` | A **permanent** snapshot of confirmed add-ons, kept separate from the appointment's own (mutable) `recommendedServices` so a later edit to the booking can't retroactively change what was already billed. |
| `items_subtotal`, `advance_paid`, `balance_due`, `total` | Number | Recomputed from `line_items` on every edit - `advance_paid` is the one money field not editable through the update endpoint. |
| `payment_status` | enum `paid / pending`, required | Once `"paid"`, later auto-syncs from the appointment only touch non-money fields. |
| `pdf_url` | String | Cleared to `null` on any edit, forcing regeneration next time it's requested. |
| `voided`, `voided_at`, `voided_by`, `void_reason` | | Soft-delete - voided invoices are never hard-deleted. |
| `created_by`, `last_edited_by`, `last_edited_at` | String/Date | |

---

## SessionRate

Singleton pricing table (`key: "global"`), used to price a course by session count.

| Field | Type |
|---|---|
| `key` | String, default `"global"`, unique |
| `tiers` | `[{from: Number, to: Number\|null, rate: Number}]` |

`to: null` means open-ended. A course of N sessions is priced by whichever tier's range
contains N.

---

## Specialization

Simple lookup list feeding the therapist specialization multi-select.

| Field | Type |
|---|---|
| `value` | String, required, unique, lowercase, trimmed |
| `label` | String, required, trimmed |

Deleting one (via the backend route - there's no UI button for it) doesn't check whether
any therapist still references it. It just becomes a dangling string on that therapist's
`specialization` array.

---

## ClinicSettings

Singleton (`key: "global"`), same pattern as `SessionRate`.

| Field | Type | Default |
|---|---|---|
| `key` | String, unique | `"global"` |
| `bookingGapMinutes` | Number, min 0 | `60` |
| `therapistSplitPercent` | Number, 0-100 | `60` |

Both fields exist and have sane defaults, but only `bookingGapMinutes` can currently be
written through the update endpoint - see the note in
[api-reference.md](api-reference.md#clinic-settings).

---

## TherapistLeave

Date-range absences. Note this is a *different* concept from `Doctor.weekOffDays` (a
recurring weekly pattern) even though both are edited through routes under
`/api/therapist-leaves`.

| Field | Type | Notes |
|---|---|---|
| `doctorId` | String, required, indexed | |
| `startDate`, `endDate` | String (`YYYY-MM-DD`), required | `endDate` defaults to `startDate` for a single-day leave. |
| `reason` | String | default `""` |

Compound index on `{doctorId, startDate, endDate}` for range queries. Fetching a single
therapist's leaves by path param (`GET /:doctorId`) currently returns everyone's leaves
due to a controller bug - see [api-reference.md](api-reference.md#therapist-leaves--week-off).
