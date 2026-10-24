import { useEffect, useState } from 'react';
import type { HomePinnedTab } from '../../../shared/types/userPreferences.types';
import { TopicService } from '../../main-process-api/TopicService';
import { SubsystemModelService } from '../../main-process-api/SubsystemModelService';

/** File-anchored model PURLs still identify the same repository. */
export function singleRepoScope(purls: readonly string[]): string | undefined {
  const repos = new Set(
    purls.map((purl) => purl.split('#')[0]).filter(Boolean),
  );
  return repos.size === 1 ? [...repos][0] : undefined;
}

/** Resolve existing pins too, without persisting a stale copy of their scope. */
export function usePinnedRepoScopes(
  pins: readonly HomePinnedTab[],
): ReadonlyMap<string, string> {
  const [scopes, setScopes] = useState<ReadonlyMap<string, string>>(new Map());

  useEffect(() => {
    let sequence = 0;
    let cancelled = false;
    const load = async () => {
      const current = ++sequence;
      const results = await Promise.allSettled(
        pins.map(async (pin): Promise<[string, string | undefined]> => {
          if (pin.kind === 'topic' && pin.topicId) {
            const topic = await TopicService.getTopic(pin.topicId);
            return [pin.id, singleRepoScope(topic?.repos ?? [])];
          }
          if (pin.kind === 'subsystem-model' && pin.modelId) {
            const model = await SubsystemModelService.get(pin.modelId);
            const purls = [
              ...(model?.components.map((component) => component.purl) ?? []),
              ...(model?.trails?.flatMap((trail) =>
                trail.steps.flatMap((step) => [
                  step.purl,
                  ...(step.target ? [step.target.purl] : []),
                ]),
              ) ?? []),
            ];
            return [pin.id, singleRepoScope(purls)];
          }
          return [pin.id, undefined];
        }),
      );
      if (cancelled || current !== sequence) return;
      const next = new Map<string, string>();
      for (const result of results) {
        if (result.status === 'fulfilled') {
          const [id, purl] = result.value;
          if (purl) next.set(id, purl);
        }
      }
      setScopes(next);
    };
    void load();
    const off = TopicService.onTopicChange(() => void load());
    // Models have no change subscription; refresh after edits outside Home.
    const refresh = () => void load();
    window.addEventListener('focus', refresh);
    return () => {
      cancelled = true;
      off();
      window.removeEventListener('focus', refresh);
    };
  }, [pins]);

  return scopes;
}
