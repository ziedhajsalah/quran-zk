import { defineConfig } from 'vite'
import tsConfigPaths from 'vite-tsconfig-paths'

// Storybook renders components without the Start/Cloudflare application entries.
export default defineConfig({
  plugins: [tsConfigPaths({ projects: ['./tsconfig.json'] })],
})
