const positiveInt = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
};

export function normalizePlaylist(items = []) {
  if (!Array.isArray(items)) throw new Error("playlist must be an array");
  return items.map((item, index) => ({
    id: String(item?.id || `asset-${index + 1}`),
    title: String(item?.title || "Untitled"),
    uri: String(item?.uri || ""),
    duration_seconds: positiveInt(item?.duration_seconds),
    type: String(item?.type || "vod"),
    enabled: item?.enabled !== false
  })).filter(item => item.enabled && item.uri);
}

export function nextPlayoutItem({ playlist = [], fallback = null, cursor = 0 } = {}) {
  const items = normalizePlaylist(playlist);
  if (!items.length) return fallback ? { item: fallback, cursor: 0, source: "fallback" } : { item: null, cursor: 0, source: "empty" };
  const index = ((positiveInt(cursor) % items.length) + items.length) % items.length;
  return { item: items[index], cursor: (index + 1) % items.length, source: "playlist" };
}

export function buildPlayoutWindow({ playlist = [], fallback = null, startAt, maxItems = 20 } = {}) {
  const items = normalizePlaylist(playlist);
  const count = Math.max(0, Math.min(100, positiveInt(maxItems, 20)));
  const start = startAt ? new Date(startAt) : new Date();
  if (Number.isNaN(start.getTime())) throw new Error("startAt must be a valid date");
  const result = [];
  let cursor = 0;
  let at = start.getTime();
  for (let i = 0; i < count; i += 1) {
    const picked = nextPlayoutItem({ playlist: items, fallback, cursor });
    if (!picked.item) break;
    const duration = Math.max(1, positiveInt(picked.item.duration_seconds, 1));
    const end = new Date(at + duration * 1000);
    result.push({ ...picked.item, start: new Date(at).toISOString(), end: end.toISOString(), source: picked.source });
    cursor = picked.cursor;
    at = end.getTime();
  }
  return result;
}
