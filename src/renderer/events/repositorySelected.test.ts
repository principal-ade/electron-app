import {
  createLocalRepoPurl,
  type Purl,
} from '@principal-ai/alexandria-core-library';
import { payloadFromPurl } from './repositorySelected';

/**
 * `payloadFromPurl` is the shape a surface uses when it only knows a repo's
 * canonical purl (e.g. a topic's declared `repos`). It seeds the GitHub identity
 * for a GitHub purl so `openProjectInfo` can route a remote-only repo to the
 * explorer, and leaves it absent otherwise.
 */
describe('payloadFromPurl', () => {
  it('preserves the purl and seeds the GitHub identity for a GitHub purl', () => {
    const purl = 'pkg:github/acme/web' as Purl;
    const payload = payloadFromPurl(purl);

    expect(payload.purl).toBe(purl);
    expect(payload.github?.owner).toBe('acme');
    expect(payload.github?.name).toBe('web');
    expect(payload.github?.id).toBe('acme/web');
  });

  it('does not invent a GitHub identity for a local purl', () => {
    const purl = createLocalRepoPurl('/Users/me/dev/widgets');
    const payload = payloadFromPurl(purl);

    expect(payload.purl).toBe(purl);
    expect(payload.github).toBeUndefined();
  });

  it('leaves clone details out — the tab re-resolves them by purl', () => {
    const payload = payloadFromPurl('pkg:github/acme/web' as Purl);

    expect(payload.localEntry).toBeUndefined();
    expect(payload.localClones).toBeUndefined();
  });
});
