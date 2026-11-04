import { runNativeBuilder } from './native-builder.mjs';

/**
 * IZAKHONO-native is the sole Builder execution provider.
 * Legacy external-builder environment variables are deliberately ignored.
 */
export async function runBuilderAdapter(task) {
  const result = await runNativeBuilder(task);
  return {
    ...result,
    provider: 'izakhono-native',
  };
}
