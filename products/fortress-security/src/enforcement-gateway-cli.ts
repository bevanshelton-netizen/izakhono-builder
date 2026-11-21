import { enforce, type EnforcementRequest } from './enforcement-gateway.js';

export function enforcementJson(request: EnforcementRequest): string {
  return JSON.stringify(enforce(request), null, 2);
}
