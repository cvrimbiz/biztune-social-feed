// Lokale Speicherung im Browser (localStorage). Arbeitsliste und vertrauliche
// Kalkulation liegen unter getrennten Schlüsseln; es gibt keine Netzwerkaufrufe.

const KEYS = { products: 'bt.products.v1', costs: 'bt.costs.v1', backup: 'bt.backup.v1', user: 'bt.user.v1', mappings: 'bt.mappings.v1' };

function read(key, fallback) {
  try {
    const raw = globalThis.localStorage?.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

function write(key, value) {
  try {
    globalThis.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch { return false; }
}

export const store = {
  loadProducts: () => read(KEYS.products, []),
  saveProducts: (v) => write(KEYS.products, v),
  loadCosts: () => read(KEYS.costs, {}),
  saveCosts: (v) => write(KEYS.costs, v),
  loadBackup: () => read(KEYS.backup, null),
  saveBackup: (v) => write(KEYS.backup, v),
  loadMappings: () => read(KEYS.mappings, {}),
  saveMappings: (v) => write(KEYS.mappings, v),
  loadUser: () => read(KEYS.user, ''),
  saveUser: (v) => write(KEYS.user, v),
  clearAll() { try { Object.values(KEYS).forEach((k) => globalThis.localStorage.removeItem(k)); return true; } catch { return false; } },
};
