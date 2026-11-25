import type { CinematicProduction } from './cinematic-production-graph';
import { buildProductionManifest, type ManifestEntry, type ProductionManifest } from './cinematic-production-manifest';

export interface ReadinessAction {
  id: string;
  priority: 'critical' | 'high' | 'normal';
  category: ManifestEntry['category'];
  title: string;
  reason: string;
  recommendedAction: string;
  relatedIds: string[];
  candidateTaskIds: string[];
}
export interface ProductionReadinessReport {
  schema: 'izakhono.creator/readiness-report-v1';
  productionId: string;
  productionTitle: string;
  generatedAt: string;
  state: 'ready' | 'in_progress' | 'blocked';
  summary: ProductionManifest['summary'];
  actions: ReadinessAction[];
}

/** Converts manifest gaps into an ordered, read-only worklist; it never schedules jobs or changes production data. */
export function buildProductionReadinessReport(project: CinematicProduction, generatedAt?: string): ProductionReadinessReport {
  const manifest = buildProductionManifest(project, generatedAt);
  const taskEntries = manifest.entries.filter(entry => entry.category === 'task');
  const actions: ReadinessAction[] = manifest.entries
    .filter(entry => entry.state === 'missing' || entry.state === 'blocked')
    .map(entry => {
      const candidateTaskIds = taskEntries
        .filter(task => task.relatedIds.includes(entry.id) && (task.state === 'missing' || task.state === 'blocked' || task.state === 'in_progress'))
        .map(task => task.id);
      const guidance = actionFor(entry);
      const priority: ReadinessAction['priority'] = entry.category === 'approval' || entry.category === 'export' ? 'critical' : entry.category === 'shot' || entry.category === 'asset' ? 'high' : 'normal';
      return {
        id: `resolve:${entry.category}:${entry.id}`,
        priority,
        category: entry.category,
        title: `Resolve ${entry.label}`,
        reason: entry.details.join('; '),
        recommendedAction: guidance,
        relatedIds: entry.relatedIds,
        candidateTaskIds,
      };
    })
    .sort((a,b) => priorityRank(a.priority)-priorityRank(b.priority) || a.category.localeCompare(b.category) || a.id.localeCompare(b.id));
  const state = manifest.summary.readyForDistribution ? 'ready' : actions.some(action => action.priority === 'critical') ? 'blocked' : actions.length ? 'in_progress' : 'ready';
  return { schema: 'izakhono.creator/readiness-report-v1', productionId: project.id, productionTitle: project.title, generatedAt: manifest.generatedAt, state, summary: manifest.summary, actions };
}

function priorityRank(priority: ReadinessAction['priority']): number {
  return priority === 'critical' ? 0 : priority === 'high' ? 1 : 2;
}
function actionFor(entry: ManifestEntry): string {
  if (entry.category === 'approval') return 'Obtain the required human decision and record the approver identity and decision timestamp.';
  if (entry.category === 'shot') return 'Review the shot brief, complete its source/reference and audio requirements, then attach a completed stored shot-video asset.';
  if (entry.category === 'asset') return 'Attach the original media or complete the producing task; record storage/hash, licence and applicable consent evidence.';
  if (entry.category === 'task') return 'Resolve dependencies or failure details, then execute the task through an approved worker and attach completion evidence.';
  if (entry.category === 'export') return 'Complete the approved master/render pipeline and attach the stored delivery asset with verified export metadata.';
  if (entry.category === 'scene') return 'Assign at least one fully specified shot to this scene and review its continuity requirements.';
  return 'Review the production record and supply the missing evidence.';
}
