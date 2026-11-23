//src/common/pipes/zod-validation.pipe.ts
//Pipe de validación usando Zod para validar los datos entrantes en los endpoints
import {
  PipeTransform,
  ArgumentMetadata,
  BadRequestException,
  Injectable,
} from '@nestjs/common';
/**
 * Interfaz de tipado estructural (Duck Typing) que acepta cualquier esquema Zod
 * (Zod 3, Zod 4, ZodObject, ZodEffects, etc.), resolviendo incompatibilidades
 * entre versiones o paquetes compartidos (@jyp/shared-contracts).
 */
export interface ZodSchemaLike {
  safeParse(data: unknown): {
    success: boolean;
    data?: unknown;
    error?: unknown;
  };
}

/**
 * Extrae `fieldErrors` si el error de Zod expone `.flatten()`; en caso contrario devuelve el error tal cual.
 */
function extraerErroresZod(error: unknown): unknown {
  if (
    typeof error === 'object' &&
    error !== null &&
    'flatten' in error &&
    typeof (error as { flatten?: unknown }).flatten === 'function'
  ) {
    const flattened = (
      error as { flatten: () => { fieldErrors?: unknown } }
    ).flatten();
    if (
      typeof flattened === 'object' &&
      flattened !== null &&
      'fieldErrors' in flattened
    ) {
      return flattened.fieldErrors;
    }
  }
  return error;
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
  constructor(
    private readonly schema: ZodSchemaLike,
    private readonly preservarCamposParciales = false,
    //Con `@Param()` (el objeto completo) permite validar los parámetros de ruta con el mismo esquema.
    private readonly validarParametrosRuta = false
  ) {}

  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    // Los parámetros de ruta solo se validan si el pipe lo pide expresamente; Body y Query siempre
    const validaRuta = this.validarParametrosRuta && metadata.type === 'param';
    if (metadata.type !== 'body' && metadata.type !== 'query' && !validaRuta) {
      return value;
    }

    // Asegura que valores null o undefined pasen como {} para que Zod valide campos requeridos
    const dataToValidate = value ?? {};
    const parsedValue = this.schema.safeParse(dataToValidate);

    // Si la validación falla, lanzamos una excepción BadRequestException con detalles del error
    if (!parsedValue.success) {
      const fieldErrors = extraerErroresZod(parsedValue.error);

      throw new BadRequestException({
        type: 'https://api.jyp.com/errors/validation',
        title: 'Payload Inválido',
        status: 400,
        detail:
          'Los datos enviados no cumplen con el contrato estricto del sistema.',
        instance: metadata.type,
        errores: fieldErrors,
      });
    }

    const data = parsedValue.data;

    // Retorna la data purificada y tipada por Zod
    if (
      this.preservarCamposParciales &&
      metadata.type === 'body' &&
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      typeof data === 'object' &&
      data !== null
    ) {
      const recordData = data as Record<string, unknown>;
      return Object.fromEntries(
        Object.keys(value)
          .filter((key) => Object.hasOwn(recordData, key))
          .map((key) => [key, recordData[key]])
      );
    }

    return data;
  }
}
