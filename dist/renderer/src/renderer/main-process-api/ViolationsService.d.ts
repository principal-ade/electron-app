import { PackageInfo, ViolationCollectionOptions, ViolationResult } from '../../shared/main-process-api-interfaces/ViolationsAPI';
declare class ViolationsServiceImpl {
    collect(sourcePath: string, packages: PackageInfo[], options?: ViolationCollectionOptions): Promise<ViolationResult>;
    clearCache(sourcePath?: string): Promise<void>;
}
export declare const ViolationsService: ViolationsServiceImpl;
export {};
//# sourceMappingURL=ViolationsService.d.ts.map