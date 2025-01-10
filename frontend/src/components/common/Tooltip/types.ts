export type TooltipPosition = "top" | "right" | "bottom" | "left";

export interface TooltipStyleProps {
  $position: TooltipPosition;
  $maxWidth?: string;
  $maxHeight?: string;
}
