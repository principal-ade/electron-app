// Global test setup
// Add any global test utilities, mocks, or configuration here
import '@testing-library/jest-dom';
import { jest } from '@jest/globals';
// Example: Custom matchers, global beforeAll/afterAll, etc.
global.console = {
    ...console,
    // Suppress console.log in tests unless needed
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
};
