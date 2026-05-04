import { defineConfig } from "tsup";

export default defineConfig({
    entry: {
        index: "src/index.ts",

        "adapters/auth/ability": "src/adapters/auth/ability/index.ts",
        "adapters/data/rest": "src/adapters/data/rest/index.ts",
        "adapters/data/supabase": "src/adapters/data/supabase/index.ts",
        "adapters/realtime/firebase": "src/adapters/realtime/firebase/index.ts",
        "adapters/realtime/reverb": "src/adapters/realtime/reverb/index.ts",
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
        "firebase/app",
        "firebase/database",
        "react-router-dom",
        "@reduxjs/toolkit",
    ],
});
