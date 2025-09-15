import { PackageInfo, ViolationCollectionOptions, ViolationResult } from '../../shared/main-process-api-interfaces/ViolationsAPI';
export declare const violationsAPI: {
    collect: (sourcePath: string, packages: PackageInfo[], options: ViolationCollectionOptions) => Promise<ViolationResult>;
    clearCache: (sourcePath?: string) => Promise<void>;
};
//# sourceMappingURL=violationsApi.d.ts.map