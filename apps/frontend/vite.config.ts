import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const envDir = fileURLToPath(new URL('../../', import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, envDir, '');

  return {
    envDir,
    plugins: [react()],
    server: {
      port: Number.parseInt(env.FRONTEND_PORT || '5173', 10),
      proxy: {
        '/api': {
          target: env.FRONTEND_PROXY_TARGET ?? 'http://localhost:3001',
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
  };
});
