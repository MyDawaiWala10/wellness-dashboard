import z from "zod";
import { ROLES } from "@/constant";

export const AnalyticsSchema = z.object({
  totalDoctors: z.number(),
  activeDoctors: z.number(),
  totalPatients: z.number(),
  totalAppointments: z.number(),
  totalActiveDoctors:z.number(),
  patientsInCurrentMonth: z.number(),
  appointmentsInCurrentMonth: z.number(),
  completedAppointments: z.number()
})

export type AnalyticsType = z.infer<typeof AnalyticsSchema>

export const SettingsSchema = z.object({
  userfName: z.optional(z.string()),
  userlName: z.optional(z.string()),
  userEmail: z.optional(z.string().email()),
  userPassword: z.optional(
    z.string().min(6, { message: "password must contains 6 charecter" }),
  ),
  userPhone: z.string().optional(),
  gender: z.string().optional(),
  dob: z.string().optional(),
});



export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6, {
    message: "Password must be atleast 6 character long"
  })
});

export const AddUserBySuperAdmin = z.object({
  username: z.string().min(1, { message: "Username required" }),
  email: z.string().email(),
  password: z.string(), // Enum validation
  role: z.string()
});

export const RegisterSchema = z.object({
  username: z.string().min(1, {
    message: "Username required"
  }),
  email: z.string().email(),
  password: z.string().min(6, {
    message: "Password must be atleast 6 character long"
  })
});

export const UserRoleUpdateSchema = z.object({
  email: z.string().email(),
  role: z.enum(ROLES),
});

export const ResetSchema = z.object({
  email: z.string().email({ message: "Email is required!" }),
});

