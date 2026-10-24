import { useEffect, useRef, useState } from "react";
import { SearchStage } from "@/api/types";
import { stageFraction } from "@/lib/searchProgress";

/** How long each step of the bar takes. */
export const BAR_MS = 600;

export interface StageBar {
  /** 0 to 1. */
  value: number;
  /** False for the instant reset between stages. */
  animate: boolean;
}

/**
 * Drives a per-stage progress bar. It steps to each update; when the stage
 * changes it fills to the end, empties without animating, then steps on from
 * there for the new stage.
 */
export const useStageBar = (stage: SearchStage | null): StageBar => {
  const target = stageFraction(stage);
  const stageId = stage?.id;
  const [bar, setBar] = useState<StageBar>({ value: 0, animate: true });
  const prevStageRef = useRef(stageId);

  useEffect(() => {
    const prev = prevStageRef.current;
    prevStageRef.current = stageId;
    const frames: number[] = [];
    // Two frames, so the instant reset paints before animation resumes.
    const nextPaint = (fn: () => void) =>
      frames.push(
        requestAnimationFrame(() => frames.push(requestAnimationFrame(fn))),
      );

    let timer: ReturnType<typeof setTimeout> | undefined;
    if (prev && stageId && prev !== stageId) {
      setBar({ value: 1, animate: true });
      timer = setTimeout(() => {
        setBar({ value: 0, animate: false });
        nextPaint(() => setBar({ value: target, animate: true }));
      }, BAR_MS);
    } else {
      nextPaint(() => setBar({ value: target, animate: true }));
    }

    return () => {
      clearTimeout(timer);
      frames.forEach(cancelAnimationFrame);
    };
  }, [stageId, target]);

  return bar;
};
