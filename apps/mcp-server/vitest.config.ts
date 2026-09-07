import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    exclude: [...configDefaults.exclude, "dist/**"],
    reporters: ["default", "junit"],
    outputFile: {
      junit: "test-results/unit.xml",
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: [
        "src/config.ts",
        "src/errors.ts",
        "src/event-store.ts",
        "src/http-app.ts",
        "src/tool-service.ts",
      ],
      thresholds: {
        lines: 70,
        functions: 55,
        statements: 70,
        branches: 40,
      },
    },
  },
});
