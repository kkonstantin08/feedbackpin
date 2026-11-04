import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  plugins: [
    {
      name: 'extension-manifest',
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'manifest.json',
          source: readFileSync(
            new URL('./manifest.json', import.meta.url),
            'utf8',
          ),
        });
      },
    },
  ],
  build: {
    rolldownOptions: {
      input: {
        index: fileURLToPath(new URL('./index.html', import.meta.url)),
        popup: fileURLToPath(
          new URL('./src/popup/index.html', import.meta.url),
        ),
        dashboard: fileURLToPath(
          new URL('./src/dashboard/index.html', import.meta.url),
        ),
        background: fileURLToPath(
          new URL('./src/background.ts', import.meta.url),
        ),
      },
      output: {
        entryFileNames: (entry) =>
          entry.name === 'background'
            ? 'background.js'
            : 'assets/[name]-[hash].js',
      },
    },
  },
});
