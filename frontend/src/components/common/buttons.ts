import { cn } from "@/lib/utils";

/** Shared button classes for dialogs, drawers and library cards. */

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

export const dialogButton = {
  primary: cn(
    "inline-flex h-11 items-center justify-center rounded-lg bg-primary px-4 font-semibold text-primary-foreground hover:bg-primary-dark disabled:opacity-60",
    focusRing,
  ),
  secondary: cn(
    "inline-flex h-11 items-center justify-center rounded-lg border border-border-strong px-4 font-medium text-foreground hover:bg-secondary disabled:opacity-60",
    focusRing,
  ),
};

/** A 44px square icon button. */
export const iconButton = cn(
  "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-secondary disabled:opacity-60",
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring",
);
