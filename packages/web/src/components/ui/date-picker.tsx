import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type Props = {
  value: Date | null;
  onChange: (value: Date | null) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
};

export function DatePicker({
  value,
  onChange,
  disabled,
  placeholder = "Kies een datum",
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <Button
          aria-haspopup="dialog"
          className={cn(
            "h-10 w-full justify-start font-normal hover:border-muted-foreground/50",
            !value && "text-muted-foreground",
            className
          )}
          disabled={disabled}
          type="button"
          variant="outline"
        >
          <CalendarIcon aria-hidden="true" className="mr-2 size-4" />
          {value ? format(value, "d MMMM yyyy", { locale: nl }) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0">
        <Calendar
          autoFocus
          onSelect={(d) => {
            onChange(d ?? null);
            setOpen(false);
          }}
          selected={value ?? undefined}
        />
      </PopoverContent>
    </Popover>
  );
}
