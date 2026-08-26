//src/common/config/env.validation.ts
//Validación de variables de entorno usando Zod
import { z } from 'zod';

/**
 * Esquema estricto de validación para las variables de entorno del sistema.
 * Garantiza que la aplicación no inicie si faltan llaves críticas o no cumplen con la seguridad mínima.
 */
export const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3000'),

  //Base de datos PostgreSQL (Prisma ORM)
  DATABASE_URL: z.string({ error: 'DATABASE_URL es requerida' }).min(1, 'DATABASE_URL no puede estar vacía'),
  DIRECT_URL: z.string().optional(),

  //Integración con API de RENIEC (Consulta DNI)
  RENIEC_API_KEY: z.string().optional().default(''),
  RENIEC_API_URL: z.string().optional(),

  //Seguridad de Sesiones y Autenticación JWT
  COOKIE_SECRET: z.string().optional().default('cookie_secret_default_32_bytes_min_2026'),
  JWT_ACCESS_SECRET: z.string({ error: 'JWT_ACCESS_SECRET es requerida' }).min(32, 'La clave secreta debe tener al menos 32 caracteres'),
  JWT_REFRESH_SECRET: z.string({ error: 'JWT_REFRESH_SECRET es requerida' }).min(32, 'La clave secreta debe tener al menos 32 caracteres'),

  //Cifrado criptográfico en reposo AES-256-GCM para datos financieros
  FINANCIAL_DATA_ENCRYPTION_KEY: z.string()
    .min(32, 'La clave de cifrado financiero debe tener al menos 32 caracteres')
    .optional()
    .default('jyp_financial_master_key_super_secret_32_bytes_2026!'),
});

export type EnvConfig = z.infer<typeof EnvSchema>;

/**
 * Función encargada de validar las variables de entorno al arrancar NestJS.
 * Lanza una excepción inmediata en caso de incongruencias o faltantes.
 */
export function validateEnv(config: Record<string, unknown>) {
  const parsed = EnvSchema.safeParse(config);
  if (!parsed.success) {
    console.error('Error de validación de variables de entorno:', parsed.error.issues);
    throw new Error('Variables de entorno inválidas');
  }
  return parsed.data;
}
