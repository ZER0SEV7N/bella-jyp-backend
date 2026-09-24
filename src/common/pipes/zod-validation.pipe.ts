//src/common/pipes/zod-validation.pipe.ts
//Pipe de validación usando Zod para validar los datos entrantes en los endpoints
import { PipeTransform, ArgumentMetadata, BadRequestException, Injectable } from '@nestjs/common';
/**
 * Interfaz de tipado estructural (Duck Typing) que acepta cualquier esquema Zod
 * (Zod 3, Zod 4, ZodObject, ZodEffects, etc.), resolviendo incompatibilidades
 * entre versiones o paquetes compartidos (@jyp/shared-contracts).
 */
export interface ZodSchemaLike {
  safeParse(data: unknown): {
    success: boolean;
    data?: any;
    error?: any;
  };
}

/**
 * Pipe de validación basado en esquemas Zod.
 * Sanitiza y purifica payloads entrantes en `body` y `query` según el contrato estricto de la API.
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  /**
   * Recibe cualquier esquema Zod mediante la interfaz estructural ZodSchemaLike,
   * garantizando compatibilidad con esquemas complejos de @jyp/shared-contracts.
   */
  constructor(private readonly schema: ZodSchemaLike) {}

  transform(value: unknown, metadata: ArgumentMetadata) {
    // Excluir parámetros de ruta (solo validamos Body y Query)
    if (metadata.type !== 'body' && metadata.type !== 'query') {
      return value;
    }

    // Asegura que valores null o undefined pasen como {} para que Zod valide campos requeridos
    const dataToValidate = value ?? {};
    const parsedValue = this.schema.safeParse(dataToValidate);

    if (!parsedValue.success) {
      const fieldErrors =
        parsedValue.error?.flatten?.()?.fieldErrors ??
        parsedValue.error;

      throw new BadRequestException({
        type: 'https://api.jyp.com/errors/validation',
        title: 'Payload Inválido',
        status: 400,
        detail: 'Los datos enviados no cumplen con el contrato estricto del sistema.',
        instance: metadata.type,
        errores: fieldErrors,
      });
    }

    // Retorna la data purificada y tipada por Zod
    return parsedValue.data;
  }
}
