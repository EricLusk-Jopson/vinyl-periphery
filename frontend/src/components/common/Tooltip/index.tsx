import React, { useRef, useEffect, useState } from "react";
import { TooltipContainer, TooltipContent } from "./styles";
import { TooltipPosition } from "./types";

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  position?: TooltipPosition;
  maxWidth?: string;
  maxHeight?: string;
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  position = "top",
  maxWidth,
  maxHeight,
}) => {
  const [tooltipPosition, setTooltipPosition] =
    useState<TooltipPosition>(position);
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updatePosition = () => {
      if (!containerRef.current || !contentRef.current) return;

      const container = containerRef.current.getBoundingClientRect();
      const content = contentRef.current.getBoundingClientRect();
      const viewport = {
        width: window.innerWidth,
        height: window.innerHeight,
      };

      let newPosition = position;

      // Check if tooltip would go off screen in current position
      switch (position) {
        case "top":
          if (container.top - content.height < 0) {
            newPosition = "bottom";
          }
          break;
        case "bottom":
          if (container.bottom + content.height > viewport.height) {
            newPosition = "top";
          }
          break;
        case "left":
          if (container.left - content.width < 0) {
            newPosition = "right";
          }
          break;
        case "right":
          if (container.right + content.width > viewport.width) {
            newPosition = "left";
          }
          break;
      }

      setTooltipPosition(newPosition);
    };

    // Update position on mount and window resize
    updatePosition();
    window.addEventListener("resize", updatePosition);
    return () => window.removeEventListener("resize", updatePosition);
  }, [position]);

  return (
    <TooltipContainer ref={containerRef}>
      {children}
      <TooltipContent
        ref={contentRef}
        $position={tooltipPosition}
        $maxWidth={maxWidth}
        $maxHeight={maxHeight}
      >
        {content}
      </TooltipContent>
    </TooltipContainer>
  );
};
