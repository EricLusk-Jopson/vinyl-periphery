import { useSyncExternalStore } from "react";
import {
  dismissTip,
  subscribeTips,
  tipDismissed,
  TipId,
} from "@/services/tips";

/** A one-time tip: whether to show it, and Got it. */
export const useTip = (id: TipId): { show: boolean; dismiss: () => void } => {
  const dismissed = useSyncExternalStore(subscribeTips, () => tipDismissed(id));
  return { show: !dismissed, dismiss: () => dismissTip(id) };
};
