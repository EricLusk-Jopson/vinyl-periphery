// src/services/db.ts
import { SearchCache } from "@/contexts/cache/types";

const DB_NAME = "vinyl-periphery";
// v2: index on lineage.stackId, for library stacks. Records from v1 have no
// lineage and stay out of the index (roots).
// v3: a store of each stack's Results tab filters, by stack id.
const DB_VERSION = 3;
const STORE_NAME = "saved-searches";
const STACK_FILTERS = "stack-filters";

interface StackFiltersRecord<T> {
  stackId: string;
  filters: T;
}

interface SavedSearchCache extends SearchCache {
  savedAt: number;
}

class DatabaseService {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    if (this.db) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create the object store if it doesn't exist
        const store = db.objectStoreNames.contains(STORE_NAME)
          ? request.transaction!.objectStore(STORE_NAME)
          : db.createObjectStore(STORE_NAME, { keyPath: "searchId" });

        // Indexes for searching, added by whichever version lacks them.
        const indexes = [
          ["artist", "searchParams.artist"],
          ["album", "searchParams.album"],
          ["savedAt", "savedAt"],
          ["stackId", "lineage.stackId"],
        ];
        for (const [name, keyPath] of indexes) {
          if (!store.indexNames.contains(name)) {
            store.createIndex(name, keyPath, { unique: false });
          }
        }
        if (!db.objectStoreNames.contains(STACK_FILTERS)) {
          db.createObjectStore(STACK_FILTERS, { keyPath: "stackId" });
        }
      };
    });
  }

  async saveSearch(searchCache: SearchCache): Promise<string> {
    await this.init();
    if (!this.db) throw new Error("Database not initialized");

    if (!searchCache.searchId) {
      throw new Error("Cannot save search without searchId");
    }

    const savedSearch: SavedSearchCache = {
      ...searchCache,
      savedAt: Date.now(),
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);

      const request = store.put(savedSearch);

      request.onerror = () => {
        console.error("Save error details:", request.error);
        reject(request.error);
      };
      request.onsuccess = () => resolve(savedSearch.searchId);
    });
  }

  async getAllSavedSearches(): Promise<SearchCache[]> {
    await this.init();

    if (!this.db) throw new Error("Database not initialized");

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.index("savedAt").getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        // Convert SavedSearchCache to SearchCache by omitting savedAt
        const savedSearches = request.result as SavedSearchCache[];
        const searches: SearchCache[] = savedSearches.map(
          ({ ...search }) => search,
        );
        resolve(searches);
      };
    });
  }

  async deleteSavedSearch(searchId: string): Promise<void> {
    await this.init();

    if (!this.db) throw new Error("Database not initialized");

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(searchId);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async clearAll(): Promise<void> {
    await this.init();

    if (!this.db) throw new Error("Database not initialized");

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  /** A stack's Results tab filters, if it has any stored. */
  async getStackFilters<T>(stackId: string): Promise<T | undefined> {
    await this.init();
    if (!this.db) throw new Error("Database not initialized");
    return new Promise((resolve, reject) => {
      const request = this.db!.transaction(STACK_FILTERS, "readonly")
        .objectStore(STACK_FILTERS)
        .get(stackId);
      request.onerror = () => reject(request.error);
      request.onsuccess = () =>
        resolve((request.result as StackFiltersRecord<T> | undefined)?.filters);
    });
  }

  async saveStackFilters<T>(stackId: string, filters: T): Promise<void> {
    await this.init();
    if (!this.db) throw new Error("Database not initialized");
    return new Promise((resolve, reject) => {
      const record: StackFiltersRecord<T> = { stackId, filters };
      const request = this.db!.transaction(STACK_FILTERS, "readwrite")
        .objectStore(STACK_FILTERS)
        .put(record);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  /** Deletes the stored filters of every stack not in `keep`. */
  async pruneStackFilters(keep: Set<string>): Promise<string[]> {
    await this.init();
    if (!this.db) throw new Error("Database not initialized");
    return new Promise((resolve, reject) => {
      const store = this.db!.transaction(
        STACK_FILTERS,
        "readwrite",
      ).objectStore(STACK_FILTERS);
      const request = store.getAllKeys();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const gone = (request.result as string[]).filter((id) => !keep.has(id));
        gone.forEach((id) => store.delete(id));
        store.transaction.oncomplete = () => resolve(gone);
        store.transaction.onerror = () => reject(store.transaction.error);
        if (gone.length === 0) resolve(gone);
      };
    });
  }

  async isSaved(searchId: string): Promise<boolean> {
    await this.init();

    if (!this.db) throw new Error("Database not initialized");

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(searchId);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(!!request.result);
    });
  }
}

export const db = new DatabaseService();
