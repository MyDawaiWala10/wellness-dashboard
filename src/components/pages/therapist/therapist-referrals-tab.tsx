"use client";

import { Loader2, UserPlus } from "lucide-react";
import { BookingIdBadge } from "@/components/booking-id-badge";
import { useGetReferrals } from "@/data/therapist/therapist";

interface TherapistReferralsTabProps {
  doctorId: string;
}

// The code and its link are in the profile header; this tab lists what came in.
export function TherapistReferralsTab({ doctorId }: TherapistReferralsTabProps) {
  const { data: referrals = [], isLoading } = useGetReferrals(doctorId);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Referred bookings
        </h4>
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading...
          </div>
        ) : referrals.length === 0 ? (
          <div className="flex flex-col items-center py-10 text-center text-muted-foreground">
            <UserPlus className="h-6 w-6 mb-2" />
            <p className="text-sm">No bookings through this referral code yet.</p>
          </div>
        ) : (
          <div className="divide-y rounded-md border">
            {referrals.map((r) => (
              <div key={r._id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{r.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.service ?? "-"}
                    {r.createdAt ? ` · ${new Date(r.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <BookingIdBadge record={{ ...r, source: "therapist" }} />
                  <span className="text-xs capitalize text-muted-foreground">{r.status ?? "enquiry"}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
