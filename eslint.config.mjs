import js from '@eslint/js';
import ts from 'typescript-eslint';
export default ts.config({ ignores: ['dist/**', 'release/**', 'node_modules/**', '.npm-cache/**', 'evidence/**', 'test-user-data/**'] }, js.configs.recommended, ...ts.configs.recommended, { files: ['**/*.ts','**/*.mjs'], languageOptions: { globals: { console:'readonly',process:'readonly',Buffer:'readonly',setTimeout:'readonly',clearTimeout:'readonly',URL:'readonly',fetch:'readonly',AbortController:'readonly',window:'readonly' } }, rules: { '@typescript-eslint/no-explicit-any':'off' } });
