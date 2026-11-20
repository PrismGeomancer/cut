import { defineConfig, type Plugin } from 'vite';
import { cpSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Preview builds (VITE_PREVIEW=1) copy ./preview (generated mockups) into the output.
// The normal build never includes it.
function previewAssets(): Plugin {
  let outDir = 'dist';
  return {
    name: 'cut-preview-assets',
    apply: 'build',
    configResolved(c) { outDir = c.build.outDir; },
    closeBundle() {
      if (process.env.VITE_PREVIEW === '1' && existsSync('preview')) cpSync('preview', resolve(outDir, 'preview'), { recursive: true });
    },
  };
}

// base './' plus hash routing: the build works at any GitHub Pages subpath.
export default defineConfig({
  base: './',
  plugins: [previewAssets()],
  optimizeDeps: { exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util'] },
  build: { target: 'es2022', chunkSizeWarningLimit: 900 },
  test: { include: ['tests/unit/**/*.test.ts'], environment: 'node' },
} as any);
