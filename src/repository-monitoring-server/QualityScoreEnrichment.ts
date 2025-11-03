/**
 * QualityScoreEnrichment - Enriches PackageLayer objects with real quality scores from lenses
 *
 * This service:
 * 1. Takes PackageLayer objects with empty hexagon scores from composition package
 * 2. Runs the codebase-quality-lenses library to get real quality scores
 * 3. Uses composition package's calculateMetrics() to map scores to hexagon metrics
 * 4. Returns enriched packages with real quality scores
 */

import type {
  PackageLayer,
  LensOperation,
} from '@principal-ai/codebase-composition';
import { QualityMetricsCalculator } from '@principal-ai/codebase-composition';
import type { LensResult, Lens } from '@principal-ai/codebase-quality-lenses';
import {
  ESLintLens,
  JestLens,
  TypeScriptLens,
  KnipLens,
} from '@principal-ai/codebase-quality-lenses';
import { NodeExecutor } from './NodeExecutor';

/**
 * Service for enriching packages with real quality scores
 */
export class QualityScoreEnrichment {
  private executor: NodeExecutor;
  private lenses: Map<string, Lens>;

  constructor() {
    this.executor = new NodeExecutor();
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

    // Filter to only lenses that have executable commands
    const executableLenses = this.getExecutableLenses(
      pkg,
      pkg.qualityMetrics.availableLenses,
    );

    if (executableLenses.length === 0) {
      console.info(
        `[QualityScoreEnrichment] No executable commands found for any lenses in: ${pkg.packageData.name}`,
      );
      return pkg;
    }

    console.info(
      `[QualityScoreEnrichment] Found ${executableLenses.length} executable lenses: ${executableLenses.join(', ')}`,
    );

    // Run lenses and collect scores
    const lensScores = new Map<string, number>();

    for (const lensId of executableLenses) {
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
    // Only include lenses that successfully returned scores
    const successfulLenses = Array.from(lensScores.keys());
    const hexagon = QualityMetricsCalculator.calculateMetrics(
      this.createDetectedLensesMap(successfulLenses),
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
  ): Map<string, { lensId: string; operations: Set<LensOperation> }> {
    const map = new Map<
      string,
      { lensId: string; operations: Set<LensOperation> }
    >();
    for (const lensId of availableLenses) {
      map.set(lensId, {
        lensId,
        operations: new Set<LensOperation>(['check']), // Operations don't matter for score mapping
      });
    }
    return map;
  }

  /**
   * Get list of lenses that have executable commands
   */
  private getExecutableLenses(
    pkg: PackageLayer,
    availableLenses: string[],
  ): string[] {
    const commands = pkg.packageData.availableCommands || [];
    const executableLenses: string[] = [];

    for (const lensId of availableLenses) {
      // Check if there's a command marked as a lens command for this lensId
      const hasLensCommand = commands.some(
        (cmd) => cmd.isLensCommand && cmd.lensId === lensId,
      );

      if (hasLensCommand) {
        executableLenses.push(lensId);
      } else {
        console.warn(
          `[QualityScoreEnrichment] Lens "${lensId}" marked as available but has no executable command in ${pkg.packageData.name}`,
        );
      }
    }

    return executableLenses;
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

    console.info(`[QualityScoreEnrichment] Configuring lens ${lensId}:`, {
      cwd,
      command: cmd,
      args,
      fullCommand: command,
    });

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

    console.info(`[QualityScoreEnrichment] Lens result for ${lensId}:`, {
      success: result.success,
      hasQualityScore: result.qualityScore !== undefined,
      qualityScore: result.qualityScore,
      hasMetrics: !!result.metrics,
      metricsKeys: result.metrics ? Object.keys(result.metrics) : [],
      hasRaw: !!result.raw,
      rawExitCode: result.raw?.exitCode,
      hasError: !!result.error,
      errorMessage: result.error?.message,
    });

    // Log the error if lens failed
    if (!result.success) {
      console.error(
        `[QualityScoreEnrichment] Lens ${lensId} failed. Full error object:`,
        result.error,
      );
      console.error(
        `[QualityScoreEnrichment] Error type:`,
        typeof result.error,
      );
      if (result.error) {
        console.error(
          `[QualityScoreEnrichment] Error keys:`,
          Object.keys(result.error),
        );
      }
    }

    // Extract quality score (should always be present in v0.1.7+)
    if (result.qualityScore !== undefined) {
      return result.qualityScore;
    }

    // No qualityScore field - unexpected for v0.1.7+
    console.warn(
      `[QualityScoreEnrichment] No qualityScore in result for ${lensId}`,
    );
    console.warn(
      `[QualityScoreEnrichment] Full result object keys:`,
      Object.keys(result),
    );
    return null;
  }

  /**
   * Find the command string for a lens from package commands
   */
  private findLensCommand(pkg: PackageLayer, lensId: string): string | null {
    const commands = pkg.packageData.availableCommands || [];

    // Only look for commands explicitly marked as lens commands
    for (const cmd of commands) {
      if (cmd.isLensCommand && cmd.lensId === lensId) {
        return cmd.command;
      }
    }

    // No fallback - if composition package marked it as available,
    // it should have provided a command
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
