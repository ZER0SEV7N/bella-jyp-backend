//test/common/interceptors/transform-response.interceptor.spec.ts
import { TransformResponseInterceptor } from '@/common/interceptors/transform-response.interceptors';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';

/**
 * Pruebas unitarias para el TransformResponseInterceptor.
 * Este interceptor se encarga de transformar las respuestas HTTP del backend, envolviendo la data y la metadata en una estructura consistente.
 * Se incluyen casos de prueba para diferentes códigos de estado HTTP (200, 201, 202, 204) y para respuestas paginadas.
 * También se verifica que la data se preserve correctamente y que los mensajes de metadata sean adecuados según el código de estado.
 */
describe('TransformResponseInterceptor - Pruebas Unitarias', () => {
    //Instancia del interceptor a probar
    let interceptor: TransformResponseInterceptor<any>;

    //Configuración inicial antes de cada prueba
    beforeEach(() => interceptor = new TransformResponseInterceptor());

    //Función auxiliar para crear un contexto de ejecución simulado con statusCode y url
    const createMockContext = (statusCode: number, url = '/api/rrhh/empleados'): ExecutionContext => {
        return {
            switchToHttp: jest.fn().mockReturnValue({
                getRequest: jest.fn().mockReturnValue({ url }),
                getResponse: jest.fn().mockReturnValue({ statusCode })
            })
        } as unknown as ExecutionContext;
    };

    //Función auxiliar para crear un CallHandler simulado que devuelve un observable con data
    const createMockCallHandler = (data: any): CallHandler => ({handle: jest.fn().mockReturnValue(of(data))});

    it('Debe transformar una respuesta estándar 200 OK envolviendo la data y la metadata', (done) => {
        //Arrange: Simulación de una respuesta HTTP 200 OK con data
        const mockData = { id: 'emp-1', nombre: 'Carlos' };
        const mockContext = createMockContext(200, '/api/rrhh/empleados/emp-1');
        const mockHandler = createMockCallHandler(mockData);

        //Act: Invocación del interceptor con el contexto y handler simulados
        interceptor.intercept(mockContext, mockHandler).subscribe({
        next: (result) => {
            //Assert: Verificación de que la respuesta transformada tenga la estructura esperada
            expect(result).toHaveProperty('data');
            expect(result).toHaveProperty('meta');
            expect(result.statusCode).toBe(200);
            expect(result.data).toEqual(mockData);
            expect(result.meta.message).toBe('Operación exitosa.');
            expect(result.meta.path).toBe('/api/rrhh/empleados/emp-1');
            expect(result.meta).toHaveProperty('timestamp');
            done();
        },
        });
    });

    it('Debe retornar mensajes adecuados para status codes 201, 202 y 204', (done) => {
        //Arrange: Simulación de una respuesta HTTP 201 Created con data
        const mockContext201 = createMockContext(201, '/api/rrhh/area');
        const mockHandler201 = createMockCallHandler({ id: 'area-1' });

        //Act: Invocación del interceptor con el contexto y handler simulados para 201 Created
        interceptor.intercept(mockContext201, mockHandler201).subscribe({
        next: (result) => {
            //Assert: Verificación de que la respuesta transformada tenga el mensaje adecuado para 201 Created
            expect(result.meta.message).toBe('Recurso creado o provisionado exitosamente.');
            done();
        }});
    });

    it('Debe retornar mensaje para status code 202 Accepted', (done) => {
        //Arrange: Simulación de una respuesta HTTP 202 Accepted con data
        const mockContext202 = createMockContext(202, '/api/rrhh/empleados/bulk/confirmar');
        const mockHandler202 = createMockCallHandler({ jobId: 'job-99' });

        //Act: Invocación del interceptor con el contexto y handler simulados para 202 Accepted
        interceptor.intercept(mockContext202, mockHandler202).subscribe({
        next: (result) => {
            //Assert: Verificación de que la respuesta transformada tenga el mensaje adecuado para 202 Accepted
            expect(result.meta.message).toBe('Petición aceptada para procesamiento en segundo plano.');
            done();
        }});
    });

    it('Debe retornar mensaje por defecto para status codes no mapeados (ej. 206)', (done) => {
        //Arrange: Simulación de una respuesta HTTP 206 Partial Content con data
        const mockContext = createMockContext(206, '/api/stream');
        const mockHandler = createMockCallHandler({ chunk: 1 });

        //Act: Invocación del interceptor con el contexto y handler simulados para 206 Partial Content
        interceptor.intercept(mockContext, mockHandler).subscribe({
        next: (result) => {
            //Assert: Verificación de que la respuesta transformada tenga el mensaje por defecto para status codes no mapeados
            expect(result.meta.message).toBe('Petición procesada.');
            done();
        }});
    });

    it('Debe preservar la estructura paginada { data, meta } cuando la respuesta ya posee paginación', (done) => {
        //Arrange: Simulación de una respuesta HTTP 200 OK con estructura paginada
        const paginatedData = {
            data: [{ id: 1 }, { id: 2 }],
            meta: {
                total: 2,
                page: 1,
                limit: 50,
                totalPages: 1
            }
        };

        const mockContext = createMockContext(200, '/api/rrhh/area?page=1');
        const mockHandler = createMockCallHandler(paginatedData);

        //Act: Invocación del interceptor con el contexto y handler simulados
        interceptor.intercept(mockContext, mockHandler).subscribe({
        next: (result) => {
            //Assert: Verificación de que la respuesta transformada preserve la estructura paginada y agregue el mensaje y path
            expect(result).toHaveProperty('data');
            expect(result).toHaveProperty('meta');
            expect(result.statusCode).toBe(200);
            expect(result.data).toEqual(paginatedData.data);
            expect(result.meta).toEqual(expect.objectContaining({
                total: 2,
                page: 1,
                limit: 50,
                totalPages: 1,
                message: 'Operación exitosa.',
                path: '/api/rrhh/area?page=1',
            }));
            done();
        }});
    });

    it('Debe asignar data como null si el handler devuelve falsy o undefined', (done) => {
        //Arrange: Simulación de una respuesta HTTP 204 No Content sin data
        const mockContext = createMockContext(204, '/api/rrhh/empleados/1');
        const mockHandler = createMockCallHandler(undefined);

        //Act: Invocación del interceptor con el contexto y handler simulados
        interceptor.intercept(mockContext, mockHandler).subscribe({
        next: (result) => {
            //Assert: Verificación de que la respuesta transformada tenga data como null y el mensaje adecuado para 204 No Content
            expect(result).toHaveProperty('data');
            expect(result).toHaveProperty('meta');
            expect(result.statusCode).toBe(204);
            expect(result.data).toBeNull();
            expect(result.meta.message).toBe('Operación exitosa sin contenido.');
            done();
        }});
    });
});