import { readFileSync, writeFileSync } from 'node:fs';
import { createSecurityReport, renderMarkdownReport } from './report.js';

export function exportReport(inputPath: string, outputPath: string): void {
  const input = JSON.parse(readFileSync(inputPath, 'utf8'));
  const report = createSecurityReport(input);
  writeFileSync(outputPath, renderMarkdownReport(report), 'utf8');
}
