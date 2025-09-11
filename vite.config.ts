import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import dts from "vite-plugin-dts";
import { resolve } from "path";

export default defineConfig({
    plugins: [
        react(),
        dts({
            insertTypesEntry: true,
            outDir: "dist/types",
            copyDtsFiles: true,
            exclude: ["**/*.test.*", "**/*.spec.*", "node_modules/**"],
        }),
    ],
    build: {
        target: "esnext",
        sourcemap: true,
        minify: "esbuild",
        lib: {
            entry: {
                index: resolve(__dirname, "src/index.ts"),
                "adapters/auth/ability-adapter": resolve(__dirname, "src/adapters/auth/ability"),
                "adapters/data/rest-adapter": resolve(__dirname, "src/adapters/data/rest"),
                "adapters/data/supabase-adapter": resolve(__dirname, "src/adapters/data/supabase"),
                "adapters/realtime/firebase-adapter": resolve(__dirname, "src/adapters/realtime/firebase"),
                "adapters/realtime/reverb-adapter": resolve(__dirname, "src/adapters/realtime/reverb"),
            },
            name: "ShardevCommon",
            fileName: (format, entryName) => `${entryName}.${format}.js`,
            formats: ["es", "cjs"],
        },
        rollupOptions: {
            external: [
                "react",
                "react-dom",
                "react-router-dom",
                "@reduxjs/toolkit",
            ],
            output: {
                exports: "named",
            },
        },
        emptyOutDir: true,
    },
    resolve: {
        alias: {
            "@": resolve(__dirname, "src"),
        },
    },
    optimizeDeps: {
        exclude: ["vite-plugin-dts"],
    },
});