// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import storybook from 'eslint-plugin-storybook'

import { defineConfig, globalIgnores } from 'eslint/config'
import { tanstackConfig } from '@tanstack/eslint-config'

export default defineConfig([
  ...tanstackConfig,
  globalIgnores(['storybook-static', 'dist', 'worker-configuration.d.ts', 'src/routeTree.gen.ts']),
  ...storybook.configs['flat/recommended'],
])
