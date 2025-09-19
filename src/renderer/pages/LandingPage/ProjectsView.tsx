import React, { useState, useEffect } from 'react';
import { Code2, Star, Package, Trash2 } from 'lucide-react';

import { useTheme } from 'themed-markdown';

import type {
  Repository,
  LocalClone,
} from '../../../shared/types/repository.types';

import { RepositoryService } from '../../main-process-api/RepositoryService';
import { FileSystemService } from '../../main-process-api/FileSystemService';
import { GitService } from '../../main-process-api/GitService';
import { UserPreferencesService } from '../../main-process-api/UserPreferencesService';
import { GitWatcherService } from '../../main-process-api/GitWatcherService';
import { ShellService } from '../../main-process-api/ShellService';

import { RepositoryCard } from '../../components/landing-page/RepositoryCard';
import { ForkParentModal } from '../../components/landing-page/ForkParentModal';
import { EmptyStateView } from '../../components/landing-page/EmptyStateView';
import { RepositorySettingsModal } from '../../components/landing-page/RepositorySettingsModal';
import { GitHubSearchModal } from '../../components/landing-page/GitHubSearchModal';
import { PasteLinkModal } from '../../components/landing-page/PasteLinkModal';

interface ProjectsViewProps {
  onConfigureAgents?: () => void;
}

type ProjectCategory = 'active' | 'following' | 'gitapps';

interface CategorizedProjects {
  active: Repository[];
  following: Repository[];
  gitapps: Repository[];
}

