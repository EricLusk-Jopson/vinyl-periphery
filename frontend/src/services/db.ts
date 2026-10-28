// src/services/db.ts
import { SearchCache } from "@/contexts/cache/types";

const DB_NAME = "vinyl-periphery";
// v2: index on lineage.stackId, for library stacks. Records from v1 have no
// lineage and stay out of the index (roots).
const DB_VERSION = 2;
const STORE_NAME = "saved-searches";

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
