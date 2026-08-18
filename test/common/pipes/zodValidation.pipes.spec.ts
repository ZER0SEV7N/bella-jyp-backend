//test/common/pipes/zodValidation.pipes.spec.ts
import { BadRequestException, ArgumentMetadata } from '@nestjs/common';
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe';
import { z } from 'zod';

/**
 * Pruebas unitarias para el ZodValidationPipe.
 * Estas pruebas validan el comportamiento del pipe de validación basado en Zod, 
 * asegurando que los datos entrantes cumplan con los esquemas definidos.
 * Se incluyen pruebas para verificar la omisión de validación en metadatos no relevantes, 
 * la validación exitosa de payloads válidos y el manejo adecuado de errores para payloads inválidos.
 * Se asegura que los errores sean formateados según RFC 7807, proporcionando detalles claros sobre las violaciones de contrato.
 */
describe('ZodValidationPipe - Pruebas Unitarias de Sanitización JIT', () => {
    const TestSchema = z.object({
      email: z.string().email('Correo inválido'),
      edad: z.number().min(18, 'Debe ser mayor de edad')
    });

    let pipe: ZodValidationPipe;

    beforeEach(() => pipe = new ZodValidationPipe(TestSchema));

    describe('transform() - Filtrado de Metadatos', () => {
      it('Debe omitir la validación y retornar el valor intacto si el metadato no es "body" ni "query"', () => {
        const metadataParam: ArgumentMetadata = { type: 'param', metatype: String, data: 'id' };
        const rawValue = '018f4a3c-7b2a-7123-8901-0123456789ab';

        const result = pipe.transform(rawValue, metadataParam);

        expect(result).toBe(rawValue);
      });
    });

    describe('transform() - Validación de Body y Query Params', () => {
      it('Debe purificar y retornar los datos si cumplen con el esquema Zod', () => {
        const metadataBody: ArgumentMetadata = { type: 'body' };
        const validPayload = { email: 'juan.perez@empresa.com', edad: 25 };

        const result = pipe.transform(validPayload, metadataBody);

        expect(result).toEqual(validPayload);
      });

      it('Debe lanzar BadRequestException formateado según RFC 7807 ante payloads inválidos', () => {
        const metadataBody: ArgumentMetadata = { type: 'body' };
        const invalidPayload = { email: 'correo-invalido', edad: 15 };

        try {
          pipe.transform(invalidPayload, metadataBody);
          fail('Se esperaba que la validación fallara');
        } catch (error) {
          expect(error).toBeInstanceOf(BadRequestException);
          const response = (error as BadRequestException).getResponse() as any;

          expect(response).toMatchObject({
            type: 'https://api.jyp.com/errors/validation',
            title: 'Payload Inválido',
            status: 400,
            detail: 'Los datos enviados no cumplen con el contrato estricto del sistema.'
          });
          expect(response.errores).toHaveProperty('email');
          expect(response.errores).toHaveProperty('edad');
        }
      });
    });
});