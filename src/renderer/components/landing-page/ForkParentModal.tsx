import React, { useState, useEffect } from 'react';
import { X, GitFork, AlertCircle } from 'lucide-react';
import { useTheme } from 'themed-markdown';
import { parseGitHubUrl } from '@principal-ai/repository-abstraction';
import type { Repository } from '../../../shared/types/repository.types';
import { EphemeralRepositoryCard } from './EphemeralRepositoryCard';
import { RepositoryService } from '../../main-process-api/RepositoryService';
interface ForkParentModalProps {
  isOpen: boolean;
  onClose: () => void;
  parentRepoInfo: { owner: string; name: string; url: string } | null;
  onRepositoryAdded: () => void;
}

export const ForkParentModal: React.FC<ForkParentModalProps> = ({
  isOpen,
  onClose,
  parentRepoInfo,
  onRepositoryAdded,
}) => {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parentRepository, setParentRepository] = useState<Repository | null>(
    null,
  );
  const [fetchingInfo, setFetchingInfo] = useState(false);

  useEffect(() => {
    if (isOpen && parentRepoInfo) {
      fetchParentRepositoryInfo();
    } else {
      // Reset state when modal closes
      setParentRepository(null);
      setError(null);
    }
  }, [isOpen, parentRepoInfo]);

  const fetchParentRepositoryInfo = async () => {
    if (!parentRepoInfo) return;

    setFetchingInfo(true);
    setError(null);

    try {
      // Check if we already have this repository
      const existingRepo = await RepositoryService.getRepository(
        parentRepoInfo.url,
      );

      if (existingRepo) {
        setParentRepository(existingRepo);
      } else {
        // Fetch repository information from GitHub API
        try {
          const response = await fetch(
            `https://api.github.com/repos/${parentRepoInfo.owner}/${parentRepoInfo.name}`,
            {
              headers: {
                Accept: 'application/vnd.github.v3+json',
                'User-Agent': 'PrincipleMD',
              },
            },
          );

          if (response.ok) {
            const repoData = await response.json();

            // Create a temporary Repository object for display
            const tempRepo: Repository = {
              remoteUrl: parentRepoInfo.url,
              name: parentRepoInfo.name,
              owner: parentRepoInfo.owner,
              vcsType: 'github',
              localClones: [],
              tags: [],
              metadata: {
                description: repoData.description,
                language: repoData.language,
                starCount: repoData.stargazers_count,
                forkCount: repoData.forks_count,
                defaultBranch: repoData.default_branch,
                isPrivate: repoData.private,
                license: repoData.license
                  ? {
                      key: repoData.license.key,
                      name: repoData.license.name,
                      spdxId: repoData.license.spdx_id,
                      url: repoData.license.url,
                    }
                  : undefined,
                topics: repoData.topics || [],
              },
              avatarUrl: repoData.owner?.avatar_url,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };

            setParentRepository(tempRepo);
          } else {
            throw new Error('Failed to fetch repository information');
          }
        } catch (fetchError) {
          console.error('Failed to fetch from GitHub API:', fetchError);
          // Create a minimal repository object even if fetch fails
          setParentRepository({
            remoteUrl: parentRepoInfo.url,
            name: parentRepoInfo.name,
            owner: parentRepoInfo.owner,
            vcsType: 'github',
            localClones: [],
            tags: [],
            avatarUrl: `https://github.com/${parentRepoInfo.owner}.png`,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          setError(
            'Unable to fetch complete repository information. You can still add it to your repositories.',
          );
        }
      }
    } finally {
      setFetchingInfo(false);
    }
  };

  const handleAddLocally = async () => {
    if (!parentRepository) return;

    setLoading(true);
    setError(null);

    try {
      const repoInfo = parseGitHubUrl(parentRepository.remoteUrl);
      if (!repoInfo) {
        throw new Error('Invalid repository URL');
      }

      // Add the repository to local storage
      await RepositoryService.addRepository({
        remoteUrl: parentRepository.remoteUrl,
        name: repoInfo.repo,
        owner: repoInfo.owner,
        metadata: parentRepository.metadata,
      });

      // Update last accessed time
      await RepositoryService.updateRepositoryAccess(
        parentRepository.remoteUrl,
      );

      // Notify parent component to reload repositories
      onRepositoryAdded();

      // Close the modal
      onClose();
    } catch (err) {
      console.error('Failed to add repository:', err);
      setError('Failed to add repository. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenInGitHub = () => {
    if (parentRepository) {
      window.open(parentRepository.remoteUrl, '_blank');
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: theme.colors.backgroundSecondary,
          borderRadius: '16px',
          padding: '24px',
          maxWidth: '600px',
          width: '90%',
          maxHeight: '80vh',
          overflow: 'auto',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
          animation: 'slideIn 0.3s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '20px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: `linear-gradient(135deg, ${theme.colors.primary}20, ${theme.colors.primary}40)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <GitFork size={20} color={theme.colors.primary} />
            </div>
            <div>
              <h3
                style={{
                  fontSize: '20px',
                  fontWeight: 600,
                  color: theme.colors.text,
                  margin: 0,
                }}
              >
                Fork Parent Repository
              </h3>
              <p
                style={{
                  fontSize: '13px',
                  color: theme.colors.textSecondary,
                  margin: '4px 0 0 0',
                }}
              >
                This repository was forked from another repository
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '8px',
              borderRadius: '8px',
              color: theme.colors.textSecondary,
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor =
                theme.colors.backgroundTertiary;
              e.currentTarget.style.color = theme.colors.text;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = theme.colors.textSecondary;
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        {fetchingInfo ? (
          <div
            style={{
              padding: '40px',
              textAlign: 'center',
              color: theme.colors.textSecondary,
            }}
          >
            <div
              style={{
                marginBottom: '16px',
                fontSize: '14px',
              }}
            >
              Fetching repository information...
            </div>
            <div
              style={{
                display: 'inline-block',
                width: '24px',
                height: '24px',
                border: `2px solid ${theme.colors.primary}`,
                borderTopColor: 'transparent',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
              }}
            />
          </div>
        ) : parentRepository ? (
          <>
            <div
              style={{
                backgroundColor: theme.colors.backgroundTertiary,
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '20px',
              }}
            >
              <p
                style={{
                  fontSize: '14px',
                  color: theme.colors.text,
                  margin: 0,
                  lineHeight: '1.5',
                }}
              >
                The parent repository{' '}
                <strong>
                  {parentRepository.owner}/{parentRepository.name}
                </strong>{' '}
                is not in your repository list. You can add it to track both the
                fork and its parent, or open it directly on GitHub.
              </p>
            </div>

            {error && (
              <div
                style={{
                  backgroundColor: '#ef444410',
                  border: '1px solid #ef444430',
                  borderRadius: '8px',
                  padding: '12px',
                  marginBottom: '16px',
                  display: 'flex',
                  gap: '8px',
                  alignItems: 'flex-start',
                }}
              >
                <AlertCircle
                  size={16}
                  color="#ef4444"
                  style={{ marginTop: '2px', flexShrink: 0 }}
                />
                <div
                  style={{
                    fontSize: '13px',
                    color: theme.colors.text,
                    lineHeight: '1.4',
                  }}
                >
                  {error}
                </div>
              </div>
            )}

            <EphemeralRepositoryCard
              repository={parentRepository}
              onAddLocally={handleAddLocally}
              onOpenInGitHub={handleOpenInGitHub}
              loading={loading}
            />
          </>
        ) : (
          <div
            style={{
              padding: '40px',
              textAlign: 'center',
              color: theme.colors.textSecondary,
            }}
          >
            No repository information available
          </div>
        )}
      </div>

      {/* Animation keyframes */}
      <style>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
