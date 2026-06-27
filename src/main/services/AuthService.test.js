/**
 * AuthService refresh-path tests.
 *
 * These cover the WorkOS session refresh in getStoredAuth (exercised through the
 * public getValidToken()), which is where the "logged out often / no token
 * refreshing" desktop bug lived. Three behaviors are pinned:
 *
 *   A. Single-flight   — concurrent callers share ONE refresh, so the rotating
 *                        refresh token is spent exactly once.
 *   B. Soft-fail       — a transient refresh failure keeps the existing session
 *                        instead of wiping credentials.
 *   C. Hard sign-out   — a definitive invalid_grant still clears auth.
 *   D. No refresh token — an expired session with no refresh token signs out.
 *
 * Variables referenced inside jest.mock() factories are prefixed with `mock`
 * so jest's hoisting allows them.
 */
const mockGetDeviceId = jest.fn().mockResolvedValue('dev-1');
const mockRefreshAccessToken = jest.fn();
const mockFetchCurrentToken = jest.fn();
const mockStorage = {
    getTokenWithMetadata: jest.fn(),
    setToken: jest.fn().mockResolvedValue(undefined),
    getToken: jest.fn().mockResolvedValue(null),
    deleteToken: jest.fn().mockResolvedValue(undefined),
    checkKeychainStatus: jest.fn(),
    testKeychainAccess: jest.fn(),
};
const mockAuthState = {
    setAuthenticated: jest.fn(),
    clearAuthentication: jest.fn(),
    getFullState: jest.fn().mockReturnValue({ isAuthenticated: true }),
};
jest.mock('electron', () => ({
    ipcMain: { handle: jest.fn() },
    shell: { openExternal: jest.fn() },
}));
jest.mock('electron-store', () => ({
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
        get: jest.fn(),
        set: jest.fn(),
        delete: jest.fn(),
    })),
}));
jest.mock('./GitCredentialHelper', () => ({
    GitCredentialHelper: {
        configureGitCredentials: jest.fn().mockResolvedValue(undefined),
        clearGitCredentials: jest.fn().mockResolvedValue(undefined),
    },
}));
jest.mock('./DeviceIdService', () => ({
    deviceIdService: { getDeviceId: mockGetDeviceId },
}));
jest.mock('./OAuthServerClient', () => ({
    OAuthServerClient: jest.fn().mockImplementation(() => ({
        refreshAccessToken: mockRefreshAccessToken,
        fetchCurrentToken: mockFetchCurrentToken,
        authenticate: jest.fn(),
    })),
    InvalidWorkosTokenError: class InvalidWorkosTokenError extends Error {
        constructor(message = 'WorkOS token verification failed') {
            super(message);
            this.name = 'InvalidWorkosTokenError';
        }
    },
}));
jest.mock('./UnifiedSecureStorage', () => ({
    UnifiedSecureStorage: { getInstance: () => mockStorage },
    TOKEN_KEYS: {
        ORBIT_AUTH: 'orbit_auth',
        GIT_SYNC_AUTH: 'git-sync-auth',
        GITHUB_TOKEN: 'github_token',
        WORKOS_TOKEN: 'workos_token',
    },
    KeychainTimeoutError: class extends Error {
    },
    KeychainPermissionError: class extends Error {
    },
    KeychainNotAvailableError: class extends Error {
    },
}));
jest.mock('./AuthStateManager', () => ({
    __esModule: true,
    default: { getInstance: () => mockAuthState },
}));
jest.mock('../stores/userPreferencesHandler', () => ({
    UserPreferencesHandler: {
        getInstance: () => ({
            getUserPreferences: jest
                .fn()
                .mockResolvedValue({ keychainConsent: { status: 'granted' } }),
        }),
    },
}));
const USER = {
    id: 123,
    login: 'me',
    email: 'me@example.com',
    name: 'Me',
    // avatarUrl present + login has no '.', so getStoredAuth's GitHub profile
    // fetch path stays dormant (no need to stub global fetch).
    avatarUrl: 'http://example.com/a.png',
};
const FUTURE = () => Date.now() + 3_600_000;
const PAST = () => Date.now() - 1_000;
/**
 * Seed the secure store. Pass `refreshToken: null` to simulate an expired
 * session with no way to refresh.
 */