// Superset schema for the executive enquiry funnel.
// Existing appointment records validate against this because every legacy
// field stays optional or unchanged. Stage transitions are driven by the
// checkpoint booleans below.
export const enquirySchema = z.object({
  _id: z.string().optional(),

  // ── Required for any record ──
  name: z.string().min(2, "Name must be at least 2 characters"),
  phonenumber: z
    .number()
    .refine((n) => String(n).length === 10, "Phone must be exactly 10 digits"),
  // status keeps the old `.default().optional()` pattern so existing forms
  // that omit it in defaultValues still type-check.
  status: z
    .enum(["enquiry", "scheduled", "ongoing", "completed", "cancelled"])
    .default("enquiry")
    .optional(),

  // ── Optional / collected as the funnel progresses ──
  // preferredReachOutTime is a structured time window the client wants to
  // be reached in. Required at the intake form level (see the intake
  // modal's mini-schema) but optional here so legacy records and mid-funnel
  // records that omit it still validate. Stored as 24h "HH:MM" strings;
  // formatted for display via formatTimeRange in ./components/pages/enquiries/time-range.
  preferredReachOutTime: z
    .object({ from: z.string(), to: z.string() })
    .optional(),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  age: z.number().optional(),
  location: z.string().optional(),
  category: z.string().optional(),
  note: z.string().optional(),
  typeOfappointment: z.enum(["consultation", "appointment"]).optional(),
  // What was sold: a one-off intake (consultation / home visit) or a course of
  // therapy sessions. typeOfappointment alone cannot tell them apart, because a
  // course is always delivered at home. See bookingKindOf in enquiries/booking.ts.
  bookingKind: z.enum(["intake", "course"]).optional(),

  // ── Which offering the customer is approaching (from the public site):
  // "Online Consultation" | "Home Therapy" | "Vitals Check". ──
  service: z.string().optional(),
  // Therapy session package from catalogue (serviceId). Tracks package progress.
  packageServiceId: z.string().optional(),
  sessionNumber: z.number().int().positive().optional(),
  sessionsCompleted: z.number().int().nonnegative().optional(),
  packageOriginId: z.string().optional(),
  // ── Vitals Check sub-selections (e.g. "Blood Pressure (BP)", "Other: ..."). ──
  vitals: z.array(z.string()).optional(),

  // ── Therapist recommendation flow ──
  // "new" = normal booking; "recommended" = legacy separate row (deprecated).
  appointmentKind: z.enum(["new", "recommended"]).optional(),
  quotedPrice: z.number().optional(),
  // ── Discount / offer tracking ──
  originalPrice: z.number().optional(),
  discountAmount: z.number().nonnegative().optional(),
  discountType: z.enum(["fixed", "percent"]).optional(),
  discountCode: z.string().optional(),
  recommendedFrom: z.string().optional(),

  // Stacked add-ons on this visit (preferred over creating a new appointment row).
  recommendedServices: z
    .array(
      z.object({
        serviceId: z.string(),
        serviceName: z.string(),
        category: z.string().optional(),
        quotedPrice: z.number(),
        sessions: z.number().optional(),
        slot: z.object({ date: z.string(), time: z.string() }).optional(),
        status: z.enum(["pending", "confirmed"]).optional(),
        recommendedAt: z.string(),
        recommendedBy: z.string().optional(),
        confirmedAt: z.string().optional(),
        confirmedBy: z.string().optional(),
        paymentCollected: z.boolean().optional(),
        paymentCollectedAt: z.string().optional(),
      }),
    )
    .optional(),

  // ── Therapist work checklist - completed item keys
  // ("arrived" | "performed" | "payment" | "completed"). ──
  workChecklist: z.array(z.string()).optional(),

  // ── Checkpoint: executive reached out ──
  // Booleans are optional (not .default(false)) so existing forms with
  // defaultValues that omit these still type-check. Consumers read with `?? false`.
  // The backend Mongoose schema still has default:false so server records
  // are never undefined in practice.
  executiveReachedOut: z.boolean().optional(),
  executiveReachedOutAt: z.string().datetime().optional(),

  // ── Checkpoint: online consultation ──
  consultationSlot: z
    .object({ date: z.string(), time: z.string() })
    .optional(),
  consultationCompleted: z.boolean().optional(),
  consultationCompletedAt: z.string().datetime().optional(),

  // ── Checkpoint: physio assignment ──
  physioSlot: z.object({ date: z.string(), time: z.string() }).optional(),
  doctorId: z.string().optional(),
  doctor: z.string().optional(),
  physioAssignmentConfirmed: z.boolean().optional(),
  physioAssignmentConfirmedAt: z.string().datetime().optional(),

  // ── Checkpoint: payment (patient → clinic) ──
  // Recording payment auto-advances status to "ongoing". Fields persist only
  // once the backend model accepts them (see FUNNEL_COMPLETION_BACKEND_PATCH.md).
  // Unguessable token for the customer-facing /pay/<token> page. Minted by the
  // backend on demand (POST /api/appointments/:id/pay-link) - never set here.
  payToken: z.string().optional(),

  paymentReceived: z.boolean().optional(),
  paymentAmount: z.number().nonnegative().optional(),
  paymentMethod: z.enum(["cash", "upi", "card", "bank", "other"]).optional(),
  paymentReceivedAt: z.string().datetime().optional(),
  therapistPaid: z.boolean().optional(),
  therapistPaidAt: z.string().datetime().optional(),
  // Per-visit OTP verification state (server-managed; UI gates checkout on it).
  visitOtpVerified: z.boolean().optional(),
  // Ad-hoc multi-session tracking + per-session report log.
  totalSessions: z.number().optional(),
  sessionIntervalDays: z.number().optional(),
  sessionNotes: z
    .array(
      z.object({
        session: z.number(),
        at: z.string(),
        note: z.string().optional(),
        therapist: z.string().optional(),
        by: z.string().optional(),
      }),
    )
    .optional(),

  // ── Checkpoint: completion ──
  // Manual; gated behind paymentReceived. Sets status "completed".
  completedAt: z.string().datetime().optional(),

  // ── Sequential enquiry ID (assigned by backend on creation) ──
  // Human-readable, e.g. "ENQ-0001". Optional because pre-backfill records
  // may not have one.
  enquiryId: z.string().optional(),
  customer_id: z.string().optional(),

  // ── Back-office assignee (who is handling this lead) ──
  // userId is the assignee's User._id; name is denormalized for display.
  assignedTo: z
    .object({
      userId: z.string(),
      name: z.string(),
    })
    .optional(),

  // ── Audit field: who FIRST claimed this lead (different from assignedTo).
  // Set once on the first action (reach-out tick, slot booked, etc.) and
  // treated as immutable in the UI for non-admins. Used as the permission
  // gate for who can edit lead status.
  reachedOutBy: z
    .object({
      userId: z.string(),
      name: z.string(),
    })
    .optional(),

  // ── Activity log: append-only audit of who did what, when. ──
  // Persisted by the backend once it supports the field (see
  // scripts/ENQUIRY_BACKEND_PATCH.md). Until then it's session-only; the UI
  // also derives a read-only timeline from the timestamp fields above.
  activityLog: z
    .array(
      z.object({
        at: z.string(),
        userId: z.string().optional(),
        name: z.string(),
        action: z.string(),
      }),
    )
    .optional(),

  // ── How many times this person re-submitted a booking while this lead
  // stayed OPEN. The backend bumps this (and logs the repeat in activityLog)
  // instead of creating a duplicate row. Defaults to 1 server-side. ──
  repeatCount: z.number().optional(),

  // ── Follow-up tracking: how many times an executive tried to call but
  // couldn't connect (no answer), and when the last attempt was. Drives the
  // /dashboard/follow-ups view. ──
  reachAttempts: z.number().optional(),
  lastAttemptAt: z.string().datetime().optional(),

  // ── Reason captured when a status is manually overridden. ──
  statusNote: z.string().optional(),

  // ── Transient override reasons (T3/T4/T5): sent with a save, logged +
  // stripped server-side, never stored as columns. ──
  overrideReason: z.string().optional(),
  reassignReason: z.string().optional(),

  // ── Legacy fields preserved for back-compat with existing appointment records ──
  slot: z.object({ date: z.string(), time: z.string() }).optional(),
  therapyStartTime: z.string().optional(),
  therapyEndTime: z.string().optional(),
});

