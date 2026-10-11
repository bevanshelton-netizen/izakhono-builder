import { scoreSponsorMatch } from './sponsor-match.js';

const base = { sports: ['football'], geographies: ['ZA'], objectives: ['brand-awareness'], audience: ['youth'], budget: 100000 };

test('strongly matching inventory scores higher', () => {
  const strong = scoreSponsorMatch(base, { sport: 'football', geography: 'ZA', objectives: ['brand-awareness'], audience: ['youth'], askingValue: 80000 });
  const weak = scoreSponsorMatch(base, { sport: 'rugby', geography: 'GB', objectives: ['sales'], audience: ['enterprise'], askingValue: 250000 });
  if (strong <= weak) throw new Error(`expected strong > weak, got ${strong} <= ${weak}`);
});

test('score stays between 0 and 100', () => {
  const score = scoreSponsorMatch(base, { sport: 'football', geography: 'ZA', objectives: ['brand-awareness'], audience: ['youth'], askingValue: 100000 });
  if (score < 0 || score > 100) throw new Error(`invalid score ${score}`);
});
