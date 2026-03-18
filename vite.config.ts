import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import electron from 'vite-plugin-electron/simple';
import path from 'node:path';

export default defineConfig(({ mode }) => ({
  plugins: [
    tailwindcss(),
    react(),
    ...(mode === 'test'
      ? []
      : [
          electron({
            main: {
              entry: 'electron/main.ts',
              vite: {
                build: {
                  rollupOptions: {
                    external: ['node:sqlite'],
                  },
                },
              },
            },
            preload: {
              input: {
                preload: 'electron/preload.ts',
              },
            },
            renderer: {},
          }),
        ]),
  ],
  resolve: {
    alias: {
      '@renderer': path.resolve(__dirname, 'src/renderer'),
      '@shared': path.resolve(__dirname, 'src/shared'),
      '@fast-renamer/rename-engine': path.resolve(
        __dirname,
        'packages/rename-engine/src/index.ts',
      ),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: 'dist-renderer',
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts', 'electron/**/*.test.ts', 'packages/**/*.test.ts'],
  },
}));
