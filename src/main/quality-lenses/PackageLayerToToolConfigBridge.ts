/**
 * PackageLayerToToolConfigBridge
 * Experimental bridge to convert PackageLayer data to ToolConfiguration for quality lenses
 * This prototype helps identify gaps in the data model
 */

import type {
  PackageLayer,
  PackageCommand,
} from '@principal-ai/codebase-composition';
import type { ToolConfiguration } from '@principal-ai/codebase-quality-lenses';
import path from 'path';

export interface BridgeAnalysis {
  success: boolean;
  toolConfig?: ToolConfiguration;
  missingData: string[];
  assumptions: string[];
  recommendations: string[];
}

export class PackageLayerToToolConfigBridge {
  /**
   * Analyze and attempt to create ESLint configuration
   */
  static analyzeESLintConfig(packageLayer: PackageLayer): BridgeAnalysis {
    const analysis: BridgeAnalysis = {
      success: false,
      missingData: [],
      assumptions: [],
      recommendations: [],
    };

    // Check if ESLint config exists
    if (!packageLayer.configFiles?.eslint) {
      analysis.missingData.push('No ESLint configuration detected');
      analysis.recommendations.push(
        'PackageLayer should detect if eslint is installed as a dependency even without config file',
      );
      return analysis;
    }

    // Check for ESLint in dependencies
    const hasESLintDependency =
      packageLayer.packageData.dependencies['eslint'] ||
      packageLayer.packageData.devDependencies['eslint'];

    if (!hasESLintDependency) {
      analysis.missingData.push('ESLint not found in dependencies');
      analysis.assumptions.push(
        'Assuming ESLint is available globally or via npx',
      );
    }

    // Look for ESLint command in available commands
    const eslintCommand = packageLayer.packageData.availableCommands?.find(
      (cmd) => cmd.name === 'lint' || cmd.name.includes('eslint'),
    );

    // Try to determine the package manager
    const packageManager = packageLayer.packageData.packageManager;
    const commandPrefix = packageManager === 'npm' ? 'npx' : packageManager;

    // Build the tool configuration
    const toolConfig: ToolConfiguration = {
      name: 'eslint',
      available: true, // Optimistic assumption
      command: commandPrefix || 'npx',
      args: [],
      cwd: packageLayer.packageData.path,
      timeout: 30000,
    };

    // Determine arguments
    if (eslintCommand) {
      // Parse existing command to extract args
      analysis.assumptions.push(
        `Using existing command: ${eslintCommand.command}`,
      );

      // This is a gap - we need to parse the command string
      analysis.missingData.push(
        'Need to parse command string to extract actual ESLint arguments',
      );
      analysis.recommendations.push(
        'PackageCommand should store parsed command and args separately, not as a single string',
      );

      // Attempt basic parsing (this is fragile)
      const parts = eslintCommand.command.split(' ');
      const eslintIndex = parts.findIndex((p) => p.includes('eslint'));
      if (eslintIndex >= 0) {
        toolConfig.args = ['eslint', ...parts.slice(eslintIndex + 1)];
      } else {
        // Fallback to defaults
        toolConfig.args = ['eslint', '.', '--ext', '.js,.jsx,.ts,.tsx'];
        analysis.assumptions.push('Using default ESLint arguments');
      }
    } else {
      // No existing command, build from scratch
      toolConfig.args = ['eslint', '.', '--ext', '.js,.jsx,.ts,.tsx'];
      analysis.assumptions.push('Created default ESLint command');

      analysis.missingData.push('No existing lint command to reference');
      analysis.recommendations.push(
        'PackageLayer should detect common tool patterns even without explicit scripts',
      );
    }

    // Add format flag for parsing
    if (!toolConfig.args.includes('--format')) {
      toolConfig.args.push('--format', 'json');
    }

    // Check for config file location
    if (packageLayer.configFiles.eslint.path) {
      const configPath = packageLayer.configFiles.eslint.path;
      toolConfig.configPath = configPath;

      // Might need to add --config flag
      if (packageLayer.configFiles.eslint.isInline) {
        analysis.assumptions.push('ESLint config is inline in package.json');
      }
    }

    // Additional missing information
    analysis.missingData.push(
      'No information about ESLint plugins or extended configs',
      'No information about ignored files/patterns',
      'No cache directory information',
      'No information about fix mode availability',
    );

    analysis.recommendations.push(
      'PackageLayer should include parsed dependency versions',
      'ConfigFile should include parsed content for inline configs',
      'Need a way to detect tool capabilities (e.g., --fix support)',
      'Should detect .eslintignore file as part of ESLint config',
      'Should parse extends/plugins from ESLint config for better command generation',
    );

    analysis.success = true;
    analysis.toolConfig = toolConfig;

    return analysis;
  }

