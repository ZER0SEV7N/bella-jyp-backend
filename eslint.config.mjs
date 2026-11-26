// @ts-check
import eslint from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Configuración ESLint del backend.
 *
 * Decisiones para permitir el merge a master:
 * - Prettier se ejecuta por separado (`npm run format`), no como regla de lint. Así el formato
 *   no bloquea un PR y se eliminan miles de avisos `prettier/prettier`.
 * - Las reglas "unsafe" de typescript-eslint (`no-unsafe-*`, `no-unnecessary-type-assertion`,
 *   `no-unsafe-enum-comparison`) se desactivan: en un codebase NestJS/Prisma con tipos dinámicos
 *   y mocks producen falsos positivos estructurales.
 * - `no-unused-vars` queda como aviso (warn): la deuda existente no bloquea el PR, pero el editor
 *   y el CI la siguen mostrando para limpiarla de forma incremental.
 */
export default tseslint.config(
  {
    ignores: ['eslint.config.mjs', 'dist/**', 'node_modules/**', 'coverage/**'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  // Desactiva las reglas de formato que entran en conflicto con Prettier.
  eslintConfigPrettier,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      // Ruido estructural de NestJS/Prisma con tipos dinámicos y mocks de Jest.
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unnecessary-type-assertion': 'off',
      '@typescript-eslint/no-unsafe-enum-comparison': 'off',
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-floating-promises': 'warn',
      // Aviso en vez de error: los `_prefijados` se consideran intencionalmente sin uso.
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
        },
      ],
      'no-control-regex': 'off',
      'require-yield': 'off',
    },
  },
  {
    // Los mocks de Jest usan objetos parciales y `expect(mock.metodo)`.
    files: ['**/*.spec.ts'],
    rules: {
      '@typescript-eslint/unbound-method': 'off',
    },
  },
);
