export interface PackageInfo {
  name: string;
  path: string;
}

export interface ViolationCollectionOptions {
  includeTypescript?: boolean;
  includeEslint?: boolean;
  maxFiles?: number;
}

export interface ViolationDetail {
  type: 'typescript' | 'eslint';
  severity: 'error' | 'warning' | 'info';
  message: string;
  rule?: string;
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
}

export interface FileViolationSummary {
  filePath: string;
  relativePath: string;
  violations: ViolationDetail[];
  errorCount: number;
  warningCount: number;
  infoCount: number;
}

export type FileViolationEntry = [string, FileViolationSummary];

export interface ViolationPackageSummary {
  packageName: string;
  packagePath: string;
  absolutePath?: string;
  fileViolations: FileViolationEntry[];
  totalFiles: number;
  totalViolations: number;
  totalErrors: number;
  totalWarnings: number;
  totalInfo: number;
}

export interface ViolationResult {
  packages: ViolationPackageSummary[];
  timestamp: number;
  rootPath: string;
  totalViolations: number;
  totalErrors: number;
  totalWarnings: number;
  totalInfo: number;
  totalPackages: number;
  totalFiles: number;
  collectionTime: number;
}

export enum ViolationEvents {
  COLLECT = 'violations:collect',
  CLEAR_CACHE = 'violations:clearCache',
}

export interface ViolationsAPI {
  collect(
    sourcePath: string,
    packages: PackageInfo[],
    options: ViolationCollectionOptions,
  ): Promise<ViolationResult>;

  clearCache(sourcePath?: string): Promise<void>;
}
