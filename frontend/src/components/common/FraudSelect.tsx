import type { ReactNode } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/common/ui/select";
import { cn } from "@/utils/utils";

export type FraudSelectOption = {
  value: string | number;
  label: ReactNode;
  disabled?: boolean;
  title?: string;
};

type FraudSelectProps = {
  value?: string | number | null;
  onValueChange: (value: string) => void;
  options: FraudSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  ariaLabel?: string;
  triggerClassName?: string;
  contentClassName?: string;
  itemClassName?: string;
};

export function FraudSelect({
  value,
  onValueChange,
  options,
  placeholder = "Select option",
  disabled,
  ariaLabel,
  triggerClassName,
  contentClassName,
  itemClassName,
}: FraudSelectProps) {
  const stringValue = value === "" || value === null || value === undefined ? undefined : String(value);

  return (
    <Select value={stringValue} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger
        aria-label={ariaLabel ?? placeholder}
        className={cn(
          "min-h-10 rounded-[14px] border-primary/20 bg-card/80 shadow-[0_16px_36px_-28px_rgba(34,211,238,0.65),0_1px_0_rgba(255,255,255,0.06)_inset] hover:border-primary/45 hover:bg-card/95 focus:ring-2 focus:ring-primary/30",
          triggerClassName,
        )}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent
        position="popper"
        className={cn(
          "z-[100] w-[var(--radix-select-trigger-width)] rounded-[14px] border-primary/25 bg-card/95 p-1 shadow-[0_28px_80px_-34px_rgba(0,0,0,0.95),0_0_26px_-18px_rgba(34,211,238,0.9)]",
          contentClassName,
        )}
      >
        {options.map((option) => (
          <SelectItem
            key={String(option.value)}
            value={String(option.value)}
            disabled={option.disabled}
            title={option.title}
            className={cn(
              "my-0.5 min-h-10 cursor-pointer rounded-[10px] px-3 py-2.5 text-sm leading-snug text-foreground/90 focus:bg-primary/15 focus:text-primary data-[state=checked]:bg-primary/18 data-[state=checked]:text-primary",
              itemClassName,
            )}
          >
            <span className="block min-w-0 truncate">{option.label}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
