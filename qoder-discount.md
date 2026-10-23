# Discount / Offer System — Design & Execution Plan

> Author: Qoder · Status: **In progress — backend Phases 0–3.0 shipped & tested; frontend data layer + Offers admin (Phase 4) + Billing apply-box (Phase 5) shipped** · Repo: `WellnessFrontend` (dashboard) + sibling `wellness-backend` (Render)
>
> This document captures my full reasoning about the discount/coupon feature: how I judged the earlier Claude Code plan, what I changed and why, the open money-decisions that must be locked before building, the data model, the API contract, the UI, validation, edge cases, testing, and a phased execution order.

---

## Feature State (live tracker — update this every session)

| Section | Status |
|---|---|
| **Current Feature** | Discount / Offer system — a single `Offer` entity (merged "coupon" + "discount"), server-authoritative, role-gated, fully audited. Plan of record: this file. |
| **Status** | **Backend done (Phases 0–3.0 + 1–2) + frontend data layer, Offers admin (Phase 4), Billing apply-box + New-booking apply-box (Phase 5).** Phase 0 decisions locked, frontend rules layer (3.0) green, **backend `offerModel` + CRUD + `apply-offer`/`remove-offer` green (396/396, tsc clean)**, **frontend `src/actions/offer/*` + `src/data/offer/offer.ts` hooks + Super-Admin Offers card (Phase 4)**, **`offer-apply-box.tsx` on the Billing tab + offer picker & invoice preview in `appointmentbookingform.tsx` (apply-after-create) — Phase 5, tsc+lint clean**. Remaining: enquiry step 4 picker, Phase 6 earnings `absorbedBy`, Phase 7 rename. |
| **Last Completed** | **2026-10-22 by Qoder (this session): Killed the double-represented discount in the invoice + billing (reviewer flag).** The new-booking Invoice and the Billing tab both showed the same saving twice (struck `₹1,600 → ₹1,280` on the line AND a `Subtotal / Discount / Total` ladder) which read like the discount applied twice. Simplified both to the checkout pattern: **priced line at full price → one named `Diwali20 discount −₹320` row → `Total ₹1,280`** (no struck price, no strike on Total). `Subtotal` row now only appears when there are 2+ priced lines (else it just repeats the single line). Dropped the per-line struck price + inline `Save ₹X` from `billing-tab.tsx` (ladder carries it). Renamed Payment wording admin-friendly: `Amount received` → **`Amount collected now`**, helper `Total` → **`Collectable total … balance after this`**, invoice rows `Paid now`/`Due` → **`Collected now`/`Balance due`**. Verified live (Diwali20 → Home visit ₹1,600 · Diwali20 discount −₹320 · Total ₹1,280, clean tabular alignment). **Follow-up tweak (same session):** the **Total** line now shows the struck original over the net (`~~₹1,600~~ ₹1,280`) so the payable price is unmistakable, and the offer picker gained a **`No offer (pay full price)`** option (also the default placeholder) so staff can clear an applied discount from the dropdown. FE `tsc --noEmit` + eslint clean. **Committed locally (NOT pushed).** _(Prior: unified money font via shared `<Money>`.)_ |
| **In Progress** | Nothing mid-edit. Offers CRUD + Billing-tab apply-box + New-booking picker are wired end-to-end (UI→action→API→model). The new-booking picker uses **apply-after-create** (create → `apply-offer` on the returned `_id`); a rejected apply (once-per-phone/expired) leaves the booking saved at full price to fix on its Billing tab. |
| **Next Up** | 1) Enquiry step-4 offer picker (`enquiry-detail-drawer.tsx`) — same apply-after-create pattern on the enquiry's `_id`. 2) Phase 6 earnings `absorbedBy` split. 3) Phase 7 rename `promoCode→discountCode`. |
| **Key Decisions** | Server does the math (browser sends code/name only, never a price). **One `Offer` entity**, no separate coupon. **Per-line** offers, one-per-line (applying a 2nd replaces). Base = `originalPrice ?? quotedPrice`; % capped by `maxOff` + hard 100% cap; line floors at 0. After-payment → **store credit**. Absorb: **company** eats marketing, therapist eats `recommended_discount` (`absorbedBy` backend-only day 1). `kind: "fixed"|"percent"`. Standardize **`discountCode`** (retire `promoCode`). `usedCount` bumped atomically. |
| **Files Touched Recently** | **Adjacent (this session, not discount-core):** `visit-tab.tsx` + `record-payment-form.tsx` + new `payment-qr-dialog.tsx` — therapist Visit-tab "collect before session" box now has a **Show payment QR** button that opens an **inline Uber-style QR popup** (`PaymentQrDialog`: payee + amount baked in via `qrcode` + `upiLink`, no page navigation), and the UPI method reads **"UPI (to company)"** so it's unambiguous money settles to the company, not the therapist. **Frontend this step:** `src/components/pages/appointment/appointmentbookingform.tsx` (invoice de-duped to line→named-discount→total, struck total, "No offer" deselect, Payment wording) + `billing-tab.tsx` (dropped per-line struck/Save, Subtotal gated to multi-line). **Frontend (prior step):** `src/components/money.tsx` (new shared `<Money>`), money font unified across billing + invoice. **Frontend (prior step):** `appointmentbookingform.tsx` offer picker + apply-after-create on both save paths. **Frontend (prior step):** `src/type/schema.ts` (+`appliedOffers[]`), `src/components/pages/appointment/offer-apply-box.tsx` (new), `src/components/pages/appointment/billing-tab.tsx` (mount). **Frontend (Phase 4):** `src/type/schema.ts` (+`offerId`), `src/actions/offer/{get-all,add,update,delete,apply,remove}-offer.ts`, `src/data/offer/offer.ts`, `src/components/pages/services/offers-card.tsx`, `src/components/pages/services/ServicesPage.tsx`. **Backend:** `controllers/bookingOfferController.ts`, `lib/offers.ts`, `lib/offers.test.ts`, `models/offerModel.ts`, `controllers/offerController.ts`, `routes/offerRoutes.ts`, `models/appointmentsBookingModel.ts`, `server.ts`. **Blast radius (next):** `enquiry-detail-drawer.tsx`, `src/lib/earnings.ts`. |
| **Known Issues / Tech Debt** | • Backend `apply-offer`/`remove-offer` DB paths have **no automated test** (repo lacks in-memory Mongo) — only `lib/offers.ts` is unit-covered; verify end-to-end against a real DB before UI merge. • `wellness-backend` is **outside this workspace** — files edited via a staging folder + copy (Write/SearchReplace are workspace-bound). • `earnings.ts` splits on **already-discounted** revenue — payout bug until `absorbedBy` wired (Phase 6). • `promoCode`/`discountCode` drift not yet renamed. • throwaway `billing-preview`/`source-preview` pages still on frontend branch — **delete before merge**. • pre-existing `tsc` errors in `customerController`/`DoctorController`/`userController`/`scripts` are unrelated and left untouched. |

