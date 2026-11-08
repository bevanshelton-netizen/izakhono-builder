import type {
  AutomationAction,
  AutomationCondition,
  AutomationDefinition,
  AutomationTrigger,
} from './contracts';

export const AUTOMATION_LIMITS = Object.freeze({
  maxNameLength: 80,
  maxConditions: 10,
  maxActions: 5,
  maxTextLength: 500,
});

export type ValidationIssue = { path: string; code: string; message: string };

const validTimezone = (value: string): boolean => {
  try { new Intl.DateTimeFormat('en', { timeZone: value }); return true; }
  catch { return false; }
};

export function validateTrigger(trigger: AutomationTrigger): ValidationIssue[] {
  if (!trigger || typeof trigger !== 'object') return [{ path: 'trigger', code: 'required', message: 'A trigger is required.' }];
  if (trigger.type === 'manual') return [];
  if (trigger.type === 'schedule') {
    const issues: ValidationIssue[] = [];
    // Deliberately support a conservative five-field cron subset. A production
    // scheduler must still parse and enforce this server-side.
    if (!/^([*]|[0-5]?\d) ([*]|[01]?\d|2[0-3]) ([*]|[1-9]|[12]\d|3[01]) ([*]|[1-9]|1[0-2]) ([*]|[0-6])$/.test(trigger.cron)) {
      issues.push({ path: 'trigger.cron', code: 'invalid_cron', message: 'Use a valid five-field schedule.' });
    }
    if (!validTimezone(trigger.timezone)) issues.push({ path: 'trigger.timezone', code: 'invalid_timezone', message: 'Use a valid IANA timezone.' });
    return issues;
  }
  if (trigger.type === 'webhook') {
    const issues: ValidationIssue[] = [];
    if (!/^[a-zA-Z0-9_-]{3,100}$/.test(trigger.connectionId)) issues.push({ path: 'trigger.connectionId', code: 'invalid_id', message: 'Invalid connection reference.' });
    if (!/^[a-zA-Z0-9._:-]{1,100}$/.test(trigger.eventType)) issues.push({ path: 'trigger.eventType', code: 'invalid_event', message: 'Invalid event type.' });
    return issues;
  }
  return [{ path: 'trigger.type', code: 'unsupported', message: 'Unsupported trigger type.' }];
}

export function validateAction(action: AutomationAction, index: number): ValidationIssue[] {
  const prefix = `actions[${index}]`;
  if (!action || typeof action !== 'object') return [{ path: prefix, code: 'invalid_action', message: 'Action is required.' }];
  if (action.type === 'send_notification') {
    if (!action.title.trim() || action.title.length > AUTOMATION_LIMITS.maxTextLength || action.body.length > AUTOMATION_LIMITS.maxTextLength) {
      return [{ path: prefix, code: 'invalid_text', message: 'Notification text is empty or too long.' }];
    }
    return [];
  }
  if (action.type === 'create_task') {
    if (!action.title.trim() || action.title.length > AUTOMATION_LIMITS.maxTextLength) return [{ path: prefix + '.title', code: 'invalid_text', message: 'Task title is empty or too long.' }];
    if (action.dueAt && !Number.isFinite(Date.parse(action.dueAt))) return [{ path: prefix + '.dueAt', code: 'invalid_date', message: 'Due date must be an ISO-compatible date.' }];
    return [];
  }
  if (action.type === 'call_webhook') {
    const issues: ValidationIssue[] = [];
    if (!/^[a-zA-Z0-9_-]{3,100}$/.test(action.connectionId)) issues.push({ path: prefix + '.connectionId', code: 'invalid_id', message: 'Invalid connection reference.' });
    if (!/^[a-zA-Z0-9._:-]{1,100}$/.test(action.eventType)) issues.push({ path: prefix + '.eventType', code: 'invalid_event', message: 'Invalid event type.' });
    return issues;
  }
  return [{ path: prefix + '.type', code: 'unsupported', message: 'Action is not in the approved action registry.' }];
}

export function validateCondition(condition: AutomationCondition, index: number): ValidationIssue[] {
  const prefix = `conditions[${index}]`;
  if (!condition || typeof condition !== 'object') return [{ path: prefix, code: 'invalid_condition', message: 'Condition is required.' }];
  if (!/^[a-zA-Z][a-zA-Z0-9_.]{0,99}$/.test(condition.field)) return [{ path: prefix + '.field', code: 'invalid_field', message: 'Invalid condition field.' }];
  if (condition.type === 'equals') return [];
  if (condition.type === 'contains') {
    if (condition.value.length > AUTOMATION_LIMITS.maxTextLength) return [{ path: prefix + '.value', code: 'too_long', message: 'Condition value is too long.' }];
    return [];
  }
  return [{ path: prefix + '.type', code: 'unsupported', message: 'Unsupported condition.' }];
}

export function validateAutomation(input: AutomationDefinition): ValidationIssue[] {
  if (!input || typeof input !== 'object') return [{ path: 'automation', code: 'invalid', message: 'Automation definition is required.' }];
  const issues: ValidationIssue[] = [];
  if (!/^[a-zA-Z0-9_-]{3,100}$/.test(input.id)) issues.push({ path: 'id', code: 'invalid_id', message: 'Invalid automation identifier.' });
  if (!/^[a-zA-Z0-9_-]{3,100}$/.test(input.organisationId)) issues.push({ path: 'organisationId', code: 'invalid_id', message: 'Invalid organisation identifier.' });
  if (!/^[a-zA-Z0-9_-]{3,100}$/.test(input.createdBy)) issues.push({ path: 'createdBy', code: 'invalid_id', message: 'Invalid creator identifier.' });
  if (!input.name.trim() || input.name.length > AUTOMATION_LIMITS.maxNameLength) issues.push({ path: 'name', code: 'invalid_name', message: 'Name must be 1–80 characters.' });
  if (!Array.isArray(input.conditions) || input.conditions.length > AUTOMATION_LIMITS.maxConditions) issues.push({ path: 'conditions', code: 'too_many', message: 'A maximum of 10 conditions is allowed.' });
  else input.conditions.forEach((condition, index) => issues.push(...validateCondition(condition, index)));
  if (!Array.isArray(input.actions) || input.actions.length < 1 || input.actions.length > AUTOMATION_LIMITS.maxActions) issues.push({ path: 'actions', code: 'invalid_count', message: 'Choose between 1 and 5 actions.' });
  else input.actions.forEach((action, index) => issues.push(...validateAction(action, index)));
  issues.push(...validateTrigger(input.trigger));
  if (!Number.isFinite(Date.parse(input.createdAt)) || !Number.isFinite(Date.parse(input.updatedAt))) issues.push({ path: 'timestamps', code: 'invalid_date', message: 'Creation and update timestamps must be valid dates.' });
  return issues;
}

export function planAutomationRun(definition: AutomationDefinition, context: { userId: string; organisationId: string }) {
  const issues = validateAutomation(definition);
  if (issues.length) throw new Error('Automation validation failed: ' + issues.map(issue => issue.code).join(','));
  if (!definition.enabled) throw new Error('Automation is disabled.');
  if (definition.organisationId !== context.organisationId || definition.createdBy !== context.userId) {
    throw new Error('Automation is outside the caller context.');
  }
  return {
    automationId: definition.id,
    organisationId: context.organisationId,
    actions: definition.actions.map(action => ({ ...action })),
    requiresApproval: definition.actions.some(action => action.type === 'call_webhook'),
    executionMode: 'queued' as const,
  };
}
