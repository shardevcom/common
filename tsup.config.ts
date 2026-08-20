import { defineConfig } from "tsup";

export default defineConfig({
    entry: {
        index: "src/index.ts",
    },

    format: ["esm", "cjs"],
    dts: true,
    sourcemap: true,
    clean: true,
    splitting: false, // importante para libs
    treeshake: true,
    minify: true,

    external: [
        "react",
        "react-dom",
        "react-redux",
        "redux-persist",
        "firebase/app",
        "firebase/database",
        "react-router-dom",
        "@reduxjs/toolkit",
    ],
});
