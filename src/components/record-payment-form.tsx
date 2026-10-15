import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRecordPayment } from "@/data/appointment/appointment";
import { formatINR } from "@/components/pages/services/services-columns";

const METHODS = ["cash", "upi", "card", "bank", "other"] as const;

/**
 * Record money received against a booking: any amount up to what's due, part
 * or full. Each payment adds to the total and is kept on the booking; nothing
 * here can change the price or undo a payment. Used by the enquiry drawer,
 * Billing, and the therapist's Visit tab (money collected at the door).
 */
export function RecordPaymentForm({
  appointmentId,
  due,
  suggested = due,
  onRecorded,
}: {
  appointmentId: string;
  /** Most that can be recorded right now. */
  due: number;
  /** Pre-filled amount (defaults to the whole balance). */
  suggested?: number;
  onRecorded?: () => void;
}) {
  const [amount, setAmount] = useState(String(suggested > 0 ? suggested : ""));
  const [method, setMethod] = useState("");
  const { mutate, isPending } = useRecordPayment();

  const value = Number(amount);
  const valid = value > 0 && value <= due && !!method;

  if (due <= 0) return null;

  return (
    <div className="space-y-1.5">
      <div className="flex gap-1.5">
        <Input
          type="number"
          min={1}
          max={due}
          className="h-8"
          aria-label="Amount received"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <Select value={method} onValueChange={setMethod}>
          <SelectTrigger className="h-8 w-28 shrink-0">
            <SelectValue placeholder="Method" />
          </SelectTrigger>
          <SelectContent>
            {METHODS.map((m) => (
              <SelectItem key={m} value={m} className="capitalize">
                {m === "upi" ? "UPI" : m[0].toUpperCase() + m.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          size="sm"
          className="h-8 shrink-0"
          disabled={!valid || isPending}
          onClick={() =>
            mutate(
              { appointmentId, amount: value, method },
              { onSuccess: () => onRecorded?.() },
            )
          }
        >
          {isPending ? "Saving..." : "Record payment"}
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Up to {formatINR(due)} can be recorded. A recorded payment can&apos;t be undone.
      </p>
    </div>
  );
}
