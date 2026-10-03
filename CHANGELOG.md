# Changelog

Plain-English record of what changed, for anyone who won't read git history.
Newest first. Covers both this dashboard and the WellnessBackend API.

## Unreleased (committed locally, not yet deployed)

**Deploy the backend before the frontend.** See BD-4, BD-5 and BD-6 in [ISSUES.md](ISSUES.md).

### Customer accounts for the Customers' App (backend)
Backend only, built and tested on 2026-10-02, **not committed yet**. Nothing
changes in the dashboard. Read BD-6 in [ISSUES.md](ISSUES.md) before deploying.
- Customers can sign in to the Customers' App with their mobile number and a
  6-digit SMS code. A sign-in lasts 7 days.
- Signed in, they can see and edit their profile (name, email, gender, date of
  birth, address, city, pincode, emergency contact), upload a profile photo,
  see their bookings (status, date and time, therapist, sessions done, amount
  due) and ask for a new booking, which arrives as a normal enquiry.
- One phone number is one account, shared with the patient website. Accounts
  that sign in through the app are labelled as wellness users; the website
  itself is unchanged.
- The new profile details are saved on the clinic's customer record
  (CUST-####), but the dashboard doesn't show them yet.
- The app never renames the clinic's customer record (bookings are matched by
  phone + name); it only changes the name on the customer's login.
- Until the new settings are on Render, the app's endpoints answer "not
  available" and everything else keeps working.
- Requests from a website that isn't on the allowed list now get a clear 403
  instead of a 500.

### Changed: repeat submissions on the website booking form
- A repeat is now only merged into an earlier enquiry when it's from the same
  phone and name, for the same service, and that enquiry hasn't been scheduled
  yet. Before, it merged into any open enquiry, scheduled or ongoing booking on
  that phone and name, which could hide a genuine second request. Staff may see
  a few more separate enquiries from one person. The app follows the same rule.

### Changed: pay page for course follow-up sessions
- A payment link for a follow-up session of a course now only asks for that
  session's own add-ons. Before, it also showed the session's share of the
  course price as due, although the whole course is paid on the first session.

### Fixed: duplicate customer records
- Two requests creating the same customer at the same moment (a double-tapped
  booking, or an app sign-in and a booking together) could create two CUST
  records for one person. Every path that creates customers, staff "Add
  customer" included, now takes its turn per phone number.

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
