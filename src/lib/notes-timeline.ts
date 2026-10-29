import type { slotBookingZodType as Row } from "@/type/schema";
import type { CustomerNote } from "@/type/customer-record";
import { childVisitsOf, topLevelRows } from "@/lib/visit-groups";
import { bookingLabel } from "@/components/pages/enquiries/booking";
import { shownStatus } from "@/components/status-badge";

/**
 * Every note about one customer, grouped the way people read it: notes about
 * the person ("About this customer"), then one block per booking, newest
 * first. Each note says who it came from - the customer, a therapist, or the
 * office - so a returning customer's history stays clear however many times
 * they come back.
 */

export type NoteSource = "customer" | "therapist" | "office";

export type TimelineNote = {
  source: NoteSource;
  text: string;
  /** "When booking", "Asked again (#2)", "Session 2 of 6", "Office". */
  tag: string;
  at?: string;
  by?: string;
  /** The stored record note, for editing (About this customer only). */
  record?: CustomerNote;
};

export type BookingNotes = {
  id: string;
  enquiryId?: string;
  title: string;
  at?: string;
  status?: string;
  notes: TimelineNote[];
};

export type NotesTimeline = { about: TimelineNote[]; bookings: BookingNotes[] };

const createdAt = (r: Row) => (r as unknown as { createdAt?: string }).createdAt;
const time = (at?: string) => (at ? new Date(at).getTime() || 0 : 0);
const clean = (t?: string | null) => (t ?? "").trim();

export function buildNotesTimeline(bookings: Row[], recordNotes: CustomerNote[] = []): NotesTimeline {
  const groups = topLevelRows(bookings).map((top) => {
    const visits = [top, ...childVisitsOf(top, bookings)];
    const total = top.totalSessions ?? 0;
    const notes: TimelineNote[] = [];

    // The customer's own words first: why they booked, then anything they
    // added when they asked again.
    if (clean(top.note)) {
      notes.push({ source: "customer", text: clean(top.note), tag: "When booking", at: createdAt(top) });
    }
    for (const c of top.customerNotes ?? []) {
      if (!clean(c.note)) continue;
      notes.push({ source: "customer", text: clean(c.note), tag: c.repeat ? `Asked again (#${c.repeat})` : "Customer", at: c.at });
    }

    // Then each session's note, in the order the sessions happened. A package
    // keeps later sessions on their own visits, so those count too.
    visits
      .flatMap((v) => v.sessionNotes ?? [])
      .filter((s) => clean(s.note))
      .sort((a, b) => time(a.at) - time(b.at))
      .forEach((s) =>
        notes.push({
          source: "therapist",
          text: clean(s.note),
          tag: `Session ${s.session}${total > 1 ? ` of ${total}` : ""}`,
          at: s.at,
          by: s.therapist || s.by,
        }),
      );

    return {
      id: top._id ?? top.enquiryId ?? "",
      enquiryId: top.enquiryId,
      ids: new Set(visits.map((v) => v.enquiryId).filter(Boolean)),
      title: bookingLabel(top),
      at: createdAt(top),
      status: shownStatus(top),
      notes,
    };
  });

  // The record's notes: copies of session notes already shown above are
  // skipped; a copy from a booking this viewer can't see (another therapist's)
  // gets its own block; everything else is about the person.
  const shown = new Set(groups.flatMap((g) => g.notes.filter((n) => n.source === "therapist").map((n) => n.text)));
  const about: TimelineNote[] = [];
  for (const n of recordNotes) {
    const text = clean(n.note);
    if (!text) continue;
    if (shown.has(text) && (n.kind === "session" || !n.kind)) continue;
    if (n.kind === "session") {
      let g = groups.find((x) => n.enquiryId && x.ids.has(n.enquiryId));
      if (!g) {
        g = { id: n.enquiryId ?? `earlier-${n.at}`, enquiryId: n.enquiryId, ids: new Set([n.enquiryId]), title: "Earlier visit", at: n.at, status: undefined, notes: [] };
        groups.push(g);
      }
      g.notes.push({ source: "therapist", text, tag: n.session ? `Session ${n.session}` : "Session note", at: n.at, by: n.by });
      shown.add(text);
      continue;
    }
    // ponytail: an older note without a kind that matches no visible session is
    // treated as the office's; scripts/backfill-note-kinds.ts tags the old ones.
    const therapist = n.kind === "therapist";
    about.push({ source: therapist ? "therapist" : "office", text, tag: therapist ? "Therapist" : "Office", at: n.at, by: n.by, record: n });
  }

  return {
    about: about.sort((a, b) => time(b.at) - time(a.at)),
    bookings: groups
      .sort((a, b) => time(b.at) - time(a.at))
      .map(({ id, enquiryId, title, at, status, notes }) => ({ id, enquiryId, title, at, status, notes })),
  };
}

/** Mirrors the backend's canEditNote (lib/customerNotes.ts) - KEEP IN SYNC. */
export function canEditNote(note: CustomerNote, user?: { role?: string; id?: string }): boolean {
  if (note.kind === "session") return false;
  if (user?.role === "SUPER_ADMIN" || user?.role === "ADMIN") return true;
  return !!note.userId && note.userId === user?.id;
}
