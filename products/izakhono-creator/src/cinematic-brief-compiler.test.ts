import { compileCinematicBrief } from './cinematic-brief-compiler';
import { validateProductionGraph } from './cinematic-production-graph';

const advert = compileCinematicBrief({
  id: 'test-ad', ownerId: 'owner-test',
  brief: 'Create a premium product commercial for social channels',
  targetRuntimeSeconds: 30,
  createdAt: '2026-01-01T00:00:00.000Z',
});
if (advert.production.format !== 'advert') throw new Error('Advert format inference failed');
if (advert.production.scenes.length !== 5) throw new Error('Advert scene outline is incomplete');
if (advert.production.shots.length !== 15) throw new Error('Expected three editable coverage shots per scene');
const imageTasks = advert.production.tasks.filter(task => task.kind === 'video_generation');
if (imageTasks.length !== advert.production.shots.length) throw new Error('Every shot should receive a blocked, reviewable image-to-video task.');
if (imageTasks.some(task => !task.shotId || task.status !== 'blocked' || task.providerPreference?.[0] !== 'izakhono-media-runtime-fabric')) throw new Error('Shot video tasks must be linked to shots and prefer the owned media fabric.');
if (advert.production.publicLive !== false) throw new Error('Production must be private by default');
if (validateProductionGraph(advert.production).some(x => x.severity === 'error')) throw new Error('Compiled advert graph is invalid');

const social = compileCinematicBrief({
  id: 'test-social', ownerId: 'owner-test',
  brief: 'Create a TikTok reel explaining the new service',
  createdAt: '2026-01-01T00:00:00.000Z',
});
if (social.production.format !== 'social') throw new Error('Social format inference failed');
if (social.production.shots.some(x => x.aspectRatio !== '9:16')) throw new Error('Social aspect ratio should default to vertical');

const film = compileCinematicBrief({
  id: 'test-film', ownerId: 'owner-test',
  brief: 'Create an original short film',
  format: 'film', targetRuntimeSeconds: 600,
  createdAt: '2026-01-01T00:00:00.000Z',
});
if (film.production.targetRuntimeSeconds !== 600) throw new Error('Requested runtime was not preserved');
if (film.production.characters.length !== 0) throw new Error('Compiler must not invent named characters');
if (!film.assumptions.some(x => x.includes('provisional'))) throw new Error('Compiler must disclose provisional assumptions');

let rejected = false;
try { compileCinematicBrief({ id: '', ownerId: 'x', brief: 'test' }); } catch { rejected = true; }
if (!rejected) throw new Error('Missing production identity must be rejected');

console.log('IZAKHONO CINEMATIC brief compiler: PASS');