---

## 0. TL;DR

- Keep the earlier plan's core stance: **server does the math, staff never type a raw price, every discount is auditable.**
- **Merge "Coupon" and "Discount" into a single `Offer` concept.** A coupon only earns a separate existence if a *customer* can redeem a code somewhere outside our staff — and right now there is no such surface. Two near-identical entities = duplicated CRUD, duplicated validation, duplicated bugs.
- **Two blocking money questions must be answered before any build:**
  1. What happens when an offer is applied **after** the customer already paid (overpayment / credit / refund)?
  2. On a discounted booking, **who absorbs the discount — therapist or company?** (It changes the earnings split directly.)
- Build **backend-authoritative first** (Offer model + a dedicated `apply-offer` action), then the Services "Offers" admin UI, then the apply-box in the 3 money-taking screens.
- Keep an escape hatch: **"Custom" offer, Super Admin only, note mandatory.**

### 0.5 Repo split (execution reality — matters for what ships when)
The backend (`wellness-backend`) is a **separate repo, not in this workspace** (only `WellnessFrontend` + `customer-app-docs` are here), and it deploys from `main` → Render. Phases 1–2 (the `Offer` model + `apply-offer`/`remove-offer` endpoints + atomic usage bump + audit) **must be authored in that repo**, not here.
What I *can* build and functionally test inside `WellnessFrontend` right now is the **shared rules layer the backend will mirror**:
- `src/type/schema.ts` → `offerZodSchema` + `Offer` type (the contract).
- `src/lib/offers.ts` → pure `computeOfferOff()` + `offerIsApplicable()` / `applicableOffers()` — the same math and eligibility the server enforces, used for optimistic UI and the role-filtered apply-dropdown.
- `src/lib/offers.test.ts` → Vitest, run locally. No backend needed to prove the rules.
The backend then imports the identical rules (this file §4.4 is the source of truth) and re-checks everything server-side — the frontend mirror is never trusted for money.

