export const FORTRESS_REPORT_VERSION = '1.7';
export const FORTRESS_REPORT_FORMATS = ['json', 'markdown'] as const;
export type FortressReportFormat = typeof FORTRESS_REPORT_FORMATS[number];
