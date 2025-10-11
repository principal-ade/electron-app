import type { QualityMetrics } from '@principal-ai/codebase-composition';

export type QualityTier = 'bronze' | 'silver' | 'gold' | 'platinum';

export type SuggestionType = 'improvement' | 'warning' | 'error';

export type SuggestionPriority = 'low' | 'medium' | 'high';

export type AnalysisPriority = 'high' | 'normal' | 'low';

export interface ExtendedQualityMetrics {
  directory: string;
  timestamp: number;
  hexagon: QualityMetrics;
  tier: QualityTier;
  availableTools: string[];
  toolResults: Record<string, ToolResult>;
  suggestions: QualitySuggestion[];
}

export interface ToolResult {
  tool: string;
  success: boolean;
  duration: number;
  output?: string;
  error?: string;
  metrics?: Record<string, number | string | boolean>;
}

export interface QualitySuggestion {
  type: SuggestionType;
  metric: keyof QualityMetrics;
  message: string;
  priority: SuggestionPriority;
}

export interface AnalysisOptions {
  priority?: AnalysisPriority;
  forceRefresh?: boolean;
  tools?: string[];
}

class MockQualityMetricsServiceImpl {
  private mockInProgress = new Map<string, boolean>();

  async analyzeDirectory(
    directory: string,
    options?: AnalysisOptions,
  ): Promise<ExtendedQualityMetrics> {
    // Mock service - analysis starting

    // Simulate analysis delay
    this.mockInProgress.set(directory, true);

    // Shorter delay for high priority
    const delay = options?.priority === 'high' ? 1000 : 2000;
    await this.simulateDelay(delay);

    this.mockInProgress.set(directory, false);

    // Return mock data with some randomization
    const metrics = this.generateMockMetrics(directory);
    // Mock service - analysis complete

    return metrics;
  }

  private generateMockMetrics(directory: string): ExtendedQualityMetrics {
    const randomValue = (min: number, max: number) =>
      Math.floor(Math.random() * (max - min + 1)) + min;

    const hexagon: QualityMetrics = {
      tests: randomValue(45, 95),
      deadCode: randomValue(5, 35), // Lower is better
      formatting: randomValue(75, 100),
      linting: randomValue(60, 95),
      types: randomValue(70, 100),
      documentation: randomValue(20, 80),
    };

    // Calculate average (accounting for deadCode being inverted)
    const adjustedDeadCode = 100 - hexagon.deadCode;
    const average =
      (hexagon.tests +
        adjustedDeadCode +
        hexagon.formatting +
        hexagon.linting +
        hexagon.types +
        hexagon.documentation) /
      6;

    let tier: QualityTier = 'bronze';
    if (average >= 95) tier = 'platinum';
    else if (average >= 85) tier = 'gold';
    else if (average >= 75) tier = 'silver';

    return {
      directory,
      timestamp: Date.now(),
      hexagon,
      tier,
      availableTools: ['eslint', 'typescript', 'jest', 'prettier'],
      toolResults: {
        eslint: {
          tool: 'eslint',
          success: true,
          duration: randomValue(500, 2000),
          output: `✓ No linting errors found in ${randomValue(20, 50)} files`,
          metrics: {
            filesChecked: randomValue(20, 50),
            errors: 0,
            warnings: randomValue(0, 5),
          },
        },
        typescript: {
          tool: 'typescript',
          success: true,
          duration: randomValue(1000, 3000),
          output: `✓ No type errors in ${randomValue(30, 60)} TypeScript files`,
          metrics: { filesChecked: randomValue(30, 60), errors: 0 },
        },
        jest: {
          tool: 'jest',
          success: true,
          duration: randomValue(3000, 8000),
          output: `Test Suites: ${randomValue(8, 15)} passed\nTests: ${randomValue(100, 200)} passed`,
          metrics: {
            suites: randomValue(8, 15),
            tests: randomValue(100, 200),
            coverage: hexagon.tests,
          },
        },
        prettier: {
          tool: 'prettier',
          success: true,
          duration: randomValue(200, 800),
          output: `✓ All ${randomValue(40, 80)} files formatted correctly`,
          metrics: { filesChecked: randomValue(40, 80), filesFormatted: 0 },
        },
      },
      suggestions: this.generateSuggestions(hexagon),
    };
  }

  private generateSuggestions(metrics: QualityMetrics): QualitySuggestion[] {
    const suggestions: QualitySuggestion[] = [];

    if (metrics.tests < 80) {
      suggestions.push({
        type: 'improvement',
        metric: 'tests',
        message: `Test coverage is at ${metrics.tests}%. Consider adding more tests to reach 80% coverage.`,
        priority: 'high',
      });
    }

    if (metrics.documentation < 60) {
      suggestions.push({
        type: 'improvement',
        metric: 'documentation',
        message:
          'Documentation coverage is low. Add JSDoc comments to exported functions.',
        priority: 'medium',
      });
    }

    if (metrics.deadCode > 20) {
      suggestions.push({
        type: 'warning',
        metric: 'deadCode',
        message: `Found ${metrics.deadCode}% unused code. Run dead code elimination tool.`,
        priority: 'medium',
      });
    }

    if (metrics.types < 90) {
      suggestions.push({
        type: 'improvement',
        metric: 'types',
        message:
          'Some TypeScript types are missing. Add explicit types to function parameters.',
        priority: 'low',
      });
    }

    return suggestions;
  }

  private async simulateDelay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Simulate real-time updates
  subscribeToUpdates(
    directory: string,
    callback: (metrics: ExtendedQualityMetrics) => void,
  ): () => void {
    // Mock service - subscribing to updates

    // Simulate progress updates every second while analyzing
    const interval = setInterval(() => {
      if (this.mockInProgress.get(directory)) {
        // Send progress update with slightly different values
        callback(this.generateMockMetrics(directory));
      }
    }, 1000);

    return () => {
      // Mock service - unsubscribing
      clearInterval(interval);
    };
  }

  isAnalyzing(directory: string): boolean {
    return this.mockInProgress.get(directory) || false;
  }

  // Get cached metrics (mock always returns null to simulate no cache)
  async getCachedMetrics(
    _directory: string,
  ): Promise<ExtendedQualityMetrics | null> {
    // Mock service - no cache available (MVP mode)
    return null;
  }
}

export const MockQualityMetricsService = new MockQualityMetricsServiceImpl();
