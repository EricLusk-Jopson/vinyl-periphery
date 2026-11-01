import React, { useCallback, useId, useMemo, useState } from "react";
import { MetaAlbum } from "@/lib/metaAlbum";
import { matchesName } from "@/lib/filters";
import {
  defaultStackFilters,
  requireInStack,
  setStates,
  stackAlbumChips,
  StackFilterState,
  stackMustIncludeOptions,
  stackPeopleChips,
  stackRequiredChips,
  stackRoleGroups,
} from "@/lib/stackFilters";
import { track, trackStackFilter } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { Chip } from "../filters/Chip";
import { ContributorDetails, RoleDetails } from "../filters/ChipDetails";
import { FilterGroup } from "../filters/FilterGroup";
import { MustIncludeView } from "../filters/MustInclude";
import { Switch } from "../filters/Switch";
import { SearchCover } from "../search/SearchCover";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring";

const MAX_COVER_DOTS = 4;

interface StackFilterPanelProps {
  meta: MetaAlbum;
  filters: StackFilterState;
  update: (updates: Partial<StackFilterState>) => void;
  replace: (filters: StackFilterState) => void;
  /** "Apply each search's filters": the stack's from its members'. */
  onApplyMembers: () => void;
  /** The sidebar has its own heading and Reset; the frame has them on top. */
  variant: "sidebar" | "frame";
}

/**
 * A stack's filters, in the same panel as one search's: switches, "must
 * include" (albums, people and roles), the stack's albums (each can be
 * switched off), roles by category, then people, each with the covers of the
 * albums they're on.
 */
