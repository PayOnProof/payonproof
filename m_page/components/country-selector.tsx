"use client";

import { COUNTRIES } from "@/lib/mock-data";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const FLAG_MAP: Record<string, string> = {
  US: "\u{1F1FA}\u{1F1F8}",
  MX: "\u{1F1F2}\u{1F1FD}",
  CO: "\u{1F1E8}\u{1F1F4}",
  AR: "\u{1F1E6}\u{1F1F7}",
  BR: "\u{1F1E7}\u{1F1F7}",
  CL: "\u{1F1E8}\u{1F1F1}",
  PE: "\u{1F1F5}\u{1F1EA}",
  NG: "\u{1F1F3}\u{1F1EC}",
  PH: "\u{1F1F5}\u{1F1ED}",
  IN: "\u{1F1EE}\u{1F1F3}",
};

interface CountrySelectorProps {
  value: string;
  onValueChange: (value: string) => void;
  label: string;
  exclude?: string;
}

export function CountrySelector({
  value,
  onValueChange,
  label,
  exclude,
}: CountrySelectorProps) {
  const filtered = COUNTRIES.filter((c) => c.code !== exclude);
  const selected = COUNTRIES.find((c) => c.code === value);

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="h-14 rounded-xl border-border bg-muted/50 px-4 text-foreground transition-colors hover:bg-muted focus:ring-primary">
          <SelectValue placeholder="Select country">
            {selected && (
              <span className="flex items-center gap-3">
                <span className="text-xl" aria-hidden="true">
                  {FLAG_MAP[selected.code] || ""}
                </span>
                <span className="flex flex-col items-start">
                  <span className="text-sm font-medium">{selected.name}</span>
                  <span className="text-xs text-muted-foreground">{selected.currency}</span>
                </span>
              </span>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="border-border bg-card">
          {filtered.map((country) => (
            <SelectItem
              key={country.code}
              value={country.code}
              className="rounded-lg py-2.5 focus:bg-primary/10 focus:text-foreground"
            >
              <span className="flex items-center gap-3">
                <span className="text-lg" aria-hidden="true">
                  {FLAG_MAP[country.code] || ""}
                </span>
                <span className="font-medium">{country.name}</span>
                <span className="text-muted-foreground">({country.currency})</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
