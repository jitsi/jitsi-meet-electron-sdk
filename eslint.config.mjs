import js from '@eslint/js';

export default [
    js.configs.recommended,
    {
        languageOptions: {
            ecmaVersion: 2021, // Use modern ECMAScript version
            sourceType: 'module',
            globals: {
                __filename: false
            }
        },
        rules: {
            'new-cap': [
                'error',
                {
                    capIsNew: false
                }
            ],
            'no-console': 'off',
            'semi': 'error'
        },
        ignores: [
            'node_modules',
            'dist'
        ]
    },
    {
        // Node.js (Main process)
        files: ['**/main/**/*.js', '**/*.cjs'],
        languageOptions: {
            globals: {
                require: 'readonly',
                module: 'readonly',
                process: 'readonly',
                console: 'readonly',
                __dirname: 'readonly'
            }
        }
    },
    {
        // Browser (Renderer process)
        files: ['**/render/**/*.js'],
        env: {
            browser: true, // Add this line
            es2021: true // Or es6: true if you're using ES6 features
        },
        languageOptions: {
            globals: {
                window: 'readonly',
                document: 'readonly',
                URL: 'readonly',
                console: 'readonly'
            },
            // browser: true
        }
    },
    {
        // Test files
        files: ['**/*.test.js'],
        languageOptions: {
            globals: {
                describe: 'readonly',
                it: 'readonly',
                expect: 'readonly',
                jest: 'readonly',
                assert: 'readonly'
            }
        }
    }
];