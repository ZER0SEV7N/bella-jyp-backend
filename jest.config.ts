//jest.config.ts
/**
 * Archivo de configuración de Jest para el proyecto.
 * - preset: 'ts-jest' indica que se utilizará ts-jest para compilar TypeScript.
 * - testEnvironment: 'node' establece el entorno de prueba como Node.js.
 * - clearMocks: true asegura que los mocks se limpien automáticamente entre pruebas.
 * - collectCoverage: true habilita la recolección de cobertura de código.
 */
import type { Config } from 'jest';

const config: Config = {
  // Preset de compilación TypeScript con ts-jest
  preset: 'ts-jest',
  testEnvironment: 'node',

  // Limpieza de mocks previa a cada test
  clearMocks: true,

  // Configuración de Cobertura de Código para SonarQube
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
  },

  // Expresión regular para encontrar archivos de pruebas (.spec.ts)
  testRegex: String.raw`.*\.spec\.ts$`,

  // Transformador de TypeScript
  transform: {
    '^.+\\.(t|j)s$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.json',
        isolatedModules: true,
      },
    ],
  },
};

export default config;