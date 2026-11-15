import { StreamdownMarkdown } from '../../components/StreamdownMarkdown';

export function OpenBotMarkdown({
  text,
  streaming = false,
}: {
  text: string;
  streaming?: boolean;
}) {
  return (
    <StreamdownMarkdown
      className="openbot-chat__markdown"
      streaming={streaming}
      text={text}
    />
  );
}
