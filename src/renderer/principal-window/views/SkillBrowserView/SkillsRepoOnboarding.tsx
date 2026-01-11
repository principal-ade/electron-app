import React, { useState, useEffect } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { X } from 'lucide-react';
import { useSkillsSync } from '../../../hooks/useSkillsSync';
import { useAuthState } from '../../../hooks/useAuthState';
import { GithubService } from '../../../main-process-api/GithubService';

interface SkillsRepoOnboardingProps {
  onComplete: () => void;
  onCancel?: () => void;
}

type OnboardingStep = 'welcome' | 'existing-skills' | 'configure' | 'migrating' | 'complete';

/**
 * Onboarding wizard for setting up a Git repository for skills
 * Guides users through:
 * 1. Explaining the feature
 * 2. Showing existing skills that will be migrated
 * 3. Configuring the repository (optional remote URL)
 * 4. Initializing and migrating skills
 */
export const SkillsRepoOnboarding: React.FC<SkillsRepoOnboardingProps> = ({ onComplete, onCancel }) => {
  const { theme } = useTheme();
  const { getAllLocalSkills, initializeRepo, migrateSkills, isLoading, error } = useSkillsSync();
  const { isAuthenticated, user } = useAuthState();

  const [step, setStep] = useState<OnboardingStep>('welcome');
  const [repoUrl, setRepoUrl] = useState('');
  const [existingSkills, setExistingSkills] = useState<Array<{ path: string; name: string; source: string }>>([]);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [creatingRepo, setCreatingRepo] = useState(false);
  const [createRepoError, setCreateRepoError] = useState<string | null>(null);

  // Load existing skills when moving to that step
  useEffect(() => {
    if (step === 'existing-skills') {
      loadExistingSkills();
    }
  }, [step]);

  const loadExistingSkills = async () => {
    const skills = await getAllLocalSkills();
    setExistingSkills(skills);
    // Select all by default
    setSelectedSkills(skills.map(s => s.path));
  };

  const handleInitializeAndMigrate = async () => {
    try {
      setStep('migrating');

      // Step 1: Initialize repository
      const initialized = await initializeRepo(repoUrl.trim() || undefined);
      if (!initialized) {
        throw new Error('Failed to initialize repository');
      }

      // Step 2: Migrate selected skills
      if (selectedSkills.length > 0) {
        const migrated = await migrateSkills(selectedSkills);
        if (!migrated) {
          throw new Error('Failed to migrate skills');
        }
      }

      setStep('complete');
    } catch (err) {
      console.error('[SkillsRepoOnboarding] Failed:', err);
      // Stay on migrating step to show error
    }
  };

  const toggleSkillSelection = (skillPath: string) => {
    setSelectedSkills(prev =>
      prev.includes(skillPath)
        ? prev.filter(p => p !== skillPath)
        : [...prev, skillPath]
    );
  };

  const handleCreateGitHubRepo = async () => {
    if (!isAuthenticated || !user) {
      setCreateRepoError('You must be logged in to create a GitHub repository');
      return;
    }

    try {
      setCreatingRepo(true);
      setCreateRepoError(null);

      const repoName = 'agent-skills';
      const repo = await GithubService.createRepository(
        user.login,
        {
          name: repoName,
          description: 'My agent skills repository - synced across projects',
          private: true,
          auto_init: true,
        },
        false // isOrganization
      );

      // Set the HTTPS clone URL
      setRepoUrl(repo.clone_url);
      setCreatingRepo(false);
    } catch (err: any) {
      console.error('[SkillsRepoOnboarding] Failed to create GitHub repo:', err);
      setCreateRepoError(err.message || 'Failed to create repository');
      setCreatingRepo(false);
    }
  };

  const renderWelcome = () => (
    <div style={{ maxWidth: 600, margin: '0 auto', textAlign: 'center' }}>
      <div style={{ fontSize: 48, marginBottom: 24 }}>📦</div>
      <h2 style={{ color: theme.colors.text, marginBottom: 16 }}>
        Set Up Your Skills Repository
      </h2>
      <p style={{ color: theme.colors.textSecondary, marginBottom: 24, lineHeight: 1.6 }}>
        Create a centralized Git repository for your agent skills. This allows you to:
      </p>
      <ul style={{
        textAlign: 'left',
        color: theme.colors.textSecondary,
        listStyle: 'none',
        padding: 0,
        marginBottom: 32,
      }}>
        <li style={{ marginBottom: 12 }}>✅ Keep skills synced across all your projects</li>
        <li style={{ marginBottom: 12 }}>✅ Version control your skills with Git</li>
        <li style={{ marginBottom: 12 }}>✅ Share skills across multiple machines</li>
        <li style={{ marginBottom: 12 }}>✅ Backup your skills to a remote repository</li>
      </ul>

      {!isAuthenticated && (
        <div style={{
          padding: 16,
          backgroundColor: theme.colors.backgroundSecondary,
          borderRadius: 6,
          marginBottom: 24,
          border: `1px solid ${theme.colors.border}`,
        }}>
          <div style={{ fontSize: 14, color: theme.colors.text, marginBottom: 8 }}>
            ⚠️ GitHub Authentication Required
          </div>
          <div style={{ fontSize: 12, color: theme.colors.textSecondary }}>
            You must be logged into GitHub to enable skill syncing. Please log in and try again.
          </div>
        </div>
      )}

      <button
        onClick={() => setStep('existing-skills')}
        disabled={!isAuthenticated}
        style={{
          padding: '10px 24px',
          backgroundColor: theme.colors.primary,
          color: theme.colors.background,
          border: 'none',
          borderRadius: 6,
          fontSize: 14,
          cursor: isAuthenticated ? 'pointer' : 'not-allowed',
          fontWeight: 600,
          opacity: isAuthenticated ? 1 : 0.5,
        }}
      >
        Get Started
      </button>
    </div>
  );

  const renderExistingSkills = () => (
    <div style={{ maxWidth: 700, margin: '0 auto' }}>
      <h2 style={{ color: theme.colors.text, marginBottom: 12 }}>
        Existing Skills
      </h2>
      <p style={{ color: theme.colors.textSecondary, marginBottom: 24 }}>
        We found {existingSkills.length} skill{existingSkills.length !== 1 ? 's' : ''} in your global directories.
        Select which ones you'd like to migrate to the repository.
      </p>

      {existingSkills.length === 0 ? (
        <div style={{
          padding: 24,
          backgroundColor: theme.colors.backgroundSecondary,
          borderRadius: 6,
          textAlign: 'center',
          marginBottom: 24,
        }}>
          <p style={{ color: theme.colors.textSecondary }}>
            No existing skills found. You can start fresh with your new repository!
          </p>
        </div>
      ) : (
        <div style={{
          maxHeight: 400,
          overflow: 'auto',
          border: `1px solid ${theme.colors.border}`,
          borderRadius: 6,
          marginBottom: 24,
        }}>
          {existingSkills.map((skill) => (
            <div
              key={skill.path}
              onClick={() => toggleSkillSelection(skill.path)}
              style={{
                padding: 16,
                borderBottom: `1px solid ${theme.colors.border}`,
                cursor: 'pointer',
                backgroundColor: selectedSkills.includes(skill.path)
                  ? theme.colors.primary + '10'
                  : 'transparent',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <input
                type="checkbox"
                checked={selectedSkills.includes(skill.path)}
                onChange={() => {}}
                style={{ cursor: 'pointer' }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ color: theme.colors.text, fontWeight: 500 }}>
                  {skill.name}
                </div>
                <div style={{ fontSize: theme.fontSizes[0], color: theme.colors.textSecondary }}>
                  {skill.source === 'agent' ? '~/.agent/skills' : '~/.claude/skills'}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between' }}>
        <button
          onClick={() => setStep('welcome')}
          style={{
            padding: '10px 24px',
            backgroundColor: 'transparent',
            color: theme.colors.textSecondary,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          Back
        </button>
        <button
          onClick={() => setStep('configure')}
          style={{
            padding: '10px 24px',
            backgroundColor: theme.colors.primary,
            color: theme.colors.background,
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          Continue
        </button>
      </div>
    </div>
  );

  const renderConfigure = () => (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      <h2 style={{ color: theme.colors.text, marginBottom: 12 }}>
        Configure Repository
      </h2>
      <p style={{ color: theme.colors.textSecondary, marginBottom: 24 }}>
        Provide a remote Git repository URL to sync your skills across projects. We can create one for you on GitHub, or you can enter an existing repository URL.
      </p>

      {isAuthenticated && user && !repoUrl && (
        <div style={{
          padding: 16,
          backgroundColor: theme.colors.backgroundSecondary,
          borderRadius: 6,
          marginBottom: 24,
          border: `1px solid ${theme.colors.border}`,
        }}>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 14, color: theme.colors.text, fontWeight: 500, marginBottom: 6 }}>
              Create GitHub Repository
            </div>
            <div style={{ fontSize: 12, color: theme.colors.textSecondary, marginBottom: 12 }}>
              Logged in as <strong>{user.login}</strong>. We can automatically create a private repository for you.
            </div>
          </div>
          <button
            onClick={handleCreateGitHubRepo}
            disabled={creatingRepo}
            style={{
              padding: '8px 16px',
              backgroundColor: theme.colors.primary,
              color: theme.colors.background,
              border: 'none',
              borderRadius: 6,
              fontSize: 14,
              cursor: creatingRepo ? 'not-allowed' : 'pointer',
              fontWeight: 500,
              opacity: creatingRepo ? 0.6 : 1,
            }}
          >
            {creatingRepo ? 'Creating repository...' : 'Create agent-skills repository'}
          </button>
          {createRepoError && (
            <div style={{
              marginTop: 12,
              padding: 12,
              backgroundColor: theme.colors.error + '20',
              color: theme.colors.error,
              borderRadius: 6,
              fontSize: 12,
            }}>
              {createRepoError}
            </div>
          )}
        </div>
      )}

      {isAuthenticated && user && !repoUrl && (
        <div style={{
          textAlign: 'center',
          color: theme.colors.textSecondary,
          fontSize: 12,
          marginBottom: 16,
        }}>
          — or —
        </div>
      )}

      <div style={{ marginBottom: 24 }}>
        <label style={{
          display: 'block',
          color: theme.colors.text,
          marginBottom: 12,
          fontSize: 14,
          fontWeight: 500,
        }}>
          {isAuthenticated && !repoUrl ? 'Or enter repository URL manually' : 'Git Repository URL'}
        </label>
        <input
          type="text"
          value={repoUrl}
          onChange={(e) => setRepoUrl(e.target.value)}
          placeholder="https://github.com/username/agent-skills.git"
          style={{
            width: '100%',
            padding: 12,
            backgroundColor: theme.colors.backgroundSecondary,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: 6,
            color: theme.colors.text,
            fontSize: 14,
            boxSizing: 'border-box',
          }}
        />
        <div style={{ fontSize: 12, color: theme.colors.textSecondary, marginTop: 6 }}>
          {repoUrl ? 'Skills will be pushed to this remote repository' : 'Required for syncing skills across projects'}
        </div>
      </div>

      <div style={{
        padding: 16,
        backgroundColor: theme.colors.backgroundSecondary,
        borderRadius: 6,
        marginBottom: 24,
      }}>
        <div style={{ fontSize: theme.fontSizes[1], color: theme.colors.text, marginBottom: 12, fontWeight: 500 }}>
          Summary
        </div>
        <ul style={{ margin: 0, paddingLeft: 24, color: theme.colors.textSecondary, fontSize: theme.fontSizes[1] }}>
          <li>Initialize local Git repository</li>
          {selectedSkills.length > 0 && (
            <li>Migrate {selectedSkills.length} skill{selectedSkills.length !== 1 ? 's' : ''}</li>
          )}
          {repoUrl.trim() && <li>Set remote to {repoUrl}</li>}
        </ul>
      </div>

      <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between' }}>
        <button
          onClick={() => setStep('existing-skills')}
          style={{
            padding: '10px 24px',
            backgroundColor: 'transparent',
            color: theme.colors.textSecondary,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          Back
        </button>
        <button
          onClick={handleInitializeAndMigrate}
          disabled={isLoading || !repoUrl.trim()}
          style={{
            padding: '10px 24px',
            backgroundColor: (isLoading || !repoUrl.trim()) ? theme.colors.textSecondary : theme.colors.primary,
            color: theme.colors.background,
            border: 'none',
            borderRadius: 6,
            cursor: (isLoading || !repoUrl.trim()) ? 'not-allowed' : 'pointer',
            fontWeight: 600,
            opacity: (isLoading || !repoUrl.trim()) ? 0.5 : 1,
          }}
        >
          {isLoading ? 'Setting up...' : 'Initialize Repository'}
        </button>
      </div>
    </div>
  );

  const renderMigrating = () => (
    <div style={{ maxWidth: 600, margin: '0 auto', textAlign: 'center' }}>
      <div style={{ fontSize: 48, marginBottom: 24 }}>⏳</div>
      <h2 style={{ color: theme.colors.text, marginBottom: 16 }}>
        Setting Up Your Repository
      </h2>
      {error ? (
        <>
          <div style={{
            padding: 16,
            backgroundColor: theme.colors.error + '20',
            border: `1px solid ${theme.colors.error}`,
            borderRadius: 6,
            color: theme.colors.error,
            marginBottom: 24,
          }}>
            {error}
          </div>
          <button
            onClick={() => setStep('configure')}
            style={{
              padding: '10px 24px',
              backgroundColor: theme.colors.primary,
              color: theme.colors.background,
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Try Again
          </button>
        </>
      ) : (
        <p style={{ color: theme.colors.textSecondary }}>
          Please wait while we initialize your repository and migrate your skills...
        </p>
      )}
    </div>
  );

  const renderComplete = () => (
    <div style={{ maxWidth: 600, margin: '0 auto', textAlign: 'center' }}>
      <div style={{ fontSize: 48, marginBottom: 24 }}>✅</div>
      <h2 style={{ color: theme.colors.text, marginBottom: 16 }}>
        All Set!
      </h2>
      <p style={{ color: theme.colors.textSecondary, marginBottom: 24, lineHeight: 1.6 }}>
        Your skills repository has been set up successfully. Your skills are now being synced from the Git repository.
      </p>
      <button
        onClick={onComplete}
        style={{
          padding: '10px 24px',
          backgroundColor: theme.colors.primary,
          color: theme.colors.background,
          border: 'none',
          borderRadius: 6,
          fontSize: theme.fontSizes[2],
          cursor: 'pointer',
          fontWeight: 600,
        }}
      >
        Continue
      </button>
    </div>
  );

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
        backgroundColor: theme.colors.background,
        position: 'relative',
      }}
    >
      {/* Close button - only show if onCancel is provided and we're not in migrating/complete state */}
      {onCancel && step !== 'migrating' && step !== 'complete' && (
        <button
          onClick={onCancel}
          style={{
            position: 'absolute',
            top: 24,
            right: 24,
            backgroundColor: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: 8,
            borderRadius: 6,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: theme.colors.textSecondary,
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
            e.currentTarget.style.color = theme.colors.text;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = theme.colors.textSecondary;
          }}
          aria-label="Close"
        >
          <X size={20} />
        </button>
      )}

      {step === 'welcome' && renderWelcome()}
      {step === 'existing-skills' && renderExistingSkills()}
      {step === 'configure' && renderConfigure()}
      {step === 'migrating' && renderMigrating()}
      {step === 'complete' && renderComplete()}
    </div>
  );
};