**Naming standard locked:** use the model's existing `kind: "fixed" | "percent"` (not `flat`), and **`discountCode`** everywhere (retire `promoCode`).

---

## 1. Context: what already exists (verified in code)

These facts shape the whole design, so I checked them rather than assumed.

| Fact | Where | Why it matters |
|---|---|---|
| Booking already carries `originalPrice`, `discountAmount`, `discountType` (`fixed\|percent`), `discountCode` | `src/type/schema.ts` (~L119–122), backend `appointmentsBookingModel.ts` (~L371–390) | We do **not** need new columns for the *applied* discount — only for the *catalog* of offers. |
| Discount math + validation exists in the booking form (percent ≤ 100, fixed ≤ original) | `appointmentbookingform.tsx` (~L246–262) | There is a working, tested cascade to reuse: `originalPrice ?? quotedPrice`. |
| `bookingLedger()` builds "sold on this booking" lines with `Save ₹X` and strikethrough | `src/lib/booking-money.ts` + its test | The billing UI already knows how to render an original-vs-final ladder. Offers plug into this, not a new renderer. |
| Earnings split computed from `revenue = paymentAmount ?? quotedPrice` | `src/lib/earnings.ts` (`buildEarningRows`), `splitRevenue(...)` | **This is the blast radius of the therapist-vs-company discount question.** A discount that lowers `revenue` silently lowers the therapist's cut. |
| Backend **strips** `discountAmount / discountType / promoCode / originalPrice` on generic create/update (mass-assignment guard) | `createAppointment` / `updateAppointment` (backend) | The generic save path will **refuse** to persist a discount. Offers must go through a **dedicated action**, which is exactly the safe design. |
| Therapist-recommended add-ons already apply a **`discountedPrice`** per service (T31) | `src/lib/service-pricing.ts` (`addonPrice`), `serviceModel.ts` | A discount channel **already exists** and bypasses any new offer system — so "every rupee is traceable" is only true if we decide how recommended add-ons relate to offers. |
| Field-name drift: `promoCode` (backend guard) vs `discountCode` (schema/model) | both | Standardize on **`discountCode`** before building or you get silent mismatches. |

**Takeaway:** the model is 80% ready to *store* an applied discount. The genuinely new work is (a) the offer *catalog*, (b) an *authoritative apply/remove action*, and (c) the policy decisions below.

---

## 2. Judging the earlier plan (what I agreed with, what I rejected)

### 2.1 I agree with
- **Server-side computation, code/name in → amount out.** Correct and non-negotiable.
- **Full audit trail**, apply *and* remove.
- **Role-gating + on/off switch + once-per-phone.**
- **Reusing existing fields** instead of a heavy migration.

### 2.2 I reject or reshape — and why

**A. "Coupon" and "Discount" are one thing here.**
A coupon's *only* unique value is external redemption: a customer pastes `DIWALI200` at a checkout you don't control. Our reality: enquiries and bookings are entered **by staff**, and there is no public checkout that takes a customer-typed code. Strip that away and a "coupon" is just *a named offer with an optional usage cap and expiry* — identical to the "Discount" list. Maintaining two entities means two forms, two tables, two permission surfaces, two bug surfaces, for no real behavioral difference.
→ **Decision: one entity, `Offer`, with optional fields (`code`, `validFrom/validUntil`, `totalUses`, `oncePerPhone`).** If a real customer-facing code entry ever ships (public booking form / WhatsApp flow), those same fields already support it — no rewrite.

