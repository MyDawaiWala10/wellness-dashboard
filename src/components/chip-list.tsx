"use client";

import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/**
 * A list shown as a few chips plus "+N more", so one long list doesn't make
 * its table row many lines tall. "+N more" opens the full list (a tap works on
 * phones, unlike a hover tooltip). Clicks stay inside, so they don't also open
 * the row's drawer.
 */
export function ChipList({ items, max = 2 }: { items?: string[] | null; max?: number }) {
  const list = (items ?? []).filter(Boolean);
  if (list.length === 0) return <span className="text-muted-foreground">-</span>;
  const rest = list.length - max;

  return (
    <div className="flex items-center gap-1">
      {list.slice(0, max).map((item) => (
        <Badge key={item} variant="secondary" className="font-normal">
          {item}
        </Badge>
      ))}
      {rest > 0 && (
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              onClick={(e) => e.stopPropagation()}
              className="shrink-0 rounded px-1 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              +{rest} more
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto max-w-xs" onClick={(e) => e.stopPropagation()}>
            <ul className="space-y-1 text-sm">
              {list.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
