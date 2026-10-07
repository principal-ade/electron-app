import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { IndustryMarkdownSlide } from 'themed-markdown';
import { FolderGit2 } from 'lucide-react';
import { parsePurl } from '@principal-ai/alexandria-core-library';
import type { PublishedTopic } from '@principal-ai/subsystems-core/node';
import { TopicService } from '../main-process-api/TopicService';

export const TopicTabContent: React.FC<{ topicId: string }> = ({ topicId }) => {
  const { theme } = useTheme();
  const [topic, setTopic] = React.useState<PublishedTopic | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void TopicService.fetchSharedById(topicId)
      .then(({ topic: fetched }) => {
        if (!cancelled) setTopic(fetched as PublishedTopic);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof Error && err.message
              ? err.message
              : 'Could not load this topic.',
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [topicId]);

  if (loading) return <CenteredMessage>Loading topic…</CenteredMessage>;
  if (error) return <CenteredMessage>{error}</CenteredMessage>;
  if (!topic) return null;

  const projects = (topic.repos ?? []).flatMap((purl) => {
    const parsed = parsePurl(purl);
    if (!parsed) return [];
    const name =
      parsed.namespace === 'local'
        ? parsed.name.split('-').filter(Boolean).at(-1) || parsed.name
        : parsed.name;
    const label =
      parsed.namespace && parsed.namespace !== 'local'
        ? `${parsed.namespace}/${name}`
        : name;
    return [{ purl, label }];
  });

  return (
    <div
      style={{
        height: '100%',
        overflowY: 'auto',
        backgroundColor: theme.colors.background,
      }}
    >
      <article
        style={{
          maxWidth: 820,
          margin: '0 auto',
          padding: '24px 28px 36px',
          color: theme.colors.text,
          fontFamily: theme.fonts.body,
        }}
      >
        <h1
          style={{
            margin: 0,
            color: theme.colors.primary,
            fontSize: theme.fontSizes[4],
            lineHeight: 1.2,
          }}
        >
          {topic.title}
        </h1>
        {topic.createdBy?.githubLogin && (
          <div
            style={{
              marginTop: 10,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              color: theme.colors.textSecondary,
              fontSize: theme.fontSizes[1],
            }}
          >
            <span>by</span>
            <img
              src={`https://github.com/${topic.createdBy.githubLogin}.png?size=48`}
              alt=""
              width={24}
              height={24}
              style={{
                borderRadius: '50%',
                border: `1px solid ${theme.colors.border}`,
              }}
            />
            <span style={{ fontWeight: 600, color: theme.colors.text }}>
              @{topic.createdBy.githubLogin}
            </span>
          </div>
        )}

        {projects.length > 0 && (
          <section style={{ marginTop: 24 }}>
            <h2
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                margin: 0,
                fontSize: theme.fontSizes[1],
                color: theme.colors.textSecondary,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              <FolderGit2 size={14} />
              Projects
            </h2>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 8,
                marginTop: 10,
              }}
            >
              {projects.map(({ purl, label }) => (
                <span
                  key={purl}
                  title={purl}
                  style={{
                    padding: '6px 10px',
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: 6,
                    color: theme.colors.text,
                    fontSize: theme.fontSizes[1],
                  }}
                >
                  {label}
                </span>
              ))}
            </div>
          </section>
        )}

        {topic.description?.trim() && (
          <div style={{ marginTop: 24 }}>
            <IndustryMarkdownSlide
              content={topic.description}
              slideIdPrefix={`topic-${topic.id}`}
              slideIndex={0}
              isVisible
              theme={theme}
              transparentBackground
              disableScroll
              disableBasePadding={{ horizontal: true }}
              enableKeyboardScrolling={false}
            />
          </div>
        )}
      </article>
    </div>
  );
};

const CenteredMessage: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { theme } = useTheme();
  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        backgroundColor: theme.colors.background,
        color: theme.colors.textSecondary,
        fontFamily: theme.fonts.body,
        fontSize: theme.fontSizes[1],
        textAlign: 'center',
      }}
    >
      {children}
    </div>
  );
};

export default TopicTabContent;
