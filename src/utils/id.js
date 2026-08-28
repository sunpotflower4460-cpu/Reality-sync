function normalizedId(value) {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

function defaultCandidate(prefix) {
  const random = globalThis.crypto?.randomUUID?.();
  if (typeof random === 'string' && random.trim()) return random.trim();
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function hasDuplicateIds(items) {
  if (!Array.isArray(items)) return false;
  const seen = new Set();
  for (const item of items) {
    const id = normalizedId(item?.id);
    if (!id) continue;
    if (seen.has(id)) return true;
    seen.add(id);
  }
  return false;
}

export function createUniqueId(prefix, existingIds = [], candidateFactory = null) {
  const safePrefix = typeof prefix === 'string' && prefix.trim() ? prefix.trim() : 'item';
  const used = new Set(
    (Array.isArray(existingIds) ? existingIds : [])
      .map(normalizedId)
      .filter(Boolean),
  );
  const factory = typeof candidateFactory === 'function'
    ? candidateFactory
    : () => defaultCandidate(safePrefix);

  for (let attempt = 0; attempt < 16; attempt += 1) {
    const candidate = normalizedId(factory());
    if (candidate && !used.has(candidate)) return candidate;
  }

  const base = `${safePrefix}-${Date.now()}`;
  let suffix = 1;
  while (used.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}
