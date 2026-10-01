# Changelog

Plain-English record of what changed, for anyone who won't read git history.
Newest first. Covers both this dashboard and the WellnessBackend API.

## Unreleased (committed locally, not yet deployed)

**Deploy the backend before the frontend.** See BD-4 and BD-5 in [ISSUES.md](ISSUES.md).

### Each therapist has their own earnings split
- The single clinic-wide split in Settings is gone. Admins and Super Admins now
  set each therapist's split in the therapist drawer, Earnings tab (it shows even
  before their first session), and when adding a therapist.
- A change applies only to sessions completed from then on. Each booking keeps
  the split it was completed at, so past earnings and payouts never shift.
- Existing therapists and past sessions are locked in at today's 60% by a
  one-time script at deploy.
- Therapists never see the percentage, only their earnings. Staff and Customer
  Care don't see it either.
- Fixed along the way: the drawer's Earnings tab ignored the therapist's own
  split, and Analytics assumed 60% for everyone.

### Booking IDs are colour-coded by how the booking came in
- Every booking ID (ENQ-####) is now a coloured pill: **black** Online,
  **green** WhatsApp, **blue** Walk-in, **orange** Via Therapist. Hover it to see
  the source, and for referrals, which therapist sent them.
- New Enquiry, Book new session and Book Slot now ask "How did they reach us?".
  Staff must pick one; there is no default, so a walk-in can't be quietly saved
  as WhatsApp. Via Therapist also asks which therapist.
- The source can be corrected later from either booking drawer. Therapists can
  see it but not change it.
- Older bookings: website ones show as Online, staff-entered ones as WhatsApp.
- Green and orange are a shade darker than the obvious ones so the ID text stays
  readable (accessibility contrast).

### Settings: "Change Password" card removed
- Staff now reset a password through "Forgot password" on the login screen
  (emailed code), or an admin sets it by editing the user.

### Appointment drawer: "Money" tab is now "Billing"
- Discounted services show the original price struck through and how much was saved.
- Totals now break down into subtotal, discount, total, paid and due.
- The booking's invoice appears at the bottom with a Download / Generate PDF
  button. Hidden for therapists, who can't access invoices.

## 2026-09-18

- Security: login tokens can no longer be signed with a fallback password that
  was in the code. The server now refuses to start without its secrets.
- Security: therapists are now blocked on the server (not just in the menu) from
  changing prices, clinic settings, the therapist roster, and deleting bookings.

## 2026-09-17

- New docs: API reference, data model, onboarding guide, refreshed owner guide.
- Top-right account menu now shows your name, email and role, and fits on phones.
- Fixed: the therapist revenue-split setting could never be saved.
- Fixed: a therapist's leave list showed every therapist's leave.
- Mobile: fixed the page being stuck and unable to scroll to the top; added a
  screen-reader title to the mobile menu.
- Dev only: the dashboard now works when tested on a phone through a dev tunnel.
