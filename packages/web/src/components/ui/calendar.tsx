import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { DayPicker } from "react-day-picker";
import { nl } from "react-day-picker/locale";

import { cn } from "@/lib/utils";

type CalendarProps = {
  selected?: Date;
  defaultMonth?: Date;
  onSelect?: (date: Date | undefined) => void;
  showOutsideDays?: boolean;
  disabled?: React.ComponentProps<typeof DayPicker>["disabled"];
  autoFocus?: boolean;
  className?: string;
  classNames?: React.ComponentProps<typeof DayPicker>["classNames"];
  /** Aantal jaren vóór + na het huidige jaar dat in de jaardropdown verschijnt. */
  yearRange?: number;
};

const NL_MONTHS = [
  "januari",
  "februari",
  "maart",
  "april",
  "mei",
  "juni",
  "juli",
  "augustus",
  "september",
  "oktober",
  "november",
  "december",
];

/**
 * Calendar met EIGEN maand+jaar-dropdowns. We laten react-day-picker's
 * caption-dropdowns expliciet links liggen omdat hun rendering in een Radix
 * Popover (portal) niet betrouwbaar klikbaar is bij ons gebruik. Onze eigen
 * <select>-elementen werken altijd, ongeacht z-index/portal-context.
 */
export function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  selected,
  defaultMonth,
  yearRange = 6,
  onSelect,
  ...props
}: CalendarProps) {
  const initialMonth =
    (selected instanceof Date ? selected : undefined) ??
    defaultMonth ??
    new Date();
  const [month, setMonth] = useState<Date>(initialMonth);

  const years = useMemo(() => {
    const current = new Date().getFullYear();
    const start = current - yearRange;
    const end = current + yearRange;
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }, [yearRange]);

  const setMonthIndex = (newMonth: number) => {
    const next = new Date(month);
    next.setMonth(newMonth);
    setMonth(next);
  };
  const setYear = (newYear: number) => {
    const next = new Date(month);
    next.setFullYear(newYear);
    setMonth(next);
  };
  const stepMonth = (delta: number) => {
    const next = new Date(month);
    next.setMonth(next.getMonth() + delta);
    setMonth(next);
  };

  return (
    <div className={cn("p-3", className)}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <button
          aria-label="Vorige maand"
          className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => stepMonth(-1)}
          type="button"
        >
          <ChevronLeftIcon aria-hidden="true" className="size-4" />
        </button>
        <div className="flex flex-1 items-center justify-center gap-1.5">
          <select
            aria-label="Maand"
            className="h-8 rounded-md border border-input bg-background px-2 text-sm shadow-sm transition-colors hover:border-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring"
            onChange={(e) => setMonthIndex(Number(e.target.value))}
            value={month.getMonth()}
          >
            {NL_MONTHS.map((label, i) => (
              <option key={label} value={i}>
                {label}
              </option>
            ))}
          </select>
          <select
            aria-label="Jaar"
            className="h-8 rounded-md border border-input bg-background px-2 text-sm shadow-sm transition-colors hover:border-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring"
            onChange={(e) => setYear(Number(e.target.value))}
            value={month.getFullYear()}
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <button
          aria-label="Volgende maand"
          className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => stepMonth(1)}
          type="button"
        >
          <ChevronRightIcon aria-hidden="true" className="size-4" />
        </button>
      </div>
      <DayPicker
        classNames={{
          day: "p-0 align-middle",
          day_button:
            "inline-flex size-9 items-center justify-center rounded-md text-sm font-normal transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          month: "flex flex-col gap-2",
          month_caption: "hidden",
          month_grid: "w-full border-collapse",
          months: "flex flex-col gap-2",
          nav: "hidden",
          outside: "text-muted-foreground/40",
          selected:
            "[&_button]:bg-primary [&_button]:text-primary-foreground [&_button]:hover:bg-primary [&_button]:hover:text-primary-foreground",
          today: "[&_button]:bg-accent/30 [&_button]:font-medium",
          week: "mt-1 flex w-full",
          weekday:
            "w-9 text-center font-normal text-muted-foreground text-xs uppercase",
          weekdays: "flex",
          ...classNames,
        }}
        hideNavigation
        locale={nl}
        mode="single"
        month={month}
        onMonthChange={setMonth}
        onSelect={onSelect as (d: Date | undefined) => void}
        selected={selected as Date | undefined}
        showOutsideDays={showOutsideDays}
        {...props}
      />
    </div>
  );
}
