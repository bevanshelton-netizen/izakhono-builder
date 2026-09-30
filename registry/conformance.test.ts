import { runRegistryConformance } from './conformance';

const result = runRegistryConformance();
if (!result.ok) throw new Error('registry conformance failed');
