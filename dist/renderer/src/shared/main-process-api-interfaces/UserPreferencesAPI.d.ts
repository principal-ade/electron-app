import { UserPreferences } from "../../shared/types/userPreferences.types";
export declare enum UserPreferencesAPIEvents {
    GET_PREFERENCES = "userPreferences:getPreferences",
    UPDATE_PREFERENCES = "userPreferences:updatePreferences"
}
export interface UserPreferencesAPI {
    getPreferences: () => Promise<UserPreferences>;
    updatePreferences: (updates: Partial<UserPreferences>) => Promise<void>;
}
//# sourceMappingURL=UserPreferencesAPI.d.ts.map