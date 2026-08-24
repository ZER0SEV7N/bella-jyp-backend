import type { Config } from 'jest';

const config: Config = {
  // Configuración base de ts-jest y entorno Node.js
  preset: 'ts-jest',
  testEnvironment: 'node',

  // Limpieza y manejo de Mocks
  clearMocks: true,

  // Configuración de Cobertura de Código para SonarQube (LCOV)
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'clover'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.module.ts',
    '!src/main.ts',
    '!src/**/*.dto.ts',
    '!src/**/*.schema.ts',
  ],

  // Mapeo del alias '@/' hacia 'src/'
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // Mapeador explícito para evitar conflictos de resolución ESM/CommonJS en paquetes como uuid
    '^uuid$': 'uuid',
  },

  // Detección de archivos de pruebas unitarias
  testRegex: '.*\\.spec\\.ts$',

  // Transformación de código con ts-jest
  transform: {
    '^.+\\.(t|j)s$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.json',
        isolatedModules: true,
      },
    ],
  },

  // Permitir que Jest transforme paquetes ESM en node_modules como uuid (compatible con pnpm virtual store)
  transformIgnorePatterns: ['/node_modules/(?!.*uuid)'],
};

export default config;