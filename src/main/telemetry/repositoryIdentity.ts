import { createHmac, randomBytes } from 'node:crypto';
import path from 'node:path';

// Correlate telemetry for the same checkout during one app run without
// exporting its local path or a reusable hash of that path.
const processSalt = randomBytes(32);

export function repositoryTelemetryId(repositoryPath: string): string {
  return createHmac('sha256', processSalt)
    .update(path.resolve(repositoryPath))
    .digest('hex')
    .slice(0, 16);
}