export type ActivityEntry = {
  at: string;
  userId?: string;
  name: string;
  action: string;
};

export type EnquiryType = z.infer<typeof enquirySchema>;

// Back-compat aliases - existing call sites import these names.
// New code should import `enquirySchema` / `EnquiryType` directly.
export const slotBookingZodSchema = enquirySchema;
export type slotBookingZodType = EnquiryType;



export const certificateSchema = z.object({
  label: z.string().min(1, "Label required"),
  url: z.string().url("Invalid URL"),
});
export type Certificate = z.infer<typeof certificateSchema>;

export const TherapistformSchema = z.object({
  name: z.string().min(1, "Name is required"),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  // Auto-allocated server-side (THR-####) when left blank.
  doctorId: z.string().optional(),
  // Link to the login account (User._id). Set server-side when creating.
  userId: z.string().optional(),
  // Temporary login password - required only when CREATING a therapist (the add
  // form enforces it); not used when editing.
  password: z.string().optional(),
  gender:z.enum(["male","female"]),
  email: z.string().email("Invalid email"),
  phonenumber: z.string().regex(/^\d{10}$/, "Must be 10 digits"),
  specialization: z.string().array(),
  bio: z.string().optional(),
  isActive: z.boolean().default(true).optional(),
  profileImage: z.string().optional().or(z.literal("")),
  certificates: z.array(certificateSchema).optional(),
  // Weekly off-days (0=Sun, 6=Sat). Empty = available every day.
  weekOffDays: z.array(z.number().min(0).max(6)).default([]).optional(),
});
export type TherapistformType = z.infer<typeof TherapistformSchema>

// ── Service catalog ──────────────────────────────────────────────────────────
// serviceId is auto-allocated (SRV-0001…) by the backend atomic counter, so it
// is NOT part of the form. The form captures only what staff type in.
export const serviceFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  description: z.string().optional(),
  hsnCode: z
    .string()
    .min(1, "HSN/SAC code is required")
    .regex(/^\d{4,8}$/, "HSN/SAC must be 4-8 digits"),
  // ── T31: the service's two prices (used when it's added to a visit) ──
  // discountedPrice when a therapist recommends it + discount applied, else originalPrice.
  originalPrice: z
    .number({ error: "Original price is required" })
    .nonnegative("Can't be negative"),
  discountedPrice: z
    .number({ error: "Discounted price is required" })
    .nonnegative("Can't be negative"),

  // ── DEPRECATED - kept optional until the T31 data migration; not on the form ──
  category: z.string().optional(),
  price: z.number().nonnegative().optional(),
  recommendedPrice: z.number().nonnegative().optional(),
  isPackage: z.boolean().optional(),
  packageUnit: z.enum(["sessions", "weeks", "months"]).optional(),
  packageCount: z.number().nonnegative().optional(),
});
export type ServiceFormType = z.infer<typeof serviceFormSchema>;

export type ServiceType = ServiceFormType & {
  _id?: string;
  serviceId: string; // e.g. "SRV-0001"
};

// ── Global session-rate table (T31) ──────────────────────────────────────────
// A dynamic list of tiers: a course of N sessions is priced by the tier whose
// [from, to] range contains N (to: null = open-ended), at `rate` per session.
export const sessionTierSchema = z.object({
  from: z.number().int().nonnegative(),
  to: z.number().int().nonnegative().nullable(),
  rate: z.number().nonnegative(),
});
export type SessionRateTier = z.infer<typeof sessionTierSchema>;

export type UserType = {
  id: string | undefined;
  role: string | undefined;
  userEmail: string | undefined | null;
};