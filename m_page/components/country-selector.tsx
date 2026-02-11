"use client";

import { useMemo } from "react";
import { COUNTRIES } from "@/lib/mock-data";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const FLAG_MAP: Record<string, string> = {
  US: "\u{1F1FA}\u{1F1F8}",
  CA: "\u{1F1E8}\u{1F1E6}",
  MX: "\u{1F1F2}\u{1F1FD}",
  CR: "\u{1F1E8}\u{1F1F7}",
  PA: "\u{1F1F5}\u{1F1E6}",
  CO: "\u{1F1E8}\u{1F1F4}",
  AR: "\u{1F1E6}\u{1F1F7}",
  BR: "\u{1F1E7}\u{1F1F7}",
  CL: "\u{1F1E8}\u{1F1F1}",
  PE: "\u{1F1F5}\u{1F1EA}",
  EC: "\u{1F1EA}\u{1F1E8}",
  BO: "\u{1F1E7}\u{1F1F4}",
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
  const filtered = useMemo(
    () => COUNTRIES.filter((c) => c.code !== exclude),
    [exclude]
  );

  const grouped = useMemo(() => {
    const map = new Map<string, typeof COUNTRIES>();
    for (const c of filtered) {
      const region = c.region ?? "Other";
      if (!map.has(region)) map.set(region, []);
      map.get(region)!.push(c);
    }
    return map;
  }, [filtered]);

  const selected = COUNTRIES.find((c) => c.code === value);

  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger
          className={cn(
            "h-16 rounded-xl border-border bg-muted/40 px-4 text-foreground",
            "transition-all duration-200",
            "hover:bg-muted/60 hover:border-primary/30",
            "focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
          )}
        >
          <SelectValue placeholder="Select country">
            {selected && (
              <span className="flex items-center gap-3">
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-xl"
                  aria-hidden="true"
                >
                  {FLAG_MAP[selected.code] || "\u{1F30E}"}
                </span>
                <span className="flex flex-col items-start">
                  <span className="text-sm font-semibold text-foreground">
                    {selected.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {selected.currency}
                  </span>
                </span>
              </span>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="max-h-[340px] border-border bg-card backdrop-blur-xl">
          {[...grouped.entries()].map(([region, countries]) => (
            <SelectGroup key={region}>
              <SelectLabel className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                {region}
              </SelectLabel>
              {countries.map((country) => (
                <SelectItem
                  key={country.code}
                  value={country.code}
                  className="rounded-lg py-3 focus:bg-primary/10 focus:text-foreground"
                >
                  <span className="flex items-center gap-3">
                    <span className="text-lg" aria-hidden="true">
                      {FLAG_MAP[country.code] || "\u{1F30E}"}
                    </span>
                    <span className="font-medium text-foreground">
                      {country.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      ({country.currency})
                    </span>
                  </span>
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
