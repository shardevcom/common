import {defineConfig} from "vite";
import react from "@vitejs/plugin-react";
import dts from "vite-plugin-dts";
import {resolve} from "path";

export default defineConfig({
    plugins: [
        react(),
        dts({
            insertTypesEntry: true, // añade "types" en package.json
            outDir: "dist/types",   // separa tipados de la build JS
            copyDtsFiles: true,
            exclude: ["**/*.test.*", "**/*.spec.*", "node_modules/**"],
        }),
    ],
    build: {
        target: "esnext", // genera output moderno, deja que bundlers transpilen si hace falta
        sourcemap: true, // facilita debug en proyectos que usen tu lib
        minify: "esbuild", // es más rápido que terser
        lib: {
            entry: {
                index: resolve(__dirname, "src/index.ts"),
                "adapters/auth/ability-adapter": resolve(
                    __dirname,
                    "src/adapters/auth/ability"
                ),
                "adapters/data/rest-adapter": resolve(
                    __dirname,
                    "src/adapters/data/rest"
                ),
                "adapters/data/supabase-adapter": resolve(
                    __dirname,
                    "src/adapters/data/supabase"
                ),
                "adapters/realtime/firebase-adapter": resolve(
                    __dirname,
                    "src/adapters/realtime/firebase"
                ),
                "adapters/realtime/reverb-adapter": resolve(
                    __dirname,
                    "src/adapters/realtime/reverb"
                ),
            },
            name: "ShardevCommon",
            fileName: (format, entryName) => `${entryName}.${format}.js`,
            formats: ["es", "cjs"],
        },
        rollupOptions: {
            external: [
                "react",
                "react-dom",
                'react-router-dom',
                "@reduxjs/toolkit", // <- marca dependencias pesadas como externas
            ],
            output: {
                globals: {
                    react: "React",
                    'react-dom': 'ReactDOM',
                    'react-router-dom': 'ReactRouterDOM',
                    '@reduxjs/toolkit': 'RTK',
                },
                exports: "named", // previene problemas con export default en CJS
                preserveModules: true, // mantiene la estructura de archivos
                preserveModulesRoot: "src", // organiza output en dist/src/*
            },
        },
        emptyOutDir: true, // limpia dist antes de cada build
    },
    resolve: {
        alias: {
            "@": resolve(__dirname, "src"), // atajo limpio para imports internos
        },
    },
    optimizeDeps: {
        exclude: ["vite-plugin-dts"], // no hace falta prebundlear esto
    },
});
