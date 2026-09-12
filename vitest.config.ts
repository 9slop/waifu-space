import { defineConfig } from 'vitest/config';
import solidPlugin from 'vite-plugin-solid';
import Icons from 'unplugin-icons/vite';

export default defineConfig({
  plugins: [solidPlugin({ hot: false }), Icons({ compiler: 'solid' })],
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.{test,spec}.{ts,tsx}']
  },
  resolve: {
    conditions: ['development', 'browser']
  }
});
