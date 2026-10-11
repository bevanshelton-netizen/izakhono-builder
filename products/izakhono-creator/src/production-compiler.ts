import type { GenerationRequest } from './provider-router';

type CompilerInput = {
  brief: string;
  aspectRatio?: string;
  durationSeconds?: number;
};

export function compileProduction(input: CompilerInput): GenerationRequest[] {
  const brief = input.brief.trim();
  const aspectRatio = input.aspectRatio ?? '16:9';
  const duration = input.durationSeconds ?? 5;
  const beats = [
    'wide establishing shot that establishes the world, location and time of day',
    'medium character shot introducing the protagonist and emotional objective',
    'dynamic movement shot showing the central conflict or transformation',
    'hero performance or emotional close-up aligned to the strongest musical or narrative beat',
    'cinematic resolution shot that lands the story and leaves a memorable final image',
  ];
  return beats.map((beat) => ({
    kind: 'video' as const,
    prompt: `${brief}. ${beat}. Maintain character, wardrobe, location and visual continuity across all shots. Cinematic composition, intentional camera movement, natural motion and production-ready detail.`,
    aspectRatio,
    durationSeconds: duration,
  }));
}