function seedStore(opts) {
    mockStorage.getTokenWithMetadata.mockImplementation(async (key) => {
        if (key === 'github_token') {
            return { token: 'gho_old', metadata: { user: USER } };
        }
        if (key === 'workos_token') {
            return {
                token: 'wos_old',
                metadata: {
                    ...(opts.refreshToken ? { refreshToken: opts.refreshToken } : {}),
                    expiresAt: opts.expiresAt,
                },
            };
        }
        return null;
    });
}
describe('AuthService refresh path', () => {
    let service;
    beforeEach(() => {
        jest.clearAllMocks();
        mockStorage.setToken.mockResolvedValue(undefined);
        mockStorage.getToken.mockResolvedValue(null);
        mockStorage.deleteToken.mockResolvedValue(undefined);
        mockGetDeviceId.mockResolvedValue('dev-1');
        mockAuthState.getFullState.mockReturnValue({ isAuthenticated: true });
        // Lazy require so the module loads AFTER the mock consts initialize.
        // Fresh instance per test → clean refreshInFlight state.
        const { AuthService } = require('./AuthService');
        service = new AuthService();
    });
    it('A. single-flights concurrent refreshes (spends the refresh token once)', async () => {
        seedStore({ expiresAt: PAST(), refreshToken: 'r1' });
        mockRefreshAccessToken.mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve({
            token: undefined, // refresh route doesn't return a gh token
            workosToken: 'wos_new',
            refreshToken: 'r2', // rotated
            expiresAt: FUTURE(),
        }), 10)));
        const [a, b, c] = await Promise.all([
            service.getValidToken(),
            service.getValidToken(),
            service.getValidToken(),
        ]);
        // The whole point: three concurrent callers, one refresh.
        expect(mockRefreshAccessToken).toHaveBeenCalledTimes(1);
        expect(mockRefreshAccessToken).toHaveBeenCalledWith('r1', 'dev-1', USER.id);
        // GitHub token is preserved (refresh returns no gh token).
        expect([a, b, c]).toEqual(['gho_old', 'gho_old', 'gho_old']);
    });
    it('B. keeps the session on a transient refresh failure (no sign-out)', async () => {
        seedStore({ expiresAt: PAST(), refreshToken: 'r1' });
        mockRefreshAccessToken.mockRejectedValue(new Error('Token refresh failed: network down'));
        const token = await service.getValidToken();
        expect(token).toBe('gho_old'); // still usable
        expect(mockStorage.deleteToken).not.toHaveBeenCalled();
        expect(mockAuthState.clearAuthentication).not.toHaveBeenCalled();
    });
    it('C. signs out on a definitive invalid_grant', async () => {
        seedStore({ expiresAt: PAST(), refreshToken: 'r1' });
        mockRefreshAccessToken.mockRejectedValue(new Error('Token refresh failed: invalid_grant'));
        const token = await service.getValidToken();
        expect(token).toBeNull();
        expect(mockStorage.deleteToken).toHaveBeenCalledWith('github_token');
        expect(mockStorage.deleteToken).toHaveBeenCalledWith('workos_token');
        expect(mockAuthState.clearAuthentication).toHaveBeenCalled();
    });
    it('D. signs out when the session is expired and there is no refresh token', async () => {
        seedStore({ expiresAt: PAST(), refreshToken: null });
        const token = await service.getValidToken();
        expect(token).toBeNull();
        expect(mockRefreshAccessToken).not.toHaveBeenCalled();
        expect(mockAuthState.clearAuthentication).toHaveBeenCalled();
    });
    it('E. refreshes when the server rejects a not-yet-expired WorkOS token', async () => {
        // Stored expiry is comfortably in the future, so getStoredAuth takes the
        // sync path — but the server rejects the WorkOS token. Without recovery this
        // loops forever ("WorkOS token verification failed" flood); the fix is to
        // refresh instead.
        const { InvalidWorkosTokenError } = require('./OAuthServerClient');
        seedStore({ expiresAt: FUTURE(), refreshToken: 'r1' });
        mockFetchCurrentToken.mockRejectedValue(new InvalidWorkosTokenError());
        mockRefreshAccessToken.mockResolvedValue({
            token: undefined,
            workosToken: 'wos_new',
            refreshToken: 'r2',
            expiresAt: FUTURE(),
        });
        const token = await service.getValidToken();
        expect(mockRefreshAccessToken).toHaveBeenCalledTimes(1);
        expect(mockRefreshAccessToken).toHaveBeenCalledWith('r1', 'dev-1', USER.id);
        expect(token).toBe('gho_old'); // GitHub token preserved across refresh
        expect(mockAuthState.clearAuthentication).not.toHaveBeenCalled();
    });
    it('F. signs out when the server rejects the token and there is no refresh token', async () => {
        const { InvalidWorkosTokenError } = require('./OAuthServerClient');
        seedStore({ expiresAt: FUTURE(), refreshToken: null });
        mockFetchCurrentToken.mockRejectedValue(new InvalidWorkosTokenError());
        const token = await service.getValidToken();
        expect(token).toBeNull();
        expect(mockRefreshAccessToken).not.toHaveBeenCalled();
        expect(mockAuthState.clearAuthentication).toHaveBeenCalled();
    });
});
export {};
