export type TooltipPosition = "top" | "right" | "bottom" | "left";

export interface TooltipStyleProps {
  $position: TooltipPosition;
  $offsetPx: number;
  $maxWidth?: string;
  $maxHeight?: string;
}
