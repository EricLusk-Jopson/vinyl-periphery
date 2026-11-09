import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { useCache } from "@/contexts/cache/CacheContext";
import { SearchCache } from "@/contexts/cache/types";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { track } from "@/lib/analytics";
import { stackPath } from "@/lib/routes";
import { searchStartedAt } from "@/lib/searches";
import {
  albumKeyOf,
  canJoin,
  defaultStackName,
  memberFor,
  memberKey,
  resolveMember,
  savedByAlbum,
  StackMember,
  StackRecord,
} from "@/lib/stackRecords";
import { LibraryStack, searchLibrary } from "@/lib/stacks";
import { cn } from "@/lib/utils";
import { dialogButton } from "../common/buttons";
import { SearchCover } from "../search/SearchCover";
import { AlbumCover } from "../search/AlbumCover";
import { useStackRemoval } from "./useStackRemoval";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring";

interface StackEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Edit this stack; without it, make a new one. */
  stack?: LibraryStack;
  /** A new stack's first albums (the first is its start). */
  initial?: SearchCache[];
  /** Called with the stack once it's kept. */
  onSaved?: (record: StackRecord) => void;
}

/**
 * Making or editing a stack: its name, and its albums. The first album is
 * the start; each one added after must link to an album already in (someone
 * credited on one worked on the other), so the library's other albums are
 * listed with those that don't link yet greyed out and saying so. Taking an
 * album out that other albums link back to the start through asks first.
 * Nothing is kept until Save. Deleting the stack is on its page.
 */
