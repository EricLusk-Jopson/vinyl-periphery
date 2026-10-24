import { useEffect, useRef, useState } from "react";
import { SearchStage } from "@/api/types";
import { stageFraction, trickleCeiling } from "@/lib/searchProgress";

/** How long the jump to each update takes. */
export const BAR_MS = 600;

/**
 * `jump`: the eased step to an update. `trickle`: the slow creep between
 * updates. `none`: the instant reset between stages.
 */
export type BarMotion = "jump" | "trickle" | "none";

export interface StageBar {
  /** 0 to 1. */
  value: number;
  motion: BarMotion;
  /** Length of the current motion. */
  ms: number;
}

/**
 * Drives a per-stage progress bar. On each update it jumps to the new value,
 * then creeps slowly towards the next one while the request runs (over
 * `itemMs`, the expected time per item). When the stage changes it fills to
 * the end, empties without animating, and carries on for the new stage.
 * A jump starts from wherever the creep has got to.
 */
export const useStageBar = (
  stage: SearchStage | null,
  itemMs: number,
): StageBar => {
  const target = stageFraction(stage);
  const ceiling = trickleCeiling(stage);
  const stageId = stage?.id;
  const [bar, setBar] = useState<StageBar>({
    value: 0,
    motion: "jump",
    ms: BAR_MS,
  });
  const prevStageRef = useRef(stageId);

  useEffect(() => {
    const prev = prevStageRef.current;
    prevStageRef.current = stageId;
    const frames: number[] = [];
    const timers: ReturnType<typeof setTimeout>[] = [];
    // Two frames, so an instant reset paints before motion resumes.
    const nextPaint = (fn: () => void) =>
      frames.push(
        requestAnimationFrame(() => frames.push(requestAnimationFrame(fn))),
      );
    const jumpThenTrickle = () => {
      setBar({ value: target, motion: "jump", ms: BAR_MS });
      timers.push(
        setTimeout(() => {
          if (ceiling > target) {
            // The jump took part of the item's time already.
            const ms = Math.max(BAR_MS, itemMs - BAR_MS);
            setBar({ value: ceiling, motion: "trickle", ms });
          }
        }, BAR_MS),
      );
    };

    if (prev && stageId && prev !== stageId) {
      setBar({ value: 1, motion: "jump", ms: BAR_MS });
      timers.push(
        setTimeout(() => {
          setBar({ value: 0, motion: "none", ms: 0 });
          nextPaint(jumpThenTrickle);
        }, BAR_MS),
      );
    } else {
      nextPaint(jumpThenTrickle);
    }

    return () => {
      timers.forEach(clearTimeout);
      frames.forEach(cancelAnimationFrame);
    };
  }, [stageId, target, ceiling, itemMs]);

  return bar;
};
