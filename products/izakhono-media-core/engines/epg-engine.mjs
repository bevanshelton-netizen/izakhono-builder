export function validateSchedule(items = []) {
  if (!Array.isArray(items)) throw new Error("schedule must be an array");
  const normalized = items.map((item, index) => {
    const start = new Date(item?.start);
    const end = new Date(item?.end);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) throw new Error(`invalid schedule item ${index}`);
    return { title: String(item?.title || "Untitled"), start: start.toISOString(), end: end.toISOString(), description: String(item?.description || "") };
  }).sort((a, b) => new Date(a.start) - new Date(b.start));
  for (let i = 1; i < normalized.length; i += 1) {
    if (new Date(normalized[i].start) < new Date(normalized[i - 1].end)) throw new Error("schedule contains overlapping programmes");
  }
  return normalized;
}

const xml = value => String(value ?? "").replace(/[<>&'\"]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", "\"": "&quot;" }[c]));

export function toEpgXml({ channelId, channelName, schedule = [] } = {}) {
  if (!channelId || !channelName) throw new Error("channelId and channelName are required");
  const items = validateSchedule(schedule).map(item => `<programme start="${xml(item.start)}" stop="${xml(item.end)}" channel="${xml(channelId)}"><title>${xml(item.title)}</title><desc>${xml(item.description)}</desc></programme>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?><tv generator-info-name="IZAKHONO MEDIA CORE"><channel id="${xml(channelId)}"><display-name>${xml(channelName)}</display-name></channel>${items}</tv>`;
}
