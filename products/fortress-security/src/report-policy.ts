import type { ReportRole } from './report.js';

export const REPORT_EXPORT_ROLES: readonly ReportRole[] = ['OWNER', 'SECURITY_ADMIN', 'ANALYST'];

export function isReportExportRole(role: ReportRole): boolean {
  return REPORT_EXPORT_ROLES.includes(role);
}
