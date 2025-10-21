module.exports = {
  testEnvironment: "node",
  roots: ["<rootDir>/tests"],
  testMatch: [
    "**/tests/**/*.spec.js",
    "**/tests/**/*.test.js"
  ],
  collectCoverageFrom: [
    "src/**/*.js",
    "!src/**/*.spec.js",
    "!src/**/*.test.js",
    "!node_modules/**"
  ],
  coverageDirectory: "coverage",
  coverageReporters: [
    "text",
    "lcov",
    "html"
  ],
  setupFilesAfterEnv: ["<rootDir>/tests/setup.js"],
  testTimeout: 10000,
  verbose: true,
  forceExit: true,
  detectOpenHandles: true,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true
};
