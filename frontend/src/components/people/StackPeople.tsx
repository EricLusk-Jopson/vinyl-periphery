import React, { useMemo } from "react";
import { StackFilters } from "@/hooks/useStackFilters";
import { trackStackFilter, track } from "@/lib/analytics";
import { MetaAlbum } from "@/lib/metaAlbum";
import {
  countedByAlbum,
  requireInStack,
  StackResult,
} from "@/lib/stackFilters";
import { stackSwimlanes } from "@/lib/swimlanes";
import { Swimlanes } from "./Swimlanes";

/**
 * A stack's People tab: everyone counted on any of its albums, by year,
 * with a line per stack album (the start's in the accent).
 */
export const StackPeople: React.FC<{
  meta: MetaAlbum;
  stackFilters: StackFilters;
  /** The Results tab's filtered results. */
  results: StackResult[];
  startKey: string;
  onResult: (key: string) => void;
}> = ({ meta, stackFilters, results, startKey, onResult }) => {
  const { filters, update } = stackFilters;
  const lanes = useMemo(
    () =>
      stackSwimlanes(meta, countedByAlbum(meta, filters), results, startKey),
    [meta, filters, results, startKey],
  );
  const describe = useMemo(() => {
    const byKey = new Map(results.map((r) => [r.key, r]));
    return (key: string) => byKey.get(key);
  }, [results]);
  const required = new Set(filters.required.contributors);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Everyone who counts on the stack's albums, by year. Solid marks are
        albums in the stack's results; a line marks each stack album.
      </p>
      <Swimlanes
        lanes={lanes}
        describe={describe}
        required={(id) => required.has(id)}
        onName={(lane) => {
          const on = !required.has(lane.id);
          trackStackFilter("must_include_contributor", on, {
            source: "swimlanes",
          });
          update(
            requireInStack(
              filters,
              { kind: "contributor", id: lane.id, label: lane.name, detail: "" },
              on,
            ),
          );
        }}
        onResult={(key) => {
          track("swimlane_tick_opened", { scope: "stack" });
          onResult(key);
        }}
      />
    </div>
  );
};
