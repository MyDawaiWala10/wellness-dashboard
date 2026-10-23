"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Loader2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BRAND, UPI, upiLink } from "@/lib/brand";
import { formatINR } from "@/components/pages/services/services-columns";

/**
 * Uber-style "show the QR" sheet for collecting a payment at the door: the
 * customer scans it with any UPI app and pays the company directly. The amount
 * and payee are baked into the code, so nothing here can be typed or changed -
 * the therapist just shows the screen. Same payee as the customer /pay page.
 */
export function PaymentQrDialog({
  open,
  onOpenChange,
  amount,
  reference,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Rupees to collect. Baked into the QR so the customer can't alter it. */
  amount: number;
  /** Booking reference shown in the UPI note (e.g. ENQ-0124). */
  reference?: string;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState(false);

  const hasAmount = amount > 0;
  const link = hasAmount ? upiLink(amount, reference ?? "") : null;

  useEffect(() => {
    let alive = true;
    setSrc(null);
    setError(false);
    if (!link) return;
    QRCode.toDataURL(link, {
      margin: 1,
      color: { dark: "#0f3057", light: "#ffffff" },
    })
      .then((url) => alive && setSrc(url))
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, [link]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xs">
        <DialogHeader>
          <DialogTitle>Scan to pay {BRAND.name}</DialogTitle>
          <DialogDescription>
            Ask the customer to open any UPI app and scan this. The amount is
            already in the code.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-3 py-1">
          <p className="text-2xl font-bold tabular-nums">{formatINR(amount)}</p>

          <div className="grid h-52 w-52 place-items-center rounded-lg border bg-white p-2">
            {!hasAmount ? (
              <p className="px-3 text-center text-[12px] text-muted-foreground">
                Nothing to collect right now.
              </p>
            ) : !link ? (
              <p className="px-3 text-center text-[12px] text-muted-foreground">
                UPI isn&rsquo;t configured, so there&rsquo;s no QR to show.
              </p>
            ) : error ? (
              <p className="px-3 text-center text-[12px] text-muted-foreground">
                Couldn&rsquo;t load the QR. Use the payment link instead.
              </p>
            ) : src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={src} alt="UPI payment QR" className="h-full w-full" />
            ) : (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            )}
          </div>

          <div className="w-full rounded-md bg-muted px-3 py-2 text-center">
            <p className="text-[11px] text-muted-foreground">Paying to</p>
            <p className="text-[13px] font-semibold">{UPI.payeeName}</p>
            <p className="font-mono text-[12px] text-muted-foreground">
              {UPI.vpa || "no UPI set"}
            </p>
          </div>

          {link && (
            <a
              href={link}
              className="text-[12px] font-medium text-primary underline underline-offset-2"
            >
              Or tap to pay on this phone
            </a>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
