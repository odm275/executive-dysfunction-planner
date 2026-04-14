import nextJest from "next/jest.js";

const createJestConfig = nextJest({
  dir: "./",
});

/** @type {import('jest').Config} */
const config = {
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  testMatch: [
    "**/__tests__/**/*.[jt]s?(x)",
    "**/?(*.)+(spec|test).[jt]s?(x)",
  ],
  testPathIgnorePatterns: [
    "<rootDir>/e2e/",
    "<rootDir>/node_modules/",
    "<rootDir>/.sandcastle/",
  ],
  moduleNameMapper: {
    "^~/(.*)$": "<rootDir>/src/$1",
  },
};

export default createJestConfig(config);