**B. "One offer per booking" is already false and will chafe.**
Therapist-recommended add-ons *already* discount a line. And senior-citizen + festive-welcome stacking is a normal ask. If we hard-cap at one and forbid stacking, we either lie in the docs or rewrite in a month.
→ **Decision: model offers as *per-line*, not *per-booking*.** Each priced line (main service, each add-on) can carry at most one offer; the booking total is the sum. This subsumes the recommended-add-on case and lets "stacking" happen naturally across lines without a special stacking engine. Cross-line stacking of two offers on the *same* line stays disallowed (simple, safe rule).

**C. Percent base was undefined → double-discount risk.**
"%off of what?" matters when `quotedPrice` is already reduced. 
→ **Decision: offers apply to the line's *list price* (`originalPrice ?? quotedPrice`), and the final `quotedPrice` is recomputed by the server from that base.** Never chain a % off an already-%-off number.

**D. "total can't go below what's already paid" is necessary but not sufficient.**
It forbids negative balances but says nothing about the very real "apply discount after full payment" → now the customer is **in credit**. 
→ **Decision deferred to §3.1 — this is a blocking choice, not a code detail.**

**E. Concurrency on `totalUses`.**
Read-check-write will oversell the last redemption under two simultaneous applies.
→ **Decision: server-side atomic increment with a conditional update (`findOneAndUpdate { usedCount: { $lt: totalUses } }`).**

### 2.3 Scope guard
This is a handful of staff at one wellness business. I am deliberately **not** building a marketing platform (no A/B, no campaign analytics, no auto-targeting). Everything below is the minimum that satisfies: *traceable, tamper-proof, role-limited discounts.*

---

## 3. Blocking decisions (✅ LOCKED 2026-10-22 — recommendations adopted as defaults)

> Per the review, these were the real gates. The user said "continue / move forward", so the **Recommended** option in each is now the adopted default. Override any line to change behavior; Phase 2+ is unblocked against these. They remain the only things to re-open if the client's policy differs.

The earlier session surfaced these but never actually answered them (the AskUserQuestion came back "user did not answer — sent a message instead").

### 3.1 Discount applied AFTER money was already paid
Options:
- **(Rec) A — Never let it change history silently; convert the difference to store credit.** Applying an offer that makes `paid > newTotal` creates a `credit` on the customer record; staff can refund manually or carry it to the next visit. Recorded as its own audit line.
- B — Refund the difference immediately (needs a refund rail / payment gateway capability).
- C — Forbid applying offers after any payment (simplest, but too rigid for complaint-favours).
> **Recommendation: A.** Small business, cash/UTR reality, no automatic refund rail wired up. Credit is honest and reversible.

