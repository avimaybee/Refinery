import * as crypto from 'crypto';
import * as vscode from 'vscode';

/**
 * Cache entry with timestamp for LRU tracking
 */
interface CacheEntry {
    value: string;
    timestamp: number;
    model: string;
    inputLength: number;
}

/**
 * LRU Cache Manager for refined prompts
 * Implements a simple hash-based cache with configurable max size and TTL
 */
export class CacheManager {
    private cache: Map<string, CacheEntry> = new Map();
    private maxSize: number;
    private ttl: number;
    private hits: number = 0;
    private misses: number = 0;

    constructor(maxSize: number = 50, ttl: number = 3600000) {
        this.maxSize = maxSize;
        this.ttl = ttl;
    }

    /**
     * Update cache configuration from settings
     */
    updateConfig(): void {
        const config = vscode.workspace.getConfiguration('refinery');
        this.maxSize = config.get<number>('cacheSize', 50);
        this.ttl = config.get<number>('cacheTTL', 3600000);
        
        // Evict excess entries if maxSize reduced
        while (this.cache.size > this.maxSize) {
            this.evictOldest();
        }
    }

    /**
     * Generate a cache key from input parameters
     */
    hash(userInput: string, model: string, projectContext: string): string {
        const data = `${userInput}|${model}|${projectContext}`;
        return crypto.createHash('sha256').update(data).digest('hex').substring(0, 16);
    }

    /**
     * Get a cached entry if it exists and is not expired
     */
    get(key: string): string | null {
        const entry = this.cache.get(key);
        
        if (entry) {
            // Check TTL expiration
            const age = Date.now() - entry.timestamp;
            if (age > this.ttl) {
                // Entry expired, remove it
                this.cache.delete(key);
                this.misses++;
                return null;
            }
            
            // Update timestamp for LRU tracking
            entry.timestamp = Date.now();
            this.cache.set(key, entry);
            this.hits++;
            return entry.value;
        }
        
        this.misses++;
        return null;
    }

    /**
     * Store a value in the cache
     */
    set(key: string, value: string, model: string, inputLength: number): void {
        // Evict oldest if at capacity
        if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
            this.evictOldest();
        }

        this.cache.set(key, {
            value,
            timestamp: Date.now(),
            model,
            inputLength,
        });
    }

    /**
     * Evict the oldest entry (LRU)
     */
    private evictOldest(): void {
        let oldestKey: string | null = null;
        let oldestTime = Infinity;

        for (const [key, entry] of this.cache.entries()) {
            if (entry.timestamp < oldestTime) {
                oldestTime = entry.timestamp;
                oldestKey = key;
            }
        }

        if (oldestKey) {
            this.cache.delete(oldestKey);
        }
    }

    /**
     * Clear the entire cache
     */
    clear(): void {
        this.cache.clear();
        this.hits = 0;
        this.misses = 0;
    }

    /**
     * Get cache statistics
     */
    getStats(): { size: number; hits: number; misses: number; hitRate: string; maxSize: number; ttlMinutes: number } {
        const total = this.hits + this.misses;
        const hitRate = total > 0 ? ((this.hits / total) * 100).toFixed(1) : '0.0';
        
        return {
            size: this.cache.size,
            hits: this.hits,
            misses: this.misses,
            hitRate: `${hitRate}%`,
            maxSize: this.maxSize,
            ttlMinutes: Math.round(this.ttl / 60000),
        };
    }

    /**
     * Check if a key exists in cache
     */
    has(key: string): boolean {
        const entry = this.cache.get(key);
        if (entry) {
            // Check TTL
            const age = Date.now() - entry.timestamp;
            if (age > this.ttl) {
                this.cache.delete(key);
                return false;
            }
            return true;
        }
        return false;
    }

    /**
     * Prune expired entries
     */
    prune(): number {
        const now = Date.now();
        let pruned = 0;
        
        for (const [key, entry] of this.cache.entries()) {
            if (now - entry.timestamp > this.ttl) {
                this.cache.delete(key);
                pruned++;
            }
        }
        
        return pruned;
    }
}

// Singleton instance for extension-wide use
let cacheInstance: CacheManager | null = null;

/**
 * Get the singleton cache manager instance
 */
export function getCacheManager(): CacheManager {
    if (!cacheInstance) {
        const config = vscode.workspace.getConfiguration('refinery');
        const maxSize = config.get<number>('cacheSize', 50);
        const ttl = config.get<number>('cacheTTL', 3600000);
        cacheInstance = new CacheManager(maxSize, ttl);
    }
    return cacheInstance;
}

/**
 * Reset the cache manager (for testing or settings change)
 */
export function resetCacheManager(): void {
    if (cacheInstance) {
        cacheInstance.clear();
    }
    cacheInstance = null;
}
