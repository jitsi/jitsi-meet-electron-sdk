import js from '@eslint/js';

export default [
    js.configs.recommended,
    {
        languageOptions: {
            ecmaVersion: 2021,
            sourceType: 'module',
            globals: {
                __filename: false
            }
        },
        rules: {
            'new-cap': ['error', { capIsNew: false }],
            'no-console': 'off',
            'semi': 'error'
        },
        ignores: ['node_modules', 'dist']
    },
    {
        files: ['**/main/**/*.js', '**/*.cjs', 'node_addons/sourceId2Coordinates/**/*.js'],
        env: {
            node: true
        }
    },
    {
        files: ['**/render/**/*.js'],
        env: { browser: true, node: true, es2021: true },
        languageOptions: {
            globals: { window: 'readonly', document: 'readonly', URL: 'readonly', console: 'readonly' }
        }
    },
    {
        files: ['**/*.test.js'],
        languageOptions: {
            globals: { describe: 'readonly', it: 'readonly', expect: 'readonly', jest: 'readonly', assert: 'readonly' }
        }
    }
];