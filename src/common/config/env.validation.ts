//src/common/config/env.validation.ts
import { z } from 'zod';

/**
 * Esquema estricto de validación para las variables de entorno del sistema (COM-F1).
 * Garantiza que la aplicación falle rápido (Fail-Fast) al iniciar si faltan llaves criptográficas
 * críticas o si tienen menos de 32 caracteres, sin permitir secretos quemados por defecto en código.
 */
export const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3000'),

  FRONTEND_ORIGINS: z.string().default('http://localhost:5173'),
  FRONTEND_RESET_PASSWORD_URL: z.string().default('http://localhost:5173/restablecer-password'),
  DIA_PAGO_PLANILLA: z
    .string()
    .regex(/^(ULTIMO|[1-9]|[12]\d|3[01])$/)
    .default('ULTIMO'),
  DIAS_AVISO_PAGO: z.coerce.number().int().min(0).max(31).default(3),
  DIAS_AVISO_SOLICITUD: z.coerce.number().int().min(0).max(31).default(2),

  // Base de datos PostgreSQL (Prisma ORM)
  DATABASE_URL: z.string({ error: 'DATABASE_URL es requerida' }).min(1, 'DATABASE_URL no puede estar vacía'),
  DIRECT_URL: z.string().optional(),

  // Infraestructura Redis (BullMQ, Caché y Notificaciones)
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),

  // Integración con API de RENIEC (Consulta DNI)
  RENIEC_API_KEY: z.string().optional().default(''),
  RENIEC_API_URL: z.string().optional(),

  // Seguridad de Sesiones, Cookies, Autenticación JWT y Cifrado AES-256-GCM (mínimo 32 caracteres, sin fallbacks en código)
  COOKIE_SECRET: z
    .string({ error: 'COOKIE_SECRET es requerida' })
    .min(32, 'COOKIE_SECRET debe tener al menos 32 caracteres'),
  JWT_ACCESS_SECRET: z
    .string({ error: 'JWT_ACCESS_SECRET es requerida' })
    .min(32, 'JWT_ACCESS_SECRET debe tener al menos 32 caracteres'),
  JWT_REFRESH_SECRET: z
    .string({ error: 'JWT_REFRESH_SECRET es requerida' })
    .min(32, 'JWT_REFRESH_SECRET debe tener al menos 32 caracteres'),
  FINANCIAL_DATA_ENCRYPTION_KEY: z
    .string({ error: 'FINANCIAL_DATA_ENCRYPTION_KEY es requerida' })
    .min(32, 'FINANCIAL_DATA_ENCRYPTION_KEY debe tener al menos 32 caracteres'),

  // Datos empresariales del MVP
  EMPRESA_NOMBRE: z.string().default('J&P PERIFERICOS SAC'),
  EMPRESA_RUC: z.string().default('20545122520'),
  EMPRESA_DIRECCION: z.string().default('Jr. Emilio Fernández 160, Dpto. 1804'),

  // Integración asíncrona con n8n (M2M HMAC-SHA256)
  N8N_WEBHOOK_SECRET: z.string().optional(),
  N8N_WEBHOOK_URL_TRABAJOS: z.string().optional(),
  ARCHIVOS_INTEGRACION_DIR: z.string().default('archivos/integraciones'),
});

export type EnvConfig = z.infer<typeof EnvSchema>;

/**
 * Valida las variables de entorno al arrancar NestJS (`ConfigModule.forRoot({ validate: validateEnv })`).
 * En entorno de pruebas unitarias (`NODE_ENV === 'test'`), provee valores sintéticos exclusivos de test
 * únicamente si no fueron inyectados por el runner, manteniendo bloqueo estricto en `development` y `production`.
 */
export function validateEnv(config: Record<string, unknown>): EnvConfig {
  const entorno = config.NODE_ENV === 'test' ? {
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test_db',
    COOKIE_SECRET: 'test_cookie_secret_key_with_at_least_32_chars',
    JWT_ACCESS_SECRET: 'test_jwt_access_secret_key_with_at_least_32_chars',
    JWT_REFRESH_SECRET: 'test_jwt_refresh_secret_key_with_at_least_32_chars',
    FINANCIAL_DATA_ENCRYPTION_KEY: 'test_financial_encryption_key_32_chars_min',
    ...config,
  } : config;

  const parsed = EnvSchema.safeParse(entorno);
  if (!parsed.success) {
    console.error('Error crítico de validación de variables de entorno:', parsed.error.issues);
    throw new Error('Variables de entorno inválidas o incompletas. Revise su archivo .env');
  }
  return parsed.data;
}
