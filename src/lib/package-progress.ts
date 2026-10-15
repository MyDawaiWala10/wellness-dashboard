import type { ServiceType, slotBookingZodType } from "@/type/schema";

export type PackageProgress = {
  packageName: string;
  packageServiceId: string;
  total: number;
  completed: number;
  currentSession: number;
  /** e.g. "2 of 6 completed" */
  label: string;
  currentLabel?: string;
  packageDone: boolean;
  /**
   * One session of a course with a visit per session: this card completes
   * once and never moves on (the next session has its own visit).
   */
  split?: boolean;
};

/**
 * This visit's place in a course stored one booking per session (the booking
 * itself is session 1; follow-ups carry sessionNumber), or null. Mirrors the
 * backend's courseSessionOf (lib/payments.ts) - KEEP IN SYNC.
 */
export function courseSessionOf(a: slotBookingZodType): { session: number; total: number } | null {
  if (a.addonOf?.bookingId) return null;
  const total = a.totalSessions ?? 0;
  if (a.packageOriginId && a.packageOriginId !== a._id) return { session: a.sessionNumber ?? 1, total };
  if (a.bookingKind === "course" && total > 1 && (a.sessionIntervalDays ?? 0) > 0) return { session: 1, total };
  return null;
}

export function getSessionPackages(services: ServiceType[]): ServiceType[] {
  return services.filter(
    (s) =>
      s.isPackage &&
      s.packageUnit === "sessions" &&
      s.packageCount &&
      s.packageCount > 0,
  );
}

export function resolvePackageForAppointment(
  appointment: slotBookingZodType,
  services: ServiceType[],
): ServiceType | null {
  const sessionPackages = getSessionPackages(services);

  if (appointment.packageServiceId) {
    const byId = sessionPackages.find(
      (s) => s.serviceId === appointment.packageServiceId,
    );
    if (byId) return byId;
  }

  const serviceName = appointment.service?.trim();
  if (serviceName) {
    const byName = sessionPackages.find((s) => s.name === serviceName);
    if (byName) return byName;
  }

  return null;
}

/**
 * Package progress from this single row (sessionsCompleted counter).
 */
export function getPackageProgressForAppointment(
  appointment: slotBookingZodType,
  _allAppointments: slotBookingZodType[],
  services: ServiceType[],
): PackageProgress | null {
  // A course with a visit per session: progress is just this one session.
  const own = courseSessionOf(appointment);
  if (own) {
    const done = appointment.status === "completed";
    return {
      packageName: `${own.total}-session course`,
      packageServiceId: appointment.packageServiceId ?? "",
      total: own.total,
      completed: done ? 1 : 0,
      currentSession: own.session,
      label: `Session ${own.session} of ${own.total}${done ? " - done" : ""}`,
      currentLabel: `This visit: session ${own.session} of ${own.total}`,
      packageDone: done,
      split: true,
    };
  }

  const pkg = resolvePackageForAppointment(appointment, services);
  // A catalogue package's count, else an ad-hoc booking's stable totalSessions.
  const total =
    pkg?.packageCount ??
    (appointment.totalSessions && appointment.totalSessions > 1
      ? appointment.totalSessions
      : 0);
  if (!total || total <= 1) return null;

  const completed = appointment.sessionsCompleted ?? 0;
  // Derive the current session from the counter, not sessionNumber (which the
  // completion flow repurposes as a moving pointer).
  const currentSession = Math.min(
    completed + (appointment.status !== "completed" ? 1 : 0),
    total,
  );
  const inProgress =
    appointment.status !== "cancelled" && completed < total;

  return {
    packageName: pkg?.name ?? `${total}-session booking`,
    packageServiceId: pkg?.serviceId ?? "",
    total,
    completed,
    currentSession,
    label: `${completed} of ${total} completed`,
    currentLabel: inProgress
      ? `This visit: session ${currentSession} of ${total}`
      : completed >= total
        ? "Package complete"
        : undefined,
    packageDone: completed >= total,
  };
}
export function dedupePackageAppointments(
  appointments: slotBookingZodType[],
): slotBookingZodType[] {
  const nonPackage: slotBookingZodType[] = [];
  const packageBest = new Map<string, slotBookingZodType>();

  for (const a of appointments) {
    if (!a.packageServiceId) {
      nonPackage.push(a);
      continue;
    }
    const key = `${a.phonenumber}-${a.packageServiceId}`;
    const existing = packageBest.get(key);
    if (!existing) {
      packageBest.set(key, a);
      continue;
    }
    const score = (r: slotBookingZodType) =>
      (r.packageOriginId === r._id ? 1000 : 0) +
      (r.sessionsCompleted ?? 0) * 10 +
      (r.sessionNumber ?? 0);
    if (score(a) >= score(existing)) {
      packageBest.set(key, a);
    }
  }

  return [...nonPackage, ...packageBest.values()];
}

export function countConfirmedAddons(appointment: slotBookingZodType): number {
  return (appointment.recommendedServices ?? []).filter(
    (r) => r.status === "confirmed",
  ).length;
}

export function countPendingAddons(appointment: slotBookingZodType): number {
  return (appointment.recommendedServices ?? []).filter(
    (r) => r.status === "pending",
  ).length;
}

export function getConfirmedAddonNames(appointment: slotBookingZodType): string[] {
  return (appointment.recommendedServices ?? [])
    .filter((r) => r.status === "confirmed")
    .map((r) => r.serviceName);
}

export function visitStatusLabel(status?: string): string {
  switch (status) {
    case "scheduled":
      return "Scheduled";
    case "ongoing":
      return "In progress";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
    default:
      return "Unknown";
  }
}
