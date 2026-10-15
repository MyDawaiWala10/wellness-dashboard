import { describe, it, expect } from "vitest";
import {
  getSessionPackages,
  resolvePackageForAppointment,
  getPackageProgressForAppointment,
  dedupePackageAppointments,
  countConfirmedAddons,
  countPendingAddons,
  getConfirmedAddonNames,
  visitStatusLabel,
} from "./package-progress";
import type { ServiceType, slotBookingZodType } from "@/type/schema";

const service = (over: Partial<ServiceType>): ServiceType =>
  ({ _id: "1", name: "Test", serviceId: "SRV-001", price: 100, ...over }) as ServiceType;

const appointment = (over: Partial<slotBookingZodType>): slotBookingZodType =>
  ({ _id: "1", name: "Test", phonenumber: 1234567890, ...over }) as slotBookingZodType;

describe("getSessionPackages", () => {
  it("filters to session packages only", () => {
    const services = [
      service({ isPackage: true, packageUnit: "sessions", packageCount: 6 }),
      service({ isPackage: false }),
      service({ isPackage: true, packageUnit: "sessions", packageCount: 0 }),
      service({ isPackage: true, packageUnit: "sessions", packageCount: 10 }),
    ];
    const result = getSessionPackages(services);
    expect(result).toHaveLength(2);
    expect(result[0].packageCount).toBe(6);
    expect(result[1].packageCount).toBe(10);
  });

  it("returns empty array when no packages", () => {
    const services = [service({ isPackage: false })];
    expect(getSessionPackages(services)).toHaveLength(0);
  });
});

describe("resolvePackageForAppointment", () => {
  const packages = [
    service({ serviceId: "PKG-001", name: "6-Session Package", isPackage: true, packageUnit: "sessions", packageCount: 6 }),
    service({ serviceId: "PKG-002", name: "10-Session Package", isPackage: true, packageUnit: "sessions", packageCount: 10 }),
  ];

  it("resolves by packageServiceId", () => {
    const apt = appointment({ packageServiceId: "PKG-001" });
    const result = resolvePackageForAppointment(apt, packages);
    expect(result?.serviceId).toBe("PKG-001");
  });

  it("resolves by service name when no packageServiceId", () => {
    const apt = appointment({ service: "10-Session Package" });
    const result = resolvePackageForAppointment(apt, packages);
    expect(result?.serviceId).toBe("PKG-002");
  });

  it("returns null when no match", () => {
    const apt = appointment({ service: "Non-existent" });
    expect(resolvePackageForAppointment(apt, packages)).toBeNull();
  });
});

describe("getPackageProgressForAppointment", () => {
  const packages = [
    service({ serviceId: "PKG-001", name: "6-Session Package", isPackage: true, packageUnit: "sessions", packageCount: 6 }),
  ];

  it("returns null for single sessions", () => {
    const apt = appointment({ service: "Single Visit" });
    expect(getPackageProgressForAppointment(apt, [], packages)).toBeNull();
  });

  it("returns progress for package appointment", () => {
    const apt = appointment({
      packageServiceId: "PKG-001",
      sessionsCompleted: 2,
      status: "ongoing",
    });
    const result = getPackageProgressForAppointment(apt, [], packages);
    expect(result).not.toBeNull();
    expect(result?.total).toBe(6);
    expect(result?.completed).toBe(2);
    expect(result?.currentSession).toBe(3);
    expect(result?.label).toBe("2 of 6 completed");
    expect(result?.packageDone).toBe(false);
  });

  it("marks package as done when all sessions completed", () => {
    const apt = appointment({
      packageServiceId: "PKG-001",
      sessionsCompleted: 6,
      status: "completed",
    });
    const result = getPackageProgressForAppointment(apt, [], packages);
    expect(result?.packageDone).toBe(true);
    expect(result?.currentLabel).toBe("Package complete");
  });
});

