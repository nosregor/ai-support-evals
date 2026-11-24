// ESLint catches bugs; Prettier handles formatting. eslint-config-prettier
// switches off ESLint's style rules so the two never disagree.
import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['node_modules', 'results'] },
  js.configs.recommended,
  // Type-aware rules catch things like forgotten `await` on a promise.
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      globals: globals.node,
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
  },
  { files: ['*.js'], ...tseslint.configs.disableTypeChecked },
  prettier,
)
