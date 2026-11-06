/**
 * Shared build-configuration instances.
 *
 * The bridge routes and the TIPC router operate on the same store,
 * resolver, and run registry, so runs started from the UI are visible to
 * bridge polling and vice versa. Lazy getters avoid import-time side
 * effects (notably newsing up the terminal session manager).
 */

import { BuildConfigurationStore } from '../build-configurations/BuildConfigurationStore';
import { BuildRunRegistry } from './BuildRunRegistry';
import { BuildSecretResolver } from '../services/BuildSecretResolver';
import { getSessionManagerInstance } from '../terminal/sessionManagerSingleton';
import { AlexandriaRegistryService } from '../stores/AlexandriaRegistryService';
import { UnifiedSecureStorage } from '../services/UnifiedSecureStorage';
import { UserPreferencesHandler } from '../stores/userPreferencesHandler';
import {
  secretStoreRepoId,
  type BuildCheckoutRoots,
} from '../../shared/build-configurations/types';
import { DEFAULT_BUILD_TERMINAL_CLEANUP_DELAY_MS } from '../../shared/types/userPreferences.types';
import { sanitizeBuildOutput } from './buildRunOutput';
import {
  prepareBuildCheckout,
  type PrepareBuildCheckoutInput,
  type PrepareBuildCheckoutResult,
} from './prepareBuildCheckout';

let store: BuildConfigurationStore | null = null;
let resolver: BuildSecretResolver | null = null;
let registry: BuildRunRegistry | null = null;

export function getBuildConfigurationStore(): BuildConfigurationStore {
  store ??= new BuildConfigurationStore();
  return store;
}

export function getBuildSecretResolver(): BuildSecretResolver {
  resolver ??= new BuildSecretResolver();
  return resolver;
}

export function getBuildRunRegistry(): BuildRunRegistry {
  registry ??= new BuildRunRegistry(
    getSessionManagerInstance(),
    undefined,
    async ({ run, secretEnvNames, rawOutput }) => {
      let secretValues: string[] = [];
      if (secretEnvNames.length > 0) {
        const resolved = await getBuildSecretResolver().resolve(
          secretStoreRepoId(run.configId),
          secretEnvNames.map((env) => ({ env, label: env, required: true })),
          { configId: run.configId, runId: run.runId },
        );
        if (resolved.missing.length > 0) return null;
        secretValues = Object.values(resolved.env);
      }
      return sanitizeBuildOutput(rawOutput, secretValues);
    },
  );
  return registry;
}

/** Cleanup delay is a global preference, clamped to a day, with a 5m default. */
export async function getBuildTerminalCleanupDelayMs(): Promise<number> {
  try {
    const prefs =
      await UserPreferencesHandler.getInstance().getUserPreferences();
    const delay = prefs.buildTerminalCleanupDelayMs;
    if (
      typeof delay === 'number' &&
      Number.isInteger(delay) &&
      delay >= 0 &&
      delay <= 24 * 60 * 60 * 1000
    ) {
      return delay;
    }
  } catch (error) {
    console.warn(
      '[BuildRun] Failed to read terminal cleanup preference:',
      error,
    );
  }
  return DEFAULT_BUILD_TERMINAL_CLEANUP_DELAY_MS;
}

/** PURLs of registered local repositories. */
export async function listRegisteredRepositoryPurls(): Promise<string[]> {
  const entries =
    await AlexandriaRegistryService.getInstance().getRepositories();
  const purls: string[] = [];
  for (const entry of entries as Array<{
    purl?: unknown;
    github?: { purl?: unknown };
  }>) {
    const purl = entry.purl ?? entry.github?.purl;
    if (typeof purl === 'string' && purl.length > 0) purls.push(purl);
  }
  return purls;
}

/** Secret env names granted under a SecretsDomain repoId. Keys only. */
export async function getGrantedSecretKeys(repoId: string): Promise<string[]> {
  return Object.keys(
    (await UnifiedSecureStorage.getInstance().getSecrets(repoId)) ?? {},
  );
}

/** The directories build checkouts resolve under. */
export async function getBuildRoots(): Promise<BuildCheckoutRoots> {
  const prefs = await UserPreferencesHandler.getInstance().getUserPreferences();
  return {
    buildsDirectory: prefs.buildsDirectory,
    baseDefaultDirectory: prefs.baseDefaultDirectory,
  };
}

/** Clone/update a config's checkout with the real git runner. */
export function prepareBuildConfigurationCheckout(
  input: PrepareBuildCheckoutInput,
): Promise<PrepareBuildCheckoutResult> {
  return prepareBuildCheckout(input);
}
