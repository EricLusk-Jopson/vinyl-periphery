import { useState, useRef, useEffect } from "react";
import { TooltipContainer, TooltipContent } from "./styles";
import { TooltipPosition } from "./types";
import { theme } from "../../../styles/theme";

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  position?: TooltipPosition;
  maxWidth?: string;
  maxHeight?: string;
}

interface PositionOffset {
  position: TooltipPosition;
  offset: number;
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  position = "top",
  maxWidth,
  maxHeight,
}) => {
  const [positionData, setPositionData] = useState<PositionOffset>({
    position,
    offset: -50, // Default 50% left offset
  });
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
      let offsetPx = 0; // Start with no offset

      // Check vertical overflow
      if (position === "top" && container.top - content.height < 0) {
        newPosition = "bottom";
      } else if (
        position === "bottom" &&
        container.bottom + content.height > viewport.height
      ) {
        newPosition = "top";
      }

      // Handle horizontal overflow for top/bottom positions
      if (["top", "bottom"].includes(newPosition)) {
        const buffer = parseInt(theme.spacing.lg); // Get buffer from theme
        const contentHalfWidth = content.width / 2;
        const containerCenterX = container.left + container.width / 2;

        // Check if tooltip would overflow right
        if (containerCenterX + contentHalfWidth > viewport.width) {
          // Just move it in by the overflow amount plus buffer
          offsetPx =
            viewport.width - (containerCenterX + contentHalfWidth) - buffer;
        }
        // Check if tooltip would overflow left
        else if (containerCenterX - contentHalfWidth < 0) {
          // Just move it out by the overflow amount plus buffer
          offsetPx = contentHalfWidth - containerCenterX + buffer;
        }
      }

      setPositionData({
        position: newPosition,
        offset: offsetPx,
      });
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
        $position={positionData.position}
        $offsetPx={positionData.offset}
        $maxWidth={maxWidth}
        $maxHeight={maxHeight}
      >
        {content}
      </TooltipContent>
    </TooltipContainer>
  );
};