export const ProjectsView: React.FC<ProjectsViewProps> = ({
  onConfigureAgents,
}) => {
  const { theme } = useTheme();
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [categorizedProjects, setCategorizedProjects] =
    useState<CategorizedProjects>({
      active: [],
      following: [],
      gitapps: [],
    });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gitStatuses, setGitStatuses] = useState<Record<string, any>>({});
  const [selectedCategory, setSelectedCategoryState] =
    useState<ProjectCategory>('active');
  // Note: use setSelectedCategory (not setSelectedCategoryState) to also save preference
  const [draggedRepo, setDraggedRepo] = useState<Repository | null>(null);
  const [dragOverCategory, setDragOverCategory] =
    useState<ProjectCategory | null>(null);
  const [animatedCategory, setAnimatedCategory] =
    useState<ProjectCategory | null>(null);
  const [isDraggingOverTrash, setIsDraggingOverTrash] = useState(false);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPasteLinkModal, setShowPasteLinkModal] = useState(false);
  const [pasteUrl, setPasteUrl] = useState('');
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [repoToDelete, setRepoToDelete] = useState<Repository | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsRepository, setSettingsRepository] =
    useState<Repository | null>(null);

  // Custom setter for selectedCategory that also saves to preferences
  const setSelectedCategory = async (category: ProjectCategory) => {
    setSelectedCategoryState(category);
    try {
      const current = await UserPreferencesService.getPreferences();
      await UserPreferencesService.updatePreferences({
        ...current,
        projectsViewSelectedCategory: category,
      });
    } catch (err) {
      console.error('Failed to save selected category preference:', err);
    }
  };
  const [showForkParentModal, setShowForkParentModal] = useState(false);
  const [forkParentInfo, setForkParentInfo] = useState<{
    owner: string;
    name: string;
    url: string;
  } | null>(null);

  // Listen for add project events from header
  useEffect(() => {
    const handleAddLocalRepoEvent = () => {
      handleAddLocalRepo();
    };

    const handleAddGithubLinkEvent = () => {
      setPasteUrl('');
      setShowPasteLinkModal(true);
    };

    const handleSearchGithubEvent = () => {
      setShowAddModal(true);
    };

    window.addEventListener('add-local-repo', handleAddLocalRepoEvent);
    window.addEventListener('add-github-link', handleAddGithubLinkEvent);
    window.addEventListener('search-github', handleSearchGithubEvent);

    return () => {
      window.removeEventListener('add-local-repo', handleAddLocalRepoEvent);
      window.removeEventListener('add-github-link', handleAddGithubLinkEvent);
      window.removeEventListener('search-github', handleSearchGithubEvent);
    };
  }, []);

  // Load repositories
  const loadRepositories = async () => {
    try {
      setLoading(true);
      const repos = await RepositoryService.getRepositories();
      setRepositories(repos);

      // Categorize projects based on metadata or heuristics
      const categorized: CategorizedProjects = {
        active: [],
        following: [],
        gitapps: [],
      };

      repos.forEach((repo) => {
        console.log(
          'Repository loaded:',
          repo.name,
          'url:',
          repo.url,
          'remoteUrl:',
          repo.remoteUrl,
          'id:',
          repo.id,
          'metadata:',
          repo.metadata,
        );

        // First check if repo has a saved category in metadata
        if (repo.metadata?.category) {
          const savedCategory = repo.metadata.category as ProjectCategory;
          console.log(
            `Repository ${repo.name} has saved category: ${savedCategory}`,
          );
          if (savedCategory in categorized) {
            categorized[savedCategory].push(repo);
            return;
          }
        }

        // Otherwise use heuristics to categorize
        console.log(
          `Repository ${repo.name} has no saved category, using heuristics`,
        );
        // Check if it's a GitApp (could be based on metadata, naming convention, or specific markers)
        if (
          repo.metadata?.isGitApp ||
          repo.name.toLowerCase().includes('-app') ||
          repo.name.toLowerCase().includes('_app')
        ) {
          categorized.gitapps.push(repo);
        }
        // Check if it's actively worked on (has local clone with recent commits)
        else if (repo.localClones && repo.localClones.length > 0) {
          const hasRecentActivity = repo.localClones.some((clone) => {
            // You could check last commit date here if available
            return (
              clone.lastOpened &&
              Date.now() - new Date(clone.lastOpened).getTime() <
                7 * 24 * 60 * 60 * 1000
            ); // 7 days
          });

          if (hasRecentActivity) {
            categorized.active.push(repo);
          } else {
            categorized.following.push(repo);
          }
        }
        // Default to following if no local clone
        else {
          categorized.following.push(repo);
        }
      });

      setCategorizedProjects(categorized);

      // Load git status for all repos with local clones
      await loadGitStatusForRepos(repos);
    } catch (err) {
      console.error('Failed to load repositories:', err);
      setError('Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  // Load git status for repositories
  const loadGitStatusForRepos = async (repos: Repository[]) => {
    const statuses: Record<string, any> = {};

    for (const repo of repos) {
      if (repo.localClones && repo.localClones.length > 0) {
        for (const clone of repo.localClones) {
          try {
            const status = await GitService.getStatus(clone.path);
            statuses[`${repo.url}_${clone.path}`] = status;
          } catch (err) {
            console.error(`Failed to get git status for ${clone.path}:`, err);
          }
        }
      }
    }

    setGitStatuses(statuses);
  };

  // Initial load
  useEffect(() => {
    loadRepositories();
    loadSelectedCategoryPreference();
  }, []);

  // Listen for repository updates from main process
  useEffect(() => {
    const handleRepositoryUpdate = (updatedRepo: Repository) => {
      console.log('Repository updated:', updatedRepo);
      // Reload repositories to reflect the changes
      loadRepositories();
    };

    const handleLocalCloneMissing = (data: { repoPath: string }) => {
      console.log('Local clone missing:', data.repoPath);
      // Reload repositories to reflect the changes
      loadRepositories();
    };

    // Add listeners using GitService
    const unsubscribeRepoUpdate = GitService.onRepositoryUpdated(
      handleRepositoryUpdate,
    );
    const unsubscribeLocalMissing = GitService.onLocalCloneMissing(
      handleLocalCloneMissing,
    );

    // Cleanup
    return () => {
      unsubscribeRepoUpdate();
      unsubscribeLocalMissing();
    };
  }, []);

  // Load saved selected category preference
  const loadSelectedCategoryPreference = async () => {
    try {
      const preferences = await UserPreferencesService.getPreferences();
      const savedCategory =
        preferences.projectsViewSelectedCategory as ProjectCategory;
      if (
        savedCategory &&
        ['active', 'following', 'gitapps'].includes(savedCategory)
      ) {
        setSelectedCategoryState(savedCategory);
      }
    } catch (err) {
      console.error('Failed to load selected category preference:', err);
    }
  };

  // Handle adding local repository
  const handleAddLocalRepo = async () => {
    try {
      const result = await FileSystemService.selectDirectory({
        title: 'Select Local Repository',
        buttonLabel: 'Select Repository',
        properties: ['openDirectory'],
      });

      console.log('Directory selection result:', result);

      if (!result || result.canceled) {
        return;
      }

      // Handle both possible response formats
      const selectedPath =
        result.filePaths?.[0] || result.filePath || result.path;

      if (!selectedPath) {
        console.error('No path found in result:', result);
        setError('No directory was selected');
        return;
      }

      const gitInfo = await GitService.getRepositoryInfo(selectedPath);

      if (!gitInfo || !gitInfo.isRepository) {
        setError('Selected folder is not a Git repository');
        return;
      }

      // Check for remote URL
      if (gitInfo.remotes && gitInfo.remotes.length > 0) {
        const remote = gitInfo.remotes[0];

        // Add repository with remote URL
        await RepositoryService.addRepository({
          remoteUrl: remote.url,
          owner: remote.owner || 'unknown',
          name: remote.repo || gitInfo.root.split('/').pop() || 'repository',
          localPath: gitInfo.root,
          metadata: {
            defaultBranch: gitInfo.currentBranch || 'main',
          },
        });
      } else {
        // Local-only repository
        const repoName = gitInfo.root.split('/').pop() || 'local-repo';
        const localUrl = `file://${gitInfo.root}`;

        await RepositoryService.addRepository({
          remoteUrl: localUrl,
          name: repoName,
          owner: 'local',
          localPath: gitInfo.root,
          metadata: {
            defaultBranch: gitInfo.currentBranch || 'main',
            isLocalOnly: true,
          },
        });
      }

      // Reload repositories to show the new one
      await loadRepositories();
      setError(null);
    } catch (err) {
      console.error('Failed to add local repository:', err);
      setError('Failed to add local repository');
    }
  };

  const totalCount = repositories.length;
  const isEmpty = totalCount === 0;

  // Handle drag start
  const handleDragStart = (repo: Repository, e: React.DragEvent) => {
    setDraggedRepo(repo);
    e.dataTransfer.effectAllowed = 'move';
    // Add visual feedback
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.5';
    }
  };

  // Handle drag end
  const handleDragEnd = (e: React.DragEvent) => {
    setDraggedRepo(null);
    setDragOverCategory(null);
    setIsDraggingOverTrash(false);
    // Remove visual feedback
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1';
    }
  };

  // Handle drop on category
  const handleCategoryDrop = async (
    targetCategory: ProjectCategory,
    e: React.DragEvent,
  ) => {
    e.preventDefault();
    e.stopPropagation();

    if (!draggedRepo) return;

    console.log(
      'Dropping repo:',
      draggedRepo.name,
      'into category:',
      targetCategory,
    );
    console.log(
      'Repo identifiers - id:',
      draggedRepo.id,
      'url:',
      draggedRepo.url,
      'remoteUrl:',
      draggedRepo.remoteUrl,
    );

    // Remove repo from all categories (use remoteUrl as the unique identifier, or name as fallback)
    const draggedRepoId = draggedRepo.remoteUrl || draggedRepo.name;
    const newCategorized = {
      active: categorizedProjects.active.filter(
        (r) => (r.remoteUrl || r.name) !== draggedRepoId,
      ),
      following: categorizedProjects.following.filter(
        (r) => (r.remoteUrl || r.name) !== draggedRepoId,
      ),
      gitapps: categorizedProjects.gitapps.filter(
        (r) => (r.remoteUrl || r.name) !== draggedRepoId,
      ),
    };

    console.log('Categories before:', {
      active: categorizedProjects.active.length,
      following: categorizedProjects.following.length,
      gitapps: categorizedProjects.gitapps.length,
    });
    console.log('Categories after filter:', {
      active: newCategorized.active.length,
      following: newCategorized.following.length,
      gitapps: newCategorized.gitapps.length,
    });

    // Add to target category
    newCategorized[targetCategory] = [
      ...newCategorized[targetCategory],
      draggedRepo,
    ];
    setCategorizedProjects(newCategorized);

    // Animate the count badge
    setAnimatedCategory(targetCategory);
    setTimeout(() => setAnimatedCategory(null), 600); // Clear animation after it completes

    // Update repository metadata to persist the category
    try {
      const updatedMetadata = {
        ...draggedRepo.metadata,
        category: targetCategory,
        isGitApp: targetCategory === 'gitapps',
      };

      console.log(
        `Updating repository ${draggedRepo.name} to category ${targetCategory}`,
        updatedMetadata,
      );

      // Use remoteUrl for the update call
      const repoUrl = draggedRepo.remoteUrl || draggedRepo.url;
      if (!repoUrl) {
        console.error('No URL found for repository:', draggedRepo);
        return;
      }

      console.log('Calling updateRepository with URL:', repoUrl);
      const result = await RepositoryService.updateRepository(repoUrl, {
        metadata: updatedMetadata,
      });

      console.log('Update result:', result);

      // Verify the update was saved
      const verifyRepo = await RepositoryService.getRepository(repoUrl);
      console.log(
        'Verification - Repository after update:',
        verifyRepo?.metadata,
      );
    } catch (err) {
      console.error('Failed to update repository category:', err);
    }

    setDraggedRepo(null);
    setDragOverCategory(null);
  };

  // Handle drag over category
  const handleCategoryDragOver = (
    category: ProjectCategory,
    e: React.DragEvent,
  ) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverCategory(category);
  };

  // Handle drag leave category
  const handleCategoryDragLeave = () => {
    setDragOverCategory(null);
  };

  // Handle drop on trash
  const handleTrashDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!draggedRepo) return;

    console.log('Dropping repo in trash:', draggedRepo.name);

    // Check if repo has local clones
    if (draggedRepo.localClones && draggedRepo.localClones.length > 0) {
      // Show confirmation modal for repos with local clones
      setRepoToDelete(draggedRepo);
      setShowDeleteConfirmModal(true);
    } else {
      // No local clones, delete immediately
      await performDelete(draggedRepo, false);
    }

    setDraggedRepo(null);
    setIsDraggingOverTrash(false);
  };

  // Perform actual deletion
  const performDelete = async (
    repo: Repository,
    deleteLocalClones: boolean,
  ) => {
    // Remove from all categories
    const repoId = repo.remoteUrl || repo.name;
    const newCategorized = {
      active: categorizedProjects.active.filter(
        (r) => (r.remoteUrl || r.name) !== repoId,
      ),
      following: categorizedProjects.following.filter(
        (r) => (r.remoteUrl || r.name) !== repoId,
      ),
      gitapps: categorizedProjects.gitapps.filter(
        (r) => (r.remoteUrl || r.name) !== repoId,
      ),
    };

    setCategorizedProjects(newCategorized);

    // Remove from backend storage
    try {
      const repoUrl = repo.remoteUrl || repo.url;
      if (repoUrl) {
        // If deleteLocalClones is true, we might need to delete the local folders
        // This would require additional API methods
        if (deleteLocalClones && repo.localClones) {
          console.log(
            'Would delete local clones:',
            repo.localClones.map((c) => c.path),
          );
          // TODO: Implement actual file deletion if needed
        }

        await RepositoryService.removeRepository(repoUrl);
        console.log('Repository removed successfully');
      }
    } catch (err) {
      console.error('Failed to remove repository:', err);
    }
  };

  // Handle drag over trash
  const handleTrashDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setIsDraggingOverTrash(true);
  };

  // Handle drag leave trash
  const handleTrashDragLeave = () => {
    setIsDraggingOverTrash(false);
  };

  // Show empty state if no repositories
  if (isEmpty && !loading) {
    return (
      <EmptyStateView
        onAddGitHub={() => setShowAddModal(true)}
        onOpenLocalFolder={handleAddLocalRepo}
        onConfigureAgents={onConfigureAgents}
      />
    );
  }

  // Get current category projects
  const getCurrentProjects = () => {
    switch (selectedCategory) {
      case 'active':
        return categorizedProjects.active;
      case 'following':
        return categorizedProjects.following;
      case 'gitapps':
        return categorizedProjects.gitapps;
      default:
        return [];
    }
  };

  const categoryInfo = {
    active: {
      title: 'Active Projects',
      icon: <Code2 size={20} />,
      description: "Projects you're actively working on",
      color: theme.colors.primary,
    },
    following: {
      title: 'Following',
      icon: <Star size={20} />,
      description: "Repositories you're watching or interested in",
      color: theme.colors.accent || '#8b7355',
    },
    gitapps: {
      title: 'GitApps',
      icon: <Package size={20} />,
      description: 'Git-based applications and tools',
      color: theme.colors.secondary || '#a08d6f',
    },
  };

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Animation styles */}
      <style>{`
        @keyframes badge-pulse {
          0% {
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(0, 0, 0, 0.2);
          }
          50% {
            transform: scale(1.3);
            box-shadow: 0 0 20px 5px rgba(0, 0, 0, 0.1);
          }
          100% {
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(0, 0, 0, 0);
          }
        }
        
        .badge-pulse {
          animation: badge-pulse 0.6s ease-out;
        }
      `}</style>
      {/* Category Tabs */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: '0',
          marginBottom: '0',
        }}
      >
        {(['following', 'active', 'gitapps'] as ProjectCategory[]).map(
          (category) => {
            const info = categoryInfo[category];
            const isSelected = selectedCategory === category;
            const count = categorizedProjects[category].length;

            const isDragOver = dragOverCategory === category;

            const isFirst = category === 'following';
            const isLast = category === 'gitapps';

            return (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                onDrop={(e) => handleCategoryDrop(category, e)}
                onDragOver={(e) => handleCategoryDragOver(category, e)}
                onDragLeave={handleCategoryDragLeave}
                style={{
                  padding: '20px 16px',
                  borderRadius: '0',
                  borderTop: `2px solid ${isDragOver ? info.color : isSelected ? info.color : theme.colors.border}`,
                  borderBottom: `2px solid ${isDragOver ? info.color : isSelected ? info.color : theme.colors.border}`,
                  borderLeft: `2px solid ${isDragOver ? info.color : isSelected ? info.color : theme.colors.border}`,
                  borderRight: `2px solid ${isDragOver ? info.color : isSelected ? info.color : theme.colors.border}`,
                  marginLeft: isFirst ? '0' : '-2px',
                  backgroundColor: isDragOver
                    ? `${info.color}30`
                    : isSelected
                      ? `${info.color}10`
                      : theme.colors.backgroundSecondary,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  transform: isDragOver ? 'scale(1)' : 'scale(1)',
                  boxShadow: isDragOver
                    ? `inset 0 0 20px ${info.color}20`
                    : 'none',
                  zIndex: isSelected ? 2 : isDragOver ? 1 : 0,
                }}
                onMouseEnter={(e) => {
                  if (!isSelected && !isDragOver) {
                    e.currentTarget.style.backgroundColor =
                      theme.colors.backgroundTertiary;
                    e.currentTarget.style.borderColor = `${info.color}80`;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected && !isDragOver) {
                    e.currentTarget.style.backgroundColor =
                      theme.colors.backgroundSecondary;
                    e.currentTarget.style.borderColor = theme.colors.border;
                  }
                }}
              >
                {/* Title */}
                <div
                  style={{
                    fontSize: '16px',
                    fontWeight: 600,
                    color: isSelected ? info.color : theme.colors.text,
                  }}
                >
                  {info.title}
                </div>
              </button>
            );
          },
        )}
      </div>

      {/* Projects Grid */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px 20px 20px 20px',
        }}
      >
        {getCurrentProjects().length > 0 ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))',
              gap: '24px',
            }}
          >
            {getCurrentProjects().map((repo, index) => (
              <div
                key={`${repo.id || repo.url}-${index}`}
                draggable
                onDragStart={(e) => handleDragStart(repo, e)}
                onDragEnd={handleDragEnd}
                style={{
                  cursor: 'move',
                  transition: 'transform 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.02)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                <RepositoryCard
                  repository={repo}
                  onRemove={() => {}}
                  onOpenRepo={async (repo, localClone) => {
                    if (localClone) {
                      await ShellService.openInDefaultEditor(localClone.path);
                    } else if (repo.url) {
                      window.open(repo.url, '_blank');
                    }
                  }}
                  onRemoveLocalClone={() => {}}
                  onOpenSettings={(repo) => {
                    setSettingsRepository(repo);
                    setShowSettingsModal(true);
                  }}
                  showRemoveButton={false}
                />
              </div>
            ))}
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '300px',
              color: theme.colors.textSecondary,
            }}
          >
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '16px',
                backgroundColor: theme.colors.backgroundSecondary,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px',
              }}
            >
              {categoryInfo[selectedCategory].icon}
            </div>
            <p
              style={{
                fontSize: '16px',
                margin: 0,
              }}
            >
              No {categoryInfo[selectedCategory].title.toLowerCase()} yet
            </p>
            <p
              style={{
                fontSize: '14px',
                margin: '8px 0 0 0',
                opacity: 0.7,
              }}
            >
              Use the Add Project button to get started
            </p>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirmModal && repoToDelete && (
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
            zIndex: 2000,
          }}
        >
          <div
            style={{
              backgroundColor: theme.colors.background,
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '500px',
              width: '90%',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
              border: `1px solid ${theme.colors.border}`,
            }}
          >
            <h3
              style={{
                fontSize: '20px',
                fontWeight: 600,
                color: theme.colors.text,
                margin: '0 0 12px 0',
              }}
            >
              Remove Repository
            </h3>

            <p
              style={{
                fontSize: '14px',
                color: theme.colors.textSecondary,
                marginBottom: '20px',
              }}
            >
              <strong>{repoToDelete.name}</strong> has{' '}
              {repoToDelete.localClones?.length || 0} local clone
              {(repoToDelete.localClones?.length || 0) !== 1 ? 's' : ''}.
            </p>

            {repoToDelete.localClones &&
              repoToDelete.localClones.map((clone, index) => (
                <div
                  key={index}
                  style={{
                    padding: '8px 12px',
                    backgroundColor: theme.colors.backgroundSecondary,
                    borderRadius: '6px',
                    marginBottom: '8px',
                    fontSize: '13px',
                    color: theme.colors.textSecondary,
                    fontFamily: 'monospace',
                  }}
                >
                  📁 {clone.path}
                </div>
              ))}

            <p
              style={{
                fontSize: '14px',
                color: theme.colors.text,
                margin: '20px 0',
              }}
            >
              What would you like to do with the local clone
              {(repoToDelete.localClones?.length || 0) !== 1 ? 's' : ''}?
            </p>

            <div
              style={{
                display: 'flex',
                gap: '12px',
                justifyContent: 'flex-end',
              }}
            >
              <button
                onClick={() => {
                  setShowDeleteConfirmModal(false);
                  setRepoToDelete(null);
                }}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: `1px solid ${theme.colors.border}`,
                  backgroundColor: theme.colors.backgroundSecondary,
                  color: theme.colors.text,
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor =
                    theme.colors.backgroundTertiary;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor =
                    theme.colors.backgroundSecondary;
                }}
              >
                Cancel
              </button>

              <button
                onClick={async () => {
                  await performDelete(repoToDelete, false);
                  setShowDeleteConfirmModal(false);
                  setRepoToDelete(null);
                }}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: theme.colors.primary,
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = '0.9';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '1';
                }}
              >
                Keep Local Files
              </button>

              <button
                onClick={async () => {
                  await performDelete(repoToDelete, true);
                  setShowDeleteConfirmModal(false);
                  setRepoToDelete(null);
                }}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: '#ef4444',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = '0.9';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '1';
                }}
              >
                Delete Everything
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Repository Settings Modal */}
      {showSettingsModal && settingsRepository && (
        <RepositorySettingsModal
          repository={settingsRepository}
          isOpen={showSettingsModal}
          onClose={() => {
            setShowSettingsModal(false);
            setSettingsRepository(null);
          }}
          onDeleteRepository={async (repo) => {
            // Check if repo has local clones and show confirmation if needed
            if (repo.localClones && repo.localClones.length > 0) {
              setRepoToDelete(repo);
              setShowDeleteConfirmModal(true);
              setShowSettingsModal(false);
              setSettingsRepository(null);
            } else {
              // No local clones, delete immediately
              await performDelete(repo, false);
              setShowSettingsModal(false);
              setSettingsRepository(null);
            }
          }}
          onRemoveLocalClone={async (repo, clonePath) => {
            // Update the repository to remove the local clone
            const updatedClones =
              repo.localClones?.filter((c) => c.path !== clonePath) || [];
            const repoUrl = repo.remoteUrl || repo.url;
            if (repoUrl) {
              await RepositoryService.updateRepository(repoUrl, {
                localClones: updatedClones,
              });
              await loadRepositories();
            }
          }}
          onUpdateRepository={async (repo) => {
            await loadRepositories();
          }}
        />
      )}

      {/* GitHub Search Modal */}
      <GitHubSearchModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSelectRepository={async (repo) => {
          try {
            // Add the selected repository
            await RepositoryService.addRepository({
              remoteUrl: repo.remoteUrl,
              owner: repo.owner,
              name: repo.name,
              metadata: {
                description: repo.description,
              },
            });

            // Reload repositories to show the new one
            await loadRepositories();
            setShowAddModal(false);
          } catch (err) {
            console.error('Failed to add repository:', err);
            setError('Failed to add repository');
          }
        }}
      />

      {/* Paste Link Modal */}
      <PasteLinkModal
        isOpen={showPasteLinkModal}
        onClose={() => setShowPasteLinkModal(false)}
        onRepositoryAdded={() => {
          loadRepositories();
        }}
      />

      {/* Trash Zone - Only visible when dragging */}
      {draggedRepo && (
        <div
          onDrop={handleTrashDrop}
          onDragOver={handleTrashDragOver}
          onDragLeave={handleTrashDragLeave}
          style={{
            position: 'fixed',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '200px',
            height: '80px',
            backgroundColor: isDraggingOverTrash
              ? '#ef4444'
              : theme.colors.backgroundSecondary,
            border: `2px dashed ${isDraggingOverTrash ? '#dc2626' : theme.colors.border}`,
            borderRadius: '12px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'all 0.3s',
            opacity: isDraggingOverTrash ? 1 : 0.8,
            transform: isDraggingOverTrash
              ? 'translateX(-50%) scale(1.1)'
              : 'translateX(-50%) scale(1)',
            boxShadow: isDraggingOverTrash
              ? '0 8px 24px rgba(239, 68, 68, 0.3)'
              : '0 4px 12px rgba(0, 0, 0, 0.1)',
            zIndex: 1000,
          }}
        >
          <Trash2
            size={24}
            color={isDraggingOverTrash ? 'white' : theme.colors.textSecondary}
          />
          <span
            style={{
              fontSize: '14px',
              fontWeight: 600,
              color: isDraggingOverTrash ? 'white' : theme.colors.textSecondary,
            }}
          >
            {isDraggingOverTrash ? 'Release to Remove' : 'Drop to Remove'}
          </span>
        </div>
      )}
    </div>
  );
};
