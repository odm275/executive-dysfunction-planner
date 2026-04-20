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

// next/jest sets its own transformIgnorePatterns; we extend it to also
// transform ESM-only packages that are imported from server code.
async function jestConfig() {
  const nextConfig = await createJestConfig(config)();
  const existing = nextConfig.transformIgnorePatterns ?? [];
  // Replace the catch-all node_modules ignore with one that allows superjson
  nextConfig.transformIgnorePatterns = existing
    .filter((p) => !p.includes("node_modules"))
    .concat(["/node_modules/(?!(superjson|copy-anything|is-what)/)"]);
  return nextConfig;
}

export default jestConfig;
