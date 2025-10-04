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
export function parseWorkflowFile(content: string): ParsedWorkflow | null {
  try {
    const workflow = yaml.load(content) as any;

    if (!workflow || typeof workflow !== 'object') {
      return null;
    }

    const requiredSecrets = new Set<string>();

    // Extract secrets from all jobs
    if (workflow.jobs && typeof workflow.jobs === 'object') {
      for (const [_jobId, job] of Object.entries(workflow.jobs)) {
        if (typeof job === 'object' && job !== null) {
          extractSecretsFromJob(job as any, requiredSecrets);
        }
      }
    }

    return {
      name: workflow.name,
      jobs: workflow.jobs || {},
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
function extractSecretsFromJob(job: any, secrets: Set<string>): void {
  // Check job-level env
  if (job.env && typeof job.env === 'object') {
    extractSecretsFromEnv(job.env, secrets);
  }

  // Check each step
  if (Array.isArray(job.steps)) {
    for (const step of job.steps) {
      if (step && typeof step === 'object') {
        // Check step env
        if (step.env && typeof step.env === 'object') {
          extractSecretsFromEnv(step.env, secrets);
        }

        // Check step with
        if (step.with && typeof step.with === 'object') {
          extractSecretsFromObject(step.with, secrets);
        }

        // Check step run command
        if (typeof step.run === 'string') {
          extractSecretsFromString(step.run, secrets);
        }
      }
    }
  }

  // Check job with
  if (job.with && typeof job.with === 'object') {
    extractSecretsFromObject(job.with, secrets);
  }
}

/**
 * Extract secret references from env object
 */
function extractSecretsFromEnv(env: Record<string, any>, secrets: Set<string>): void {
  for (const value of Object.values(env)) {
    if (typeof value === 'string') {
      extractSecretsFromString(value, secrets);
    }
  }
}

/**
 * Extract secret references from any object
 */
function extractSecretsFromObject(obj: Record<string, any>, secrets: Set<string>): void {
  for (const value of Object.values(obj)) {
    if (typeof value === 'string') {
      extractSecretsFromString(value, secrets);
    } else if (value && typeof value === 'object') {
      extractSecretsFromObject(value, secrets);
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
