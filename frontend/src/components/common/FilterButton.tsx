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
          "font-secondary text-ms text-text-primary",
          "border border-primary-main",
          "transition-all duration-200",
          "whitespace-nowrap overflow-hidden text-ellipsis",
          "max-w-full",
          isActive ? "bg-primary-main" : "bg-bg-primary",
          "disabled:hover:bg-bg-primary",
          isActive ? "hover:bg-primary-light" : "hover:bg-primary-dark",
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
