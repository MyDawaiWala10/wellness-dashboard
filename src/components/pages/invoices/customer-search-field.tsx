"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useSearchCustomers } from "@/data/customer/customer-api";
import type { PersistedCustomer } from "@/type/customer-record";
import { cn } from "@/lib/utils";
import { personAge } from "@/lib/person";

export type CustomerSelection = {
  customer_id?: string;
  customer_name: string;
  customer_phone?: number;
  email?: string;
  address?: string;
  /** From the customer record (birth year / date of birth); unset when unknown. */
  age?: number;
};

interface CustomerSearchFieldProps {
  value: CustomerSelection;
  onChange: (value: CustomerSelection) => void;
  disabled?: boolean;
}

export function CustomerSearchField({
  value,
  onChange,
  disabled,
}: CustomerSearchFieldProps) {
  const [query, setQuery] = useState(value.customer_name);
  const [open, setOpen] = useState(false);
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value.customer_name);
  }, [value.customer_name]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 250);
    return () => clearTimeout(t);
  }, [query]);

  const { data: suggestions = [], isFetching } = useSearchCustomers(
    debouncedQuery,
    open,
  );

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function pickCustomer(c: PersistedCustomer) {
    onChange({
      customer_id: c.customer_id,
      customer_name: c.name,
      customer_phone: c.phone,
      email: c.email ?? "",
      address: c.address ?? "",
      age: personAge(c),
    });
    setQuery(c.name);
    setOpen(false);
  }

  function handleInputChange(next: string) {
    setQuery(next);
    setOpen(true);
    onChange({
      customer_id: undefined,
      customer_name: next,
      customer_phone: value.customer_phone,
      email: value.email,
      address: value.address,
    });
  }

  return (
    <div ref={containerRef} className="space-y-1.5">
      <Label htmlFor="invoice-customer-search">Customer name</Label>
      <div className="relative">
        <Input
          id="invoice-customer-search"
          placeholder="Enter customer name"
          value={query}
          disabled={disabled}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => setOpen(true)}
          autoComplete="off"
        />
        {isFetching && open && (
          <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
        )}

        {open && (
          <div
            className={cn(
              "absolute left-0 right-0 top-full z-50 mt-1 rounded-md border bg-popover shadow-md",
              "max-h-64 overflow-hidden",
            )}
          >
            <Command shouldFilter={false}>
              <CommandList className="max-h-64">
                <CommandEmpty>
                  {query.trim()
                    ? "No matching customers - details will be saved as new."
                    : "Type to search customers…"}
                </CommandEmpty>
                {suggestions.length > 0 && (
                  <CommandGroup heading="Customer suggestions">
                    {suggestions.map((c) => (
                      <CommandItem
                        key={c.customer_id}
                        value={c.customer_id}
                        onSelect={() => pickCustomer(c)}
                        className="cursor-pointer flex flex-col items-start gap-0.5 py-2.5"
                      >
                        <span className="font-medium">{c.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {c.phone}
                          {c.address ? ` · ${c.address}` : ""}
                          {c.customer_id ? ` · ${c.customer_id}` : ""}
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
              </CommandList>
            </Command>
          </div>
        )}
      </div>
    </div>
  );
}
