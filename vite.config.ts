import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import dts from 'vite-plugin-dts'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    react(),
    dts({
      insertTypesEntry: true,
      outDir: 'dist'
    })
  ],
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        'adapters/auth/ability-adapter': resolve(__dirname, 'src/adapters/auth/ability'),
        'adapters/data/rest-adapter': resolve(__dirname, 'src/adapters/data/rest'),
        'adapters/data/supabase-adapter': resolve(__dirname, 'src/adapters/data/supabase'),
        'adapters/realtime/firebase-adapter': resolve(__dirname, 'src/adapters/realtime/firebase'),
        'adapters/realtime/reverb-adapter': resolve(__dirname, 'src/adapters/realtime/reverb'),
      },
      name: '@shadevcom/common',
      fileName: (format, entryName) => `${entryName}.${format}.js`,
      formats: ['es', 'cjs'],
    },
    rollupOptions: {
      external: ['react', 'react-dom'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
        },
      },
    }
  },
})

