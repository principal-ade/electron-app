import React, { useState, useEffect, useCallback } from 'react';
import { useTheme, Theme } from '@principal-ade/industry-theme';
import { FileCityLogo, FileCityLogoAnimated } from '@principal-ai/logo-component';
import {
  FolderGit2,
  ArrowRight,
  CheckCircle,
  Folder,
  FolderTree,
  AlertCircle,
  Info,
  Pencil,
  Sparkles
} from 'lucide-react';
import { FileSystemService } from '../../main-process-api/FileSystemService';
import { GitService } from '../../main-process-api/GitService';
import { AuthenticationService } from '../../main-process-api/AuthenticationService';
import { UserPreferencesService } from '../../main-process-api/UserPreferencesService';
import type { AuthTokenSource } from '../../../shared/main-process-api-interfaces/AuthenticationAPI';
import type { UserPreferences } from '../../../shared/types/userPreferences.types';
import {
  ALL_SKILL_DETAILS,
  getInstalledCatalogSkillNames,
  installSkills,
} from '../../skills/skillCatalog';
import type { SkillDetail } from '../../skills/skillCatalog';

/** Home directory used to resolve the `~/<name>` base directory field. */
function getHomeDirectory(): string {
  return (typeof process !== 'undefined' ? process.env.HOME : '') || '';
}

/** `~/Code` -> `Code`, `/Users/me/Code` -> `Code` (last segment fallback). */
function baseDirectoryToName(baseDirectory: string): string {
  const home = getHomeDirectory();
  if (home && baseDirectory.startsWith(`${home}/`)) {
    return baseDirectory.slice(home.length + 1);
  }
  return baseDirectory.split('/').filter(Boolean).pop() ?? '';
}

/** `Code` -> `~/Code` as an absolute path (the form the rest of the app stores). */
function nameToBaseDirectory(name: string): string | null {
  const home = getHomeDirectory();
  const trimmed = name.trim().replace(/^\/+|\/+$/g, '');
  if (!home || !trimmed) return null;
  return `${home}/${trimmed}`;
}

