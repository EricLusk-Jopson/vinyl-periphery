import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SearchStage } from "@/api/types";

interface ProgressButtonProps {
  stage: SearchStage | null;
  isSearching: boolean;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
}

const AnimatedEllipsis = () => {
  const [dots, setDots] = useState("");

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => {
        switch (prev) {
          case "":
            return ".";
          case ".":
            return "..";
          case "..":
            return "...";
          default:
            return "";
        }
      });
    }, 250); // Complete cycle every second (4 states * 250ms)

    return () => clearInterval(interval);
  }, []);

  return <span className="inline-block w-6">{dots}</span>;
};

const ProgressButton: React.FC<ProgressButtonProps> = ({
  stage,
  isSearching,
  disabled,
  onClick,
  className,
}) => {
  const getProgressText = () => {
    if (!stage) return "Search";
    return `${stage.label}${
      stage.total > 0 ? ` (${stage.current}/${stage.total})` : ""
    }`;
  };

  const getProgress = () => {
    if (!stage || stage.total === 0) return 0;
    return (stage.current / stage.total) * 100;
  };

  return (
    <div className="relative w-full">
      <Button
        type="submit"
        disabled={disabled || isSearching}
        onClick={onClick}
        className={cn(
          "w-full p-md font-primary text-lg tracking-normal z-20",
          "bg-primary-main hover:bg-primary-main text-text-primary",
          "transition-colors duration-200",
          "disabled:opacity-90 disabled:cursor-not-allowed disabled:bg-bg-tertiary disabled:text-text-disabled",
          isSearching && "bg-text-disabled cursor-wait",
          className
        )}
      >
        <span className="relative z-10">
          {getProgressText()}
          {isSearching && <AnimatedEllipsis />}
        </span>
      </Button>
      {isSearching && (
        <div
          className="absolute left-0 bottom-0 h-1 bg-primary-main transition-all duration-300 ease-in-out"
          style={{ width: `${getProgress()}%` }}
        />
      )}
    </div>
  );
};

export default ProgressButton;
