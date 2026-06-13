import { defineConfig } from 'vite'
import { localDataPlugin } from './vite-plugin-local-data'

export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/Friends-Chat-Online/' : '/',
  plugins: command === 'serve' ? [localDataPlugin()] : [],
  build: {
    outDir: 'docs',
    emptyOutDir: true,
  },
}))
