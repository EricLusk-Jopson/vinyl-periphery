import { SearchStage } from "@/api/types";

export type StageId = SearchStage["id"];
export type StageStatus = "done" | "active" | "pending";

export const STAGE_ORDER: StageId[] = ["initial", "contributors", "releases"];

export const STAGE_TITLES: Record<StageId, string> = {
  initial: "Finding the album",
  contributors: "Reading the credits",
  releases: "Compiling the discographies",
};

/** Title of the stage under way. */
export const currentStageTitle = (stage: SearchStage | null): string =>
  STAGE_TITLES[stage?.id ?? "initial"];

/** Where a stage stands relative to the one running now. */
export const stageStatus = (
  id: StageId,
  activeId: StageId | null,
): StageStatus => {
  if (!activeId) return id === "initial" ? "active" : "pending";
  const diff = STAGE_ORDER.indexOf(id) - STAGE_ORDER.indexOf(activeId);
  if (diff < 0) return "done";
  return diff === 0 ? "active" : "pending";
};

/** Share of the whole search each stage covers, in order. */
const STAGE_SPAN: Record<StageId, [start: number, end: number]> = {
  initial: [0, 0.05],
  contributors: [0.05, 0.25],
  releases: [0.25, 1],
};

/**
 * Progress through the whole search, 0 to 1, counting the call under way as
 * done: the bar glides towards this while the call runs. It only moves
 * forward, since stages run in order and `current` only rises.
 */
export const overallProgress = (stage: SearchStage | null): number => {
  if (!stage) return 0;
  const [start, end] = STAGE_SPAN[stage.id];
  if (stage.id === "initial" || stage.total <= 0) return end;
  const share = Math.min(1, Math.max(0, stage.current / stage.total));
  return start + (end - start) * share;
};

/**
 * Seconds left, from the calls still to make times the pause after each.
 * Only the discography stage has a known number of calls (one per
 * contributor); the earlier stages fetch band members on the fly.
 * `current` is the call under way, so it still counts as remaining.
 */
export const secondsLeft = (
  stage: SearchStage | null,
  delayMs: number,
): number | null => {
  if (!stage || stage.id !== "releases" || stage.total <= 0) return null;
  const remaining = Math.max(0, stage.total - stage.current + 1);
  return (remaining * delayMs) / 1000;
};

export const formatTimeLeft = (seconds: number): string => {
  if (seconds < 60) return "under a minute left";
  return `about ${Math.round(seconds / 60)} min left`;
};

/** "21 of 48 · about 1 min left", "2 of 5", or "" before counts exist. */
export const progressDetail = (
  stage: SearchStage | null,
  delayMs: number,
): string => {
  if (!stage || stage.id === "initial" || stage.total <= 0) return "";
  const count = `${stage.current} of ${stage.total}`;
  const seconds = secondsLeft(stage, delayMs);
  return seconds === null ? count : `${count} · ${formatTimeLeft(seconds)}`;
};

export const plural = (n: number, one: string, many = `${one}s`) =>
  `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;
