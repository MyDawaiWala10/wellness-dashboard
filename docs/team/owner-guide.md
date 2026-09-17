# Your Wellness Dashboard: Owner's Guide

A plain-English tour of the back-office website your team uses to run
the business. No technical knowledge required.

---

## What this dashboard is, in one paragraph

This is a **private website** that you and your team log into to manage
your wellness business. It tracks **enquiries** (people who reached out
but haven't booked yet), **appointments** (confirmed bookings and
sessions), **therapists** (who works for you and what they do), **customers**
(everyone who's ever booked), and now **invoices and earnings** too.

Your customers **never see this dashboard.** They reach out to you via
WhatsApp, phone, or walk-in. Your team uses the dashboard to track them
from "interested" all the way through "regular customer," and to see
what the business actually made once the money's in.

---

## Who logs in and what they can do

When you create someone's account, you assign them a **role**. The role
determines what they can do. Think of it like job titles inside the
system.

| Role | Who this is in real life |
|---|---|
| **Super Admin** | You, the owner. Can do everything, including the one thing nobody else can: permanently delete a therapist's record. |
| **Admin** | A trusted senior manager. Same day-to-day access as Super Admin, with that one exception. |
| **Staff** | Your day-to-day office staff. Handle bookings and leads. |
| **Customer Care** | The executives who answer WhatsApp and convert leads. The Enquiries screen is built for them. |
| **Therapist** | Your therapists. Logging in drops them straight onto Appointments, and they only see their own schedule, earnings, and profile. |

You create staff accounts on the **Settings** screen. Creating, editing, and
deleting staff accounts is genuinely locked to Super Admin/Admin at the
system level (it used to only be a suggestion in the UI; that's since been
fixed). The next section spells out, screen by screen, what's actually a
hard wall versus what's just how the menu is arranged.

### What each role can actually do

A word of warning before the table: most of this system was built trusting
that everyone who has a login is a trusted employee, so it enforces role
differences unevenly. Some walls are real (the server itself refuses the
request no matter how you ask). Others are just "the menu doesn't show you
this button," even though someone who really wanted to could still reach
the feature through the same website with the right knowledge. The table
calls out which kind each one is, because that difference matters if
you're deciding how much to trust a new hire.

| Screen / action | Super Admin | Admin | Staff | Customer Care | Therapist |
|---|---|---|---|---|---|
| Home dashboard | Whole business | Whole business | Whole business | Whole business | Own sessions only |
| Enquiries & Follow-ups | Full access | Full access | Full access | Full access | Not on their menu, and typing the address in by hand bounces them back to Appointments |
| Appointments | Everyone's | Everyone's | Everyone's | Everyone's | Own appointments only (the server itself enforces this one, not just the menu) |
| Customers | Full access | Full access | Full access | Full access | Not on their menu |
| Adding a note on a customer | Not available¹ | Not available¹ | Not available¹ | Not available¹ | Coded as therapist-only¹ |
| Analytics | Full access | Full access | Full access | Full access | Blocked with an explanatory message |
| Earnings & Payouts | Everyone's, can mark payouts paid | Everyone's, can mark payouts paid | Everyone's, can mark payouts paid | Everyone's, can mark payouts paid | Own earnings only, view only |
| Invoices | Full access | Full access | Full access | Full access | Not on their menu |
| Services & pricing | Full access | Full access | Full access | Full access | Not on their menu (though nothing stops it if someone opened it directly: this one's a menu choice, not a server rule) |
| Therapist List | Full roster, add/edit/deactivate, **only one who can permanently delete** | Full roster, add/edit/deactivate, no delete button | Full roster, add/edit/deactivate, no delete button | Full roster, add/edit/deactivate, no delete button | Their own record only, relabeled "My Profile," can't add others |
| Settings → staff accounts | Add/edit/delete staff | Add/edit/delete staff | Not shown | Not shown | Not shown |
| Settings → clinic-wide numbers (booking gap, revenue split) | Full access | Full access | Not shown | Not shown | Not shown |
| Settings → own profile | Yes | Yes | Yes | Yes | Yes |

¹ *This one's worth knowing about specifically: the code has a real
"therapist leaves a note on a customer" feature, but it only shows the
Add/Edit buttons to the Therapist role, and Therapists don't have the
Customers screen on their menu at all. So right now, nobody can actually
use it. Not a business risk, just a loose end from how the two features
were built at different times, worth mentioning to your developer if you
want that feature to actually work for someone.*

### In plain words

- **Super Admin (you):** everything, plus the only login that can wipe a
  therapist's record for good rather than just deactivating them.
- **Admin:** trust this role like you trust yourself, day to day. The one
  thing they can't do is that permanent therapist deletion: a deliberate
  guardrail so a second set of hands can run the business without being
  able to erase history.
- **Staff:** runs bookings, leads, the therapist roster, pricing, and
  billing. Can't touch staff accounts or the clinic-wide settings numbers.
- **Customer Care:** functionally identical access to Staff today. The
  Enquiries screen is just designed with their job in mind. If you want
  Customer Care to be more restricted than Staff, that isn't built yet.
- **Therapist:** the most locked-down role, mostly for real. They land on
  their own appointments, see only their own earnings and profile, and
  can't open Enquiries, Customers, Invoices, Services, or Analytics at all.

The practical summary: **Therapist is a real, enforced restriction. The
four back-office roles (Super Admin, Admin, Staff, Customer Care) are
almost entirely interchangeable today**, aside from the one Super-Admin-only
delete button and the Settings-page split between "Admin and up" versus
"everyone." If your business grows to where Staff and Customer Care need
different limits from each other, that's a real conversation to have with
your developer rather than something already quietly enforced.

---

## The screens

The dashboard now has more going on than it did a few months ago: invoices,
earnings, and a real analytics dashboard have all shipped since the last
version of this guide. Here they are grouped by what they're actually for.

### Your leads-to-booking pipeline

#### 1. Enquiries: your leads pipeline

**The address:** `/dashboard/enquiries`

**What's here:** Every customer who's reached out to you, organized by how
far along they are. The funnel got simpler since it was first built: it's
now four steps, not seven:

- **Enquiry**: just got in touch, no contact yet
- **Reached out**: your team has called/messaged them
- **Booked**: a session is scheduled (online consult or a physio visit)
- **Paid**: payment has cleared
- **Assigned**: a therapist is confirmed and locked in for a slot (funnel complete)
- **Cancelled**: the lead didn't convert, at any point

Leads that you've tried calling but haven't connected with yet get a
separate **Follow-up** flag (see the next screen) instead of just sitting
untouched.

**What you can do here:**
- **Log a new lead** the moment someone reaches out. Click `+ New Enquiry`,
  fill in name, phone, and preferred callback time.
- **Move a lead forward** by clicking it to open the side panel, then work
  through the same four steps in order: mark reached out, book the session,
  record payment, then confirm the therapist. A small progress tracker at
  the top of the panel shows exactly where the lead is and lets you jump to
  the right section.
- **Edit lead details**, cancel a lead, or delete a mistaken entry.

**Important quirk, still true:** a lead stays on the Enquiries screen the
whole way through: it does not automatically move itself to Appointments
once assigned. If you need it to show up there too, the status has to be
flipped manually.

**Designed for:** Customer Care, day to day. Admins use it too. Therapists
don't need it.

---

#### 2. Follow-ups: leads you tried but couldn't reach

**The address:** `/dashboard/follow-ups`

**What's here:** This is new since the last guide. It's not a separate list
of customers, it's the *same* enquiries, filtered down to the ones your
team has already tried calling at least once but hasn't connected with yet.
It exists so a lead that's been attempted-but-not-reached doesn't quietly
sink to the bottom of the main Enquiries list.

**What you can do here:** Everything you can do from the Enquiries screen:
clicking a row opens the exact same side panel. Rows are sorted so the
longest-waiting follow-up is at the top, and turn amber if nobody's tried
again within 24 hours.

**Designed for:** Customer Care: this is where "did we call Anita back
yet?" gets answered without scrolling the whole Enquiries list.

---

#### 3. Appointments: confirmed bookings only

**The address:** `/dashboard/appointments`

**What's here:** Every confirmed booking: consultations and physio
sessions on the calendar. Enquiry-stage leads are not shown here.

**What you can do here:**
- **Book an appointment directly**, skipping the enquiry funnel. Use this
  for a walk-in or a customer who calls already knowing what they want.
- **Search and filter** appointments.
- **Edit any appointment**: change time, mark as ongoing/completed, edit
  notes.
- Record a therapist's **visit code** (a one-time code your therapist
  confirms on-site before a session can be marked complete; this stops a
  session from being ticked off without the therapist actually being there).
- **Delete** an appointment.

**Designed for:** Everyone on the back-office team. **Therapists log in and
see only their own appointments here.**

---

### Money

#### 4. Home: your business at a glance

**The address:** `/dashboard`

**What's here:** A quick-glance row of number cards: total therapists,
active therapists, total customers, total enquiries, appointments,
completed sessions, total services, open follow-ups, and revenue, plus a
recent-activity table underneath. If you're a therapist, you get a
personal version instead: today's sessions, completed-today, recommendations
made, and open assignments.

**What you can do here:** Look at the numbers, hit "Refresh" if something
looks stale. Read-only otherwise.

**When to open:** Mornings, before a meeting, or a weekly pulse check.

---

#### 5. Analytics: the deeper dive

**The address:** `/dashboard/analytics`

**What's here:** New since the last guide, and genuinely more than a
prettier version of the Home numbers. This is where you'd go to actually
understand *trends*, not just totals:
- Revenue and bookings this month, with month-over-month growth charts
- Where your revenue is coming from (which services)
- How much of what's owed has actually been collected
- New vs. repeat customer growth over time
- A payout breakdown: what therapists are owed and what the business keeps
- A daily "pacing" view of bookings, and how loaded each therapist is this
  week

**Not available to therapists**: they see a message pointing them
elsewhere instead. This is a screen-level choice, not something enforced
by the server, worth knowing if you ever need to reason about who can
technically see what.

**Designed for:** You, and anyone doing the numbers side of running the
business.

---

#### 6. Earnings & Payouts

**The address:** `/dashboard/earnings`

**What's here:** Also new. A session-by-session breakdown of revenue and
what each therapist is owed, built from your global revenue-split setting
(Settings screen) or a therapist's individual override if you've set one.

**What you can do here:**
- Filter by date range, therapist, service, or payment status.
- Toggle a therapist's cut between **Owed** and **Paid** once you've
  actually paid them out. This is the record of who's been settled.
- **Export to CSV** for your own books.

**Therapists see their own version** ("My Earnings") with the company's
cut hidden: just their own numbers and payout status.

**Designed for:** You, for running payroll conversations with therapists.
Therapists, for checking what they're owed.

---

#### 7. Invoices

**The address:** `/dashboard/invoices`

**What's here:** Also new. It didn't exist at all in the last version of
this guide. Most invoices generate themselves the moment a payment is
recorded on a booking; you don't have to remember to create one. You can
also create one manually for anything that falls outside a normal booking.

**What you can do here:**
- **Create an invoice** by hand: pick or type a customer, add line items,
  record what's already been paid.
- **Generate a PDF** and **send it over WhatsApp** with one click, once a
  PDF has been generated.
- **Edit** an invoice: if it's already marked paid, the system makes you
  confirm twice and shows you exactly what's about to change before
  saving, since editing a paid invoice is the kind of thing you want to be
  deliberate about.
- **Void** an invoice with a reason, if it was created in error. A voided
  invoice can't be edited further, and stays on record rather than
  disappearing.

**A quirk worth knowing:** once an invoice is paid, editing it won't change
the amount. The money fields lock. If a paid invoice genuinely needs a
different amount, the correct move is to void it and create a fresh one,
not to edit the old one.

**Designed for:** Whoever handles your billing/bookkeeping, plus anyone
following up on payment for a specific customer.

---

### Your team and catalogue

#### 8. Therapist List

**The address:** `/dashboard/alltherapist`

**What's here:** Every therapist you have, with specializations, contact
details, and active/inactive status.

**What you can do here:**
- **Add a new therapist**: name, ID code, email, phone, gender, therapies
  they do, bio, weekly days off, and leave dates.
- **Edit** an existing therapist's details.
- **Deactivate** a therapist: keeps their record and history but hides
  them from "active" counts.
- **Delete** a therapist (only if you want their history gone entirely;
  blocked if they still have any appointments on record, to stop you from
  accidentally losing that history).
- **See per-therapist appointments** by clicking into them.

**Important: two steps for a new therapist who needs to log in.** If a
therapist needs their own login (to see their own schedule and earnings),
you still need to do two things: add them here, **and** add them again on
Settings with role "Therapist," using the **exact same email** on both. A
mismatched email means they'll log in fine but see nothing.

**Designed for:** You and your admins.

---

#### 9. Services

**The address:** `/dashboard/services`

**What's here:** Your service catalogue: name, pricing, category, and
whether it's a multi-session package. This screen used to be a working
preview that reset on every page refresh; that's no longer the case:
everything you do here saves for real now.

**What you can do here:**
- **Add, edit, or delete** a service. Prices support both single sessions
  and packages (e.g. "6 sessions of physio").
- Deleting is blocked if a service is still tied to an existing booking or
  invoice, so you can't accidentally orphan someone's billing history.
- A companion card lets you set **session-rate pricing tiers** (e.g. "1-4
  sessions at ₹X each, 5+ at ₹Y each") used when quoting multi-session
  courses.

**Designed for:** You and your admins.

---

### Customers

#### 10. Customers

**The address:** `/dashboard/customers`

**What's here:** This screen has grown a lot. It's still every person
who's ever booked, but the detail view now shows much more than a booking
list:
- Their full booking history, including notes left after each completed
  session
- A badge showing whether they're **New**, **Returning**, or a **VIP**
  (5+ bookings)
- A running activity timeline across everything that's happened with
  them (reached out, booked, paid, assigned, completed), pulled together
  from all their bookings in one place
- A **therapist notes** section, where therapists can leave freeform notes
  on a customer (visible only to therapists to add/edit)
- A **"Book new session"** button that starts a new enquiry for that
  customer, pre-filled

**What you can't do here (yet):** jump straight from a customer to their
invoices, that link doesn't exist yet. You'd go to Invoices and search by
name/phone instead.

**Designed for:** Anyone who needs the full picture on a specific person:
Customer Care following up, or a therapist checking history before a
session.

---

### Admin

#### 11. Settings

**The address:** `/dashboard/settings`

**What's here:** Your own profile, plus (for admins) staff account
management and two clinic-wide numbers: the default gap between booking
slots, and the default revenue split with therapists.

**What you can do here:**
- **Your profile**: update details, change your password.
- **Staff section** (admins): add, edit, or delete a staff account.
- **Booking gap**: set the default minutes between slots. This one saves
  correctly.
- **Therapist revenue split**: set what percentage of a session's price
  goes to the therapist by default. **This save button is currently
  broken**: it always fails silently on the backend regardless of what
  you enter. Individual therapists' overrides (set on their own profile)
  still work fine; it's only the *global* default that can't be changed
  from here right now. Flagged for your developer to fix.

**Designed for:** The profile section, everyone. Staff management and the
clinic-wide settings, Super Admin/Admin only, and that one actually is
enforced now, not just suggested.

---

## A day in the life: how a customer flows through your business

```
Sunday 11 PM:
  Customer "Anita" sends a WhatsApp to your business:
  "hi, I have lower back pain, can I get a session?"

Monday 8:30 AM:
  Your Customer Care opens /dashboard/enquiries
  → + New Enquiry
  → Name: Anita / Phone: 9812345678 / Preferred: 9 AM - 11 AM
  → Anita's row appears with the "Enquiry" chip

Monday 10:00 AM:
  Customer Care calls Anita, connects.
  → Opens Anita's row, ticks "Mark as reached out" → chip turns "Reached out"

Tuesday 11:30 AM:
  → Books Anita's physio session, picks a slot
  → chip turns "Booked"

Tuesday 12:00 PM:
  → Payment comes in, gets recorded
  → chip turns "Paid," and an invoice for the booking appears
    automatically on the Invoices screen; no one has to create it

Tuesday 12:15 PM:
  → CC confirms Dr. Reddy is free at that time, assigns her
  → chip turns "Assigned." Funnel complete.

Going forward:
  The session shows up on /dashboard/appointments. When Dr. Reddy
  actually arrives, she confirms a one-time visit code before the
  session can be marked complete, that's what unlocks "Mark complete."
  Once it's ticked off, it shows up in Anita's history on the Customers
  screen and in the Earnings breakdown for Dr. Reddy.
```

---

## What you (the owner) should personally check, weekly

| What | Where | What it tells you |
|---|---|---|
| New leads this week | Enquiries, compared to last week | Are inquiries growing? |
| Lead conversion | Analytics → conversion rate | Where's your funnel leaking? |
| Stuck follow-ups | Follow-ups screen, oldest first | Is Customer Care actually calling back? |
| Active therapists | Home → therapist card | Matches your actual headcount? |
| Revenue and collection rate | Analytics | Growth, and how much of what's billed actually gets collected |
| Payout owed | Earnings | What you owe therapists that hasn't been paid out yet |
| Cancelled leads | Enquiries → Cancelled | High cancellation = a quality issue with leads or handling |

---

## What to do when something breaks

If you or anyone on your team sees an error message like these:

- "Forbidden" / "Role not allowed"
- "Missing required fields"
- A blank screen where there should be data
- An action that seems to do nothing

**Do these three things:**
1. **Take a screenshot** showing the error and the URL bar
2. **Note exactly what you were clicking** when it happened
3. **Send to your developer** with both

A few things that are **normal, not errors**:
- **First page loads slowly (15-30 seconds)** after a while of nobody
  using it. The server "wakes up": it's hosted on a service called
  Render that sleeps when idle. Subsequent pages are fast.
- **Numbers don't update immediately** in another tab. Refresh that
  tab and the latest data will appear.
- **Forgot your password?** There's a proper "forgot password" flow now:
  it emails a one-time code. Nobody has to reset it for you by hand
  anymore.

---

## Things to watch out for (talk to your developer about these)

| Issue | What it means for the business |
|---|---|
| Therapist revenue-split save is broken on Settings | You can still set a per-therapist override on their own profile; the *global* default can't be changed from Settings right now. Low urgency unless you're about to change your standard split. |
| The four back-office roles are barely distinguished from each other | See "What each role can actually do" near the top of this guide. Staff and Customer Care in particular have identical access today. Worth tightening before you have a larger or less-trusted team. |
| The customer-notes feature has nobody who can use it | It only shows its Add/Edit buttons to the Therapist role, but Therapists don't have the Customers screen on their menu. Low priority unless you actually want therapists leaving notes on customers. |
| No link from a customer to their invoices | You can still find their invoices by searching name/phone on the Invoices screen; it's just not one click from their profile yet. |
| A therapist's login email can drift from their roster profile | If a therapist's email or phone is edited from the regular Therapist screen (as opposed to by a Super Admin), their login details don't automatically update to match. Only matters if someone's contact info changes. |

---

## Quick glossary

| Word | What it means in plain English |
|---|---|
| **Lead / Enquiry** | A customer who showed interest but hasn't booked yet |
| **Funnel** | The step-by-step journey from "enquired" to "assigned and confirmed" |
| **Follow-up** | A lead you've tried to reach but haven't connected with yet |
| **Visit code** | A one-time code a therapist confirms on-site, required before a session can be marked complete |
| **Slot** | A specific date and time for a session |
| **Status** | Where a record is in its life: enquiry → scheduled → ongoing → completed (or cancelled) |
| **Role** | The job title inside the system that determines what someone can do |
| **Dashboard** | This whole website you log into |
| **Backend** | The server that stores all the data. Hosted on a service called Render. You don't interact with it directly. |
| **Frontend** | Same thing as "dashboard" in everyday language: what your browser shows you |

---

If anything in this guide is unclear, ask your developer to update it.
This document lives at `WellnessFrontend/docs/team/owner-guide.md` in
the code repository. Last refreshed 2026-09-17.
