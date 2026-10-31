/**
 * Dependency interfaces for the desktop repository monitoring integration
 * Desktop services injected into the repository monitoring adapters
 */

import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library';
import type {
  ToolExecutionRequest,
  ToolExecutionResponse,
} from '@principal-ai/repository-monitoring-server';

/**
 * Interface for Alexandria Registry Service
 * Provides access to repository metadata
 */
export interface IAlexandriaRegistryService {
  getRepositories(): Promise<AlexandriaEntry[]>;
}

/**
 * Interface for Quality Lens Service
 * Executes quality analysis tools on repositories
 */
export interface IQualityLensService {
  executeToolForPackage(
    request: ToolExecutionRequest,
  ): Promise<ToolExecutionResponse>;
}

/**
 * All optional dependencies that can be injected into the monitoring system
 */
export interface RepositoryMonitoringDependencies {
  alexandriaRegistryService?: IAlexandriaRegistryService;
  qualityLensService?: IQualityLensService;
}
