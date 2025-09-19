import React, { useState, useEffect } from 'react';
import { X, Search, Star, GitFork, AlertCircle, Loader2 } from 'lucide-react';
import { useTheme } from 'themed-markdown';
import { RepositoryService } from '../../main-process-api/RepositoryService';

interface GitHubSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectRepository: (repo: {
    owner: string;
    name: string;
    remoteUrl: string;
    description?: string;
  }) => void;
}

export const GitHubSearchModal: React.FC<GitHubSearchModalProps> = ({
  isOpen,
  onClose,
  onSelectRepository,
}) => {
  const { theme } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setSearchResults([]);
      setError(null);
      setHasSearched(false);
    }
  }, [isOpen]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setError(null);
    setHasSearched(true);

    try {
      const results = await RepositoryService.searchGitHubRepositories(
        searchQuery,
        {
          sort: 'stars',
          order: 'desc',
          perPage: 20,
        },
      );
      setSearchResults(results.items || []);
    } catch (err) {
      console.error('Failed to search GitHub:', err);
      setError('Failed to search GitHub repositories. Please try again.');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isSearching) {
      handleSearch();
    }
  };

  const handleSelectRepo = (repo: any) => {
    const [owner, name] = repo.full_name.split('/');
    onSelectRepository({
      owner,
      name,
      remoteUrl: repo.html_url,
      description: repo.description,
    });
    onClose();
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
      }}
    >
      <div
        style={{
          backgroundColor: theme.colors.backgroundSecondary,
          borderRadius: '16px',
          padding: '32px',
          maxWidth: '800px',
          width: '90%',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '24px',
          }}
        >
          <div>
            <h2
              style={{
                fontSize: '24px',
                fontWeight: 600,
                color: theme.colors.text,
                margin: '0 0 8px 0',
              }}
            >
              Search GitHub Repositories
            </h2>
            <p
              style={{
                fontSize: '14px',
                color: theme.colors.textSecondary,
                margin: 0,
              }}
            >
              Search for public repositories on GitHub
            </p>
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

        {/* Search Bar */}
        <div
          style={{
            display: 'flex',
            gap: '12px',
            marginBottom: '24px',
          }}
        >
          <div
            style={{
              flex: 1,
              position: 'relative',
            }}
          >
            <Search
              size={18}
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: theme.colors.textSecondary,
              }}
            />
            <input
              type="text"
              placeholder="Search repositories (e.g., react, tensorflow, vue...)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              autoFocus
              style={{
                width: '100%',
                padding: '10px 12px 10px 40px',
                borderRadius: '8px',
                border: `1px solid ${theme.colors.border}`,
                backgroundColor: theme.colors.background,
                color: theme.colors.text,
                fontSize: '14px',
                outline: 'none',
                transition: 'border-color 0.2s',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = theme.colors.primary;
              }}
              onBlur={(e) => {
                e.target.style.borderColor = theme.colors.border;
              }}
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={isSearching || !searchQuery.trim()}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: theme.colors.primary,
              color: theme.colors.background,
              fontSize: '14px',
              fontWeight: 500,
              cursor:
                isSearching || !searchQuery.trim() ? 'not-allowed' : 'pointer',
              opacity: isSearching || !searchQuery.trim() ? 0.5 : 1,
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
            onMouseEnter={(e) => {
              if (!isSearching && searchQuery.trim()) {
                e.currentTarget.style.opacity = '0.9';
              }
            }}
            onMouseLeave={(e) => {
              if (!isSearching && searchQuery.trim()) {
                e.currentTarget.style.opacity = '1';
              }
            }}
          >
            {isSearching ? (
              <>
                <Loader2
                  size={16}
                  style={{ animation: 'spin 1s linear infinite' }}
                />
                Searching...
              </>
            ) : (
              <>
                <Search size={16} />
                Search
              </>
            )}
          </button>
        </div>

        {/* Results */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            minHeight: 0,
          }}
        >
          {error && (
            <div
              style={{
                padding: '16px',
                borderRadius: '8px',
                backgroundColor: `${theme.colors.error || '#ef4444'}20`,
                border: `1px solid ${theme.colors.error || '#ef4444'}40`,
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <AlertCircle size={20} color={theme.colors.error || '#ef4444'} />
              <span style={{ color: theme.colors.text, fontSize: '14px' }}>
                {error}
              </span>
            </div>
          )}

          {isSearching && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '48px',
                color: theme.colors.textSecondary,
              }}
            >
              <Loader2
                size={32}
                style={{
                  animation: 'spin 1s linear infinite',
                  marginBottom: '16px',
                }}
              />
              <p>Searching GitHub repositories...</p>
            </div>
          )}

          {!isSearching &&
            hasSearched &&
            searchResults.length === 0 &&
            !error && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '48px',
                  color: theme.colors.textSecondary,
                }}
              >
                <Search
                  size={48}
                  style={{ marginBottom: '16px', opacity: 0.5 }}
                />
                <p style={{ fontSize: '16px', marginBottom: '8px' }}>
                  No repositories found
                </p>
                <p style={{ fontSize: '14px', opacity: 0.7 }}>
                  Try a different search term
                </p>
              </div>
            )}

          {!isSearching && searchResults.length > 0 && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              {searchResults.map((repo) => (
                <button
                  key={repo.id}
                  onClick={() => handleSelectRepo(repo)}
                  style={{
                    padding: '16px',
                    borderRadius: '8px',
                    border: `1px solid ${theme.colors.border}`,
                    backgroundColor: theme.colors.background,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    textAlign: 'left',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor =
                      theme.colors.backgroundTertiary;
                    e.currentTarget.style.borderColor = theme.colors.primary;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor =
                      theme.colors.background;
                    e.currentTarget.style.borderColor = theme.colors.border;
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <h3
                        style={{
                          fontSize: '16px',
                          fontWeight: 600,
                          color: theme.colors.primary,
                          margin: '0 0 4px 0',
                        }}
                      >
                        {repo.full_name}
                      </h3>
                      {repo.description && (
                        <p
                          style={{
                            fontSize: '14px',
                            color: theme.colors.textSecondary,
                            margin: '0 0 8px 0',
                            lineHeight: 1.4,
                          }}
                        >
                          {repo.description}
                        </p>
                      )}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '16px',
                          fontSize: '13px',
                          color: theme.colors.textSecondary,
                        }}
                      >
                        {repo.language && (
                          <span
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <span
                              style={{
                                width: '12px',
                                height: '12px',
                                borderRadius: '50%',
                                backgroundColor:
                                  theme.colors.accent || '#8b7355',
                                display: 'inline-block',
                              }}
                            />
                            {repo.language}
                          </span>
                        )}
                        <span
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <Star size={14} />
                          {repo.stargazers_count.toLocaleString()}
                        </span>
                        <span
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <GitFork size={14} />
                          {repo.forks_count.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {!isSearching && !hasSearched && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '48px',
                color: theme.colors.textSecondary,
              }}
            >
              <Search
                size={48}
                style={{ marginBottom: '16px', opacity: 0.5 }}
              />
              <p style={{ fontSize: '16px', marginBottom: '8px' }}>
                Search for repositories
              </p>
              <p style={{ fontSize: '14px', opacity: 0.7 }}>
                Enter a search term above to find GitHub repositories
              </p>
            </div>
          )}
        </div>

        {/* Add animation styles */}
        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );
};
