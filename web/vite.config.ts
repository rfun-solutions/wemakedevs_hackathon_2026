import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

// PORT is the API port, VITE_PORT the dev-server port (see AGENTS.md rule 1).
const apiPort = process.env.PORT ?? '3000';
const vitePort = Number(process.env.VITE_PORT ?? 5173);

export default defineConfig({
  root: import.meta.dirname,
  plugins: [preact()],
  build: { outDir: 'dist', emptyOutDir: true, sourcemap: false },
  server: {
    port: vitePort,
    proxy: { '/api': `http://localhost:${apiPort}` },
  },
  preview: { port: Number(apiPort), strictPort: true },
});
