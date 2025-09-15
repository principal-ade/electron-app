/**
 * Tool-based validation system types
 *
 * This system separates validation logic from execution context,
 * allowing tools to be validated regardless of where they're installed.
 */

// Action categories for grouping validation actions
export type ActionCategory =
  | 'quality' // Linting, formatting
  | 'correctness' // Type checking, tests
  | 'security' // Vulnerability scanning
  | 'performance' // Bundle size, speed tests
  | 'build' // Compilation, bundling
  | 'custom'; // User-defined

// Tool types
export type ToolType =
  | 'linter'
  | 'compiler'
  | 'test-runner'
  | 'formatter'
  | 'bundler'
  | 'framework'
  | 'package-manager'
  | 'other';

// Package manager types
export type PackageManager = 'npm' | 'yarn' | 'pnpm';

// Validation action - a single command that can be run
export interface ValidationAction {
  id: string;
  name: string;
  command: string; // Template: "${pm} lint" or "npm run ${script}"
  description: string;
  severity: 'error' | 'warning' | 'info';
  requiresScript?: string; // Check if package.json has this script
  requiresConfig?: string[]; // Check for config files
  timeout?: number; // Timeout in milliseconds
  exitCodes?: {
    // How to interpret exit codes
    success?: number[]; // Exit codes that mean success (default: [0])
    warning?: number[]; // Exit codes that mean warning
    // Any other exit code is considered an error
  };
  // Layer integration
  targetLayers?: string[]; // Which layer types this action targets (e.g., ['typescript', 'javascript'])
  layerOverrides?: {
    // Override command based on active layers
    [layerId: string]: string; // e.g., { 'typescript': '${pm} lint --ext .ts,.tsx' }
  };
}

// Grouped actions by category
export interface ActionGroup {
  category: ActionCategory;
  items: ValidationAction[];
}

// Tool information for matching
export interface ToolInfo {
  name: string; // Tool identifier
  type: ToolType;
  packageMatchers: string[]; // Patterns to match in dependencies
  configFiles?: string[]; // Config files that indicate tool presence
  requiredCommands?: string[]; // Scripts that should exist in package.json
  requiresIgnoreFile?: string; // Ignore file that should exist for safe operation
  documentationUrl?: string; // URL to documentation about ignore patterns
}

// Validation template - defines what can be validated for a tool
export interface ValidationTemplate {
  id: string;
  name: string;
  description: string;
  tool: ToolInfo;
  actions: ActionGroup[];

  // Optional metadata
  author?: string;
  version?: string;
  tags?: string[];
}

// Detected tool in a package
export interface DetectedTool {
  name: string;
  version: string;
  packages: string[]; // Actual package names found
  configFiles: string[]; // Config files found
  availableScripts: Record<string, string>; // Scripts from package.json
  packageManager: PackageManager;
  packagePath: string; // Where this tool was detected
  hasIgnoreFile?: boolean; // Whether the required ignore file exists
}

// Package validation - an instance of a template applied to a package
export interface PackageValidation {
  id: string;
  packagePath: string;
  templateId: string;
  detectedTool: DetectedTool;
  availableActions: string[]; // Action IDs that can be run
  selectedLayers?: string[]; // Which layers to validate
  customOverrides?: Record<string, string>; // Override specific commands
  lastRun?: {
    timestamp: number;
    results: ValidationResult[];
  };
}

// Result of running a validation action
export interface ValidationResult {
  actionId: string;
  status: 'success' | 'failure' | 'warning' | 'skipped';
  output?: string;
  error?: string;
  duration?: number;
  timestamp: number;
}

// Tool detection result
export interface ToolDetectionResult {
  packagePath: string;
  packageName: string;
  detectedTools: DetectedTool[];
  suggestedTemplates: ValidationTemplate[];
}

// Template matching criteria
export interface TemplateMatchCriteria {
  toolName?: string;
  toolType?: ToolType;
  hasConfig?: string[];
  hasScript?: string[];
}

// Validation run request
export interface ValidationRunRequest {
  validationId: string;
  actionIds?: string[]; // If not specified, run all available
  workingDirectory: string;
  timeout?: number;
}

// Validation run response
export interface ValidationRunResponse {
  validationId: string;
  results: ValidationResult[];
  summary: {
    total: number;
    success: number;
    failure: number;
    warning: number;
    skipped: number;
  };
}
