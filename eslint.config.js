import js from '@eslint/js';
import globals from 'globals';

export default [
    {
        ignores: ['dist/**', 'node_modules/**']
    },
    js.configs.recommended,
    {
        languageOptions: {
            ecmaVersion: 2024,
            sourceType: 'module',
            globals: {
                ...globals.node
            }
        },
        rules: {
            'no-unused-vars': ['error', {argsIgnorePattern: '^_'}],
            eqeqeq: ['error', 'smart'],
            // checkTimer is read by the shutdown closure before being assigned,
            // which is exactly what this option exempts
            'prefer-const': ['error', {ignoreReadBeforeAssign: true}],
            'no-var': 'error'
        }
    }
];
