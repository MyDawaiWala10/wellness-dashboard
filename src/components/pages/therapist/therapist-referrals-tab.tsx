"use client";

import { Copy, Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { BookingIdBadge } from "@/components/booking-id-badge";
import { useGetAllTherapist, useGetReferrals } from "@/data/therapist/therapist";
import { useAuthStore } from "@/providers/permission-provider";
import { BRAND } from "@/lib/brand";
import type { TherapistformType } from "@/type/schema";

interface TherapistReferralsTabProps {
  doctorId: string;
}

export function TherapistReferralsTab({ doctorId }: TherapistReferralsTabProps) {
  const { user } = useAuthStore();
  const { data: therapists = [] } = useGetAllTherapist();
  const therapist = (therapists as TherapistformType[]).find((t) => t.doctorId === doctorId);
  const { data: referrals = [], isLoading } = useGetReferrals(doctorId);

  // The code is for admins and the therapist it belongs to; other staff only
  // see which bookings came in through it.
  const isAdmin = user?.role === "SUPER_ADMIN" || user?.role === "ADMIN";
  const isOwn = user?.role === "THERAPIST" && therapist?.userId === user?.id;
  const code = (isAdmin || isOwn) && therapist?.referralCode;
  const link = code ? `https://${BRAND.website}/?ref=${code}` : "";

  async function copy(text: string, what: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${what} copied`);
    } catch {
      toast.error("Couldn't copy - select it and copy by hand");
    }
  }

  return (
    <div className="space-y-4">
      {code && (
        <div className="rounded-md border p-3 space-y-2">
          <p className="text-xs text-muted-foreground">
            Share this link, or read out the code at a visit. Bookings made with it are credited here.
          </p>
          <div className="flex items-center gap-2">
            <span className="font-mono text-lg font-semibold tracking-widest">{code}</span>
            <Button size="sm" variant="outline" onClick={() => copy(code, "Code")}>
              <Copy className="h-3.5 w-3.5" /> Code
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <span className="truncate text-sm text-muted-foreground">{link}</span>
            <Button size="sm" onClick={() => copy(link, "Link")}>
              <Copy className="h-3.5 w-3.5" /> Copy link
            </Button>
          </div>
        </div>
      )}

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
