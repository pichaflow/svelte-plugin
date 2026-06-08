import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    svelte(),
    dts({
      insertTypesEntry: true,
    }),
  ],
  build: {
    minify: false,
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'PichaFlowSvelte',
      fileName: 'index',
    },
    rollupOptions: {
      external: ['svelte', '@pichaflow/sdk'],
    },
  },
});
