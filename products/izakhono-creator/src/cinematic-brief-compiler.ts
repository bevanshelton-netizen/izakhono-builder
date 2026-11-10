import {
  type CinematicProduction,
  type ProductionTask,
  type Scene,
  type Shot,
} from './cinematic-production-graph';

export interface CinematicBriefInput {
  id: string;
  ownerId: string;
  title?: string;
  brief: string;
  format?: CinematicProduction['format'];
  audience?: string;
  language?: string;
  locale?: string;
  targetRuntimeSeconds?: number;
  aspectRatio?: Shot['aspectRatio'];
  createdAt?: string;
}

export interface CinematicBriefCompilation {
  production: CinematicProduction;
  assumptions: string[];
  nextActions: string[];
}

const token = (prefix: string, n: number) => `${prefix}_${String(n).padStart(3, '0')}`;

function inferFormat(text: string): CinematicProduction['format'] {
  const b = text.toLowerCase();
  if (/music video|music-video|official video/.test(b)) return 'music_video';
  if (/documentary|docu-series/.test(b)) return 'documentary';
  if (/training|lesson|course|tutorial|explainer/.test(b)) return 'training';
  if (/advert|commercial|campaign|product launch/.test(b)) return 'advert';
  if (/series|episode|tv show/.test(b)) return 'series';
  if (/tiktok|reel|short-form|shorts/.test(b)) return 'social';
  if (/film|movie|cinema|trailer/.test(b)) return 'film';
  return 'other';
}

function sceneBlueprint(format: CinematicProduction['format']) {
  switch (format) {
    case 'advert':
      return [
        ['The Hook', 'Interrupt attention and establish the need or desire.', 0.12],
        ['The Product or Promise', 'Introduce the product, service or central promise.', 0.24],
        ['The Proof', 'Show credible use, detail, benefit or evidence.', 0.30],
        ['The Transformation', 'Show the outcome or emotional payoff.', 0.20],
        ['The Call to Action', 'Make the next customer action unmistakable.', 0.14],
      ] as const;
    case 'music_video':
      return [
        ['Opening Image', 'Establish the visual world and musical identity.', 0.12],
        ['Verse One', 'Introduce the performer, story and visual motifs.', 0.22],
        ['First Hook', 'Deliver the central performance and memorable visual.', 0.22],
        ['Bridge or Development', 'Introduce contrast, movement or story escalation.', 0.18],
        ['Final Hook and Outro', 'Resolve the visual motif and leave a memorable final image.', 0.26],
      ] as const;
    case 'documentary':
      return [
        ['The Question', 'Introduce the central question and stakes.', 0.12],
        ['Context', 'Establish people, place and background.', 0.22],
        ['Evidence and Voices', 'Build the story through evidence and participant perspectives.', 0.34],
        ['Complication', 'Examine tension, counterpoints and unanswered questions.', 0.18],
        ['Resolution', 'Offer a grounded conclusion without overstating certainty.', 0.14],
      ] as const;
    case 'training':
      return [
        ['Learning Outcome', 'Explain what the learner will be able to do.', 0.10],
        ['Context and Concepts', 'Introduce the essential concepts and terminology.', 0.20],
        ['Demonstration', 'Show the process in clear, ordered steps.', 0.38],
        ['Practice and Check', 'Give the learner an opportunity to apply and check understanding.', 0.20],
        ['Recap', 'Reinforce the key learning and next action.', 0.12],
      ] as const;
    case 'social':
      return [
        ['Pattern Break', 'Earn attention immediately.', 0.12],
        ['Core Message', 'Communicate one clear idea.', 0.32],
        ['Proof or Demonstration', 'Make the message concrete and credible.', 0.32],
        ['Call to Action', 'Give one simple next step.', 0.24],
      ] as const;
    default:
      return [
        ['Opening', 'Establish the world, subject and central question.', 0.12],
        ['Set-up', 'Introduce the people, context and objective.', 0.20],
        ['Development', 'Advance the story through action, discovery or demonstration.', 0.34],
        ['Climax or Key Insight', 'Deliver the central dramatic or informational payoff.', 0.22],
        ['Resolution', 'Resolve the sequence and provide a meaningful ending.', 0.12],
      ] as const;
  }
}

/**
 * Creates an editable, explicitly provisional production graph from a short brief.
 * It does not invent named characters, factual claims, finished scripts or completed media.
 */
