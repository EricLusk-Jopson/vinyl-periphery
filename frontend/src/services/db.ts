// src/services/db.ts
import { SearchCache } from "@/contexts/cache/types";

const DB_NAME = "vinyl-periphery";
const DB_VERSION = 1;
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
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, {
            keyPath: "searchId",
          });

          // Create indexes for searching
          store.createIndex("artist", "searchParams.artist", { unique: false });
          store.createIndex("album", "searchParams.album", { unique: false });
          store.createIndex("savedAt", "savedAt", { unique: false });
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

    // Log the object being saved for debugging
    console.log("Saving search:", savedSearch);

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);

      console.log("About to save:", {
        searchId: savedSearch.searchId,
        type: typeof savedSearch.searchId,
        fullObject: JSON.stringify(savedSearch, null, 2),
      });
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
          ({ ...search }) => search
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
