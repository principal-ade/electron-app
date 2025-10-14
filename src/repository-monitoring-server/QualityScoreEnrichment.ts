/**
 * QualityScoreEnrichment - Enriches PackageLayer objects with real quality scores from lenses
 *
 * This service:
 * 1. Takes PackageLayer objects with empty hexagon scores from composition package
 * 2. Runs the codebase-quality-lenses library to get real quality scores
 * 3. Uses composition package's calculateMetrics() to map scores to hexagon metrics
 * 4. Returns enriched packages with real quality scores
 */

import type { PackageLayer } from '@principal-ai/codebase-composition';
import { QualityMetricsCalculator } from '@principal-ai/codebase-composition';
import type { LensResult } from '@principal-ai/codebase-quality-lenses';
import {
  ESLintLens,
  JestLens,
  TypeScriptLens,
  KnipLens,
} from '@principal-ai/codebase-quality-lenses';
import { ElectronCLIBridgeExecutor } from '../main/quality-lenses/ElectronCLIBridgeExecutor';

/**
 * Service for enriching packages with real quality scores
 */
export class QualityScoreEnrichment {
  private executor: ElectronCLIBridgeExecutor;
  private lenses: Map<string, any>;

  constructor() {
    this.executor = new ElectronCLIBridgeExecutor();
    this.lenses = new Map();
    this.initializeLenses();
  }

  /**
   * Initialize available lenses
   */
  private initializeLenses(): void {
    this.lenses.set('eslint', new ESLintLens(this.executor));
    this.lenses.set('typescript', new TypeScriptLens(this.executor));
    this.lenses.set('jest', new JestLens(this.executor));
    this.lenses.set('test', new JestLens(this.executor)); // Alias
    this.lenses.set('knip', new KnipLens(this.executor));
  }

  /**
   * Enrich a package with real quality scores
   * @param pkg PackageLayer to enrich
   * @param repoPath Absolute path to repository root
   * @returns Enriched PackageLayer with real quality scores
   */
  async enrichPackage(
    pkg: PackageLayer,
    repoPath: string,
  ): Promise<PackageLayer> {
    // Skip if no quality metrics or no available lenses
    if (!pkg.qualityMetrics?.availableLenses?.length) {
      console.info(
        `[QualityScoreEnrichment] No lenses available for: ${pkg.packageData.name}`,
      );
      return pkg;
    }

    console.info(
      `[QualityScoreEnrichment] Enriching package: ${pkg.packageData.name}`,
    );

    const packagePath = pkg.packageData.path || '';
    const cwd = packagePath ? `${repoPath}/${packagePath}` : repoPath;

    // Run lenses and collect scores
    const lensScores = new Map<string, number>();

    for (const lensId of pkg.qualityMetrics.availableLenses) {
      try {
        const score = await this.runLensAndGetScore(lensId, cwd, pkg);
        if (score !== null) {
          lensScores.set(lensId, score);
          console.info(
            `[QualityScoreEnrichment] ${pkg.packageData.name} - ${lensId}: ${score}`,
          );
        }
      } catch (error) {
        console.warn(
          `[QualityScoreEnrichment] Failed to run lens ${lensId}:`,
          error,
        );
        // Leave score out on error - hexagon will show 0 for that metric
      }
    }

    // Use composition package to calculate hexagon from scores
    // This uses the LENS_TO_METRIC_MAP to properly map lens IDs to hexagon metrics
    const hexagon = QualityMetricsCalculator.calculateMetrics(
      this.createDetectedLensesMap(pkg.qualityMetrics.availableLenses),
      lensScores,
    );

    // Update the package with real scores
    return {
      ...pkg,
      qualityMetrics: {
        ...pkg.qualityMetrics,
        hexagon,
      },
    };
  }

  /**
   * Create a Map of detected lenses for calculateMetrics
   */
  private createDetectedLensesMap(
    availableLenses: string[],
  ): Map<string, { lensId: string; operations: Set<any> }> {
    const map = new Map();
    for (const lensId of availableLenses) {
      map.set(lensId, {
        lensId,
        operations: new Set(['check']), // Operations don't matter for score mapping
      });
    }
    return map;
  }

  /**
   * Run a specific lens and extract quality score
   */
  private async runLensAndGetScore(
    lensId: string,
    cwd: string,
    pkg: PackageLayer,
  ): Promise<number | null> {
    const lens = this.lenses.get(lensId);
    if (!lens) {
      console.warn(
        `[QualityScoreEnrichment] No lens implementation for: ${lensId}`,
      );
      return null;
    }

    // Find the command to run
    const command = this.findLensCommand(pkg, lensId);
    if (!command) {
      console.warn(
        `[QualityScoreEnrichment] No command found for lens: ${lensId}`,
      );
      return null;
    }

    // Parse command string
    const { command: cmd, args } = this.parseCommandString(command);

    // Configure lens
    lens.configure({
      cwd,
      tool: {
        name: lensId,
        command: cmd,
        args,
        cwd,
        available: true,
      },
    });

    // Run lens
    const result: LensResult = await lens.run();

    // Extract quality score (should always be present in v0.1.7+)
    if (result.qualityScore !== undefined) {
      return result.qualityScore;
    }

    // No qualityScore field - unexpected for v0.1.7+
    console.warn(
      `[QualityScoreEnrichment] No qualityScore in result for ${lensId}`,
    );
    return null;
  }

  /**
   * Find the command string for a lens from package commands
   */
  private findLensCommand(pkg: PackageLayer, lensId: string): string | null {
    const commands = pkg.packageData.availableCommands || [];

    // Look for lens: commands first
    for (const cmd of commands) {
      if (cmd.isLensCommand && cmd.lensId === lensId) {
        return cmd.command;
      }
    }

    // Fallback: look for common script names
    const scriptMap: Record<string, string[]> = {
      eslint: ['lint', 'eslint'],
      typescript: ['typecheck', 'type-check', 'tsc'],
      test: ['test'],
      jest: ['test', 'jest'],
      knip: ['knip', 'unused'],
    };

    const scriptNames = scriptMap[lensId] || [];
    for (const cmd of commands) {
      if (scriptNames.includes(cmd.name)) {
        return cmd.command;
      }
    }

    return null;
  }

  /**
   * Parse command string into command + args
   */
  private parseCommandString(commandString: string): {
    command: string;
    args: string[];
  } {
    // Handle npm/yarn/pnpm run scripts
    if (commandString.startsWith('npm run ')) {
      const parts = commandString.split(' ');
      return { command: 'npm', args: ['run', ...parts.slice(2)] };
    }
    if (commandString.startsWith('yarn ')) {
      const parts = commandString.split(' ');
      return { command: 'yarn', args: parts.slice(1) };
    }
    if (commandString.startsWith('pnpm ')) {
      const parts = commandString.split(' ');
      return { command: 'pnpm', args: parts.slice(1) };
    }

    // Direct command
    const parts = commandString.split(' ');
    return { command: parts[0], args: parts.slice(1) };
  }

  /**
   * Enrich multiple packages in parallel
   */
  async enrichPackages(
    packages: PackageLayer[],
    repoPath: string,
  ): Promise<PackageLayer[]> {
    console.info(
      `[QualityScoreEnrichment] Enriching ${packages.length} packages...`,
    );

    // Run enrichment in parallel for better performance
    const enrichedPackages = await Promise.all(
      packages.map((pkg) => this.enrichPackage(pkg, repoPath)),
    );

    console.info(
      `[QualityScoreEnrichment] Enrichment complete for ${enrichedPackages.length} packages`,
    );

    return enrichedPackages;
  }
}
