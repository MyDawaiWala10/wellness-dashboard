import { format } from "date-fns";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { sendVisitOtp } from "@/actions/appointments/visit-otp";
import { whatsAppLink } from "@/lib/whatsapp";
import { useAuthStore } from "@/providers/permission-provider";
import type { slotBookingZodType } from "@/type/schema";

/** Who may send the session code (the backend allows the same roles). */
export const VISIT_OTP_SENDERS = ["SUPER_ADMIN", "ADMIN", "STAFF"];

/**
 * "Send OTP" for a visit: creates the session code and opens WhatsApp to send
 * it to the customer. One button for the Visit tab and the enquiry drawer, so
 * the office can send it wherever they are. Hidden for roles that can't send.
 */
export function SendVisitOtpButton({
  appointment,
  onSent,
  className,
}: {
  appointment: slotBookingZodType;
  onSent?: () => void;
  className?: string;
}) {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  if (!VISIT_OTP_SENDERS.includes(user?.role ?? "")) return null;

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={className ?? "h-8 shrink-0"}
      onClick={async () => {
        if (!appointment._id) return;
        const r = await sendVisitOtp(appointment._id);
        if (!r.success || !r.code) {
          toast.error(r.message ?? "Could not create a code");
          return;
        }
        onSent?.();
        // Refresh both lists so "Code sent ..." shows wherever it's open.
        for (const key of ["appointments", "enquiries"]) {
          queryClient.invalidateQueries({ queryKey: [key] });
        }
        const link = whatsAppLink(appointment.phonenumber, `Your MDW visit code is ${r.code}`);
        if (link) window.open(link, "_blank");
        else toast.error("Customer number can't be messaged on WhatsApp");
      }}
    >
      Send OTP
    </Button>
  );
}

/** "Code sent 2026-10-15 21:40 by X" (+ " · verified ..." once used). */
export function visitCodeStatus(a: Pick<slotBookingZodType, "visitOtpSentAt" | "visitOtpSentBy" | "visitOtpVerifiedAt">): string {
  if (!a.visitOtpSentAt) return "";
  const at = (d: string) => format(new Date(d), "yyyy-MM-dd HH:mm");
  return (
    `Code sent ${at(a.visitOtpSentAt)}${a.visitOtpSentBy ? ` by ${a.visitOtpSentBy}` : ""}` +
    (a.visitOtpVerifiedAt ? ` · verified ${at(a.visitOtpVerifiedAt)}` : "")
  );
}
