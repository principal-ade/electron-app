import {
  type CodeHighlighterPlugin,
  defaultRemarkPlugins,
  Streamdown,
  type StreamdownProps,
} from 'streamdown';
import 'streamdown/styles.css';

const codeThemes: ['github-light', 'github-dark'] = [
  'github-light',
  'github-dark',
];

type Highlighted = Parameters<
  NonNullable<Parameters<CodeHighlighterPlugin['highlight']>[1]>
>[0];

let codePluginPromise: Promise<CodeHighlighterPlugin> | undefined;
let loadedCodePlugin: CodeHighlighterPlugin | undefined;

function loadCodePlugin(): Promise<CodeHighlighterPlugin> {
  codePluginPromise ??= import('@streamdown/code').then(
    ({ createCodePlugin }) => createCodePlugin({ themes: codeThemes }),
  );
  return codePluginPromise;
}

const markdownPlugins: NonNullable<StreamdownProps['plugins']> = {
  code: {
    name: 'shiki',
    type: 'code-highlighter',
    getThemes: () => codeThemes,
    supportsLanguage: (language) =>
      loadedCodePlugin?.supportsLanguage(language) ?? true,
    getSupportedLanguages: () =>
      loadedCodePlugin?.getSupportedLanguages() ?? [],
    highlight(options, callback) {
      if (loadedCodePlugin)
        return loadedCodePlugin.highlight(options, callback);

      loadCodePlugin()
        .then((plugin) => {
          loadedCodePlugin = plugin;
          const highlighted: Highlighted | null = plugin.highlight(
            options,
            callback,
          );
          if (highlighted) callback?.(highlighted);
        })
        .catch((error: unknown) => {
          console.error('Could not load Markdown code highlighting:', error);
          codePluginPromise = undefined;
        });
      return null;
    },
  },
};

type MarkdownNode = {
  type: string;
  value?: string;
  children?: MarkdownNode[];
};

const lineEnding = /\r\n|\r|\n/;

function preserveChatLineBreaks(node: MarkdownNode): void {
  if (!node.children) return;
  node.children = node.children.flatMap((child) => {
    if (
      child.type !== 'text' ||
      !child.value ||
      !lineEnding.test(child.value)
    ) {
      preserveChatLineBreaks(child);
      return [child];
    }
    return child.value
      .split(lineEnding)
      .flatMap((line, index) => [
        ...(index > 0 ? [{ type: 'break' }] : []),
        ...(line ? [{ type: 'text', value: line }] : []),
      ]);
  });
}

const replyRemarkPlugins: NonNullable<StreamdownProps['remarkPlugins']> = [
  ...Object.values(defaultRemarkPlugins),
  () => (tree: MarkdownNode) => preserveChatLineBreaks(tree),
];

export function OpenBotMarkdown({
  text,
  streaming = false,
}: {
  text: string;
  streaming?: boolean;
}) {
  return (
    <Streamdown
      className="openbot-chat__markdown"
      mode={streaming ? 'streaming' : 'static'}
      plugins={markdownPlugins}
      remarkPlugins={replyRemarkPlugins}
    >
      {text}
    </Streamdown>
  );
}
