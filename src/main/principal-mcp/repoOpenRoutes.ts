import { BrowserWindow } from 'electron';
import type { Application } from 'express';
import { createPurl } from '@principal-ai/alexandria-core-library';
import { WindowEvent } from '../../shared/ipc-events/WindowEvents';
import { applicationWindows } from '../window/modernWindowManager';
import { PrimaryWindowType } from '../window/types';
import { parseCloneTarget } from '../repos/cloneTarget';

/** Repository roots only, not arbitrary web pages or GitHub subpaths. */
export function parseRepositoryOpenTarget(value: unknown) {
  if (typeof value !== 'string') return undefined;
  const repo = value.trim();
  if (
    !/^(?:pkg:github\/|https:\/\/github\.com\/)?[A-Za-z0-9_-]+\/[A-Za-z0-9_.-]+\/?$/i.test(
      repo,
    )
  ) {
    return undefined;
  }
  const parsed = parseCloneTarget(repo);
  if (!parsed.ok || parsed.target.host !== 'github.com') return undefined;
  const { owner, repo: name } = parsed.target;
  return {
    owner,
    name,
    purl: createPurl({ type: 'github', namespace: owner, name }),
  };
}

export function registerRepoOpenRoutes(app: Application): void {
  app.post('/api/repos/open', (req, res) => {
    if (req.headers.origin || req.headers['sec-fetch-site']) {
      res.status(403).json({
        success: false,
        error: 'browser-origin requests are not allowed',
      });
      return;
    }
    const target = parseRepositoryOpenTarget(req.body?.repo);
    if (!target) {
      res.status(400).json({
        success: false,
        error:
          'repo must be a GitHub owner/repo slug, pkg:github/owner/repo PURL, or https://github.com/owner/repo URL',
      });
      return;
    }
    try {
      const focused = BrowserWindow.getFocusedWindow();
      const host =
        focused && !focused.isDestroyed()
          ? applicationWindows.get(focused.id)
          : undefined;
      if (!host || host.metadata.primaryType !== PrimaryWindowType.MAIN) {
        res.json({
          success: true,
          delivered: false,
          purl: target.purl,
          reason: 'no-focused-repository-host',
        });
        return;
      }
      // Reuse Quick Open's native repository explorer, without cloning or
      // registering anything. The renderer focuses an existing tab by PURL.
      host.window.webContents.send(WindowEvent.OPEN_REPOSITORY_EXPLORER, {
        owner: target.owner,
        name: target.name,
      });
      res.json({ success: true, delivered: true, purl: target.purl });
    } catch {
      res.status(500).json({
        success: false,
        error: 'failed to dispatch repository open',
      });
    }
  });
}