### 3.2 Therapist vs Company: whose cut shrinks on a discount? (MOST IMPORTANT)
Today `earnings.ts` splits `revenue` (which would be the *discounted* number) → so **the therapist already eats the discount by default.** That may or may not be intended.
Options:
- **(Rec) A — Company absorbs marketing/loyalty/complaint discounts; therapist absorbed only service-level recommended discounts.** Rationale: the therapist didn't cause a "Senior citizen 10%" — the business chose to win/keep the customer. But the therapist *did* recommend the add-on, so that discount rides with them. This requires the split to be computed on the **pre-offer line price**, with the offer amount posted to a company "discount expense" so books balance.
- B — Therapist always absorbs (simplest, matches current code, but demotivates staff whose company runs promos).
- C — Configurable per offer (`absorbedBy: therapist|company`), default company.
> **Recommendation: A now, structured so it can become C** (add `absorbedBy` field with default `company`; you don't have to expose it in UI on day one). **This must be confirmed** — it changes payouts.

### 3.3 Can one line have both an offer and a "Custom"?
> **Recommendation: no** — one offer per line; a Custom *is* an offer. Simpler and fully traceable.

### 3.4 Who can apply, and ceilings?
> **Recommendation:** Staff → offers whose `minRole ≤ staff`; Admin → up to admin; **Custom** → Super Admin only + note. Ceilings live on the offer row (`maxOff`, `minRole`), not hard-coded.

---

## 4. The design (locked, pending §3 confirmations)

### 4.1 Concept
An **Offer** = a reusable, server-known discount rule. Staff/admin pick one by name (or type a code if the offer defines one); the **server** computes the ₹ amount and applies it to a **single priced line**. Nothing in this flow lets a browser send a final price.

### 4.2 Offer shape (catalog) — NEW persisted collection
Backend: `models/offerModel.ts`

```ts
{
  _id,
  name:        String,                 // "Senior citizen (60+)", "DIWALI200"
  code:        { type: String, unique, sparse }, // optional; enables typing-a-code
  kind:        'fixed' | 'percent',    // matches existing model (NOT 'flat')
  amount:      Number,                 // ₹ for fixed, % for percent
  maxOff:      { type: Number, default: null }, // cap; required for percent
  appliesTo:   'all' | 'services' | 'courses' | 'add_ons',
  serviceIds:  [ObjectId],             // when appliesTo='services'
  minRole:     'STAFF' | 'ADMIN' | 'SUPER_ADMIN',
  absorbedBy:  'company' | 'therapist', // default 'company' — BACKEND-ONLY day 1 (see §3.2 + review note below)
  validFrom:   Date | null,
  validUntil:  Date | null,
  totalUses:   Number | null,          // null = unlimited
  usedCount:   { type: Number, default: 0 },
  oncePerPhone:{ type: Boolean, default: true },
  noteRequired:{ type: Boolean, default: false }, // true for complaint/custom
  active:      { type: Boolean, default: true },   // the on/off switch
  createdBy:   { name, at },
}
```

Frontend mirror types in `src/type/schema.ts` (`offerZodSchema`).

> **Review refinement (absorbedBy):** the field exists on the schema and defaults to `'company'` server-side, but it is **not** surfaced in the "New offer" form or exposed to staff until there's a real reason to vary it per offer. Baking the column in now = free future flexibility; exposing it now = scope creep.

### 4.3 Applied-discount record (per line) — reuses existing booking fields
On an appointment line we keep the existing `originalPrice` / `discountAmount` / `discountType` / `discountCode`, plus an audit sub-doc so removal is traceable:

```ts
// add to appointmentsBookingModel
discountAudit: [{
  offerId, offerName, kind, amount, appliedPctOrFlat,
  offValue,               // ₹ taken off (server-computed)
  appliedBy: { name, role },
  appliedAt, removedAt, reason, lineKey
}]
```

> **Review refinement (defer):** `discountAudit` is correct long-term but should **not** block Phase 1. Day-one traceability is already met by the flat fields (`originalPrice`/`discountAmount`/`discountType`/`discountCode`) plus the existing append-only `activityLog` on the booking. Land the sub-doc in **Phase 2/3**, once the happy path + the §3.1 credit path work and you've confirmed what you actually need to record.

### 4.4 Rules (server-enforced)
1. **One offer per line.** Applying a second on the same line replaces the first (both audited).
2. Base = line `originalPrice ?? quotedPrice`; `%` applies to base, capped at `maxOff`; `flat` capped at base. Final `quotedPrice = base - offValue` (server writes it; client never sends it).
3. Never let a line total go below what's already **paid on that line** — except §3.1 credit path (post-payment application → credit, not negative).
4. Offer must be `active`, within `validFrom/validUntil`, `usedCount < totalUses` (atomic), and phone-not-already-used if `oncePerPhone`.
5. Caller role ≥ `minRole`. `Custom` ⇒ `minRole='superadmin'` ∧ `noteRequired=true`.
6. `absorbedBy` decides whether the therapist split base is pre- or post-offer (§3.2).

### 4.5 Endpoints (backend)
```
GET    /api/offers                # list (role-filtered: staff see only applicable+active)
POST   /api/offers                # superadmin
PATCH  /api/offers/:id            # superadmin (incl. active toggle)
DELETE /api/offers/:id            # superadmin (soft)
POST   /api/appointments/:id/apply-offer   # { lineKey, offerId | custom:{kind,amount,reason} }
POST   /api/appointments/:id/remove-offer  # { lineKey }
```
`apply-offer` is where all validation + atomic usage bump + audit + recompute lives. The **generic `updateAppointment` keeps stripping discount fields** — this is correct; offers can *only* move through `apply-offer`/`remove-offer`, so the mass-assignment guard becomes a feature, not a bug.

---

## 5. UI plan

### 5.1 Admin: Services page → "Offers" section
- New card alongside the existing Session-rates card.
- **Single list** (no Coupon/Discount tabs — merged per §2.2A). Columns: name · kind/amount · cap · applies-to · min-role · window · uses (n/total) · **on/off switch**.
- Super Admin: `+ New offer` (fields from §4.2). Admin/Staff: **read-only** so they can see what exists.
- Therapist: no Services page (unchanged).

### 5.2 Applying: "Apply offer" box in the 3 money screens
Reuse the same small component in:
1. `appointmentbookingform.tsx` (booking)
2. `enquiry-detail-drawer.tsx` (step 4 payment)
3. `billing-tab.tsx` (post-booking)

Behavior:
- Dropdown of offers the **current user's role is allowed**, scoped to the line being priced (main vs which add-on).
- Selecting sends `{ lineKey, offerId }` to `apply-offer`; the returned server-computed amount updates the `bookingLedger` line (strikethrough + `Save ₹X` already supported).
- `Remove` button → `remove-offer`.
- The **price box stays read-only everywhere** (preserve the tamper fix).
- Recommended add-ons (§1) show their `discountedPrice` as a normal line; if you want them to count as an "offer" for reporting, tag them with a system offer `recommended_discount` (absorbedBy = therapist) so §3.2 accounting stays consistent.

### 5.3 Earnings
Update `buildEarningRows`/`splitRevenue` so the therapist split base honors `absorbedBy` (§3.2). Surface a `discount expense (company)` line so the two sides of the ledger reconcile.

---

## 6. Edge cases (must handle in code + tests)

- **Apply after full payment** → credit per §3.1.
- **Percent with no `maxOff`** → reject at offer-create (100% is a giveaway).
- **Flat > base** → clamp to base; total floors at paid (or credit).
- **`totalUses` race** → atomic `findOneAndUpdate({ usedCount: { $lt: totalUses } })`; on no-match → "offer fully used".
- **oncePerPhone across two bookings for same number** → query prior uses by phone. **Review refinement: at this scale (a few hundred bookings), a plain query/filter scan is fine — do NOT add a `discountCode+phone` compound index now.** Keep it as a documented assumption so nobody over-engineers it.
- **Expired / toggled-off mid-session** → apply-time re-check server-side; UI list is best-effort, server is truth.
- **Role downgrade** → minRole checked on apply, not on UI render.
- **Recommended add-on + offer on same line** → one-per-line rule → replace, audited.
- **Custom without note** → reject.
- **Field drift** → single source of truth `discountCode` (rename `promoCode`).
- **Partial-payment lines** → the plan's "per-line paid" idea is **out of scope for this feature (review refinement).** `booking-money.ts` already tracks per-line paid for **add-ons** (`paidAmount`/`paymentCollected`), but the **main booking line** only has a booking-level `paymentAmount`. Splitting paid across the main line is a *payment-allocation* concern that doesn't exist yet. Handle the "can't discount below what's paid" invariant at the **booking total** level for now; revisit per-line paid at the payment layer when it's actually needed.

---

## 7. Testing strategy

- **Unit (frontend `vitest`, already used):**
  - `service-pricing` / `booking-money`: offer applied to base, `maxOff` clamp, percent vs flat, one-per-line replace.
  - role filtering of the applicable-offers selector.
- **Unit (backend):**
  - `apply-offer`: validation matrix (active/expired/cap/role/phone/usage/custom-note), atomic usage bump, credit path, audit entries for apply + remove.
  - `updateAppointment` still strips discount fields (guard is intact).
  - `buildEarningRows` honors `absorbedBy` (therapist vs company).
- **Integration:** create offer → apply in booking → verify recomputed total, ledger strikethrough, audit row, earnings split.
- **Manual click-through:** the earlier session admitted "tests pass, not clicked." For money features this is mandatory before merge — I will not mark a phase done without a real screen pass.

---

## 8. Phased execution order

> Each phase is independently shippable and testable. **Phase 0 is done (see §3 / §11). Phases 1–2 live in the `wellness-backend` repo (not this workspace); Phases 3–7 live here in `WellnessFrontend`.**

- **Phase 0 — Lock decisions (§3).** ✅ **Done 2026-10-22** — recommendations adopted; see §11.
- **Phase 3.0 — Frontend rules mirror (`WellnessFrontend`).** ← **start here, it's unblocked.** `offerZodSchema` + `src/lib/offers.ts` (`computeOfferOff`/`offerIsApplicable`/`applicableOffers`) + `offers.test.ts`, Vitest green. This is the shared source of truth the backend re-implements and the UI consumes; it needs no backend to test.
- **Phase 1 — Backend Offer model + CRUD** (`wellness-backend`: `offerModel`, controller, routes, role guards, `active`/usage/expiry). Unit tests.
- **Phase 2 — Backend `apply-offer` / `remove-offer`** (validation, atomic bump, server recompute, audit[deferred per §4.3], credit path, `absorbedBy`). Unit + integration tests. Confirm mass-assignment guard unchanged.
- **Phase 3 — Frontend types + `bookingLedger`/`service-pricing`** to render an offer line (reuse existing strikethrough/Save UI). Vitest.
- **Phase 4 — Services "Offers" admin UI** (Super Admin CRUD, Admin/Staff read-only, on/off switch).
- **Phase 5 — "Apply offer" box** wired into booking form / enquiry step 4 / Billing tab (calls Phase 2 endpoints).
- **Phase 6 — Earnings** split honors `absorbedBy`; add company "discount expense" reconciliation.
- **Phase 7 — Rename `promoCode → discountCode`** across the two repos; run full suite; manual screen pass; PR → sync fork → Vercel per deploy flow.

---

## 9. Files this touches (map)

**Frontend (`WellnessFrontend`)**
- `src/type/schema.ts` — `offerZodSchema`, `discountAudit`, rename `discountCode`.
- `src/lib/service-pricing.ts`, `src/lib/booking-money.ts` (+ tests) — offer-aware line pricing.
- `src/lib/earnings.ts` (+ `src/lib/...` split) — `absorbedBy`.
- `src/components/pages/appointment/appointmentbookingform.tsx` — apply box, keep price read-only.
- `src/components/pages/enquiries/enquiry-detail-drawer.tsx` — step 4 apply box.
- `src/components/pages/appointment/billing-tab.tsx` — apply box.
- `src/components/pages/services/*` — "Offers" admin card.
- `src/data/offers/` — fetch hooks.

**Backend (`wellness-backend`, sibling repo)**
- `models/offerModel.ts`, `models/appointmentsBookingModel.ts` (`discountAudit`, rename).
- `controllers/offerController.ts`, `controllers/appointmentController.ts` (`apply-offer`/`remove-offer`).
- routes + role middleware.

---

## 10. Open items / risks

- **§3.2 (therapist vs company) is the real risk** — it changes payouts and can erode therapist trust if wrong. Do not guess; confirm.
- **Recommended add-ons as offers** — decide whether they count in "traceable discount" reporting (I lean yes, tagged `recommended_discount`).
- **No customer-facing redemption today** — the merged `Offer` keeps `code`/expiry/usage fields so a public code entry can be added later without a second entity.
- **Two-repo change** — coordinate backend merge/deploy first (Render), then frontend PR → fork sync → Vercel.
- **Do not recreate the T31 migration script** (marked unsafe/deleted in prior notes). No migration needed here either — new collection + additive fields only.

---

## 11. Decision log (fill in, then start Phase 1)

| # | Question | Recommended | **Your answer** |
|---|---|---|---|
| 3.1 | Discount after full payment | Store credit (A) | ✅ **A — store credit** (adopted default) |
| 3.2 | Who absorbs the discount | Company absorbs marketing; therapist absorbs recommended add-ons (A, structured for C) | ✅ **A** — `absorbedBy` defaults `'company'`, backend-only day 1 |
| 3.3 | Offer + Custom on same line | No — one offer per line | ✅ **No** — one offer per line |
| 3.4 | Who can apply + ceilings | Role-gated via offer `minRole`/`maxOff`; Custom = Super Admin + note | ✅ **Adopted** — `minRole` ∈ STAFF/ADMIN/SUPER_ADMIN |
| 2.2B | Recommended add-ons counted as offers? | Yes, tag `recommended_discount` | ✅ **Yes** — tag system offer `recommended_discount`, `absorbedBy:'therapist'` |
