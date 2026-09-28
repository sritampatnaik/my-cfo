"use client";

import { useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function parseDay(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return undefined;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function formatDay(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function DateField({
  value,
  onChange,
  min,
  max,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = parseDay(value);
  const minDate = min ? parseDay(min) : undefined;
  const maxDate = max ? parseDay(max) : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-40 justify-start font-normal" aria-label={label}>
          <CalendarIcon />
          {selected ? format(selected, "d MMM yyyy") : "Pick a date"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          disabled={[
            ...(minDate ? [{ before: minDate }] : []),
            ...(maxDate ? [{ after: maxDate }] : []),
          ]}
          onSelect={(date) => {
            if (!date) return;
            onChange(formatDay(date));
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

export function MonthField({
  value,
  onChange,
  disabled = false,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  label: string;
}) {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  const selectedYear = match ? Number(match[1]) : new Date().getFullYear();
  const selectedMonth = match ? Number(match[2]) : 0;
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(selectedYear);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setViewYear(selectedYear);
        setOpen(next);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="w-40 justify-start font-normal"
          aria-label={label}
          disabled={disabled}
        >
          <CalendarIcon />
          {match ? `${MONTHS[selectedMonth - 1]} ${selectedYear}` : "Pick a month"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64" align="start">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="icon" aria-label="Previous year" onClick={() => setViewYear((year) => year - 1)}>
            <ChevronLeftIcon />
          </Button>
          <span className="text-sm font-medium">{viewYear}</span>
          <Button variant="ghost" size="icon" aria-label="Next year" onClick={() => setViewYear((year) => year + 1)}>
            <ChevronRightIcon />
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-1">
          {MONTHS.map((name, index) => {
            const month = index + 1;
            const active = viewYear === selectedYear && month === selectedMonth;
            return (
              <Button
                key={name}
                type="button"
                variant={active ? "default" : "ghost"}
                className="font-normal"
                onClick={() => {
                  onChange(`${viewYear}-${String(month).padStart(2, "0")}`);
                  setOpen(false);
                }}
              >
                {name}
              </Button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