// Git Logo Component
const GitLogo: React.FC<{ size?: number; color?: string }> = ({
  size = 40,
  color = '#F05032'
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 92 92"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M90.156 41.965L50.036 1.848a5.918 5.918 0 0 0-8.372 0l-8.328 8.332 10.566 10.566a7.03 7.03 0 0 1 7.23 1.684 7.043 7.043 0 0 1 1.673 7.277l10.183 10.184a7.026 7.026 0 0 1 7.278 1.672 7.04 7.04 0 0 1 0 9.957 7.045 7.045 0 0 1-9.961 0 7.038 7.038 0 0 1-1.532-7.66l-9.5-9.497V59.36a7.04 7.04 0 0 1 1.86 11.29 7.04 7.04 0 0 1-9.957 0 7.04 7.04 0 0 1 0-9.958 7.034 7.034 0 0 1 2.308-1.539V33.926a7.001 7.001 0 0 1-2.308-1.535 7.049 7.049 0 0 1-1.516-7.7L29.242 14.273 1.734 41.777a5.918 5.918 0 0 0 0 8.371l40.12 40.118a5.918 5.918 0 0 0 8.371 0l39.931-39.934a5.925 5.925 0 0 0 0-8.367"
      fill={color}
    />
  </svg>
);

// GitHub Logo Component (Octocat mark)
const GitHubLogo: React.FC<{ size?: number; color?: string }> = ({
  size = 40,
  color = '#24292e'
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 98 96"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M48.854 0C21.839 0 0 22 0 49.217c0 21.756 13.993 40.172 33.405 46.69 2.427.49 3.316-1.059 3.316-2.362 0-1.141-.08-5.052-.08-9.127-13.59 2.934-16.42-5.867-16.42-5.867-2.184-5.704-5.42-7.17-5.42-7.17-4.448-3.015.324-3.015.324-3.015 4.934.326 7.523 5.052 7.523 5.052 4.367 7.496 11.404 5.378 14.235 4.074.404-3.178 1.699-5.378 3.074-6.6-10.839-1.141-22.243-5.378-22.243-24.283 0-5.378 1.94-9.778 5.014-13.2-.485-1.222-2.184-6.275.486-13.038 0 0 4.125-1.304 13.426 5.052a46.97 46.97 0 0 1 12.214-1.63c4.125 0 8.33.571 12.213 1.63 9.302-6.356 13.427-5.052 13.427-5.052 2.67 6.763.97 11.816.485 13.038 3.155 3.422 5.015 7.822 5.015 13.2 0 18.905-11.404 23.06-22.324 24.283 1.78 1.548 3.316 4.481 3.316 9.126 0 6.6-.08 11.897-.08 13.526 0 1.304.89 2.853 3.316 2.364 19.412-6.52 33.405-24.935 33.405-46.691C97.707 22 75.788 0 48.854 0z"
      fill={color}
    />
  </svg>
);

type OnboardingStep = 'welcome' | 'git-config' | 'choose-method' | 'folder-selection' | 'scanning' | 'home-directory' | 'github-cli' | 'skills' | 'ready';

type SetupMethod = 'scan' | 'later' | null;

/** GitHub account details shown on the github-cli step. */
interface GitHubCliUser {
  login: string;
  name?: string;
  email?: string;
  avatarUrl?: string;
}

interface GitHubCliStatus {
  isLoading: boolean;
  isConfigured: boolean;
  source: AuthTokenSource | 'none';
  user: GitHubCliUser | null;
  error?: string;
}

/** Result shape of a GitHub CLI check (matches AuthService.check()). */
interface GitHubCliCheckResult {
  authenticated?: boolean;
  source?: AuthTokenSource;
  user?: GitHubCliUser | null;
  error?: string;
}

const defaultGitHubCliService = {
  check: (): Promise<GitHubCliCheckResult> => AuthenticationService.check(),
};

const defaultSkillInstaller = {
  getInstalledSkillNames: getInstalledCatalogSkillNames,
  installSkills: (skills: ReadonlyArray<SkillDetail>) => installSkills(skills),
};

type SkillInstallState = 'idle' | 'installing' | 'installed' | 'failed';

interface SkillRowState {
  selected: boolean;
  status: SkillInstallState;
  error?: string;
}

/** Everything starts checked; the user can uncheck what they don't want. */
function initialSkillRows(): Record<string, SkillRowState> {
  const rows: Record<string, SkillRowState> = {};
  for (const skill of ALL_SKILL_DETAILS) {
    rows[skill.name] = {
      selected: true,
      status: 'idle'
    };
  }
  return rows;
}

interface OnboardingWizardProps {
  /** Jump straight to a step. Used by Storybook stories. */
  initialStep?: OnboardingStep;
  onComplete?: (data: OnboardingData) => void;
  // Service methods for testing/mocking
  fileSystemService?: {
    getTopLevelFolders: () => Promise<TopLevelFolder[]>;
    scanFoldersForRepos: (folderPaths: string[]) => Promise<{ success: boolean; repos: Array<{ path: string; name: string; owner?: string; registered?: boolean; alreadyRegistered?: boolean; registrationError?: string }>; error?: string }>;
    onRepoScanProgress: (callback: (progress: { current: number; total: number; currentFolder: string; foundRepos: number }) => void) => () => void;
  };
  githubCliService?: {
    check: () => Promise<GitHubCliCheckResult>;
  };
  preferencesService?: {
    getPreferences: () => Promise<UserPreferences>;
    updatePreferences: (updates: Partial<UserPreferences>) => Promise<void>;
  };
  skillInstaller?: {
    getInstalledSkillNames: () => Promise<Set<string>>;
    installSkills: (
      skills: ReadonlyArray<SkillDetail>
    ) => Promise<{ installed: string[]; failures: string[] }>;
  };
}

interface OnboardingData {
  hasMultipleLocations: boolean;
  githubCliConfigured: boolean;
  /** GitHub login detected by the CLI check, if any. */
  githubLogin: string | null;
  /** Absolute base directory chosen in the clone-directory step. */
  baseDirectory: string | null;
  /** Names of skills installed from the install-skills step. */
  installedSkills: string[];
}

interface TopLevelFolder {
  name: string;
  path: string;
  selected: boolean;
  category: 'dev' | 'common' | 'system';
}

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({
  initialStep = 'welcome',
  onComplete,
  fileSystemService = FileSystemService,
  githubCliService = defaultGitHubCliService,
  preferencesService = UserPreferencesService,
  skillInstaller = defaultSkillInstaller
}) => {
  const { theme } = useTheme();
  const [currentStep, setCurrentStep] = useState<OnboardingStep>(initialStep);
  const [setupMethod, setSetupMethod] = useState<SetupMethod>(() => {
    // Keep activeSteps in sync when a story/test jumps into the middle of a flow.
    if (initialStep === 'folder-selection' || initialStep === 'scanning') return 'scan';
    return null;
  });
  const [topLevelFolders, setTopLevelFolders] = useState<TopLevelFolder[]>([]);
  const [isLoadingFolders, setIsLoadingFolders] = useState(false);
  const [foundProjects, setFoundProjects] = useState<Array<{ currentPath: string; owner: string; name: string; registered?: boolean; alreadyRegistered?: boolean; registrationError?: string }>>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState({ current: 0, total: 0, currentFolder: '', foundRepos: 0 });
  const [githubCliStatus, setGithubCliStatus] = useState<GitHubCliStatus>({
    isLoading: false,
    isConfigured: false,
    source: 'none',
    user: null
  });
  const [skillRows, setSkillRows] = useState<Record<string, SkillRowState>>(
    initialSkillRows
  );
  const [isInstallingSkills, setIsInstallingSkills] = useState(false);
  const [hasStarted, setHasStarted] = useState(initialStep !== 'welcome');
  const [showContent, setShowContent] = useState(true);
  const [devDirectoryName, setDevDirectoryName] = useState('Development');
  const [gitConfigLoaded, setGitConfigLoaded] = useState(false);
  const [gitVersion, setGitVersion] = useState('');
  const [gitUserName, setGitUserName] = useState('');
  const [gitUserEmail, setGitUserEmail] = useState('');

  // Get active steps based on user's choice
  const getActiveSteps = (): OnboardingStep[] => {
    const baseSteps: OnboardingStep[] = ['welcome', 'git-config', 'home-directory', 'choose-method'];

    if (setupMethod === 'scan') {
      return [...baseSteps, 'folder-selection', 'scanning', 'github-cli', 'skills', 'ready'];
    } else if (setupMethod === 'later') {
      return [...baseSteps, 'github-cli', 'skills', 'ready'];
    }

    // Before method is chosen, show all possible steps
    return ['welcome', 'git-config', 'home-directory', 'choose-method', 'github-cli', 'skills', 'ready'];
  };

  const activeSteps = getActiveSteps();
  const currentStepIndex = activeSteps.indexOf(currentStep);

  // Don't count welcome step in progress
  const actualSteps: Array<Exclude<OnboardingStep, 'welcome'>> = activeSteps.filter((s): s is Exclude<OnboardingStep, 'welcome'> => s !== 'welcome');
  const actualStepIndex = currentStep === 'welcome' ? -1 : actualSteps.indexOf(currentStep as Exclude<OnboardingStep, 'welcome'>);
  const progress = currentStep === 'welcome' ? 0 : ((actualStepIndex + 1) / actualSteps.length) * 100;

  // Load top-level folders when entering folder-selection step
  useEffect(() => {
    if (currentStep === 'folder-selection' && topLevelFolders.length === 0) {
      setIsLoadingFolders(true);
      fileSystemService.getTopLevelFolders().then((folders) => {
        setTopLevelFolders(folders
          .filter(f => !f.name.startsWith('.'))
          .map(f => ({
            ...f,
            selected: f.category === 'dev' // Pre-select dev folders
          })));
        setIsLoadingFolders(false);
      });
    }
  }, [currentStep, topLevelFolders.length, fileSystemService]);

  // Set up progress listener when entering scanning step
  useEffect(() => {
    if (currentStep === 'scanning') {
      const cleanup = fileSystemService.onRepoScanProgress((progress) => {
        setScanProgress(progress);
      });

      // Start scanning
      startScanning();

      return cleanup;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, fileSystemService]);

  // Fetch git config when entering git-config step
  useEffect(() => {
    if (currentStep === 'git-config' && !gitConfigLoaded) {
      const fetchGitConfig = async () => {
        try {
          const versionResult = await GitService.execCommand('', ['--version']);
          setGitVersion(versionResult.stdout.trim());

          try {
            const nameResult = await GitService.execCommand('', ['config', '--global', 'user.name']);
            setGitUserName(nameResult.stdout.trim());
          } catch {
            setGitUserName('');
          }

          try {
            const emailResult = await GitService.execCommand('', ['config', '--global', 'user.email']);
            setGitUserEmail(emailResult.stdout.trim());
          } catch {
            setGitUserEmail('');
          }
        } catch {
          // git not installed — step will show error
        } finally {
          setGitConfigLoaded(true);
        }
      };
      fetchGitConfig();
    }
  }, [currentStep, gitConfigLoaded]);

  // Prefill the clone directory from the saved base directory, if any
  useEffect(() => {
    let cancelled = false;

    preferencesService
      .getPreferences()
      .then(prefs => {
        if (cancelled) return;
        const saved = prefs.baseDefaultDirectory;
        if (saved) {
          setDevDirectoryName(baseDirectoryToName(saved));
        }
      })
      .catch(error => {
        console.error('[OnboardingWizard] Failed to load base directory:', error);
      });

    return () => {
      cancelled = true;
    };
  }, [preferencesService]);

  // Check the GitHub CLI session when entering the github-cli step
  const checkGitHubCli = useCallback(async () => {
    setGithubCliStatus(prev => ({ ...prev, isLoading: true, error: undefined }));

    try {
      const result = await githubCliService.check();
      setGithubCliStatus({
        isLoading: false,
        isConfigured: !!result?.authenticated,
        source: result?.source ?? (result?.authenticated ? 'gh-cli' : 'none'),
        user: result?.user ?? null,
        error: result?.error
      });
    } catch (error) {
      setGithubCliStatus({
        isLoading: false,
        isConfigured: false,
        source: 'none',
        user: null,
        error: error instanceof Error ? error.message : 'Could not check the GitHub CLI'
      });
    }
  }, [githubCliService]);

  useEffect(() => {
    if (currentStep === 'github-cli') {
      checkGitHubCli();
    }
  }, [currentStep, checkGitHubCli]);

  const handleSaveGitConfig = async (name: string, email: string) => {
    if (name !== gitUserName) {
      await GitService.execCommand('', ['config', '--global', 'user.name', name]);
      setGitUserName(name);
    }
    if (email !== gitUserEmail) {
      await GitService.execCommand('', ['config', '--global', 'user.email', email]);
      setGitUserEmail(email);
    }
  };

  const startScanning = async () => {
    setIsScanning(true);
    setFoundProjects([]);
    setScanProgress({ current: 0, total: 0, currentFolder: '', foundRepos: 0 });

    const scanStartTime = Date.now();

    try {
      const selectedFolders = topLevelFolders.filter(f => f.selected).map(f => f.path);

      const result = await fileSystemService.scanFoldersForRepos(selectedFolders);

      if (result.success && result.repos) {
        // Convert to the format expected by foundProjects
        const projects = result.repos.map(repo => ({
          currentPath: repo.path,
          owner: repo.owner || 'local', // Fallback for repos without remotes
          name: repo.name,
          registered: repo.registered,
          alreadyRegistered: repo.alreadyRegistered,
          registrationError: repo.registrationError
        })).sort((a, b) => a.name.localeCompare(b.name));
        setFoundProjects(projects);
      }
    } catch (error) {
      console.error('Scanning failed:', error);
    } finally {
      // Ensure scanning animation shows for at least 2 seconds
      const elapsed = Date.now() - scanStartTime;
      const remaining = Math.max(0, 2000 - elapsed);
      setTimeout(() => {
        setIsScanning(false);
      }, remaining);
    }
  };

  // Load install state for the skill catalog when entering the skills step.
  // Topic skills are preselected; anything already installed is locked in.
  useEffect(() => {
    if (currentStep !== 'skills') return;

    let cancelled = false;

    skillInstaller
      .getInstalledSkillNames()
      .catch(() => new Set<string>())
      .then(installed => {
        if (cancelled) return;
        const rows: Record<string, SkillRowState> = {};
        for (const skill of ALL_SKILL_DETAILS) {
          const isInstalled = installed.has(skill.name);
          rows[skill.name] = {
            selected: true,
            status: isInstalled ? 'installed' : 'idle'
          };
        }
        setSkillRows(rows);
      });

    return () => {
      cancelled = true;
    };
  }, [currentStep, skillInstaller]);

  const toggleSkill = useCallback((name: string) => {
    setSkillRows(prev => {
      const row = prev[name];
      if (!row || row.status === 'installed' || row.status === 'installing') {
        return prev;
      }
      return { ...prev, [name]: { ...row, selected: !row.selected } };
    });
  }, []);

  const handleInstallSkills = useCallback(async () => {
    const selected = ALL_SKILL_DETAILS.filter(
      skill => skillRows[skill.name]?.selected && skillRows[skill.name]?.status !== 'installed'
    );
    if (selected.length === 0) return;

    setIsInstallingSkills(true);
    setSkillRows(prev => {
      const next = { ...prev };
      for (const skill of selected) {
        next[skill.name] = { ...next[skill.name], status: 'installing', error: undefined };
      }
      return next;
    });

    try {
      const result = await skillInstaller.installSkills(selected);
      const installedNames = new Set(result.installed);

      setSkillRows(prev => {
        const next = { ...prev };
        for (const skill of selected) {
          if (installedNames.has(skill.name)) {
            next[skill.name] = { selected: true, status: 'installed' };
          } else {
            const failure = result.failures.find(f => f.startsWith(`${skill.name}:`) || f.startsWith(`${skill.name} →`));
            next[skill.name] = {
              selected: true,
              status: 'failed',
              error: failure ?? 'Install failed'
            };
          }
        }
        return next;
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Install failed';
      setSkillRows(prev => {
        const next = { ...prev };
        for (const skill of selected) {
          next[skill.name] = { selected: true, status: 'failed', error: message };
        }
        return next;
      });
    } finally {
      setIsInstallingSkills(false);
    }
  }, [skillInstaller, skillRows]);

  const installedSkillNames = ALL_SKILL_DETAILS
    .filter(skill => skillRows[skill.name]?.status === 'installed')
    .map(skill => skill.name);

  const persistBaseDirectory = useCallback(
    async (baseDirectory: string) => {
      try {
        await preferencesService.updatePreferences({
          baseDefaultDirectory: baseDirectory
        });
      } catch (error) {
        console.error(
          '[OnboardingWizard] Failed to save base directory:',
          error
        );
      }
    },
    [preferencesService]
  );

  const handleStart = () => {
    setShowContent(false);

    // Step 1: Fade out welcome content (300ms)
    setTimeout(() => {
      const nextIndex = activeSteps.indexOf('welcome') + 1;
      setCurrentStep(activeSteps[nextIndex] || 'choose-method');
      setHasStarted(true);

      // Step 2: Nav slides up (400ms animation in CSS)
      // Step 3: Show new content after nav appears
      setTimeout(() => {
        setShowContent(true);
      }, 400);
    }, 300);
  };

  const handleNext = () => {
    // Persist the clone directory before leaving its step so General Settings
    // always shows the value the wizard used.
    if (currentStep === 'home-directory') {
      const baseDirectory = nameToBaseDirectory(devDirectoryName);
      if (baseDirectory) {
        persistBaseDirectory(baseDirectory);
      }
    }

    const nextIndex = currentStepIndex + 1;
    if (nextIndex < activeSteps.length) {
      setShowContent(false);
      setTimeout(() => {
        setCurrentStep(activeSteps[nextIndex]);
        setTimeout(() => {
          setShowContent(true);
        }, 50);
      }, 300);
    } else {
      onComplete?.({
        hasMultipleLocations: false,
        githubCliConfigured: githubCliStatus.isConfigured,
        githubLogin: githubCliStatus.user?.login ?? null,
        baseDirectory: nameToBaseDirectory(devDirectoryName),
        installedSkills: installedSkillNames
      });
    }
  };

  const handleBack = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      if (activeSteps[prevIndex] === 'welcome') {
        // Going back to welcome - reverse the animation
        setShowContent(false);
        setTimeout(() => {
          setHasStarted(false);
          setCurrentStep('welcome');
          setTimeout(() => {
            setShowContent(true);
          }, 100);
        }, 300);
      } else {
        // Normal back transition with fade
        setShowContent(false);
        setTimeout(() => {
          setCurrentStep(activeSteps[prevIndex]);
          setTimeout(() => {
            setShowContent(true);
          }, 50);
        }, 300);
      }
    }
  };

  const canProceed = () => {
    if (currentStep === 'git-config') {
      return gitConfigLoaded;
    }
    if (currentStep === 'choose-method') {
      return setupMethod !== null;
    }
    if (currentStep === 'folder-selection') {
      return topLevelFolders.some(f => f.selected);
    }
    if (currentStep === 'scanning') {
      return !isScanning && foundProjects.length > 0;
    }
    return true;
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: theme.colors.background,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}
    >
      {/* Progress Bar */}
      <div style={{
        height: 4,
        backgroundColor: theme.colors.border,
        position: 'relative'
      }}>
        <div style={{
          position: 'absolute',
          left: 0,
          top: 0,
          height: '100%',
          width: `${progress}%`,
          backgroundColor: theme.colors.primary,
          transition: 'width 0.3s ease'
        }} />
      </div>

      {/* Main Content */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 24px'
      }}>
        <div style={{
          maxWidth: 600,
          width: '100%',
          opacity: showContent ? 1 : 0,
          transition: 'opacity 0.3s ease-in-out'
        }}>
          {currentStep === 'welcome' && (
            <WelcomeStep theme={theme} onStart={handleStart} />
          )}

          {currentStep === 'git-config' && (
            <GitConfigStep
              theme={theme}
              isLoading={!gitConfigLoaded}
              gitVersion={gitVersion}
              userName={gitUserName}
              userEmail={gitUserEmail}
              onSave={handleSaveGitConfig}
            />
          )}

          {currentStep === 'home-directory' && (
            <HomeDirectoryStep
              theme={theme}
              devDirectoryName={devDirectoryName}
              onSetDevDirectoryName={setDevDirectoryName}
            />
          )}

          {currentStep === 'choose-method' && (
            <ChooseMethodStep
              theme={theme}
              selectedMethod={setupMethod}
              onSelectMethod={setSetupMethod}
            />
          )}

          {currentStep === 'folder-selection' && (
            <FolderSelectionStep
              theme={theme}
              folders={topLevelFolders}
              isLoading={isLoadingFolders}
              onToggleFolder={(name) => {
                setTopLevelFolders(folders =>
                  folders.map(f => f.name === name ? { ...f, selected: !f.selected } : f)
                );
              }}
            />
          )}

          {currentStep === 'scanning' && (
            <ScanningStep
              theme={theme}
              isScanning={isScanning}
              progress={scanProgress}
              foundProjects={foundProjects}
            />
          )}

          {currentStep === 'github-cli' && (
            <GitHubCliStep
              theme={theme}
              status={githubCliStatus}
              onRecheck={checkGitHubCli}
            />
          )}

          {currentStep === 'skills' && (
            <SkillsStep
              theme={theme}
              rows={skillRows}
              isInstalling={isInstallingSkills}
              onToggleSkill={toggleSkill}
              onInstall={handleInstallSkills}
            />
          )}

          {currentStep === 'ready' && (
            <ReadyStep theme={theme} />
          )}
        </div>
      </div>

      {/* Navigation Footer */}
      {hasStarted && (
      <div style={{
        padding: '24px',
        borderTop: `1px solid ${theme.colors.border}`,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        animation: 'slideUpFromBottom 0.4s ease-out',
      }}>
        <button
          onClick={handleBack}
          style={{
            width: 140,
            padding: '12px 24px',
            backgroundColor: 'transparent',
            color: theme.colors.text,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: 8,
            cursor: 'pointer',
            fontFamily: theme.fonts.body,
            fontSize: `${theme.fontSizes[1]}px`,
            fontWeight: 500,
            transition: 'all 0.2s ease'
          }}
        >
          Back
        </button>

        <div style={{
          color: theme.colors.textSecondary,
          fontFamily: theme.fonts.body,
          fontSize: `${theme.fontSizes[2]}px`,
        }}>
          Step {actualStepIndex + 1} of {actualSteps.length}
        </div>

        <button
          onClick={handleNext}
          disabled={!canProceed()}
          style={{
            width: 140,
            padding: '12px 24px',
            backgroundColor: canProceed() ? theme.colors.primary : theme.colors.border,
            color: '#ffffff',
            border: 'none',
            borderRadius: 8,
            cursor: canProceed() ? 'pointer' : 'not-allowed',
            fontFamily: theme.fonts.body,
            fontSize: `${theme.fontSizes[1]}px`,
            fontWeight: 500,
            transition: 'all 0.2s ease'
          }}
        >
          {currentStep === 'ready' ? 'Finish' : 'Continue'}
        </button>
      </div>
      )}
    </div>
  );
};

// Step Components

interface GitConfigStepProps {
  theme: Theme;
  isLoading: boolean;
  gitVersion: string;
  userName: string;
  userEmail: string;
  onSave: (name: string, email: string) => Promise<void>;
}

const GitConfigStep: React.FC<GitConfigStepProps> = ({
  theme,
  isLoading,
  gitVersion,
  userName,
  userEmail,
  onSave
}) => {
  const [editingName, setEditingName] = React.useState(false);
  const [editingEmail, setEditingEmail] = React.useState(false);
  const [name, setName] = React.useState(userName);
  const [email, setEmail] = React.useState(userEmail);
  const [saving, setSaving] = React.useState(false);
  const nameInputRef = React.useRef<HTMLInputElement>(null);
  const emailInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setName(userName);
    setEmail(userEmail);
  }, [userName, userEmail]);

  React.useEffect(() => {
    if (editingName && nameInputRef.current) nameInputRef.current.focus();
  }, [editingName]);

  React.useEffect(() => {
    if (editingEmail && emailInputRef.current) emailInputRef.current.focus();
  }, [editingEmail]);

  const handleSaveName = async () => {
    if (!name.trim()) return;
    setSaving(true);
    await onSave(name, userEmail);
    setSaving(false);
    setEditingName(false);
  };

  const handleSaveEmail = async () => {
    if (!email.trim()) return;
    setSaving(true);
    await onSave(userName, email);
    setSaving(false);
    setEditingEmail(false);
  };

  const hasGit = !!gitVersion;
  const hasName = !!userName;
  const hasEmail = !!userEmail;
  const configured = hasGit && hasName && hasEmail;

  return (
    <div>
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        marginBottom: 24
      }}>
        <div style={{
          display: 'inline-flex',
          padding: 20,
          backgroundColor: '#ffffff',
          borderRadius: '50%'
        }}>
          <GitLogo size={48} color="#F05032" />
        </div>
      </div>

      <h2 style={{
        fontFamily: theme.fonts.heading,
        fontSize: `${theme.fontSizes[6]}px`,
        fontWeight: 700,
        color: theme.colors.text,
        marginBottom: 8,
        textAlign: 'center'
      }}>
        Git Configuration
      </h2>

      <p style={{
        fontFamily: theme.fonts.body,
        fontSize: `${theme.fontSizes[3]}px`,
        color: theme.colors.textSecondary,
        textAlign: 'center',
        marginBottom: 32
      }}>
        {configured
          ? 'Your git identity is all set.'
          : 'Let\'s make sure git is ready to go.'}
      </p>

      {isLoading ? (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          padding: 32
        }}>
          <div style={{
            width: 24,
            height: 24,
            border: `3px solid ${theme.colors.border}`,
            borderTopColor: theme.colors.primary,
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite'
          }} />
        </div>
      ) : (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          maxWidth: 400,
          margin: '0 auto'
        }}>
          {/* User name */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '12px 16px',
            backgroundColor: hasName ? `${theme.colors.success || '#4CAF50'}10` : `${theme.colors.warning || '#FF9800'}10`,
            border: `1px solid ${hasName ? (theme.colors.success || '#4CAF50') : (theme.colors.warning || '#FF9800')}30`,
            borderRadius: 8
          }}>
            {hasName ? (
              <CheckCircle size={18} color={theme.colors.success || '#4CAF50'} />
            ) : (
              <Info size={18} color={theme.colors.warning || '#FF9800'} />
            )}
            {editingName ? (
              <input
                ref={nameInputRef}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveName();
                  if (e.key === 'Escape') { setName(userName); setEditingName(false); }
                }}
                onBlur={handleSaveName}
                placeholder="Your name"
                disabled={saving}
                style={{
                  flex: 1,
                  padding: '4px 8px',
                  backgroundColor: theme.colors.background,
                  color: theme.colors.text,
                  border: `1px solid ${theme.colors.primary}`,
                  borderRadius: 4,
                  fontFamily: theme.fonts.body,
                  fontSize: `${theme.fontSizes[1]}px`,
                  outline: 'none'
                }}
              />
            ) : (
              <>
                <div style={{
                  flex: 1,
                  fontFamily: theme.fonts.body,
                  fontSize: `${theme.fontSizes[1]}px`,
                  color: theme.colors.text,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {hasName ? (
                    <>Name: <strong style={{ color: theme.colors.primary }}>{userName}</strong></>
                  ) : (
                    <span style={{ color: theme.colors.warning || '#FF9800' }}>No name configured</span>
                  )}
                </div>
                <button
                  onClick={() => { setName(userName); setEditingName(true); }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 28,
                    height: 28,
                    padding: 0,
                    backgroundColor: 'transparent',
                    color: theme.colors.textSecondary,
                    border: 'none',
                    borderRadius: 4,
                    cursor: 'pointer',
                    flexShrink: 0,
                    transition: 'color 0.15s'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = theme.colors.primary; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = theme.colors.textSecondary; }}
                >
                  <Pencil size={14} />
                </button>
              </>
            )}
          </div>

          {/* User email */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '12px 16px',
            backgroundColor: hasEmail ? `${theme.colors.success || '#4CAF50'}10` : `${theme.colors.warning || '#FF9800'}10`,
            border: `1px solid ${hasEmail ? (theme.colors.success || '#4CAF50') : (theme.colors.warning || '#FF9800')}30`,
            borderRadius: 8
          }}>
            {hasEmail ? (
              <CheckCircle size={18} color={theme.colors.success || '#4CAF50'} />
            ) : (
              <Info size={18} color={theme.colors.warning || '#FF9800'} />
            )}
            {editingEmail ? (
              <input
                ref={emailInputRef}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveEmail();
                  if (e.key === 'Escape') { setEmail(userEmail); setEditingEmail(false); }
                }}
                onBlur={handleSaveEmail}
                placeholder="you@example.com"
                disabled={saving}
                style={{
                  flex: 1,
                  padding: '4px 8px',
                  backgroundColor: theme.colors.background,
                  color: theme.colors.text,
                  border: `1px solid ${theme.colors.primary}`,
                  borderRadius: 4,
                  fontFamily: theme.fonts.body,
                  fontSize: `${theme.fontSizes[1]}px`,
                  outline: 'none'
                }}
              />
            ) : (
              <>
                <div style={{
                  flex: 1,
                  fontFamily: theme.fonts.body,
                  fontSize: `${theme.fontSizes[1]}px`,
                  color: theme.colors.text,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {hasEmail ? (
                    <>Email: <strong style={{ color: theme.colors.primary }}>{userEmail}</strong></>
                  ) : (
                    <span style={{ color: theme.colors.warning || '#FF9800' }}>No email configured</span>
                  )}
                </div>
                <button
                  onClick={() => { setEmail(userEmail); setEditingEmail(true); }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 28,
                    height: 28,
                    padding: 0,
                    backgroundColor: 'transparent',
                    color: theme.colors.textSecondary,
                    border: 'none',
                    borderRadius: 4,
                    cursor: 'pointer',
                    flexShrink: 0,
                    transition: 'color 0.15s'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = theme.colors.primary; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = theme.colors.textSecondary; }}
                >
                  <Pencil size={14} />
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

interface ChooseMethodStepProps {
  theme: Theme;
  selectedMethod: SetupMethod;
  onSelectMethod: (method: SetupMethod) => void;
}

const ChooseMethodStep: React.FC<ChooseMethodStepProps> = ({
  theme,
  selectedMethod,
  onSelectMethod
}) => (
  <div>
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      marginBottom: 24
    }}>
      <div style={{
        display: 'inline-flex',
        padding: 20,
        backgroundColor: '#ffffff',
        borderRadius: '50%'
      }}>
        <GitLogo size={48} color="#F05032" />
      </div>
    </div>

    <h2 style={{
      fontFamily: theme.fonts.heading,
      fontSize: `${theme.fontSizes[6]}px`,
      fontWeight: 700,
      color: theme.colors.text,
      marginBottom: 8,
      textAlign: 'center'
    }}>
      Local Projects
    </h2>

    <p style={{
      fontFamily: theme.fonts.body,
      fontSize: `${theme.fontSizes[3]}px`,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      marginBottom: 32
    }}>
      How would you like to add your projects?
    </p>

    <div style={{
      display: 'flex',
      flexDirection: 'row',
      gap: 16
    }}>
      {/* Scan Option */}
      <button
        onClick={() => onSelectMethod('scan')}
        style={{
          flex: 1,
          padding: 24,
          backgroundColor: selectedMethod === 'scan' ? `${theme.colors.primary}15` : theme.colors.backgroundSecondary,
          border: `2px solid ${selectedMethod === 'scan' ? theme.colors.primary : theme.colors.border}`,
          borderRadius: 12,
          cursor: 'pointer',
          textAlign: 'center',
          transition: 'all 0.2s ease'
        }}
      >
        <div style={{
          fontFamily: theme.fonts.body,
          fontSize: `${theme.fontSizes[2]}px`,
          fontWeight: 600,
          color: theme.colors.text,
          marginBottom: 8
        }}>
          Automatic
        </div>
        <div style={{
          fontFamily: theme.fonts.body,
          fontSize: `${theme.fontSizes[1]}px`,
          color: theme.colors.textSecondary,
          lineHeight: 1.5
        }}>
          Scan for .git projects
        </div>
      </button>

      {/* Setup Later Option */}
      <button
        onClick={() => onSelectMethod('later')}
        style={{
          flex: 1,
          padding: 24,
          backgroundColor: selectedMethod === 'later' ? `${theme.colors.primary}15` : theme.colors.backgroundSecondary,
          border: `2px solid ${selectedMethod === 'later' ? theme.colors.primary : theme.colors.border}`,
          borderRadius: 12,
          cursor: 'pointer',
          textAlign: 'center',
          transition: 'all 0.2s ease'
        }}
      >
        <div style={{
          fontFamily: theme.fonts.body,
          fontSize: `${theme.fontSizes[2]}px`,
          fontWeight: 600,
          color: theme.colors.text,
          marginBottom: 8
        }}>
          Skip For Now
        </div>
        <div style={{
          fontFamily: theme.fonts.body,
          fontSize: `${theme.fontSizes[1]}px`,
          color: theme.colors.textSecondary,
          lineHeight: 1.5
        }}>
          Add later
        </div>
      </button>
    </div>
  </div>
);

