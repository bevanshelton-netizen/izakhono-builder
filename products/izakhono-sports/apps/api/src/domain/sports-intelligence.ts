export type ResultRecord = {
  resultId: string;
  participantKey: string;
  score: number | null;
  placing: number | null;
  points: number;
};

export function genericPoints(placing: number | null, explicitPoints?: unknown): number {
  if (typeof explicitPoints === 'number' && Number.isFinite(explicitPoints)) return explicitPoints;
  if (placing === 1) return 3;
  if (placing === 2) return 2;
  if (placing === 3) return 1;
  return 0;
}

export function summariseResults(results: ResultRecord[]) {
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
    lastResult: results.at(-1) ?? null
  };
}
