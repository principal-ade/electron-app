import yaml from 'js-yaml';

export interface ParsedWorkflow {
  name?: string;
  jobs: Record<string, ParsedJob>;
  requiredSecrets: string[];
}

export interface ParsedJob {
  name?: string;
  steps: ParsedStep[];
  env?: Record<string, string>;
}

export interface ParsedStep {
  name?: string;
  run?: string;
  uses?: string;
  env?: Record<string, string>;
}

/**
 * Parse a GitHub Actions workflow YAML file and extract required secrets
 */
interface WorkflowYaml {
  name?: string;
  jobs?: Record<string, unknown>;
}

export function parseWorkflowFile(content: string): ParsedWorkflow | null {
  try {
    const workflow = yaml.load(content) as WorkflowYaml | null;

    if (!workflow || typeof workflow !== 'object') {
      return null;
    }

    const requiredSecrets = new Set<string>();

    // Extract secrets from all jobs
    if (workflow.jobs && typeof workflow.jobs === 'object') {
      for (const [_jobId, job] of Object.entries(workflow.jobs)) {
        if (typeof job === 'object' && job !== null) {
          extractSecretsFromJob(job as Record<string, unknown>, requiredSecrets);
        }
      }
    }

    return {
      name: workflow.name,
      jobs: (workflow.jobs || {}) as Record<string, ParsedJob>,
      requiredSecrets: Array.from(requiredSecrets).sort(),
    };
  } catch (error) {
    console.error('[workflowParser] Failed to parse workflow:', error);
    return null;
  }
}

/**
 * Extract secret references from a job definition
 */
function extractSecretsFromJob(job: Record<string, unknown>, secrets: Set<string>): void {
  // Check job-level env
  if (job.env && typeof job.env === 'object') {
    extractSecretsFromEnv(job.env as Record<string, unknown>, secrets);
  }

  // Check each step
  if (Array.isArray(job.steps)) {
    for (const step of job.steps) {
      if (step && typeof step === 'object') {
        const stepObj = step as Record<string, unknown>;
        // Check step env
        if (stepObj.env && typeof stepObj.env === 'object') {
          extractSecretsFromEnv(stepObj.env as Record<string, unknown>, secrets);
        }

        // Check step with
        if (stepObj.with && typeof stepObj.with === 'object') {
          extractSecretsFromObject(stepObj.with as Record<string, unknown>, secrets);
        }

        // Check step run command
        if (typeof stepObj.run === 'string') {
          extractSecretsFromString(stepObj.run, secrets);
        }
      }
    }
  }

  // Check job with
  if (job.with && typeof job.with === 'object') {
    extractSecretsFromObject(job.with as Record<string, unknown>, secrets);
  }
}

/**
 * Extract secret references from env object
 */
function extractSecretsFromEnv(
  env: Record<string, unknown>,
  secrets: Set<string>,
): void {
  for (const value of Object.values(env)) {
    if (typeof value === 'string') {
      extractSecretsFromString(value, secrets);
    }
  }
}

/**
 * Extract secret references from any object
 */
function extractSecretsFromObject(
  obj: Record<string, unknown>,
  secrets: Set<string>,
): void {
  for (const value of Object.values(obj)) {
    if (typeof value === 'string') {
      extractSecretsFromString(value, secrets);
    } else if (value && typeof value === 'object') {
      extractSecretsFromObject(value as Record<string, unknown>, secrets);
    }
  }
}

/**
 * Extract secret references from a string using regex
 * Matches patterns like: ${{ secrets.SECRET_NAME }}
 */
function extractSecretsFromString(str: string, secrets: Set<string>): void {
  // Match ${{ secrets.SECRET_NAME }}
  const secretPattern = /\$\{\{\s*secrets\.([A-Z_][A-Z0-9_]*)\s*\}\}/gi;
  let match;

  while ((match = secretPattern.exec(str)) !== null) {
    if (match[1]) {
      secrets.add(match[1]);
    }
  }
}

/**
 * Get required secrets from workflow file content
 */
export function getRequiredSecrets(content: string): string[] {
  const parsed = parseWorkflowFile(content);
  return parsed?.requiredSecrets || [];
}
