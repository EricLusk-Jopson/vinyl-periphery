import { useSyncExternalStore } from "react";
import { getLikes, Likes, subscribeLikes } from "@/services/likes";

/** Liked albums by result key, updating when any are liked or unliked. */
export const useLikes = (): Likes =>
  useSyncExternalStore(subscribeLikes, getLikes, getLikes);
