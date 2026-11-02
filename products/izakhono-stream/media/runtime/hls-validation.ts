/**
 * Deterministic validation gate for the HLS runtime contract.
 */

import type { HlsOutput } from "./hls-runtime";

export interface HlsValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateHlsOutput(output: HlsOutput): HlsValidationResult {
  const errors: string[] = [];

  if (!output.masterPlaylistUri.endsWith("master.m3u8")) {
    errors.push("master playlist URI is invalid");
  }
  if (output.renditions.length === 0) {
    errors.push("no HLS renditions supplied");
  }
  if (!output.authorizationRequired) {
    errors.push("authorization requirement must be enabled");
  }
  for (const rendition of output.renditions) {
    if (!rendition.uri) errors.push(`${rendition.id}: missing URI`);
    if (rendition.bandwidth <= 0) errors.push(`${rendition.id}: invalid bandwidth`);
    if (rendition.width <= 0 || rendition.height <= 0) {
      errors.push(`${rendition.id}: invalid dimensions`);
    }
  }

  return { valid: errors.length === 0, errors };
}
