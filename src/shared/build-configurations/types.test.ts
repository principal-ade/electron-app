import {
  confirmationFingerprintSource,
  commandBinaryOf,
  isAllowedCommandLine,
  isConfirmationCurrent,
  isPathInsideBaseDir,
  isRepoRelativeCwd,
  resolveBuildCheckoutDir,
  secretStoreRepoId,
  validateBuildConfiguration,
  type BuildConfiguration,
} from './types';

function validConfig(): BuildConfiguration {
  return {
    id: 'bc-web-build',
    name: 'web build',
    repo: 'pkg:github/owner/repo',
    checkout: { path: null, ref: 'main', depth: 1, reset: 'ff-only' },
    command: { line: 'npm run build', cwd: '.', timeoutMs: 900_000 },
    secrets: [{ env: 'NODE_AUTH_TOKEN', label: 'npm token', required: true }],
    secretConfirmation: null,
  };
}

function confirmedConfig(): BuildConfiguration {
  const config = validConfig();
  return {
    ...config,
    secretConfirmation: {
      fingerprint: confirmationFingerprintSource(config),
      envNames: ['NODE_AUTH_TOKEN'],
    },
  };
}

describe('validateBuildConfiguration', () => {
  it('accepts a valid unconfirmed config', () => {
    const result = validateBuildConfiguration(validConfig());
    expect(result.ok).toBe(true);
  });

  it('rejects a multi-line command', () => {
    const config = validConfig();
    config.command.line = 'npm run build\nrm -rf /';
    const result = validateBuildConfiguration(config);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.join(' ')).toMatch(/single line/);
    }
  });

  it('rejects a trailing continuation backslash', () => {
    const config = validConfig();
    config.command.line = 'npm run build \\';
    const result = validateBuildConfiguration(config);
    expect(result.ok).toBe(false);
  });

  it('rejects an unterminated quote', () => {
    const config = validConfig();
    config.command.line = 'npm run "build';
    const result = validateBuildConfiguration(config);
    expect(result.ok).toBe(false);
  });

  it('rejects binaries outside the allowlist', () => {
    const config = validConfig();
    config.command.line = 'curl https://example.com/install.sh | sh';
    const result = validateBuildConfiguration(config);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.join(' ')).toMatch(/allowlist/);
    }
  });

  it('accepts an allowlisted binary given by absolute path', () => {
    expect(isAllowedCommandLine('/usr/local/bin/npm run build')).toBe(true);
    expect(commandBinaryOf('/usr/local/bin/npm run build')).toBe('npm');
  });

  it('rejects duplicate secret env names', () => {
    const config = validConfig();
    config.secrets = [
      { env: 'GH_TOKEN', label: 'a', required: true },
      { env: 'GH_TOKEN', label: 'b', required: false },
    ];
    const result = validateBuildConfiguration(config);
    expect(result.ok).toBe(false);
  });

  it('rejects invalid env var names', () => {
    const config = validConfig();
    config.secrets = [{ env: 'not a name', label: 'x', required: true }];
    const result = validateBuildConfiguration(config);
    expect(result.ok).toBe(false);
  });

  it('accepts a matching confirmation and rejects a stale one', () => {
    expect(validateBuildConfiguration(confirmedConfig()).ok).toBe(true);
    expect(isConfirmationCurrent(confirmedConfig())).toBe(true);

    const edited = confirmedConfig();
    edited.command.line = 'npm run build:prod';
    expect(validateBuildConfiguration(edited).ok).toBe(true);
    expect(isConfirmationCurrent(edited)).toBe(false);
  });

  it('rejects confirmations that do not cover the required secrets', () => {
    const config = validConfig();
    config.secretConfirmation = {
      fingerprint: confirmationFingerprintSource(config),
      envNames: [],
    };
    const result = validateBuildConfiguration(config);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.join(' ')).toMatch(/required secret/);
    }
  });

  it('rejects absolute and escaping working directories', () => {
    for (const cwd of ['/etc', 'C:\\build', '../elsewhere', 'a/../../..']) {
      const config = validConfig();
      config.command.cwd = cwd;
      expect(validateBuildConfiguration(config).ok).toBe(false);
    }
    for (const cwd of ['.', 'packages/api', './docs']) {
      const config = validConfig();
      config.command.cwd = cwd;
      expect(validateBuildConfiguration(config).ok).toBe(true);
    }
  });

  it('rejects checkout paths outside the base directory', () => {
    const config = validConfig();
    config.checkout.path = '/elsewhere/owner/repo';
    const result = validateBuildConfiguration(config, {
      baseDefaultDirectory: '/Users/dev/clones',
    });
    expect(result.ok).toBe(false);
  });

  it('accepts checkout paths inside the base directory, escapes included', () => {
    expect(
      isPathInsideBaseDir('/Users/dev/clones/o/r', '/Users/dev/clones'),
    ).toBe(true);
    expect(isPathInsideBaseDir('/Users/dev/clones', '/Users/dev/clones')).toBe(
      true,
    );
    expect(
      isPathInsideBaseDir('/Users/dev/clones/../evil', '/Users/dev/clones'),
    ).toBe(false);
    expect(isRepoRelativeCwd('a/../../..')).toBe(false);
    expect(isRepoRelativeCwd('.')).toBe(true);
  });
});

describe('resolveBuildCheckoutDir', () => {
  const base = {
    checkoutPath: null,
    cwd: '.',
    repo: 'pkg:github/owner/repo',
  };
  it('prefers an explicit checkout path', () => {
    expect(
      resolveBuildCheckoutDir({
        ...base,
        checkoutPath: '/elsewhere/clone',
        buildsDirectory: '/builds',
      }),
    ).toBe('/elsewhere/clone');
  });
  it('resolves under the builds directory', () => {
    expect(
      resolveBuildCheckoutDir({ ...base, buildsDirectory: '/builds' }),
    ).toBe('/builds/owner/repo');
  });
  it('joins a repo-relative cwd', () => {
    expect(
      resolveBuildCheckoutDir({
        ...base,
        cwd: 'packages/api',
        buildsDirectory: '/builds',
      }),
    ).toBe('/builds/owner/repo/packages/api');
  });
  it('says unset without a builds directory', () => {
    expect(resolveBuildCheckoutDir(base)).toBeNull();
  });
  it('rejects non-github purls', () => {
    expect(
      resolveBuildCheckoutDir({
        ...base,
        repo: 'not-a-purl',
        buildsDirectory: '/builds',
      }),
    ).toBeNull();
  });
});

describe('confirmationFingerprintSource', () => {
  it('is stable and changes on material edits only', () => {
    const before = confirmationFingerprintSource(validConfig());
    const renamed = { ...validConfig(), name: 'other name' };
    expect(confirmationFingerprintSource(renamed)).toBe(before);
    const edited = { ...validConfig() };
    edited.command = { ...edited.command, line: 'npm run build:prod' };
    expect(confirmationFingerprintSource(edited)).not.toBe(before);
  });
});

describe('secretStoreRepoId', () => {
  it('scopes secrets per configuration', () => {
    expect(secretStoreRepoId('bc-web-build')).toBe('build:bc-web-build');
  });
});