interface WelcomeStepProps {
  theme: Theme;
  onStart: () => void;
}

const WelcomeStep: React.FC<WelcomeStepProps> = ({ theme, onStart }) => (
  <div style={{ textAlign: 'center' }}>
    <h1 style={{
      fontFamily: theme.fonts.heading,
      fontSize: `${theme.fontSizes[7]}px`,
      fontWeight: 700,
      color: theme.colors.text,
      marginBottom: 32
    }}>
      Welcome <span style={{ color: theme.colors.primary }}>to</span> Principal <span style={{ color: theme.colors.primary }}>AI</span>
    </h1>

    <div style={{
      display: 'flex',
      justifyContent: 'center',
      marginBottom: 32
    }}>
      {/* ANIMATED-LOGO-TODO: was the animated sphere Logo; static for now. */}
      <FileCityLogoAnimated mark="P" width={120} height={120} primary={theme.colors.primary} accent={theme.colors.accent} color={theme.colors.text} background="transparent" />
    </div>

    <p style={{
      fontFamily: theme.fonts.body,
      fontSize: `${theme.fontSizes[4]}px`,
      color: theme.colors.textSecondary,
      lineHeight: 1.6,
      marginBottom: 48
    }}>
      Let's get you set up.
    </p>

    <button
      onClick={onStart}
      style={{
        padding: '16px 48px',
        backgroundColor: theme.colors.primary,
        color: '#ffffff',
        border: 'none',
        borderRadius: 8,
        cursor: 'pointer',
        fontFamily: theme.fonts.body,
        fontSize: `${theme.fontSizes[2]}px`,
        fontWeight: 600,
        transition: 'all 0.2s ease'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.3)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      Begin
    </button>
  </div>
);

interface FolderSelectionStepProps {
  theme: Theme;
  folders: TopLevelFolder[];
  isLoading: boolean;
  onToggleFolder: (name: string) => void;
}

const FolderSelectionStep: React.FC<FolderSelectionStepProps> = ({
  theme,
  folders,
  isLoading,
  onToggleFolder
}) => {
  const selectedCount = folders.filter(f => f.selected).length;

  // Skeleton loader items
  const skeletonItems = Array.from({ length: 8 }, (_, i) => i);

  return (
    <div>
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        marginBottom: 24
      }}>
        <div style={{
          display: 'inline-flex',
          padding: 20,
          backgroundColor: `${theme.colors.primary}15`,
          borderRadius: '50%'
        }}>
          <FolderTree size={48} color={theme.colors.primary} />
        </div>
      </div>

      <h2 style={{
        fontFamily: theme.fonts.heading,
        fontSize: `${theme.fontSizes[6]}px`,
        fontWeight: 700,
        color: theme.colors.text,
        marginBottom: 12,
        textAlign: 'center'
      }}>
        Choose folders to scan
      </h2>

      <p style={{
        fontFamily: theme.fonts.body,
        fontSize: `${theme.fontSizes[3]}px`,
        color: theme.colors.textSecondary,
        lineHeight: 1.6,
        marginBottom: 8,
        textAlign: 'center'
      }}>
        Select which folders to search for <span style={{ color: '#F05032' }}>git</span> projects
      </p>

      <p style={{
        fontFamily: theme.fonts.body,
        fontSize: `${theme.fontSizes[0]}px`,
        color: theme.colors.textSecondary,
        marginBottom: 32,
        textAlign: 'center'
      }}>
        {selectedCount} folder{selectedCount !== 1 ? 's' : ''} selected
      </p>

      <div style={{
        maxHeight: 350,
        minHeight: 350,
        overflowY: 'auto',
        marginBottom: 24
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8
        }}>
          {isLoading ? (
            // Skeleton loaders
            skeletonItems.map((i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: 12,
                  backgroundColor: theme.colors.backgroundSecondary,
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: 8,
                  height: 48
                }}
              >
                <div style={{
                  width: 18,
                  height: 18,
                  backgroundColor: theme.colors.border,
                  borderRadius: 3,
                  animation: 'pulse 1.5s ease-in-out infinite'
                }} />
                <div style={{
                  width: 20,
                  height: 20,
                  backgroundColor: theme.colors.border,
                  borderRadius: 4,
                  animation: 'pulse 1.5s ease-in-out infinite'
                }} />
                <div style={{
                  flex: 1,
                  height: 16,
                  backgroundColor: theme.colors.border,
                  borderRadius: 4,
                  animation: 'pulse 1.5s ease-in-out infinite',
                  maxWidth: `${40 + Math.random() * 30}%`
                }} />
              </div>
            ))
          ) : (
            // Actual folders
            folders.map((folder) => {
              const isDev = folder.category === 'dev';
              const isSystem = folder.category === 'system';

              return (
                <label
                  key={folder.name}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: 12,
                    backgroundColor: folder.selected ? `${theme.colors.primary}10` : theme.colors.backgroundSecondary,
                    border: `1px solid ${folder.selected ? theme.colors.primary : theme.colors.border}`,
                    borderRadius: 8,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    opacity: isSystem ? 0.6 : 1
                  }}
                >
                  <input
                    type="checkbox"
                    checked={folder.selected}
                    onChange={() => onToggleFolder(folder.name)}
                    style={{
                      width: 18,
                      height: 18,
                      cursor: 'pointer'
                    }}
                  />
                  <Folder
                    size={20}
                    color={isDev ? theme.colors.primary : theme.colors.textSecondary}
                  />
                  <span style={{
                    flex: 1,
                    fontFamily: theme.fonts.monospace,
                    fontSize: `${theme.fontSizes[1]}px`,
                    color: theme.colors.text,
                    fontWeight: isDev ? 600 : 400
                  }}>
                    ~/{folder.name}
                  </span>
                  {isDev && (
                    <span style={{
                      padding: '2px 8px',
                      backgroundColor: `${theme.colors.primary}20`,
                      color: theme.colors.primary,
                      borderRadius: 4,
                      fontSize: `${theme.fontSizes[0]}px`,
                      fontWeight: 500
                    }}>
                      Recommended
                    </span>
                  )}
                  {isSystem && (
                    <span style={{
                      padding: '2px 8px',
                      backgroundColor: `${theme.colors.textSecondary}20`,
                      color: theme.colors.textSecondary,
                      borderRadius: 4,
                      fontSize: `${theme.fontSizes[0]}px`
                    }}>
                      Excluded
                    </span>
                  )}
                </label>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

interface ScanningStepProps {
  theme: Theme;
  isScanning: boolean;
  progress: { current: number; total: number; currentFolder: string };
  foundProjects: Array<{ currentPath: string; owner: string; name: string; registered?: boolean; alreadyRegistered?: boolean; registrationError?: string }>;
}

const ScanningStep: React.FC<ScanningStepProps> = ({
  theme,
  isScanning,
  progress,
  foundProjects
}) => {
  // Skeleton loader items for projects
  const skeletonProjects = Array.from({ length: 5 }, (_, i) => i);

  return (
    <div>
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        marginBottom: 24
      }}>
        <div style={{
          display: 'inline-flex',
          padding: 20,
          backgroundColor: `${theme.colors.primary}15`,
          borderRadius: '50%'
        }}>
          <FolderGit2 size={48} color={theme.colors.primary} />
        </div>
      </div>

      <h2 style={{
        fontFamily: theme.fonts.heading,
        fontSize: `${theme.fontSizes[6]}px`,
        fontWeight: 700,
        color: theme.colors.text,
        marginBottom: 12,
        textAlign: 'center'
      }}>
        {isScanning ? (
          <>
            Scanning for <span style={{ color: '#F05032' }}>git</span> projects...
          </>
        ) : (
          'Scan complete!'
        )}
      </h2>

      <p style={{
        fontFamily: theme.fonts.body,
        fontSize: `${theme.fontSizes[3]}px`,
        color: theme.colors.textSecondary,
        lineHeight: 1.6,
        marginBottom: 8,
        textAlign: 'center',
        minHeight: 29
      }}>
        {isScanning ? 'Scanning your selected folders' : `Found ${foundProjects.length} project${foundProjects.length !== 1 ? 's' : ''}`}
      </p>

      <p style={{
        fontFamily: theme.fonts.body,
        fontSize: `${theme.fontSizes[0]}px`,
        color: theme.colors.textSecondary,
        marginBottom: 32,
        textAlign: 'center',
        minHeight: 16
      }}>
        {isScanning ? '' : '\u00A0'}
      </p>

      {/* Results area - always reserve space */}
      <div style={{
        minHeight: 350
      }}>
        {isScanning && (
          <>
            <p style={{
              fontFamily: theme.fonts.body,
              fontSize: `${theme.fontSizes[1]}px`,
              color: theme.colors.textSecondary,
              lineHeight: 1.6,
              marginBottom: 24,
              textAlign: 'center',
              minHeight: 24
            }}>
              {progress.currentFolder ? `Scanning ~/${progress.currentFolder}...` : 'Starting scan...'}
            </p>

            <div style={{
              maxHeight: 300,
              overflowY: 'auto',
              backgroundColor: theme.colors.backgroundSecondary,
              borderRadius: 8,
              padding: 16
            }}>
              {skeletonProjects.map((i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: 12,
                    borderBottom: i < skeletonProjects.length - 1 ? `1px solid ${theme.colors.border}` : 'none'
                  }}
                >
                  <div style={{
                    width: 20,
                    height: 20,
                    backgroundColor: theme.colors.border,
                    borderRadius: 4,
                    animation: 'pulse 1.5s ease-in-out infinite'
                  }} />
                  <div style={{ flex: 1 }}>
                    <div style={{
                      height: 16,
                      backgroundColor: theme.colors.border,
                      borderRadius: 4,
                      marginBottom: 8,
                      animation: 'pulse 1.5s ease-in-out infinite',
                      maxWidth: `${30 + Math.random() * 30}%`
                    }} />
                    <div style={{
                      height: 12,
                      backgroundColor: theme.colors.border,
                      borderRadius: 4,
                      animation: 'pulse 1.5s ease-in-out infinite',
                      maxWidth: `${50 + Math.random() * 30}%`
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {!isScanning && foundProjects.length === 0 && (
          <p style={{
            fontFamily: theme.fonts.body,
            fontSize: `${theme.fontSizes[1]}px`,
            color: theme.colors.textSecondary,
            lineHeight: 1.6,
            marginBottom: 24,
            textAlign: 'center'
          }}>
            No <span style={{ color: '#F05032' }}>git</span> projects found in the selected folders
          </p>
        )}

        {!isScanning && foundProjects.length > 0 && (
          <>
            <p style={{
              fontFamily: theme.fonts.body,
              fontSize: `${theme.fontSizes[1]}px`,
              color: theme.colors.textSecondary,
              lineHeight: 1.6,
              marginBottom: 24,
              textAlign: 'center'
            }}>
              Found {foundProjects.length} <span style={{ color: '#F05032' }}>git</span> {foundProjects.length === 1 ? 'project' : 'projects'}
              {foundProjects.some(p => p.registered === true || p.registered === false) && (
                <>
                  {' • '}
                  <span style={{ color: theme.colors.success || '#10b981' }}>
                    {foundProjects.filter(p => p.registered === true && !p.alreadyRegistered).length} newly registered
                  </span>
                  {foundProjects.some(p => p.alreadyRegistered) && (
                    <>
                      {' • '}
                      <span style={{ color: theme.colors.textSecondary }}>
                        {foundProjects.filter(p => p.alreadyRegistered).length} already in library
                      </span>
                    </>
                  )}
                  {foundProjects.some(p => p.registered === false) && (
                    <>
                      {' • '}
                      <span style={{ color: theme.colors.error || '#ef4444' }}>
                        {foundProjects.filter(p => p.registered === false).length} failed
                      </span>
                    </>
                  )}
                </>
              )}
            </p>

            <div style={{
              maxHeight: 300,
              overflowY: 'auto',
              backgroundColor: theme.colors.backgroundSecondary,
              borderRadius: 8,
              padding: 16
            }}>
              {foundProjects.map((project, idx) => (
                <div
                  key={project.currentPath}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: 12,
                    borderBottom: idx < foundProjects.length - 1 ? `1px solid ${theme.colors.border}` : 'none'
                  }}
                >
                  <FolderGit2 size={20} color={theme.colors.primary} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontFamily: theme.fonts.monospace,
                      fontSize: `${theme.fontSizes[1]}px`,
                      color: theme.colors.text,
                      fontWeight: 500
                    }}>
                      {project.name}
                    </div>
                    <div style={{
                      fontFamily: theme.fonts.monospace,
                      fontSize: `${theme.fontSizes[0]}px`,
                      color: theme.colors.textSecondary,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {project.currentPath}
                    </div>
                    {project.registrationError && (
                      <div style={{
                        fontFamily: theme.fonts.body,
                        fontSize: `${theme.fontSizes[0]}px`,
                        color: theme.colors.error || '#ef4444',
                        marginTop: 4
                      }}>
                        Failed: {project.registrationError}
                      </div>
                    )}
                  </div>
                  {project.registered === true && !project.alreadyRegistered && (
                    <CheckCircle size={20} color={theme.colors.success || '#10b981'} />
                  )}
                  {project.registered === false && (
                    <AlertCircle size={20} color={theme.colors.error || '#ef4444'} />
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

interface HomeDirectoryStepProps {
  theme: Theme;
  devDirectoryName: string;
  onSetDevDirectoryName: (name: string) => void;
}

const HomeDirectoryStep: React.FC<HomeDirectoryStepProps> = ({
  theme,
  devDirectoryName,
  onSetDevDirectoryName
}) => {
  const suggestions = ['Development', 'Developer', 'Code', 'Projects'];

  return (
    <div>
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        marginBottom: 24
      }}>
        <div style={{
          display: 'inline-flex',
          padding: 20,
          backgroundColor: `${theme.colors.primary}15`,
          borderRadius: '50%'
        }}>
          <FolderTree size={48} color={theme.colors.primary} />
        </div>
      </div>

      <h2 style={{
        fontFamily: theme.fonts.heading,
        fontSize: `${theme.fontSizes[6]}px`,
        fontWeight: 700,
        color: theme.colors.text,
        marginBottom: 12,
        textAlign: 'center'
      }}>
        Set a Default Clone Directory
      </h2>

      <p style={{
        fontFamily: theme.fonts.body,
        fontSize: `${theme.fontSizes[3]}px`,
        color: theme.colors.textSecondary,
        lineHeight: 1.6,
        marginBottom: 32,
        textAlign: 'center'
      }}>
        This is where we will place all future <span style={{ color: '#F05032' }}>git</span> projects in owner/reponame style.
        You can change it later in Settings → General.
      </p>

      <div style={{ marginBottom: 16 }}>
        <div style={{
          fontFamily: theme.fonts.body,
          fontSize: `${theme.fontSizes[2]}px`,
          color: theme.colors.textSecondary,
          marginBottom: 12,
          textAlign: 'center'
        }}>
          Suggestions:
        </div>
        <div style={{
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
          justifyContent: 'center'
        }}>
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => onSetDevDirectoryName(suggestion)}
              style={{
                width: 130,
                padding: '8px 16px',
                backgroundColor: devDirectoryName === suggestion ? `${theme.colors.primary}20` : theme.colors.backgroundSecondary,
                color: devDirectoryName === suggestion ? theme.colors.primary : theme.colors.text,
                border: `1px solid ${devDirectoryName === suggestion ? theme.colors.primary : theme.colors.border}`,
                borderRadius: 6,
                cursor: 'pointer',
                fontFamily: theme.fonts.body,
                fontSize: `${theme.fontSizes[1]}px`,
                fontWeight: 500,
                transition: 'all 0.2s ease'
              }}
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 24 }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '12px 16px',
          backgroundColor: theme.colors.backgroundSecondary,
          border: `1px solid ${theme.colors.border}`,
          borderRadius: 8
        }}>
          <span style={{
            fontFamily: theme.fonts.body,
            fontSize: `${theme.fontSizes[1]}px`,
            color: theme.colors.textSecondary
          }}>
            ~/
          </span>
          <input
            type="text"
            value={devDirectoryName}
            onChange={(e) => onSetDevDirectoryName(e.target.value)}
            style={{
              flex: 1,
              backgroundColor: 'transparent',
              border: 'none',
              outline: 'none',
              fontFamily: theme.fonts.body,
              fontSize: `${theme.fontSizes[1]}px`,
              color: theme.colors.text
            }}
            placeholder="Development"
          />
        </div>

        <div style={{
          marginTop: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          fontFamily: theme.fonts.body,
          fontSize: `${theme.fontSizes[2]}px`,
          color: theme.colors.textSecondary
        }}>
          Example:
          <span style={{ fontFamily: theme.fonts.monospace }}>
            ~/
            <span style={{ color: theme.colors.primary, fontWeight: 600 }}>
              {devDirectoryName || 'Development'}
            </span>
            /octocat/hello-world
          </span>
        </div>
      </div>
    </div>
  );
};

interface GitHubCliStepProps {
  theme: Theme;
  status: GitHubCliStatus;
  onRecheck: () => void;
}

const GitHubCliStep: React.FC<GitHubCliStepProps> = ({
  theme,
  status,
  onRecheck
}) => {
  const { isLoading, isConfigured, source, user, error } = status;
  const successColor = theme.colors.success || '#10b981';
  const warningColor = theme.colors.warning || '#FF9800';

  const subtitle = isLoading
    ? 'Checking your GitHub CLI session.'
    : isConfigured
      ? 'Principal uses your GitHub CLI session for GitHub features.'
      : 'Principal uses the GitHub CLI for GitHub features.';

  return (
    <div>
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 16,
        marginBottom: 24
      }}>
        {/* ANIMATED-LOGO-TODO: was the animated sphere Logo; static for now. */}
        <FileCityLogo mark="P" width={80} height={80} primary={theme.colors.primary} color={theme.colors.text} background="transparent" />
        <ArrowRight size={32} color={theme.colors.textSecondary} />
        <div style={{
          display: 'inline-flex',
          padding: 10,
          backgroundColor: '#24292e',
          borderRadius: '50%'
        }}>
          <GitHubLogo size={48} color="#ffffff" />
        </div>
      </div>

      <h2 style={{
        fontFamily: theme.fonts.heading,
        fontSize: `${theme.fontSizes[6]}px`,
        fontWeight: 700,
        color: theme.colors.text,
        marginBottom: 12,
        textAlign: 'center'
      }}>
        GitHub CLI
      </h2>

      <p style={{
        fontFamily: theme.fonts.body,
        fontSize: `${theme.fontSizes[3]}px`,
        color: theme.colors.textSecondary,
        lineHeight: 1.6,
        marginBottom: 32,
        textAlign: 'center'
      }}>
        {subtitle}
      </p>

      {isLoading ? (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          padding: 24
        }}>
          <div style={{
            width: 20,
            height: 20,
            border: `3px solid ${theme.colors.border}`,
            borderTopColor: theme.colors.primary,
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite'
          }} />
          <span style={{
            fontFamily: theme.fonts.body,
            fontSize: `${theme.fontSizes[1]}px`,
            color: theme.colors.textSecondary
          }}>
            Looking for <code style={{ fontFamily: theme.fonts.monospace }}>gh auth token</code>...
          </span>
        </div>
      ) : isConfigured ? (
        <div style={{
          padding: 20,
          backgroundColor: `${successColor}15`,
          border: `1px solid ${successColor}`,
          borderRadius: 12
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16
          }}>
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.login}
                width={48}
                height={48}
                style={{ borderRadius: '50%', flexShrink: 0 }}
              />
            ) : (
              <div style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: `${successColor}25`,
                color: successColor
              }}>
                <GitHubLogo size={24} color={successColor} />
              </div>
            )}

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontFamily: theme.fonts.body,
                fontSize: `${theme.fontSizes[1]}px`,
                fontWeight: 600,
                color: theme.colors.text
              }}>
                {user ? (
                  <span style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {user.name || user.login}
                  </span>
                ) : (
                  'GitHub CLI is set up'
                )}
              </div>
              {user?.login && (
                <div style={{
                  fontFamily: theme.fonts.monospace,
                  fontSize: `${theme.fontSizes[0]}px`,
                  color: theme.colors.textSecondary
                }}>
                  @{user.login}
                </div>
              )}
              {user?.email && (
                <div style={{
                  fontFamily: theme.fonts.body,
                  fontSize: `${theme.fontSizes[0]}px`,
                  color: theme.colors.textSecondary,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {user.email}
                </div>
              )}
            </div>

            <CheckCircle size={24} color={successColor} />
          </div>

          <div style={{
            marginTop: 16,
            paddingTop: 12,
            borderTop: `1px solid ${successColor}30`,
            fontFamily: theme.fonts.body,
            fontSize: `${theme.fontSizes[0]}px`,
            color: theme.colors.textSecondary
          }}>
            {source === 'gh-cli'
              ? 'Detected from your signed-in GitHub CLI session.'
              : 'Using a saved GitHub token instead of the CLI. Run gh auth login to switch to the CLI.'}
          </div>
        </div>
      ) : (
        <div style={{
          padding: 20,
          backgroundColor: `${warningColor}10`,
          border: `1px solid ${warningColor}40`,
          borderRadius: 12
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12
          }}>
            <Info size={20} color={warningColor} style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ flex: 1 }}>
              <div style={{
                fontFamily: theme.fonts.body,
                fontSize: `${theme.fontSizes[1]}px`,
                fontWeight: 600,
                color: theme.colors.text,
                marginBottom: 4
              }}>
                No GitHub CLI session found
              </div>
              <div style={{
                fontFamily: theme.fonts.body,
                fontSize: `${theme.fontSizes[0]}px`,
                color: theme.colors.textSecondary,
                marginBottom: 12
              }}>
                You can skip this and set it up later. When you're ready, sign in from your terminal:
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 12px',
                backgroundColor: theme.colors.background,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: 6
              }}>
                <span style={{
                  fontFamily: theme.fonts.monospace,
                  fontSize: `${theme.fontSizes[0]}px`,
                  color: theme.colors.text
                }}>
                  gh auth login
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div style={{
          marginTop: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontFamily: theme.fonts.body,
          fontSize: `${theme.fontSizes[0]}px`,
          color: theme.colors.error || '#ef4444'
        }}>
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      {!isLoading && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
          <button
            onClick={onRecheck}
            style={{
              padding: '8px 16px',
              backgroundColor: 'transparent',
              color: theme.colors.primary,
              border: `1px solid ${theme.colors.primary}`,
              borderRadius: 6,
              cursor: 'pointer',
              fontFamily: theme.fonts.body,
              fontSize: `${theme.fontSizes[0]}px`,
              fontWeight: 500,
              transition: 'all 0.2s ease'
            }}
          >
            Check again
          </button>
        </div>
      )}
    </div>
  );
};