describe("dedupePackageAppointments", () => {
  it("keeps non-package appointments", () => {
    const apts = [
      appointment({ _id: "1", phonenumber: 123 }),
      appointment({ _id: "2", phonenumber: 456, packageServiceId: "PKG-001" }),
    ];
    const result = dedupePackageAppointments(apts);
    expect(result).toHaveLength(2);
  });

  it("deduplicates package appointments by phone+package", () => {
    const apts = [
      appointment({ _id: "1", phonenumber: 123, packageServiceId: "PKG-001", sessionsCompleted: 1 }),
      appointment({ _id: "2", phonenumber: 123, packageServiceId: "PKG-001", sessionsCompleted: 3 }),
    ];
    const result = dedupePackageAppointments(apts);
    expect(result).toHaveLength(1);
    expect(result[0].sessionsCompleted).toBe(3); // keeps the one with more progress
  });
});

describe("countConfirmedAddons", () => {
  it("counts confirmed addons", () => {
    const apt = appointment({
      recommendedServices: [
        { serviceId: "S1", serviceName: "A", quotedPrice: 100, status: "confirmed", recommendedAt: "2026-01-01" },
        { serviceId: "S2", serviceName: "B", quotedPrice: 200, status: "pending", recommendedAt: "2026-01-01" },
      ],
    });
    expect(countConfirmedAddons(apt)).toBe(1);
  });

  it("returns 0 when no addons", () => {
    const apt = appointment({});
    expect(countConfirmedAddons(apt)).toBe(0);
  });
});

describe("countPendingAddons", () => {
  it("counts pending addons", () => {
    const apt = appointment({
      recommendedServices: [
        { serviceId: "S1", serviceName: "A", quotedPrice: 100, status: "confirmed", recommendedAt: "2026-01-01" },
        { serviceId: "S2", serviceName: "B", quotedPrice: 200, status: "pending", recommendedAt: "2026-01-01" },
      ],
    });
    expect(countPendingAddons(apt)).toBe(1);
  });
});

describe("getConfirmedAddonNames", () => {
  it("returns names of confirmed addons", () => {
    const apt = appointment({
      recommendedServices: [
        { serviceId: "S1", serviceName: "Massage", quotedPrice: 100, status: "confirmed", recommendedAt: "2026-01-01" },
        { serviceId: "S2", serviceName: "Acupuncture", quotedPrice: 200, status: "pending", recommendedAt: "2026-01-01" },
      ],
    });
    expect(getConfirmedAddonNames(apt)).toEqual(["Massage"]);
  });
});

describe("visitStatusLabel", () => {
  it("returns correct labels", () => {
    expect(visitStatusLabel("scheduled")).toBe("Scheduled");
    expect(visitStatusLabel("ongoing")).toBe("In progress");
    expect(visitStatusLabel("completed")).toBe("Completed");
    expect(visitStatusLabel("cancelled")).toBe("Cancelled");
    expect(visitStatusLabel("unknown")).toBe("Unknown");
    expect(visitStatusLabel(undefined)).toBe("Unknown");
  });
});

describe("a course with a visit per session (ENQ-0112)", () => {
  const base = { name: "C", phonenumber: 9000000000, bookingKind: "course", totalSessions: 3 } as const;

  it("the booking itself is session 1, even after the old counter moved on", () => {
    const origin = { ...base, _id: "o", sessionIntervalDays: 7, sessionsCompleted: 1, sessionNumber: 2, status: "scheduled" } as never;
    const p = getPackageProgressForAppointment(origin, [], []);
    expect(p).toMatchObject({ currentSession: 1, total: 3, split: true, packageDone: false });
  });

  it("a follow-up is its own session, and done once completed", () => {
    const s2 = { ...base, _id: "s2", packageOriginId: "o", sessionNumber: 2, status: "completed" } as never;
    expect(getPackageProgressForAppointment(s2, [], [])).toMatchObject({ currentSession: 2, completed: 1, split: true });
  });
});
