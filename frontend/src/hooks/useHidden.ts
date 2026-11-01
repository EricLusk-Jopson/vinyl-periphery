import { useSyncExternalStore } from "react";
import { getHidden, Hidden, subscribeHidden } from "@/services/hidden";

/** Hidden albums by result key, updating when any are hidden or shown. */
export const useHidden = (): Hidden =>
  useSyncExternalStore(subscribeHidden, getHidden, getHidden);
