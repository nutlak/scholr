import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // 'ios' holds the generated Xcode project; ios/App/App/public is a copy of
  // the built bundle that `cap sync` drops there, so linting it reports the
  // minified output as ~170 errors that no one can act on.
  globalIgnores(['dist', 'ios']),
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