export const StackEditor: React.FC<StackEditorProps> = ({
  open,
  onOpenChange,
  stack,
  initial = [],
  onSaved,
}) => {
  const { searches, savedSearchIds, createStack, updateStack } = useCache();
  const navigate = useNavigate();
  const wide = useMediaQuery("(min-width: 768px)");
  const editing = Boolean(stack);
  const [name, setName] = useState(stack?.record.name ?? "");
  const [members, setMembers] = useState<StackMember[]>(
    () => stack?.record.members ?? initial.map((s) => memberFor(s)),
  );
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const { request, dialog } = useStackRemoval();

  const byAlbum = useMemo(
    () => savedByAlbum(searches, savedSearchIds),
    [searches, savedSearchIds],
  );
  // The draft's albums still in the library, in order.
  const albums = useMemo(
    () =>
      members
        .map((m) => resolveMember(m, byAlbum))
        .filter((s): s is SearchCache => Boolean(s)),
    [members, byAlbum],
  );
  const inDraft = useMemo(() => new Set(albums.map(albumKeyOf)), [albums]);
  // The rest of the library: those that link first, then newest.
  const candidates = useMemo(() => {
    const saved = Array.from(savedSearchIds)
      .map((id) => searches[id])
      .filter((s): s is SearchCache => Boolean(s))
      .filter((s) => !inDraft.has(albumKeyOf(s)));
    const latest = new Map<string, SearchCache>();
    for (const s of saved) {
      const key = albumKeyOf(s);
      const seen = latest.get(key);
      if (!seen || searchStartedAt(s.searchId) > searchStartedAt(seen.searchId))
        latest.set(key, s);
    }
    return searchLibrary(Array.from(latest.values()), query)
      .map((search) => ({ search, join: canJoin(search, albums) }))
      .sort(
        (a, b) =>
          Number(b.join.ok) - Number(a.join.ok) ||
          searchStartedAt(b.search.searchId) -
            searchStartedAt(a.search.searchId),
      );
  }, [savedSearchIds, searches, inDraft, query, albums]);

  const add = (search: SearchCache) =>
    setMembers((current) => [...current, memberFor(search)]);
  const removeMember = (member: StackMember) => {
    const drop = () =>
      setMembers((current) =>
        current.filter((m) => memberKey(m) !== memberKey(member)),
      );
    const search = resolveMember(member, byAlbum);
    // An album deleted from the library goes without a check.
    if (!search) drop();
    else request(search, albums, drop);
  };

  const save = async () => {
    if (busy || members.length === 0) return;
    setBusy(true);
    try {
      const finalName = name.trim() || defaultStackName(members);
      if (stack) {
        const record = { ...stack.record, name: finalName, members };
        await updateStack(record);
        track("stack_edited", {
          members: members.length,
          renamed: finalName !== stack.record.name,
        });
        onSaved?.(record);
      } else {
        const record = await createStack(finalName, albums);
        track("stack_created", { members: members.length });
        onSaved?.(record);
        navigate(stackPath(record.id));
      }
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  const advisory =
    members.length === 0
      ? "Start with any album in your library: it's the stack's start."
      : "Add albums that link to one already in the stack: someone credited on one worked on the other. Greyed-out albums don't link yet; adding others may link them.";

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side={wide ? "right" : "bottom"}
          className={cn(
            "flex flex-col gap-5 overflow-y-auto bg-background p-5 md:w-[480px] md:max-w-[480px] md:p-6",
            !wide && "max-h-[92vh] rounded-t-xl",
          )}
        >
          <div className="flex flex-col gap-1.5 pr-8">
            <SheetTitle className="text-left text-lg font-semibold">
              {editing ? "Edit stack" : "New stack"}
            </SheetTitle>
            <SheetDescription className="text-left text-sm text-muted-foreground">
              A stack groups albums linked by their credits. Its albums stay in
              your library, and can be in other stacks too.
            </SheetDescription>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-xs uppercase tracking-[1px] text-muted-foreground">
              Name
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={defaultStackName(members)}
              maxLength={80}
              className={cn(
                "h-11 rounded-lg border border-border-strong bg-surface px-3 text-[15px] text-foreground placeholder:text-faint",
                focusRing,
              )}
            />
          </label>

          <section aria-label="In this stack" className="flex flex-col gap-2">
            <span className="font-mono text-xs uppercase tracking-[1px] text-muted-foreground">
              In this stack · {members.length}
            </span>
            {members.length === 0 ? (
              <p className="rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground">
                No albums yet.
              </p>
            ) : (
              <ul className="flex flex-col divide-y rounded-lg border bg-surface">
                {members.map((member, i) => {
                  const search = resolveMember(member, byAlbum);
                  return (
                    <li
                      key={memberKey(member)}
                      className="flex min-h-[60px] items-center gap-3 px-3 py-2"
                    >
                      {search ? (
                        <SearchCover
                          search={search}
                          className="h-10 w-10 rounded-[3px] text-xs"
                        />
                      ) : (
                        <AlbumCover
                          src={member.thumb}
                          title={member.title}
                          className="h-10 w-10 rounded-[3px] text-xs opacity-60"
                        />
                      )}
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm font-medium">
                          {member.title}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          {i === 0 ? "Start · " : ""}
                          {search ? member.artist : "Deleted from your library"}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => removeMember(member)}
                        aria-label={`Remove ${member.title} from the stack`}
                        className={cn(
                          "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
                          focusRing,
                        )}
                      >
                        <X className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section aria-label="Add albums" className="flex flex-col gap-2">
            <span className="font-mono text-xs uppercase tracking-[1px] text-muted-foreground">
              Add albums
            </span>
            <p role="note" className="text-[13px] text-muted-foreground">
              {advisory}
            </p>
            <label className="relative">
              <span className="sr-only">Find an album in your library</span>
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint"
                aria-hidden="true"
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Find an album in your library"
                className={cn(
                  "h-11 w-full rounded-lg border bg-surface pl-9 pr-3 text-[15px] text-foreground placeholder:text-faint",
                  focusRing,
                )}
              />
            </label>
            {candidates.length === 0 ? (
              <p className="text-[13px] text-faint">
                {query.trim()
                  ? `No albums match "${query.trim()}".`
                  : "Every album in your library is in this stack."}
              </p>
            ) : (
              <ul className="flex flex-col divide-y rounded-lg border bg-surface">
                {candidates.map(({ search, join }) => (
                  <li
                    key={search.searchId}
                    className={cn(
                      "flex min-h-[60px] items-center gap-3 px-3 py-2",
                      !join.ok && "opacity-60",
                    )}
                  >
                    <SearchCover
                      search={search}
                      className="h-10 w-10 rounded-[3px] text-xs"
                    />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-medium">
                        {search.searchParams.album}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {join.ok
                          ? join.via
                            ? `Links to ${join.via.searchParams.album}`
                            : search.searchParams.artist
                          : "Not linked to the stack yet"}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => add(search)}
                      disabled={!join.ok}
                      aria-label={
                        join.ok
                          ? `Add ${search.searchParams.album}`
                          : `${search.searchParams.album} can't be added: it doesn't link to an album in the stack yet`
                      }
                      className={cn(
                        "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:text-faint disabled:hover:bg-transparent",
                        focusRing,
                      )}
                    >
                      <Plus className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="sticky bottom-0 -mx-5 -mb-5 mt-auto flex gap-2 border-t bg-background px-5 pb-5 pt-3 md:-mx-6 md:-mb-6 md:px-6 md:pb-6">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className={cn(dialogButton.secondary, "flex-1")}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={busy || members.length === 0}
              className={cn(dialogButton.primary, "flex-1")}
            >
              {editing ? "Save" : "Make stack"}
            </button>
          </div>
        </SheetContent>
      </Sheet>
      {dialog}
    </>
  );
};
