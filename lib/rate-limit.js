const stores = new Map();

// Auto-cleanup expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [name, store] of stores) {
    for (const [key, entry] of store) {
      // Remove entries where all timestamps are expired
      entry.timestamps = entry.timestamps.filter(t => now - t < entry.interval);
      if (entry.timestamps.length === 0) {
        store.delete(key);
      }
    }
    if (store.size === 0) {
      stores.delete(name);
    }
  }
}, 5 * 60 * 1000);

export function rateLimit({ interval, maxRequests, name = 'default' }) {
  if (!stores.has(name)) {
    stores.set(name, new Map());
  }
  const store = stores.get(name);

  return {
    check(identifier) {
      const now = Date.now();
      const entry = store.get(identifier) || { timestamps: [], interval };

      // Filter to only timestamps within the window
      entry.timestamps = entry.timestamps.filter(t => now - t < interval);

      if (entry.timestamps.length >= maxRequests) {
        store.set(identifier, entry);
        return { success: false, remaining: 0 };
      }

      entry.timestamps.push(now);
      store.set(identifier, entry);
      return { success: true, remaining: maxRequests - entry.timestamps.length };
    },
  };
}
