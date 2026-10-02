import { ecosystemValueScore } from '../registry/ecosystem-gravity';

export interface ConsoleAction {
  action: string;
  appId?: string;
  developerId?: string;
  payload?: Record<string, unknown>;
}

export interface ConsoleSummary {
  developerId: string;
  apps: number;
  activeServices: string[];
  ecosystemValueScore: number;
  nextActions: string[];
}

export function buildConsoleSummary(input: {
  developerId: string;
  appIds: string[];
  services: string[];
}): ConsoleSummary {
  const uniqueServices = Array.from(new Set(input.services));
  const nextActions: string[] = [];

  if (input.appIds.length === 0) nextActions.push('create-app');
  else nextActions.push('review-apps');

  if (!uniqueServices.includes('trust')) nextActions.push('verify-app');
  if (!uniqueServices.includes('payments')) nextActions.push('connect-commerce');
  if (!uniqueServices.includes('distribution')) nextActions.push('publish-and-grow');

  return {
    developerId: input.developerId,
    apps: input.appIds.length,
    activeServices: uniqueServices,
    ecosystemValueScore: ecosystemValueScore(uniqueServices as never[]),
    nextActions,
  };
}

export function validateConsoleAction(action: ConsoleAction): string[] {
  const errors: string[] = [];
  if (!action.action) errors.push('action is required');
  if (action.action !== 'create-account' && !action.developerId) errors.push('developerId is required');
  if (['deploy', 'publish', 'connect-commerce'].includes(action.action) && !action.appId) {
    errors.push('appId is required for this action');
  }
  return errors;
}