  /**
   * Analyze TypeScript configuration
   */
  static analyzeTypeScriptConfig(packageLayer: PackageLayer): BridgeAnalysis {
    const analysis: BridgeAnalysis = {
      success: false,
      missingData: [],
      assumptions: [],
      recommendations: [],
    };

    if (!packageLayer.configFiles?.typescript) {
      analysis.missingData.push('No TypeScript configuration detected');
      return analysis;
    }

    const hasTypeScript =
      packageLayer.packageData.dependencies['typescript'] ||
      packageLayer.packageData.devDependencies['typescript'];

    if (!hasTypeScript) {
      analysis.missingData.push('TypeScript not found in dependencies');
      analysis.assumptions.push('Assuming TypeScript is available globally');
    }

    // Look for TypeScript command
    const tscCommand = packageLayer.packageData.availableCommands?.find(
      (cmd) =>
        cmd.name === 'typecheck' ||
        cmd.name === 'tsc' ||
        cmd.name.includes('type'),
    );

    const packageManager = packageLayer.packageData.packageManager;
    const commandPrefix = packageManager === 'npm' ? 'npx' : packageManager;

    const toolConfig: ToolConfiguration = {
      name: 'typescript',
      available: true,
      command: commandPrefix || 'npx',
      args: ['tsc', '--noEmit'],
      cwd: packageLayer.packageData.path,
      timeout: 60000, // TypeScript can be slow
      configPath: packageLayer.configFiles.typescript.path,
    };

    if (tscCommand) {
      analysis.assumptions.push(
        `Found existing command: ${tscCommand.command}`,
      );
      analysis.missingData.push('Need to parse TypeScript command arguments');
    } else {
      analysis.assumptions.push('Using default tsc --noEmit');
    }

    analysis.missingData.push(
      'No information about TypeScript version',
      'No information about project references',
      'No information about include/exclude patterns',
      'Cannot determine if incremental compilation is enabled',
    );

    analysis.recommendations.push(
      'Should parse tsconfig.json to understand compilation scope',
      'Should detect build vs check commands separately',
      'Should understand composite projects and references',
    );

    analysis.success = true;
    analysis.toolConfig = toolConfig;

    return analysis;
  }

  /**
   * Analyze test runner configuration
   */
  static analyzeTestConfig(packageLayer: PackageLayer): BridgeAnalysis {
    const analysis: BridgeAnalysis = {
      success: false,
      missingData: [],
      assumptions: [],
      recommendations: [],
    };

    // Check for test frameworks
    const hasJest =
      packageLayer.configFiles?.jest ||
      packageLayer.packageData.devDependencies['jest'];
    const hasVitest =
      packageLayer.configFiles?.vitest ||
      packageLayer.packageData.devDependencies['vitest'];

    if (!hasJest && !hasVitest) {
      analysis.missingData.push('No test framework detected');
      return analysis;
    }

    const testCommand = packageLayer.packageData.availableCommands?.find(
      (cmd) => cmd.name === 'test' || cmd.name.includes('test'),
    );

    if (!testCommand) {
      analysis.missingData.push('No test command found in scripts');
      analysis.recommendations.push(
        'Should detect test commands even without explicit scripts',
      );
    }

    analysis.missingData.push(
      'Cannot determine test runner (Jest vs Vitest vs other)',
      'No information about coverage settings',
      'No information about test file patterns',
      'Cannot determine if watch mode is available',
    );

    analysis.recommendations.push(
      'PackageLayer should identify which test framework is primary',
      'Should parse test configuration for coverage thresholds',
      'Should detect test file patterns from config',
    );

    return analysis;
  }

  /**
   * Create all possible tool configurations from a PackageLayer
   */
  static createToolConfigurations(packageLayer: PackageLayer): {
    configs: ToolConfiguration[];
    analyses: Record<string, BridgeAnalysis>;
  } {
    const configs: ToolConfiguration[] = [];
    const analyses: Record<string, BridgeAnalysis> = {};

    // Try ESLint
    const eslintAnalysis = this.analyzeESLintConfig(packageLayer);
    analyses.eslint = eslintAnalysis;
    if (eslintAnalysis.success && eslintAnalysis.toolConfig) {
      configs.push(eslintAnalysis.toolConfig);
    }

    // Try TypeScript
    const tsAnalysis = this.analyzeTypeScriptConfig(packageLayer);
    analyses.typescript = tsAnalysis;
    if (tsAnalysis.success && tsAnalysis.toolConfig) {
      configs.push(tsAnalysis.toolConfig);
    }

    // Try test framework
    const testAnalysis = this.analyzeTestConfig(packageLayer);
    analyses.test = testAnalysis;
    if (testAnalysis.success && testAnalysis.toolConfig) {
      configs.push(testAnalysis.toolConfig);
    }

    return { configs, analyses };
  }

  /**
   * Generate a report of all findings
   */
  static generateReport(analyses: Record<string, BridgeAnalysis>): string {
    let report = '# PackageLayer to ToolConfiguration Bridge Analysis\n\n';

    for (const [tool, analysis] of Object.entries(analyses)) {
      report += `## ${tool.toUpperCase()}\n\n`;

      report += `Success: ${analysis.success}\n\n`;

      if (analysis.missingData.length > 0) {
        report += '### Missing Data\n';
        analysis.missingData.forEach((item) => {
          report += `- ${item}\n`;
        });
        report += '\n';
      }

      if (analysis.assumptions.length > 0) {
        report += '### Assumptions Made\n';
        analysis.assumptions.forEach((item) => {
          report += `- ${item}\n`;
        });
        report += '\n';
      }

      if (analysis.recommendations.length > 0) {
        report += '### Recommendations for codebase-composition\n';
        analysis.recommendations.forEach((item) => {
          report += `- ${item}\n`;
        });
        report += '\n';
      }
    }

    return report;
  }
}
