import js from '@eslint/js'
import typescriptEslint from '@typescript-eslint/eslint-plugin'
import typescriptParser from '@typescript-eslint/parser'
import prettier from '@vue/eslint-config-prettier/skip-formatting'
import typescript from '@vue/eslint-config-typescript'
import playwright from 'eslint-plugin-playwright'
import simpleImportSort from 'eslint-plugin-simple-import-sort'
import sonarjs from 'eslint-plugin-sonarjs'
import vue from 'eslint-plugin-vue'
import vuetify from 'eslint-plugin-vuetify'
import vueParser from 'vue-eslint-parser'

export default [
  // Global ignores
  {
    ignores: ['dist/**', 'node_modules/**', '.git/**', '*.min.js']
  },

  // Base configuration for JS/TS files
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module'
      },
      globals: {
        // Browser globals
        window: 'readonly',
        document: 'readonly',
        Element: 'readonly',
        navigator: 'readonly',
        console: 'readonly',
        alert: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        PromiseRejectionEvent: 'readonly',
        // Node globals
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        global: 'readonly',
        module: 'readonly',
        require: 'readonly',
        exports: 'readonly'
      }
    },
    plugins: {
      vuetify,
      sonarjs,
      'simple-import-sort': simpleImportSort,
      '@typescript-eslint': typescriptEslint
    },
    rules: {
      ...js.configs.recommended.rules,

      'no-debugger': process.env.NODE_ENV === 'production' ? 'error' : 'off',
      // Disabled to not cause conflicts with simple-import-sort
      'sort-imports': ['off'],
      'simple-import-sort/imports': [
        'error',
        // This config is the default group ordering without lines between groups
        // https://github.com/lydell/eslint-plugin-simple-import-sort?tab=readme-ov-file#how-do-i-remove-all-blank-lines-between-imports
        { groups: [['^\\u0000', '^node:', '^@?\\w', '^', '^\\.']] }
      ],
      'simple-import-sort/exports': 'error',
      '@typescript-eslint/no-empty-function': ['off'],
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          ignoreRestSiblings: true,
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_'
        }
      ],
      'no-redeclare': 'off',
      '@typescript-eslint/no-redeclare': 'warn',
      'sonarjs/no-duplicate-string': [
        'error',
        { ignoreStrings: 'network-only,cache-first,cache-and-network,no-cache,standby' }
      ],
      'sonarjs/cognitive-complexity': ['error', 15]
    }
  },

  // Vue files configuration
  {
    files: ['**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: typescriptParser,
        ecmaVersion: 'latest',
        sourceType: 'module'
      },
      globals: {
        // Browser globals
        window: 'readonly',
        document: 'readonly',
        Element: 'readonly',
        navigator: 'readonly',
        console: 'readonly',
        alert: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        PromiseRejectionEvent: 'readonly',
        // Node globals
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        global: 'readonly',
        module: 'readonly',
        require: 'readonly',
        exports: 'readonly'
      }
    },
    plugins: {
      vue,
      vuetify,
      sonarjs,
      'simple-import-sort': simpleImportSort,
      '@typescript-eslint': typescriptEslint
    },
    rules: {
      'vue/valid-v-slot': ['error', { allowModifiers: true }],
      // Disabled to not cause conflicts with simple-import-sort
      'sort-imports': ['off'],
      'simple-import-sort/imports': [
        'error',
        // This config is the default group ordering without lines between groups
        // https://github.com/lydell/eslint-plugin-simple-import-sort?tab=readme-ov-file#how-do-i-remove-all-blank-lines-between-imports
        { groups: [['^\\u0000', '^node:', '^@?\\w', '^', '^\\.']] }
      ],
      'simple-import-sort/exports': 'error',
      'vue/component-name-in-template-casing': [
        'error',
        'PascalCase',
        {
          registeredComponentsOnly: false
        }
      ],
      'vue/component-options-name-casing': ['error', 'PascalCase'],
      'vue/next-tick-style': ['error', 'promise'],
      'vue/no-potential-component-option-typo': ['error'],
      'vue/match-component-file-name': ['error'],
      'vue/require-default-prop': ['off'],
      'vue/attribute-hyphenation': ['error', 'never'],
      'vue/block-lang': [
        'error',
        {
          script: {
            lang: ['ts'],
            allowNoLang: false
          },
          style: {
            lang: ['scss'],
            allowNoLang: true
          }
        }
      ],
      '@typescript-eslint/no-empty-function': ['off'],
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          ignoreRestSiblings: true,
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_'
        }
      ],
      'vue/no-unused-vars': [
        'error',
        {
          ignorePattern: '^_'
        }
      ],
      'no-redeclare': 'off',
      '@typescript-eslint/no-redeclare': 'warn',
      'sonarjs/no-duplicate-string': [
        'error',
        { ignoreStrings: 'network-only,cache-first,cache-and-network,no-cache,standby' }
      ],
      'sonarjs/cognitive-complexity': ['error', 15]
    }
  },

  // Vuetify recommended rules (using flat config)
  ...vuetify.configs['flat/recommended'].map((config) => ({
    ...config,
    files: config.files || ['**/*.{js,jsx,ts,tsx,vue}']
  })),

  // SonarJS recommended rules
  {
    files: ['**/*.{js,jsx,ts,tsx,vue}'],
    rules: {
      ...sonarjs.configs['recommended-legacy'].rules
    },
    settings: {
      ...sonarjs.configs['recommended-legacy'].settings
    }
  },

  // TypeScript configuration
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module'
      }
    },
    ...typescript
  },

  // Prettier configuration (skip formatting)
  {
    files: ['**/*.{js,jsx,ts,tsx,vue}'],
    ...prettier
  },

  // E2E test files configuration
  {
    files: ['e2e/**/*.{test,spec}.{js,ts,jsx,tsx}'],
    plugins: {
      playwright
    },
    rules: {
      ...playwright.configs.recommended.rules
    }
  },

  // Test files configuration
  {
    files: ['**/*.{test,spec}.{j,t}s?(x)'],
    rules: {
      'sonarjs/no-duplicate-string': 'off'
    }
  }
]
