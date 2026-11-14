/**
 * Jest for the mobile app (CONN-TEST-2).
 *
 * This repo had no test runner, no test dependency, no test script AND no CI
 * workflow of any kind - so even the lint, typecheck and format scripts that
 * did exist never ran automatically.
 *
 * jest-expo rather than plain jest or vitest: it ships the preset that
 * transforms react-native and the expo-* packages, mocks the native modules
 * that have no JS implementation off-device, and tracks the SDK. Plain jest
 * fails on the first `import ... from 'expo-router'`.
 */
module.exports = {
  preset: 'jest-expo',
  // Always use worker processes. On a one-core runner jest goes in band, and there the run exits 1 although every
  // test passed (jest-expo's lazy global fetch logs after the test environment is gone). Two workers avoid it.
  maxWorkers: 2,
  // Node's default resolver plus the RN/Expo transform allowances the preset
  // needs. Without transformIgnorePatterns, node_modules ships untranspiled
  // Flow/JSX and every RN import throws a syntax error.
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg)',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  testPathIgnorePatterns: ['/node_modules/', '/.expo/', '/_design-sandbox/'],
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.d.ts'],
};
