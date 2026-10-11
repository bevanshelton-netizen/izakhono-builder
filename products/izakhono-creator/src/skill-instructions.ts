import { creatorSkills } from './skill-registry';

const instructions: Record<string, string> = {
  director: 'Extract objective, audience, format, duration, tone and success criteria; write a logline and treatment; create scenes and shots; define visual language and continuity; separate creative choices from provider settings; require approval before generation, final QA and publishing. Never claim media exists without evidence.',
  'music-video': 'Map intro, verses, hooks, bridge and outro to narrative or performance beats; create a timed scene and shot plan; define artist and continuity references; prepare generation briefs and master/social deliverables. Do not infer rights or claim publishing is complete without evidence.',
  'social-pack': 'Derive hooks and moments from an approved master; define platform-specific aspect ratio, duration, opening beat and CTA; prepare captions, thumbnails and derivative manifests; keep publishing approval-gated and evidence-based.',
  'african-localization': 'Identify target countries, languages and audiences; separate translation from cultural adaptation; preserve intent while adapting idioms and references; flag pronunciation and sensitive elements for human review; track each variant to the canonical asset and avoid pan-African stereotyping.'
};

export function listSkills() {
  return creatorSkills;
}

export function activateSkill(id: string) {
  const skill = creatorSkills.find(item => item.id === id);
  if (!skill) return null;
  return { skill, instructions: instructions[id] ?? '' };
}