interface SkillsStepProps {
  theme: Theme;
  rows: Record<string, SkillRowState>;
  isInstalling: boolean;
  onToggleSkill: (name: string) => void;
  onInstall: () => void;
}

const SkillsStep: React.FC<SkillsStepProps> = ({
  theme,
  rows,
  isInstalling,
  onToggleSkill,
  onInstall
}) => {
  const successColor = theme.colors.success || '#10b981';
  const errorColor = theme.colors.error || '#ef4444';

  const selectable = ALL_SKILL_DETAILS.filter(skill => rows[skill.name]?.status !== 'installed');
  const selectedCount = selectable.filter(skill => rows[skill.name]?.selected).length;
  const installedCount = ALL_SKILL_DETAILS.length - selectable.length;

  return (
    <div>
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        marginBottom: 24
      }}>
        <div style={{
          display: 'inline-flex',
          padding: 20,
          backgroundColor: `${theme.colors.primary}15`,
          borderRadius: '50%'
        }}>
          <Sparkles size={48} color={theme.colors.primary} />
        </div>
      </div>

      <h2 style={{
        fontFamily: theme.fonts.heading,
        fontSize: `${theme.fontSizes[6]}px`,
        fontWeight: 700,
        color: theme.colors.text,
        marginBottom: 12,
        textAlign: 'center'
      }}>
        Install Skills
      </h2>

      <p style={{
        fontFamily: theme.fonts.body,
        fontSize: `${theme.fontSizes[3]}px`,
        color: theme.colors.textSecondary,
        lineHeight: 1.6,
        marginBottom: 8,
        textAlign: 'center'
      }}>
        Skills teach your agent how to do specific jobs.
      </p>

      <p style={{
        fontFamily: theme.fonts.body,
        fontSize: `${theme.fontSizes[0]}px`,
        color: theme.colors.textSecondary,
        marginBottom: 24,
        textAlign: 'center'
      }}>
        Pick what you want now — you can install more later from Skills.
        {installedCount > 0 && ` ${installedCount} already installed.`}
      </p>

      <div style={{
        maxHeight: 320,
        overflowY: 'auto',
        marginBottom: 20
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8
        }}>
          {ALL_SKILL_DETAILS.map(skill => {
            const row: SkillRowState = rows[skill.name] ?? { selected: false, status: 'idle' };
            const isInstalled = row.status === 'installed';
            const isBusy = row.status === 'installing';
            const Icon = skill.Icon;

            return (
              <label
                key={skill.name}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                  padding: 12,
                  backgroundColor: row.selected ? `${theme.colors.primary}10` : theme.colors.backgroundSecondary,
                  border: `1px solid ${row.selected ? theme.colors.primary : theme.colors.border}`,
                  borderRadius: 8,
                  cursor: isInstalled || isBusy ? 'default' : 'pointer',
                  transition: 'all 0.2s ease',
                  opacity: isBusy ? 0.7 : 1
                }}
              >
                <input
                  type="checkbox"
                  checked={row.selected}
                  disabled={isInstalled || isBusy}
                  onChange={() => onToggleSkill(skill.name)}
                  style={{
                    width: 18,
                    height: 18,
                    marginTop: 2,
                    cursor: isInstalled || isBusy ? 'default' : 'pointer'
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontFamily: theme.fonts.body,
                    fontSize: `${theme.fontSizes[1]}px`,
                    fontWeight: 600,
                    color: theme.colors.text
                  }}>
                    <Icon size={16} color={theme.colors.primary} />
                    {skill.title}
                  </div>
                  <div style={{
                    fontFamily: theme.fonts.body,
                    fontSize: `${theme.fontSizes[0]}px`,
                    color: theme.colors.textSecondary,
                    lineHeight: 1.5,
                    marginTop: 4
                  }}>
                    {skill.description}
                  </div>
                  {row.status === 'failed' && row.error && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      marginTop: 6,
                      fontFamily: theme.fonts.body,
                      fontSize: `${theme.fontSizes[0]}px`,
                      color: errorColor
                    }}>
                      <AlertCircle size={12} />
                      {row.error}
                    </div>
                  )}
                </div>
                {isInstalled && (
                  <CheckCircle size={20} color={successColor} style={{ flexShrink: 0 }} />
                )}
                {isBusy && (
                  <div style={{
                    width: 18,
                    height: 18,
                    flexShrink: 0,
                    border: `2px solid ${theme.colors.border}`,
                    borderTopColor: theme.colors.primary,
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite'
                  }} />
                )}
              </label>
            );
          })}
        </div>
      </div>

      <button
        onClick={onInstall}
        disabled={isInstalling || selectedCount === 0}
        style={{
          width: '100%',
          padding: '12px 24px',
          backgroundColor: isInstalling || selectedCount === 0 ? theme.colors.border : theme.colors.primary,
          color: '#ffffff',
          border: 'none',
          borderRadius: 8,
          cursor: isInstalling || selectedCount === 0 ? 'not-allowed' : 'pointer',
          fontFamily: theme.fonts.body,
          fontSize: `${theme.fontSizes[1]}px`,
          fontWeight: 500,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          transition: 'all 0.2s ease'
        }}
      >
        <Sparkles size={16} />
        {isInstalling
          ? 'Installing...'
          : `Install ${selectedCount} skill${selectedCount === 1 ? '' : 's'}`}
      </button>
    </div>
  );
};

interface ReadyStepProps {
  theme: Theme;
}

const ReadyStep: React.FC<ReadyStepProps> = ({ theme }) => (
  <div style={{ textAlign: 'center' }}>
    <div style={{
      display: 'inline-flex',
      padding: 32,
      backgroundColor: `${theme.colors.success || '#10b981'}15`,
      borderRadius: '50%',
      marginBottom: 24
    }}>
      <CheckCircle size={64} color={theme.colors.success || '#10b981'} />
    </div>

    <h2 style={{
      fontFamily: theme.fonts.heading,
      fontSize: `${theme.fontSizes[6]}px`,
      fontWeight: 700,
      color: theme.colors.text,
      marginBottom: 12,
      textAlign: 'center'
    }}>
      You're all set!
    </h2>

    <p style={{
      fontFamily: theme.fonts.body,
      fontSize: `${theme.fontSizes[3]}px`,
      color: theme.colors.textSecondary,
      lineHeight: 1.6,
      textAlign: 'center'
    }}>
      Let's start exploring your <span style={{ color: '#F05032' }}>git</span> projects and building something awesome together.
    </p>
  </div>
);
