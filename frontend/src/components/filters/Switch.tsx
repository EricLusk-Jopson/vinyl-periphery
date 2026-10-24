import React from "react";
import { cn } from "@/lib/utils";

interface SwitchProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

/** A labelled on/off switch, as a 48px row. */
export const Switch: React.FC<SwitchProps> = ({ label, checked, onChange }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={() => onChange(!checked)}
    className="flex min-h-12 w-full items-center justify-between gap-3 border-b text-left text-[15px] text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring lg:min-h-11 lg:border-0"
  >
    <span>{label}</span>
    <span
      aria-hidden="true"
      className={cn(
        "flex h-6 w-10 shrink-0 items-center rounded-full p-0.5 transition-colors duration-150",
        checked ? "bg-primary" : "bg-border-strong",
      )}
    >
      {/* The knob's position, not just the colour, shows the state. */}
      <span
        className={cn(
          "h-5 w-5 rounded-full bg-primary-foreground transition-transform duration-150",
          checked && "translate-x-4",
        )}
      />
    </span>
  </button>
);