export const StackFilterPanel: React.FC<StackFilterPanelProps> = ({
  meta,
  filters,
  update,
  replace,
  onApplyMembers,
  variant,
}) => {
  const id = useId();
  const [query, setQuery] = useState("");
  const albums = useMemo(() => stackAlbumChips(meta, filters), [meta, filters]);
  const people = useMemo(
    () => stackPeopleChips(meta, filters),
    [meta, filters],
  );
  const groups = useMemo(() => stackRoleGroups(meta, filters), [meta, filters]);
  const roles = groups.flatMap((g) => g.roles);
  const required = useMemo(
    () => stackRequiredChips(meta, filters),
    [meta, filters],
  );
  const options = useCallback(
    (q: string) => stackMustIncludeOptions(meta, filters, q),
    [meta, filters],
  );
  const covers = useMemo(
    () => new Map(meta.members.map((m) => [m.key, m.search])),
    [meta],
  );
  const titles = useMemo(
    () => new Map(meta.members.map((m) => [m.key, m.title])),
    [meta],
  );

  const shown = people.filter((p) => matchesName(p.name, query));
  const filtering = query.trim() !== "";
  const shownUnlocked = shown.filter((p) => !p.required);
  const rolesUnlocked = roles.filter((r) => !r.required);

  const toggle = (key: keyof StackFilterState, filter: string) => (): void => {
    const on = !filters[key];
    trackStackFilter(filter, on);
    update({ [key]: on });
  };

  return (
    <div className="flex flex-col gap-6 lg:gap-7">
      {variant === "sidebar" && (
        <div className="flex items-baseline justify-between">
          <h2 className="text-[15px] font-semibold">Filters</h2>
          <button
            type="button"
            onClick={() => {
              trackStackFilter("reset", true);
              replace(defaultStackFilters());
            }}
            className={cn(
              "h-8 text-sm font-medium text-muted-foreground underline underline-offset-2 transition-colors hover:text-foreground",
              focusRing,
            )}
          >
            Reset
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={onApplyMembers}
        className={cn(
          "-mt-2 inline-flex min-h-11 items-center self-start rounded-md text-sm font-medium text-muted-foreground underline underline-offset-2 transition-colors hover:text-foreground lg:min-h-8",
          focusRing,
        )}
      >
        Apply each search's filters
      </button>

      <div className="flex flex-col lg:gap-1">
        <Switch
          label="Hide releases by these artists"
          checked={filters.excludeMainArtist}
          onChange={toggle("excludeMainArtist", "hide_main_artist")}
        />
        <Switch
          label="Only albums with 2+ shared contributors"
          checked={filters.collaborationsOnly}
          onChange={toggle("collaborationsOnly", "two_plus_shared")}
        />
        <Switch
          label="Hide Various Artists"
          checked={filters.excludeVarious}
          onChange={toggle("excludeVarious", "hide_various")}
        />
        <Switch
          label="Only liked albums"
          checked={filters.likedOnly}
          onChange={toggle("likedOnly", "liked_only")}
        />
        <Switch
          label="Only albums linking 2+ stack albums"
          checked={filters.linksTwoPlus}
          onChange={toggle("linksTwoPlus", "two_plus_links")}
        />
        <Switch
          label="Show hidden albums"
          checked={filters.showHidden}
          onChange={toggle("showHidden", "show_hidden")}
        />
      </div>

      <MustIncludeView
        chips={required}
        options={options}
        onAdd={(item) => {
          trackStackFilter(`must_include_${item.kind}`, true);
          update(requireInStack(filters, item, true));
        }}
        onRemove={(item) => {
          trackStackFilter(`must_include_${item.kind}`, false);
          update(requireInStack(filters, item, false));
        }}
        copy={{
          thing: "an album, name or role",
          things: "albums, names or roles",
          hint: "Every result will link each album, and feature each person and role, you add here.",
        }}
      />

      <FilterGroup
        title="Albums"
        on={albums.filter((a) => a.included).length}
        total={albums.length}
        canSelect={albums.some((a) => !a.included && !a.required)}
        canDeselect={albums.some((a) => a.included && !a.required)}
        onSelect={() => {
          trackStackFilter("all_albums", true);
          update({ albums: {} });
        }}
        onDeselect={() => {
          trackStackFilter("all_albums", false);
          update({
            albums: setStates(
              filters.albums,
              albums.filter((a) => !a.required).map((a) => a.key),
              false,
            ),
          });
        }}
      >
        <ul className="flex flex-col gap-1.5">
          {albums.map((album) => (
            <li key={album.key} className="flex items-center gap-1">
              <button
                type="button"
                aria-pressed={album.included}
                aria-disabled={album.required || undefined}
                onClick={
                  album.required
                    ? undefined
                    : () => {
                        trackStackFilter("album", !album.included);
                        update({
                          albums: setStates(
                            filters.albums,
                            [album.key],
                            !album.included,
                          ),
                        });
                      }
                }
                className={cn(
                  "flex min-h-11 min-w-0 flex-1 items-center gap-2.5 rounded-md border px-2 py-1.5 text-left transition-colors duration-150",
                  focusRing,
                  album.required
                    ? "cursor-not-allowed border-primary bg-primary text-primary-foreground"
                    : album.included
                      ? "border-border-emphasis bg-secondary text-foreground hover:border-border-strong"
                      : "bg-transparent text-faint hover:text-muted-foreground",
                )}
              >
                <SearchCover
                  search={album.search}
                  className={cn(
                    "h-8 w-8 rounded-[3px] text-xs",
                    !album.included && "opacity-50",
                  )}
                />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span
                    className={cn(
                      "truncate text-sm",
                      !album.included && "line-through",
                    )}
                  >
                    {album.title}
                  </span>
                  <span
                    className={cn(
                      "truncate font-mono text-xs",
                      album.required
                        ? "text-primary-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    {album.artist}
                  </span>
                </span>
                <span
                  className={cn(
                    "shrink-0 font-mono text-xs",
                    album.required ? "text-primary-foreground" : "text-faint",
                  )}
                >
                  {album.count}
                </span>
                <span className="sr-only">
                  {` ${album.count === 1 ? "album" : "albums"}`}
                  {album.required && ", required: change it in Must include"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </FilterGroup>

      <FilterGroup
        title="Roles"
        on={roles.filter((r) => r.included).length}
        total={roles.length}
        canSelect={rolesUnlocked.some((r) => !r.included)}
        canDeselect={rolesUnlocked.some((r) => r.included)}
        onSelect={() => {
          trackStackFilter("all_roles", true);
          update({
            roles: setStates(
              filters.roles,
              rolesUnlocked.map((r) => r.role),
              true,
            ),
          });
        }}
        onDeselect={() => {
          trackStackFilter("all_roles", false);
          update({
            roles: setStates(
              filters.roles,
              rolesUnlocked.map((r) => r.role),
              false,
            ),
          });
        }}
      >
        <div className="flex flex-col gap-3">
          {groups.map((group) => {
            const on = group.roles.filter((r) => r.included).length;
            const unlocked = group.roles.filter((r) => !r.required);
            const next = !unlocked.some((r) => r.included);
            return (
              <div key={group.id} className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs uppercase tracking-[1px] text-faint">
                    {group.label}
                  </span>
                  <span className="font-mono text-xs text-faint">
                    {on}/{group.roles.length}
                  </span>
                  {unlocked.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        trackStackFilter("role_category", next, {
                          category: group.id,
                        });
                        update({
                          roles: setStates(
                            filters.roles,
                            unlocked.map((r) => r.role),
                            next,
                          ),
                        });
                      }}
                      aria-label={`${next ? "Select" : "Deselect"} all ${group.label} roles`}
                      className={cn(
                        "ml-auto h-11 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground lg:h-8",
                        focusRing,
                      )}
                    >
                      {next ? "Select" : "Deselect"}
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {group.roles.map((r) => (
                    <Chip
                      key={r.role}
                      label={r.role}
                      included={r.included}
                      available={r.available}
                      required={r.required}
                      description={r.people.map((p) => p.name).join(", ")}
                      details={<RoleDetails role={r.role} people={r.people} />}
                      onDetails={(via) =>
                        track("chip_details", { kind: "role", via })
                      }
                      unavailableNote="everyone with this role is switched off"
                      onToggle={() => {
                        trackStackFilter("role", !r.included);
                        update({
                          roles: setStates(
                            filters.roles,
                            [r.role],
                            !r.included,
                          ),
                        });
                      }}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </FilterGroup>

      <FilterGroup
        title="People"
        on={people.filter((p) => p.included).length}
        total={people.length}
        scope={filtering ? "matches" : "all"}
        canSelect={shownUnlocked.some((p) => !p.included)}
        canDeselect={shownUnlocked.some((p) => p.included)}
        onSelect={() => {
          trackStackFilter("all_contributors", true);
          update({
            contributors: setStates(
              filters.contributors,
              shownUnlocked.map((p) => p.id),
              true,
            ),
          });
        }}
        onDeselect={() => {
          trackStackFilter("all_contributors", false);
          update({
            contributors: setStates(
              filters.contributors,
              shownUnlocked.map((p) => p.id),
              false,
            ),
          });
        }}
      >
        <label htmlFor={`${id}-filter`} className="sr-only">
          Filter people
        </label>
        <input
          id={`${id}-filter`}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter names"
          autoComplete="off"
          className={cn(
            "h-11 rounded-lg border bg-surface px-3 text-[15px] text-foreground placeholder:text-faint lg:h-9 lg:text-sm",
            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
          )}
        />
        {shown.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {shown.map((p) => (
              <span
                key={p.id}
                className="inline-flex max-w-full items-center gap-1"
              >
                <Chip
                  label={p.name}
                  count={p.count}
                  description={`${p.roles.join(", ")}; on ${p.albums
                    .map((key) => titles.get(key) ?? key)
                    .join(", ")}`}
                  details={<ContributorDetails name={p.name} roles={p.roles} />}
                  onDetails={(via) =>
                    track("chip_details", { kind: "contributor", via })
                  }
                  included={p.included}
                  available={p.available}
                  required={p.required}
                  unavailableNote="all their roles are switched off"
                  onToggle={() => {
                    trackStackFilter("contributor", !p.included);
                    update({
                      contributors: setStates(
                        filters.contributors,
                        [p.id],
                        !p.included,
                      ),
                    });
                  }}
                />
                {/* The albums they're on, as cover dots. */}
                <span aria-hidden="true" className="flex -space-x-1">
                  {p.albums.slice(0, MAX_COVER_DOTS).map((key) => {
                    const search = covers.get(key);
                    return search ? (
                      <SearchCover
                        key={key}
                        search={search}
                        className={cn(
                          "h-3.5 w-3.5 rounded-full text-xs ring-1 ring-background !text-transparent [&_*]:!text-transparent",
                          !p.included && "opacity-50",
                        )}
                      />
                    ) : null;
                  })}
                </span>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-faint">No names match "{query.trim()}".</p>
        )}
      </FilterGroup>
    </div>
  );
};
