//src/common/pipes/zod-validation.pipe.ts
//Pipe de validación usando Zod para validar los datos entrantes en los endpoints
import {
  PipeTransform,
  ArgumentMetadata,
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { ZodType } from 'zod';

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  //Inyección del contrato base
  constructor(private readonly schema: any) {}

  transform(value: unknown, metadata: ArgumentMetadata) {
    //Excluir parámetros de ruta o query params (solo validamos el Body)
    if (metadata.type !== 'body' && metadata.type !== 'query') return value;

    //Validar el valor entrante usando el esquema Zod proporcionado
    const dataToValidate = value || {};
    const parsedValue = this.schema.safeParse(dataToValidate);

    if (!parsedValue.success) {
      throw new BadRequestException({
        type: 'https://api.jyp.com/errors/validation',
        title: 'Payload Inválido',
        status: 400,
        detail:'Los datos enviados no cumplen con el contrato estricto del sistema.',
        errores: parsedValue.error.flatten().fieldErrors
      });
    }

    // Retorna la data purificada y tipada
    return parsedValue.data;
  }
}
