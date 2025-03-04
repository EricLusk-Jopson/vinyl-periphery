import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes, forwardRef } from "react";

interface FilterButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  isActive?: boolean;
}

export const FilterButton = forwardRef<HTMLButtonElement, FilterButtonProps>(
  ({ className, isActive, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center px-xs py-xs",
          "font-secondary text-xs text-text-primary",
          "border border-primary-main",
          "transition-all duration-200",
          "whitespace-nowrap overflow-hidden text-ellipsis",
          "max-w-full",
          isActive ? "bg-primary-main" : "bg-bg-primary",
          "hover:bg-primary-main disabled:hover:bg-bg-primary",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          "disabled:border-text-disabled",
          className
        )}
        disabled={disabled}
        {...props}
      >
        {children}
      </button>
    );
  }
);

FilterButton.displayName = "FilterButton";
