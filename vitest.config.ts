import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        environment: "node",
        globals: false,
        include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
        clearMocks: true,
        pool: "threads",
        poolOptions: {
            threads: {
                singleThread: true,
            },
        },
    },
    resolve: {
        alias: {
            "@": path.resolve("src"),
        },
    },
});
