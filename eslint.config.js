const js = require('@eslint/js');
const typescript = require('@typescript-eslint/eslint-plugin');
const typescriptParser = require('@typescript-eslint/parser');
const react = require('eslint-plugin-react');
const reactHooks = require('eslint-plugin-react-hooks');
const reactNative = require('eslint-plugin-react-native');
const prettier = require('eslint-plugin-prettier');
const prettierConfig = require('eslint-config-prettier');

module.exports = [
  // Base configuration for all files
  js.configs.recommended,

  // Configuration for TypeScript files
  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
        ecmaVersion: 2020,
        sourceType: 'module',
        project: './tsconfig.json',
      },
      globals: {
        __DEV__: 'readonly',
        console: 'readonly',
        module: 'readonly',
        require: 'readonly',
        process: 'readonly',
        global: 'readonly',
        window: 'readonly',
        document: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        fetch: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': typescript,
      react: react,
      'react-hooks': reactHooks,
      'react-native': reactNative,
      prettier: prettier,
    },
    rules: {
      // Base TypeScript rules
      ...typescript.configs.recommended.rules,

      // Prettier integration
      'prettier/prettier': 'error',

      // React specific rules
      'react/react-in-jsx-scope': 'off', // Not needed in React 17+
      'react/prop-types': 'off', // Using TypeScript for prop validation
      'react/display-name': 'off',

      // React Hooks rules
      ...reactHooks.configs.recommended.rules,

      // TypeScript specific rules
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'warn',

      // React Native specific rules
      // 'no-unused-styles' is off: eslint-plugin-react-native@5's detector
      // only names a stylesheet via `node.parent.id` (a plain
      // `const styles = StyleSheet.create({...})` VariableDeclarator). The
      // theming migration's mandated pattern — `useMemo(() => StyleSheet
      // .create({...}), [deps])`, see Card.tsx / BaseListScreen.tsx and
      // src/styles/*.ts's useTheme()/useCommonStyles() hooks — puts an
      // ArrowFunctionExpression between the declarator and the call, so
      // `.parent.id` is undefined and the rule reports every key as unused
      // under a literal "undefined" stylesheet name, even when the JSX uses
      // it. Verified against Card.tsx/BaseListScreen.tsx, both already on
      // this pattern, both false-positiving before this file changed.
      'react-native/no-unused-styles': 'off',
      'react-native/split-platform-components': 'error',
      'react-native/no-inline-styles': 'warn',
      'react-native/no-color-literals': 'warn',
      'react-native/no-raw-text': 'off', // Can be overly restrictive

      // General code quality rules
      'no-console': process.env.NODE_ENV === 'production' ? 'error' : 'warn',
      'no-debugger': 'error',
      'prefer-const': 'error',
      'no-var': 'error',
      eqeqeq: ['error', 'always'],
      curly: ['error', 'all'],

      // Import/Export rules
      'no-duplicate-imports': 'error',
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
  },

  // Configuration for test files
  {
    files: ['tst/**/*.{ts,tsx,js,jsx}', '**/*.{test,spec}.{ts,tsx,js,jsx}'],
    languageOptions: {
      parser: typescriptParser,
      globals: {
        // Jest globals
        jest: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        // Node/common globals
        __DEV__: 'readonly',
        console: 'readonly',
        module: 'readonly',
        require: 'readonly',
        process: 'readonly',
        global: 'readonly',
      },
    },
    rules: {
      // Relax some rules for test files
      '@typescript-eslint/no-explicit-any': 'off', // Allow any in tests for mocking
      'no-console': 'off', // Allow console in tests
    },
  },

  // Prettier config to disable conflicting rules
  prettierConfig,

  // Ignore patterns
  {
    ignores: [
      'node_modules/',
      // The library build output — generated from src/, never hand-edited.
      'lib/',
      'dist/',
      'build/',
      'coverage/',
      '.expo/',
      '.git/',
      '.vscode/',
      '.idea/',
      '*.config.js',
      'babel.config.js',
      'jest.setup.js',
      '*.min.js',
    ],
  },
];
