import crypto from 'node:crypto';

const ALLOWED_EVENTS = new Set(['page_view', 'player_start']);

export function recordAnalyticsEvent(analytics, { event, sessionId, now = new Date() }) {
  if (!ALLOWED_EVENTS.has(event)) throw new Error('invalid_analytics_event');
  if (typeof sessionId !== 'string' || !/^[a-zA-Z0-9-]{20,80}$/.test(sessionId)) {
    throw new Error('invalid_analytics_session');
  }
  const date = now.toISOString().slice(0, 10);
  analytics.days = Array.isArray(analytics.days) ? analytics.days : [];
  let day = analytics.days.find((entry) => entry.date === date);
  if (!day) {
    day = { date, pageViews: 0, playerStarts: 0, sessionHashes: [] };
    analytics.days.push(day);
  }
  const digest = crypto.createHash('sha256').update(date).update(':').update(sessionId).digest('hex');
  if (!day.sessionHashes.includes(digest)) day.sessionHashes.push(digest);
  if (event === 'page_view') day.pageViews += 1;
  if (event === 'player_start') day.playerStarts += 1;
  analytics.days = analytics.days.filter((entry) => entry.date >= new Date(now.getTime() - 29 * 86400000).toISOString().slice(0, 10));
  return { accepted: true, date };
}

export function analyticsSummary(analytics, days = 30) {
  const all = Array.isArray(analytics?.days) ? analytics.days : [];
  const cutoff = new Date(Date.now() - (days - 1) * 86400000).toISOString().slice(0, 10);
  const selected = all.filter((entry) => entry.date >= cutoff).sort((a, b) => a.date.localeCompare(b.date));
  return {
    periodDays: days,
    pageViews: selected.reduce((sum, entry) => sum + (entry.pageViews || 0), 0),
    playerStarts: selected.reduce((sum, entry) => sum + (entry.playerStarts || 0), 0),
    daily: selected.map((entry) => ({
      date: entry.date,
      pageViews: entry.pageViews || 0,
      playerStarts: entry.playerStarts || 0,
      sessionCount: Array.isArray(entry.sessionHashes) ? entry.sessionHashes.length : 0
    })),
    measurementNote: 'Counts are platform-observed events and browser-tab sessions, not verified unique people, viewers, watch time or audience reach.'
  };
}
