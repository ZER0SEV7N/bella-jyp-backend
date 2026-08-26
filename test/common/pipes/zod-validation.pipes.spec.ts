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
  //Definir el schema de prueba usando Zod para validar un payload de ejemplo
  const TestSchema = z.object({
    email: z.string().email('Correo inválido'),
    edad: z.number().min(18, 'Debe ser mayor de edad')
  });

  let pipe: ZodValidationPipe;

  //Inicializar el pipe antes de cada prueba, asegurando un estado limpio para cada caso de prueba
  beforeEach(() => pipe = new ZodValidationPipe(TestSchema));

  describe('transform() - Filtrado de Metadatos', () => {
    it('Debe omitir la validación y retornar el valor intacto si el metadato no es "body" ni "query"', () => {
      //Arrange: Definir metadatos de prueba que no sean "body" ni "query"
      const metadataParam: ArgumentMetadata = { type: 'param', metatype: String, data: 'id' };
      const rawValue = '018f4a3c-7b2a-7123-8901-0123456789ab';

      //Act: Llamar al método transform del pipe con los metadatos y valor de prueba
      const result = pipe.transform(rawValue, metadataParam);

      //Assert: Verificar que el valor retornado sea el mismo que el valor de entrada, sin modificaciones
      expect(result).toBe(rawValue);
    });
  });

  describe('transform() - Validación de Body y Query Params', () => {
    it('Debe purificar y retornar los datos si cumplen con el esquema Zod', () => {
      //Arrange: Definir metadatos de tipo "body" y un payload válido que cumpla con el esquema Zod
      const metadataBody: ArgumentMetadata = { type: 'body' };
      const validPayload = { email: 'juan.perez@empresa.com', edad: 25 };

      //Act: Llamar al método transform del pipe con los metadatos y payload válido
      const result = pipe.transform(validPayload, metadataBody);

      //Assert: Verificar que el resultado sea igual al payload válido, confirmando que la validación y purificación fueron exitosas
      expect(result).toEqual(validPayload);
    });

    it('Debe lanzar BadRequestException formateado según RFC 7807 ante payloads inválidos', () => {
      //Arrange: Definir metadatos de tipo "body" y un payload inválido que no cumpla con el esquema Zod
      const metadataBody: ArgumentMetadata = { type: 'body' };
      const invalidPayload = { email: 'correo-invalido', edad: 15 };

      //Act & Assert: Llamar al método transform del pipe y esperar que lance una excepción BadRequestException
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
          instance: 'body',
          detail: 'Los datos enviados no cumplen con el contrato estricto del sistema.'
        });
        expect(response.errores).toHaveProperty('email');
        expect(response.errores).toHaveProperty('edad');
      }
    });
  });
});