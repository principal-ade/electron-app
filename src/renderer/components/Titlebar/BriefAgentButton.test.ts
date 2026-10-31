import { buildBriefingText } from './BriefAgentButton';

jest.mock('../../main-process-api/TopicService', () => ({ TopicService: {} }));
jest.mock('@principal-ade/industry-theme', () => ({ useTheme: jest.fn() }));

test('briefing includes a skill-independent edit and verification workflow', () => {
  const text = buildBriefingText({
    topicId: 'topic-1',
    topicTitle: 'Working brief',
  });
  expect(text).toContain('/api/topics/topic-1');
  expect(text).toContain('topic-context');
  expect(text).toContain('/routes');
  expect(text).toContain('expectedRevision');
  expect(text).toContain('On 409, reread and reconcile');
  expect(text).toContain(
    'do not write topic files directly or delete and recreate',
  );
  expect(text).toContain('read it back to verify');
});
