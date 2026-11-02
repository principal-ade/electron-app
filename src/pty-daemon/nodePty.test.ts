import * as path from 'path';
import { resolveNodePtyModule } from './nodePty';

describe('resolveNodePtyModule', () => {
  it('prefers the asar copy when the app is packaged', () => {
    const resourcesPath = '/Applications/Principal AI.app/Contents/Resources';

    expect(
      resolveNodePtyModule({ resourcesPath, fileExists: () => true }),
    ).toBe(path.join(resourcesPath, 'app.asar', 'node_modules', 'node-pty'));
  });

  it('falls back to the bare module when the asar copy is missing', () => {
    expect(
      resolveNodePtyModule({
        resourcesPath: '/Applications/Principal AI.app/Contents/Resources',
        fileExists: () => false,
      }),
    ).toBe('node-pty');
  });

  it('falls back to the bare module outside a packaged app', () => {
    expect(
      resolveNodePtyModule({ resourcesPath: '', fileExists: () => true }),
    ).toBe('node-pty');
  });
});
