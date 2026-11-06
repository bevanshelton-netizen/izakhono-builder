import test from 'node:test';
import assert from 'node:assert/strict';
import { recordAnalyticsEvent, analyticsSummary } from './analytics.mjs';

test('counts page views and player starts while deduplicating tab sessions per day', () => {
  const data = { days: [] };
  const now = new Date('2026-11-06T10:00:00.000Z');
  recordAnalyticsEvent(data, { event: 'page_view', sessionId: 'session-identifier-0001', now });
  recordAnalyticsEvent(data, { event: 'player_start', sessionId: 'session-identifier-0001', now });
  recordAnalyticsEvent(data, { event: 'page_view', sessionId: 'session-identifier-0002', now });
  const result = analyticsSummary(data, 30);
  assert.equal(result.pageViews, 2);
  assert.equal(result.playerStarts, 1);
  assert.equal(result.daily[0].sessionCount, 2);
  assert.match(result.measurementNote, /not verified unique people/);
});

test('rejects unsupported event types and malformed session identifiers', () => {
  const data = { days: [] };
  const now = new Date('2026-11-06T10:00:00.000Z');
  assert.throws(() => recordAnalyticsEvent(data, { event: 'email_capture', sessionId: 'session-identifier-0001', now }), /invalid_analytics_event/);
  assert.throws(() => recordAnalyticsEvent(data, { event: 'page_view', sessionId: 'short', now }), /invalid_analytics_session/);
  assert.equal(data.days.length, 0);
});

test('retains only the most recent 30 days of daily analytics', () => {
  const data = { days: [] };
  recordAnalyticsEvent(data, { event: 'page_view', sessionId: 'session-identifier-0001', now: new Date('2026-10-01T10:00:00.000Z') });
  recordAnalyticsEvent(data, { event: 'page_view', sessionId: 'session-identifier-0002', now: new Date('2026-11-06T10:00:00.000Z') });
  assert.equal(data.days.length, 1);
  assert.equal(data.days[0].date, '2026-11-06');
});
