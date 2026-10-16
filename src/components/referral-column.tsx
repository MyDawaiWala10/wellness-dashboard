"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useGetAllTherapist } from "@/data/therapist/therapist";
import type { EnquiryType, TherapistformType } from "@/type/schema";

/**
 * The referral code a booking came in through, with the therapist's name and ID
 * on hover. Super Admin only (client rule): the backend sends every code only to
 * the Super Admin (a therapist gets just their own), and tables add this column
 * only for the Super Admin.
 */
function ReferralCell({ record }: { record: EnquiryType }) {
  const { data: therapists = [] } = useGetAllTherapist();
  const id = record.source === "therapist" ? record.referredByDoctorId : null;
  if (!id) return <span className="text-muted-foreground/40">-</span>;
  const therapist = (therapists as TherapistformType[]).find((t) => t.doctorId === id);
  return (
    <span
      title={`${record.referredByName ?? therapist?.name ?? "Therapist"} · ${id}`}
      className="cursor-help font-mono text-xs font-semibold"
    >
      {therapist?.referralCode ?? id}
    </span>
  );
}

export const referralColumn: ColumnDef<EnquiryType> = {
  id: "referral",
  header: "Referral",
  cell: ({ row }) => <ReferralCell record={row.original} />,
};
