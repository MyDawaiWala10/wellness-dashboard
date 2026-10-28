"use client";

import { useState } from "react";
import { format } from "date-fns";
import { ChevronRight, Pencil, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AppointmentStatusBadge } from "@/components/status-badge";
import { useAuthStore } from "@/providers/permission-provider";
import type { CustomerNote } from "@/type/customer-record";
import {
  canEditNote,
  type NoteSource,
  type NotesTimeline as Timeline,
  type TimelineNote,
} from "@/lib/notes-timeline";
import { cn } from "@/lib/utils";

// Who a note is from, at a glance: the same colour and word on every screen.
const SOURCE: Record<NoteSource, { label: string; pill: string; rule: string }> = {
  customer: {
    label: "Customer",
    pill: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
    rule: "border-sky-500",
  },
  therapist: {
    label: "Therapist",
    pill: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
    rule: "border-emerald-500",
  },
  office: {
    label: "Office",
    pill: "bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200",
    rule: "border-slate-400",
  },
};

type Filter = "all" | NoteSource;
const FILTERS: Filter[] = ["all", "customer", "therapist", "office"];

const when = (at?: string) => (at ? format(new Date(at), "yyyy-MM-dd HH:mm") : "");

/**
 * Every note about a customer, tagged Customer / Therapist / Office: notes
 * about the person first, then one block per booking (newest first). Used by
 * the Customers drawer and the booking drawer's History tab.
 */
export function NotesTimeline({
  timeline,
  openId,
  onAdd,
  onEdit,
}: {
  timeline: Timeline;
  /** The booking block to open (the one being looked at). Default: the newest. */
  openId?: string;
  /** Adding a note about the person; resolves true once saved. */
  onAdd?: (text: string) => Promise<boolean>;
  onEdit?: (note: CustomerNote, text: string) => Promise<boolean>;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const shows = (n: TimelineNote) => filter === "all" || n.source === filter;
  const open = openId ?? timeline.bookings[0]?.id;
  const about = timeline.about.filter(shows);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Show notes from">
        {FILTERS.map((f) => (
          <Button
            key={f}
            type="button"
            size="sm"
            variant={filter === f ? "secondary" : "ghost"}
            aria-pressed={filter === f}
            className="h-7 px-2.5 text-xs"
            onClick={() => setFilter(f)}
          >
            {f === "all" ? "All" : SOURCE[f].label}
          </Button>
        ))}
      </div>

      {(about.length > 0 || onAdd) && filter !== "customer" && (
        <section className="rounded-lg border p-3">
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-sm font-semibold">About this customer</h4>
          </div>
          {onAdd && <AddNote onAdd={onAdd} />}
          {about.length === 0 ? (
            <p className="text-xs text-muted-foreground">No notes about this customer yet.</p>
          ) : (
            <div className="space-y-2">
              {about.map((n, i) => (
                <NoteRow key={`${n.at}-${i}`} note={n} onEdit={onEdit} />
              ))}
            </div>
          )}
        </section>
      )}

      {timeline.bookings.map((b) => {
        const notes = b.notes.filter(shows);
        const counts = (["customer", "therapist"] as const)
          .map((s) => [s, b.notes.filter((n) => n.source === s).length] as const)
          .filter(([, c]) => c > 0)
          .map(([s, c]) => `${c} ${SOURCE[s].label.toLowerCase()}`)
          .join(" · ");
        return (
          <details key={b.id} open={b.id === open} className="group rounded-lg border">
            <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 p-3 hover:bg-muted/40">
              {/* Points right when closed, down when open. */}
              <ChevronRight
                aria-hidden
                className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90"
              />
              {b.enquiryId && <span className="font-mono text-xs font-semibold">{b.enquiryId}</span>}
              <span className="text-sm font-medium">{b.title}</span>
              {b.status && <AppointmentStatusBadge status={b.status} />}
              <span className="ml-auto text-[11px] text-muted-foreground">
                {b.at ? format(new Date(b.at), "yyyy-MM-dd") : ""}
                {counts ? ` · ${counts}` : " · no notes"}
              </span>
            </summary>
            <div className="space-y-2 border-t p-3">
              {notes.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  {filter === "all" ? "No notes for this booking yet." : `No ${SOURCE[filter].label.toLowerCase()} notes for this booking.`}
                </p>
              ) : (
                notes.map((n, i) => <NoteRow key={`${n.at}-${i}`} note={n} />)
              )}
            </div>
          </details>
        );
      })}
    </div>
  );
}

function NoteRow({
  note,
  onEdit,
}: {
  note: TimelineNote;
  onEdit?: (note: CustomerNote, text: string) => Promise<boolean>;
}) {
  const user = useAuthStore((s) => s.user);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(note.text);
  const [saving, setSaving] = useState(false);
  const style = SOURCE[note.source];
  const editable = !!onEdit && !!note.record && canEditNote(note.record, { role: user?.role, id: user?.id });

  async function save() {
    if (!onEdit || !note.record || !text.trim()) return;
    setSaving(true);
    const ok = await onEdit(note.record, text.trim());
    setSaving(false);
    if (ok) setEditing(false);
  }

  return (
    <div className={cn("border-l-2 pl-2.5", style.rule)}>
      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
        <span className={cn("rounded px-1.5 py-0.5 font-semibold", style.pill)}>{style.label}</span>
        {note.tag !== style.label && <span className="font-medium text-foreground">{note.tag}</span>}
        {note.by && <span>· {note.by}</span>}
        {note.at && <span className="tabular-nums">· {when(note.at)}</span>}
        {editable && !editing && (
          <Button type="button" variant="ghost" size="sm" className="ml-auto h-6 w-6 p-0" aria-label="Edit note" onClick={() => setEditing(true)}>
            <Pencil className="h-3 w-3" />
          </Button>
        )}
      </div>
      {editing ? (
        <div className="mt-1.5 space-y-2">
          <Textarea value={text} onChange={(e) => setText(e.target.value)} className="min-h-[60px] text-sm" />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setEditing(false); setText(note.text); }}>
              Cancel
            </Button>
            <Button type="button" size="sm" className="h-7 text-xs" onClick={save} disabled={saving || !text.trim()}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      ) : (
        <p className="mt-1 whitespace-pre-wrap text-sm">{note.text}</p>
      )}
    </div>
  );
}

function AddNote({ onAdd }: { onAdd: (text: string) => Promise<boolean> }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!text.trim()) return;
    setSaving(true);
    const ok = await onAdd(text.trim());
    setSaving(false);
    if (ok) {
      setText("");
      setOpen(false);
    }
  }

  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" className="mb-2 h-7 gap-1 text-xs" onClick={() => setOpen(true)}>
        <Plus className="h-3.5 w-3.5" />
        Add note
      </Button>
    );
  }
  return (
    <div className="mb-3 space-y-2 rounded-md border bg-muted/30 p-2.5">
      <Textarea
        autoFocus
        placeholder="About the person: allergies, preferences, how to reach them..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="min-h-[70px] text-sm"
      />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setOpen(false); setText(""); }}>
          Cancel
        </Button>
        <Button type="button" size="sm" className="h-7 text-xs" onClick={save} disabled={saving || !text.trim()}>
          {saving ? "Saving..." : "Save note"}
        </Button>
      </div>
    </div>
  );
}
