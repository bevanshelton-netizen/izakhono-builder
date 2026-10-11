export type SkillDefinition = {
  id: string;
  name: string;
  description: string;
  path: string;
  triggers: string[];
};

export const creatorSkills: SkillDefinition[] = [
  { id: 'director', name: 'Director', description: 'Turns a brief into a production-ready treatment.', path: 'skills/director/SKILL.md', triggers: ['video', 'film', 'story', 'director', 'cinematic', 'advert'] },
  { id: 'music-video', name: 'Music Video', description: 'Maps a song into a timed music-video treatment and shot plan.', path: 'skills/music-video/SKILL.md', triggers: ['song', 'single', 'track', 'music video', 'music-video'] },
  { id: 'social-pack', name: 'Social Pack', description: 'Creates derivatives for TikTok, Reels and Shorts.', path: 'skills/social-pack/SKILL.md', triggers: ['tiktok', 'reel', 'reels', 'shorts', 'social', 'promo'] },
  { id: 'african-localization', name: 'African Localization', description: 'Localizes creative work across African languages and markets.', path: 'skills/african-localization/SKILL.md', triggers: ['africa', 'african', 'johannesburg', 'south africa', 'zulu', 'xhosa', 'sesotho', 'setswana', 'swahili', 'amapiano', 'afrobeats'] },
];

export function selectSkills(brief: string): SkillDefinition[] {
  const b = brief.toLowerCase();
  const selected = creatorSkills.filter(skill => skill.triggers.some(trigger => b.includes(trigger)));
  return selected.length ? selected : creatorSkills.slice(0, 2);
}
