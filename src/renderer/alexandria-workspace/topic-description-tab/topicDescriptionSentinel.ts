/**
 * Sentinel-path plumbing that lets the file-backed `MDXEditorPanel` edit a
 * topic's in-memory `description` as if it were a markdown file on disk.
 *
 * The panel only ever touches the filesystem through its injected
 * `readFile`/`writeFile` actions, so we hand it a synthetic path
 * (`topic://<id>/description.md`) and route reads/writes for that path to
 * `TopicService` instead of the disk. The `.md` suffix makes the editor treat
 * the content as markdown. Any non-sentinel path is delegated to the host's
 * real file actions.
 */

import { TopicService } from '../../main-process-api/TopicService';

const SENTINEL_PREFIX = 'topic://';
const SENTINEL_SUFFIX = '/description.md';

/** Build the synthetic markdown path for a topic's description. */
export const buildTopicDescriptionPath = (topicId: string): string =>
  `${SENTINEL_PREFIX}${topicId}${SENTINEL_SUFFIX}`;

/** Pull the topic id back out of a sentinel path, or null if it isn't one. */
export const parseTopicDescriptionPath = (path: string): string | null => {
  if (!path.startsWith(SENTINEL_PREFIX) || !path.endsWith(SENTINEL_SUFFIX)) {
    return null;
  }
  const id = path.slice(SENTINEL_PREFIX.length, -SENTINEL_SUFFIX.length);
  return id.length > 0 ? id : null;
};

export const isTopicDescriptionPath = (path: string): boolean =>
  parseTopicDescriptionPath(path) !== null;

/**
 * Read a topic's description for the editor. Always fetches fresh so the tab
 * reflects edits made elsewhere (e.g. the trail brief) since it was opened.
 * Returns '' for an empty/absent description — the editor needs a string.
 */
export const readTopicDescription = async (path: string): Promise<string> => {
  const topicId = parseTopicDescriptionPath(path);
  if (!topicId) {
    throw new Error(`Not a topic-description path: ${path}`);
  }
  const topic = await TopicService.getTopic(topicId);
  return topic?.description ?? '';
};

/** Persist edited markdown back onto the topic via a partial patch. */
export const writeTopicDescription = async (
  path: string,
  content: string,
): Promise<void> => {
  const topicId = parseTopicDescriptionPath(path);
  if (!topicId) {
    throw new Error(`Not a topic-description path: ${path}`);
  }
  await TopicService.updateTopic(topicId, { description: content });
};
