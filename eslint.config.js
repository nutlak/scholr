import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // New in React 19's plugin. Fires on working load-then-poll effects;
      // kept visible as a warning rather than rewriting effects that work.
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
  {
    // Express backend runs on Node, not in the browser.
    files: ['server/**/*.js'],
    languageOptions: { globals: globals.node },
    rules: {
      // Express identifies error middleware by arity, so the 4th parameter has
      // to be declared even when unused. Underscore marks that as deliberate.
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
])
