import {
  PackageInfo,
  ViolationCollectionOptions,
  ViolationResult,
} from '../../shared/main-process-api-interfaces/ViolationsAPI';

class ViolationsServiceImpl {
  async collect(
    sourcePath: string,
    packages: PackageInfo[],
    options: ViolationCollectionOptions = {},
  ): Promise<ViolationResult> {
    try {
      return await window.mainProcess.violations.collect(
        sourcePath,
        packages,
        options,
      );
    } catch (error) {
      console.error('[ViolationsService] Failed to collect violations:', error);
      throw error;
    }
  }

  async clearCache(sourcePath?: string): Promise<void> {
    try {
      await window.mainProcess.violations.clearCache(sourcePath);
    } catch (error) {
      console.error('[ViolationsService] Failed to clear cache:', error);
      throw error;
    }
  }
}

export const ViolationsService = new ViolationsServiceImpl();
