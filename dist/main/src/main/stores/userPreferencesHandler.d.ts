import { UserPreferences } from "../../shared/types/userPreferences.types";
import { TypedMultiStoreWrapper } from "../storage-providers/typed-multistore-wrapper";
export declare class UserPreferencesHandler {
    private typedStore;
    constructor(typedStore: TypedMultiStoreWrapper);
    private getOrCreatePreferences;
    getUserPreferences(): Promise<UserPreferences>;
    updateUserPreferences(updates: Partial<UserPreferences>): Promise<void>;
    registerHandlers(): void;
}
//# sourceMappingURL=userPreferencesHandler.d.ts.map