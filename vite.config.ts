import { defineConfig } from 'vite'
import { localDataPlugin } from './vite-plugin-local-data'

export default defineConfig(({ command }) => ({
  // Relative base works with any GitHub repo name (avoids white screen)
  base: command === 'build' ? './' : '/',
  plugins: command === 'serve' ? [localDataPlugin()] : [],
  build: {
    outDir: 'docs',
    emptyOutDir: true,
  },
}))
