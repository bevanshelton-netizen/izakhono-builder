export type SponsorBrief = { sports?: string[]; geographies?: string[]; objectives?: string[]; audience?: string[]; budget?: number };
export type Inventory = { sport?: string; geography?: string; audience?: string[]; objectives?: string[]; askingValue?: number };
const overlap = (a: string[] = [], b: string[] = []) => { if (!a.length || !b.length) return 0; const set = new Set(b.map(x => x.toLowerCase())); return a.filter(x => set.has(x.toLowerCase())).length / Math.max(a.length, 1); };
export function scoreSponsorMatch(brief: SponsorBrief, inventory: Inventory) {
  const sportFit = brief.sports?.length && inventory.sport ? (brief.sports.map(x => x.toLowerCase()).includes(inventory.sport.toLowerCase()) ? 1 : 0) : 0.5;
  const geographyFit = brief.geographies?.length && inventory.geography ? (brief.geographies.map(x => x.toLowerCase()).includes(inventory.geography.toLowerCase()) ? 1 : 0) : 0.5;
  const objectiveFit = overlap(brief.objectives, inventory.objectives);
  const audienceFit = overlap(brief.audience, inventory.audience);
  const budgetFit = brief.budget && inventory.askingValue ? Math.min(brief.budget / inventory.askingValue, 1) : 0.5;
  return Math.round((sportFit * .20 + geographyFit * .15 + objectiveFit * .20 + audienceFit * .25 + budgetFit * .20) * 100);
}
