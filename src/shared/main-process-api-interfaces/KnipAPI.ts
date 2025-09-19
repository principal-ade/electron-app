export interface KnipAnalysisResult {
  unusedFiles?: string[];
  unusedExports?: Array<{
    file: string;
    export: string;
  }>;
  unusedDependencies?: string[];
  unresolvedImports?: Array<{
    file: string;
    import: string;
  }>;
  error?: string;
  hasIssues?: boolean;
  raw?: string;
}

export interface KnipAPI {
  /**
   * Check if Knip is available for analysis
   */
  checkAvailability(): Promise<boolean>;

  /**
   * Run Knip analysis on a directory
   */
  runAnalysis(directoryPath: string): Promise<KnipAnalysisResult>;
}
