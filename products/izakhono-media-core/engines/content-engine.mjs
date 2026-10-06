export function normalizeAsset(asset = {}) {
  if (!asset.title) throw new Error("asset title is required");
  if (!asset.uri) throw new Error("asset uri is required");
  return {
    id: String(asset.id || `asset_${Date.now().toString(36)}`),
    title: String(asset.title),
    description: String(asset.description || ""),
    uri: String(asset.uri),
    type: String(asset.type || "vod"),
    duration_seconds: Math.max(0, Number(asset.duration_seconds || 0)),
    status: asset.status === "published" ? "published" : "draft",
    tags: Array.isArray(asset.tags) ? asset.tags.map(String).slice(0, 50) : [],
    created_at: asset.created_at || new Date().toISOString()
  };
}

export function buildChannelMetadata({ channel, assets = [] } = {}) {
  if (!channel?.id || !channel?.name) throw new Error("channel id and name are required");
  return {
    channel_id: String(channel.id),
    name: String(channel.name),
    description: String(channel.description || ""),
    status: channel.approved ? "published" : "draft",
    asset_count: assets.length,
    updated_at: new Date().toISOString()
  };
}