export function compileCinematicBrief(input: CinematicBriefInput): CinematicBriefCompilation {
  const brief = input.brief.trim();
  if (!brief) throw new Error('A creative brief is required.');
  if (!input.id.trim() || !input.ownerId.trim()) throw new Error('Production ID and owner ID are required.');

  const createdAt = input.createdAt ?? new Date().toISOString();
  const format = input.format ?? inferFormat(brief);
  const runtime = Math.max(10, Math.min(7200, Math.round(input.targetRuntimeSeconds ?? (format === 'social' ? 30 : format === 'advert' ? 30 : format === 'music_video' ? 180 : 120))));
  const blueprints = sceneBlueprint(format);
  const locationId = 'loc_primary_tbd';
  const scenes: Scene[] = blueprints.map(([title, synopsis, share], index) => ({
    id: token('scene', index + 1),
    sequence: index + 1,
    title,
    synopsis,
    locationId,
    characterIds: [],
    propIds: [],
    timeOfDay: 'To be decided',
    emotionalBeat: 'To be directed',
    estimatedDurationSeconds: Math.max(1, Math.round(runtime * share)),
    continuityNotes: ['Location, characters, wardrobe, props and time-of-day continuity require director approval.'],
  }));

  const shots: Shot[] = [];
  let shotNumber = 1;
  for (const scene of scenes) {
    const sceneShots: Array<Pick<Shot, 'purpose' | 'action' | 'shotSize' | 'cameraMove' | 'lensIntent'>> = [
      { purpose: 'Establish the scene', action: 'Introduce the scene subject and geography; final action to be specified by director.', shotSize: 'wide', cameraMove: 'static', lensIntent: 'Establishing perspective' },
      { purpose: 'Capture the key beat', action: "Cover the scene's principal action or message; exact performance to be directed.", shotSize: 'medium', cameraMove: 'tracking', lensIntent: 'Natural perspective' },
      { purpose: 'Capture detail and edit point', action: 'Capture a meaningful detail, reaction or transition point.', shotSize: 'close_up', cameraMove: 'dolly', lensIntent: 'Selective focus' },
    ];
    sceneShots.forEach((spec, index) => {
      shots.push({
        id: token('shot', shotNumber++),
        sceneId: scene.id,
        sequence: index + 1,
        purpose: spec.purpose,
        action: spec.action,
        shotSize: spec.shotSize,
        cameraAngle: 'Eye level unless director specifies otherwise',
        lensIntent: spec.lensIntent,
        cameraMove: spec.cameraMove,
        focusIntent: 'Subject-led focus; confirm with cinematographer',
        lightingIntent: 'To be designed for the approved location, time and visual treatment',
        durationSeconds: Math.max(1, Math.round(scene.estimatedDurationSeconds / 3)),
        aspectRatio: input.aspectRatio ?? (format === 'social' ? '9:16' : '16:9'),
        characterIds: [],
        propIds: [],
        referenceIds: [],
        dependsOnShotIds: index === 0 ? [] : [shots[shots.length - 1].id],
        continuityLocks: ['Do not invent character identity, wardrobe, props, geography or factual product details.'],
        generationPrompt: undefined,
      });
    });
  }

  const tasks: ProductionTask[] = [
    { id: 'task_001', kind: 'script', status: 'ready', dependsOnTaskIds: [], inputAssetIds: [], outputAssetIds: [], attempts: 0 },
    { id: 'task_002', kind: 'storyboard', status: 'blocked', blockedReason: 'dependencies', dependsOnTaskIds: ['task_001'], inputAssetIds: [], outputAssetIds: [], attempts: 0 },
    { id: 'task_003', kind: 'quality_check', status: 'blocked', blockedReason: 'dependencies', dependsOnTaskIds: ['task_002'], inputAssetIds: [], outputAssetIds: [], attempts: 0 },
  ];

  const production: CinematicProduction = {
    schema: 'izakhono.cinematic/production-v1',
    id: input.id,
    title: input.title?.trim() || 'Untitled Cinematic Production',
    brief,
    status: 'draft',
    format,
    audience: input.audience,
    language: input.language,
    locale: input.locale,
    targetRuntimeSeconds: runtime,
    characters: [],
    locations: [{
      id: locationId,
      name: 'Primary location — to be defined',
      description: 'Placeholder only. The director must select or approve the actual location.',
      geography: 'Unspecified',
      timeOfDay: 'Unspecified',
      lighting: 'To be designed',
      palette: [],
      referenceAssetIds: [],
      lockedFacts: [],
    }],
    props: [],
    scenes,
    shots,
    references: [],
    assets: [],
    tasks,
    approvals: [
      { id: 'approval_creative', gate: 'creative', status: 'pending' },
      { id: 'approval_generation', gate: 'generation', status: 'pending' },
      { id: 'approval_master', gate: 'master', status: 'pending' },
      { id: 'approval_distribution', gate: 'distribution', status: 'pending' },
    ],
    metadata: {
      createdAt, updatedAt: createdAt, ownerId: input.ownerId,
      tags: ['cinematic-ai', format, 'draft'], version: 1,
    },
    publicLive: false,
  };

  return {
    production,
    assumptions: [
      'This is a provisional structure, not a finished screenplay or approved storyboard.',
      'No named characters, factual claims, locations or product attributes have been invented.',
      'The scene and shot timings are estimates and may be revised by the director.',
      'No generation, rendering, publication or external provider call has occurred.',
    ],
    nextActions: [
      'Approve the creative treatment and production format.',
      'Define characters, locations, wardrobe, props and visual references.',
      'Revise scene and shot timing, camera language and sound design.',
      'Approve the storyboard before any paid or external generation is submitted.',
    ],
  };
}
