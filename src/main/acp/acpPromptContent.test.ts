import os from 'os';
import path from 'path';
import { pathToFileURL } from 'url';
import {
  artifactUri,
  buildAcpPromptContent,
  formatAssociatedArtifacts,
} from './acpPromptContent';
import type { AcpArtifactAssociation } from '../../shared/main-process-api-interfaces/AcpAPI';

const topic: AcpArtifactAssociation = {
  kind: 'topic',
  id: 'topic/1',
  title: 'Bridge topic',
};
const model: AcpArtifactAssociation = {
  kind: 'subsystem-model',
  id: 'model-1',
};
const drawing: AcpArtifactAssociation = {
  kind: 'drawing',
  id: 'notes',
  title: 'Agent notes',
};

describe('acpPromptContent', () => {
  it('sends plain text when no artifacts are attached', () => {
    expect(buildAcpPromptContent({ text: 'hello', artifacts: [] })).toEqual([
      { type: 'text', text: 'hello' },
    ]);
  });

  it('adds a session preamble, resource links, then user text', () => {
    const content = buildAcpPromptContent({
      text: 'hello',
      artifacts: [topic, model],
    });

    expect(content[0]).toEqual({
      type: 'text',
      text: formatAssociatedArtifacts([topic, model]),
    });
    expect(content[1]).toMatchObject({
      type: 'resource_link',
      name: 'Bridge topic',
      uri: artifactUri(topic),
    });
    expect(content[2]).toMatchObject({
      type: 'resource_link',
      name: 'subsystem model model-1',
    });
    expect(content[content.length - 1]).toEqual({
      type: 'text',
      text: 'hello',
    });
  });

  it('includes staged artifacts once and dedupes links already associated', () => {
    const content = buildAcpPromptContent({
      text: 'hello',
      artifacts: [topic],
      stagedArtifacts: [topic, drawing],
    });

    expect(
      content.filter((block) => block.type === 'resource_link'),
    ).toHaveLength(2);
    expect(
      content.some(
        (block) => block.type === 'text' && block.text.includes('attached'),
      ),
    ).toBe(true);
  });

  it('builds bridge URLs and file URLs for artifact kinds', () => {
    expect(artifactUri(topic)).toMatch(/\/api\/topics\/topic%2F1$/);
    expect(artifactUri(model)).toMatch(/\/api\/subsystem-models\/model-1$/);
    expect(artifactUri(drawing)).toBe(
      pathToFileURL(
        path.join(os.homedir(), '.alexandria', 'drawings', 'notes.excalidraw'),
      ).href,
    );
  });
});
