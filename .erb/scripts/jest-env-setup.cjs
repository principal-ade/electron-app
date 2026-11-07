// Jest should always load development React, even when the parent shell exports
// NODE_ENV=production. The npm test script also sets this, but direct Jest runs
// should behave the same way.
process.env.NODE_ENV = 'test';
