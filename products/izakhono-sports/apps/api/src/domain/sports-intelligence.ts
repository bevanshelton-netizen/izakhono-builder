export type ResultRecord = {
  resultId: string;
  participantKey: string;
  score: number | null;
  placing: number | null;
  points: number;
};

/**
 * Sport-agnostic fallback scoring. Real sports must eventually provide a
 * competition/sport scoring profile because placing and score semantics vary.
 * Explicit points in result_payload win; otherwise 1st/2nd/3rd receive 3/2/1.
 */
export function genericPoints(placing: number | null, explicitPoints?: unknown): number {
  if (typeof explicitPoints === 'number' && Number.isFinite(explicitPoints)) return explicitPoints;
  if (placing === 1) return 3;
  if (placing === 2) return 2;
  if (placing === 3) return 1;
  return 0;
}

export function summariseResults(results: ResultRecord[]) {
  const ordered = [...results].sort((a, b) => (a.placing ?? Number.MAX_SAFE_INTEGER) - (b.placing ?? Number.MAX_SAFE_INTEGER));
  const placings = results.map(r => r.placing).filter((x): x is number => Number.isInteger(x));
  const wins = placings.filter(x => x === 1).length;
  const podiums = placings.filter(x => x <= 3).length;
  return {
    events: results.length,
    points: results.reduce((sum, r) => sum + r.points, 0),
    wins,
    podiums,
    bestPlacing: placings.length ? Math.min(...placings) : null,
    averagePlacing: placings.length ? Number((placings.reduce((a, b) => a + b, 0) / placings.length).toFixed(2)) : null,
    lastResult: ordered.at(-1) ?? null
  };
}
