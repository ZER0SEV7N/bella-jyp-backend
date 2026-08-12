//src/common/config/env.validation.ts
//Validación de variables de entorno usando Zod
import { z } from 'zod';

//Esquema de validación para las variables de entorno
export const EnvSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.string().default('3000'),
  DATABASE_URL: z.string().url(),
  JWT_ACCESS_SECRET: z
    .string()
    .min(32, 'La clave secreta debe tener al menos 32 caracteres'),
  JWT_REFRESH_SECRET: z
    .string()
    .min(32, 'La clave secreta debe tener al menos 32 caracteres'),
});

export function validateEnv(config: Record<string, unknown>) {
  const parsed = EnvSchema.safeParse(config);
  if (!parsed.success) {
    console.error('Error de validación de variables de entorno:', parsed.error.format());
    throw new Error('Variables de entorno inválidas');
  }
  return parsed.data;
}
