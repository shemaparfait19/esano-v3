/**
 * Search result caching utility to reduce Firestore reads
 * Stores results in memory with TTL and localStorage backup
 */

interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

class SearchCache {
  private memoryCache = new Map<string, CacheEntry>();
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_MEMORY_ENTRIES = 50;
  private readonly STORAGE_KEY = "esano_search_cache";

  constructor() {
    // Load from localStorage on initialization
    this.loadFromStorage();

    // Clean expired entries every minute
    setInterval(() => this.cleanExpired(), 60 * 1000);
  }

  /**
   * Generate cache key from search query and parameters
   */
  private generateKey(query: string, params?: Record<string, any>): string {
    const normalizedQuery = query.toLowerCase().trim();
    const paramString = params ? JSON.stringify(params) : "";
    return `${normalizedQuery}:${paramString}`;
  }

  /**
   * Check if cache entry is still valid
   */
  private isValid(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp < entry.ttl;
  }

  /**
   * Get cached result if available and valid
   */
  get(query: string, params?: Record<string, any>): any | null {
    const key = this.generateKey(query, params);

    // Check memory cache first
    const memoryEntry = this.memoryCache.get(key);
    if (memoryEntry && this.isValid(memoryEntry)) {
      console.log("🎯 Search cache HIT (memory):", query);
      return memoryEntry.data;
    }

    // Check localStorage cache
    const storageEntry = this.getFromStorage(key);
    if (storageEntry && this.isValid(storageEntry)) {
      console.log("🎯 Search cache HIT (storage):", query);
      // Promote to memory cache
      this.memoryCache.set(key, storageEntry);
      return storageEntry.data;
    }

    console.log("❌ Search cache MISS:", query);
    return null;
  }

  /**
   * Store result in cache
   */
  set(
    query: string,
    data: any,
    params?: Record<string, any>,
    ttl?: number
  ): void {
    const key = this.generateKey(query, params);
    const entry: CacheEntry = {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.DEFAULT_TTL,
    };

    // Store in memory cache
    this.memoryCache.set(key, entry);

    // Limit memory cache size
    if (this.memoryCache.size > this.MAX_MEMORY_ENTRIES) {
      const firstKey = this.memoryCache.keys().next().value;
      this.memoryCache.delete(firstKey);
    }

    // Store in localStorage
    this.saveToStorage(key, entry);

    console.log("💾 Search result cached:", query);
  }

  /**
   * Clear all cached results
   */
  clear(): void {
    this.memoryCache.clear();
    try {
      localStorage.removeItem(this.STORAGE_KEY);
    } catch (error) {
      console.warn("Failed to clear localStorage cache:", error);
    }
    console.log("🗑️ Search cache cleared");
  }

  /**
   * Remove expired entries from memory cache
   */
  private cleanExpired(): void {
    let cleanedCount = 0;

    for (const [key, entry] of this.memoryCache.entries()) {
      if (!this.isValid(entry)) {
        this.memoryCache.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`🧹 Cleaned ${cleanedCount} expired cache entries`);
    }
  }

  /**
   * Load cache from localStorage
   */
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const cache = JSON.parse(stored);
        let loadedCount = 0;

        for (const [key, entry] of Object.entries(cache)) {
          if (this.isValid(entry as CacheEntry)) {
            this.memoryCache.set(key, entry as CacheEntry);
            loadedCount++;
          }
        }

        if (loadedCount > 0) {
          console.log(`📂 Loaded ${loadedCount} cached search results`);
        }
      }
    } catch (error) {
      console.warn("Failed to load search cache from storage:", error);
    }
  }

  /**
   * Save single entry to localStorage
   */
  private saveToStorage(key: string, entry: CacheEntry): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      const cache = stored ? JSON.parse(stored) : {};

      cache[key] = entry;

      // Limit storage cache size (keep only recent 20 entries)
      const entries = Object.entries(cache);
      if (entries.length > 20) {
        const sorted = entries.sort(
          ([, a], [, b]) =>
            (b as CacheEntry).timestamp - (a as CacheEntry).timestamp
        );
        const limited = Object.fromEntries(sorted.slice(0, 20));
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(limited));
      } else {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(cache));
      }
    } catch (error) {
      console.warn("Failed to save to localStorage cache:", error);
    }
  }

  /**
   * Get single entry from localStorage
   */
  private getFromStorage(key: string): CacheEntry | null {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const cache = JSON.parse(stored);
        return cache[key] || null;
      }
    } catch (error) {
      console.warn("Failed to read from localStorage cache:", error);
    }
    return null;
  }

  /**
   * Get cache statistics
   */
  getStats(): { memoryEntries: number; totalSize: string } {
    const memoryEntries = this.memoryCache.size;

    let totalSize = "0 KB";
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        totalSize = `${Math.round(stored.length / 1024)} KB`;
      }
    } catch (error) {
      // Ignore
    }

    return { memoryEntries, totalSize };
  }
}

// Export singleton instance
export const searchCache = new SearchCache();

// Export utility functions
export const cacheSearchResult = (
  query: string,
  data: any,
  params?: Record<string, any>
) => {
  searchCache.set(query, data, params);
};

export const getCachedSearchResult = (
  query: string,
  params?: Record<string, any>
) => {
  return searchCache.get(query, params);
};

export const clearSearchCache = () => {
  searchCache.clear();
};
