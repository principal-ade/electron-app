import { UserPreferences } from "../../shared/types/userPreferences.types";
export declare class UserPreferencesService {
    static getPreferences(): Promise<UserPreferences>;
    static updatePreferences(updates: Partial<UserPreferences>): Promise<void>;
}
//# sourceMappingURL=UserPreferencesService.d.ts.map