import { createSecurityReport, renderMarkdownReport, type SecurityReportInput } from './report.js';

export function exportSecurityReport(input: SecurityReportInput): { report: ReturnType<typeof createSecurityReport>; markdown: string } {
  const report = createSecurityReport(input);
  return { report, markdown: renderMarkdownReport(report) };
}
