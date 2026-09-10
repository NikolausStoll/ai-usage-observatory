import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";

const sharedRules = {
  "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
  "no-console": "off",
  "@typescript-eslint/no-floating-promises": "warn",
};

export default [
  {
    // Source files — strict
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/routeTree.gen.ts"],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        project: "./tsconfig.json",
        ecmaVersion: 2022,
        sourceType: "module",
      },
    },
    plugins: { "@typescript-eslint": tseslint },
    rules: {
      ...sharedRules,
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
  {
    // Test files — relaxed (allow `as any` for test fixtures and mocks)
    files: ["tests/**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        project: "./tsconfig.json",
        ecmaVersion: 2022,
        sourceType: "module",
      },
    },
    plugins: { "@typescript-eslint": tseslint },
    rules: {
      ...sharedRules,
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
];
