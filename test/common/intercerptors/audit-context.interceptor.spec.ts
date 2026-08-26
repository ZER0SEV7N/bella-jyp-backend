//test/common/interceptors/audit-context.interceptor.spec.ts
import { AuditContextInterceptor } from '@/common/interceptors/audit-context.interceptor';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { of } from 'rxjs';
import { CLS_USER_ID, CLS_IP_ADDRESS } from '@/common/cls/cls.constants';

/**
 * Pruebas unitarias para el AuditContextInterceptor.
 * Este interceptor captura el contexto de auditoría (usuario e IP) en cada solicitud HTTP y lo almacena en un contexto aislado usando ClsService.
 * Las pruebas verifican que el interceptor extraiga correctamente el userId y la dirección IP de la solicitud y los almacene en ClsService.
 */
describe('AuditContextInterceptor - Pruebas Unitarias', () => {
    let interceptor: AuditContextInterceptor;
    let mockClsService: jest.Mocked<ClsService>;

    //Configuración inicial antes de cada prueba
    beforeEach(() => {
        mockClsService = {
            set: jest.fn(),
            get: jest.fn()
        } as unknown as jest.Mocked<ClsService>;

        interceptor = new AuditContextInterceptor(mockClsService);
    });

    //Función auxiliar para crear un contexto de ejecución simulado
    const createMockContext = (requestData: any): ExecutionContext => {
        return {switchToHttp: jest.fn().mockReturnValue({getRequest: jest.fn().mockReturnValue(requestData)})} as unknown as ExecutionContext;
    };

    //Función auxiliar para crear un CallHandler simulado
    const createMockCallHandler = (): CallHandler => ({handle: jest.fn().mockReturnValue(of({ success: true }))});

    it('Debe extraer userId e IP de la petición y guardarlos en ClsService', (done) => {
        //Arrange: Simulación de una solicitud HTTP con objeto user y dirección IP
        const mockRequest = {
            user: { id: 'user-uuid-123' },
            ip: '192.168.1.50',
            headers: {}
        };

        //Creación de un contexto de ejecución y un CallHandler simulados
        const mockContext = createMockContext(mockRequest);
        const mockHandler = createMockCallHandler();

        //Act: Invocación del interceptor con el contexto y handler simulados
        interceptor.intercept(mockContext, mockHandler).subscribe({
            next: (result) => {
                //Assert: Verificación de que ClsService.set fue llamado con los valores correctos y que el resultado del handler es el esperado
                expect(mockClsService.set).toHaveBeenCalledWith(CLS_USER_ID, 'user-uuid-123');
                expect(mockClsService.set).toHaveBeenCalledWith(CLS_IP_ADDRESS, '192.168.1.50');
                expect(result).toEqual({ success: true });
                done();
            }});
    });

    it('Debe asignar null a userId cuando el objeto user no existe en la petición', (done) => {
        //Arrange: Simulación de una solicitud HTTP sin objeto user
        const mockRequest = {
            user: undefined,
            ip: '10.0.0.1',
            headers: {}
        };

        //Creación de un contexto de ejecución y un CallHandler simulados
        const mockContext = createMockContext(mockRequest);
        const mockHandler = createMockCallHandler();

        //Act: Invocación del interceptor con el contexto y handler simulados
        interceptor.intercept(mockContext, mockHandler).subscribe({
            next: () => {
                //Assert: Verificación de que ClsService.set fue llamado con null para userId y con la IP correcta
                expect(mockClsService.set).toHaveBeenCalledWith(CLS_USER_ID, null);
                expect(mockClsService.set).toHaveBeenCalledWith(CLS_IP_ADDRESS, '10.0.0.1');
                done();
            }});
    });

    it('Debe usar la cabecera x-forwarded-for si req.ip no está presente', (done) => {
        //Arrange: Simulación de una solicitud HTTP sin req.ip pero con cabecera x-forwarded-for
        const mockRequest = {
            user: { id: 'user-456' },
            ip: undefined,
            headers: { 'x-forwarded-for': '203.0.113.195' }
        };

        //Creación de un contexto de ejecución y un CallHandler simulados
        const mockContext = createMockContext(mockRequest);
        const mockHandler = createMockCallHandler();

        //Act: Invocación del interceptor con el contexto y handler simulados
        interceptor.intercept(mockContext, mockHandler).subscribe({
            next: () => {
                //Assert: Verificación de que ClsService.set fue llamado con los valores correctos y que la IP se extrajo de la cabecera
                expect(mockClsService.set).toHaveBeenCalledWith(CLS_USER_ID, 'user-456');
                expect(mockClsService.set).toHaveBeenCalledWith(CLS_IP_ADDRESS, '203.0.113.195');
                done();
            }});
    });

    it('Debe usar la IP por defecto 127.0.0.1 si req.ip y x-forwarded-for no existen', (done) => {
        //Arrange: Simulación de una solicitud HTTP sin req.ip y sin cabecera x-forwarded-for
        const mockRequest = {
            ip: undefined,
            headers: {}
        };

        //Creación de un contexto de ejecución y un CallHandler simulados
        const mockContext = createMockContext(mockRequest);
        const mockHandler = createMockCallHandler();

        //Act: Invocación del interceptor con el contexto y handler simulados
        interceptor.intercept(mockContext, mockHandler).subscribe({
            next: () => {
                //Assert: Verificación de que ClsService.set fue llamado con la IP por defecto
                expect(mockClsService.set).toHaveBeenCalledWith(CLS_IP_ADDRESS, '127.0.0.1');
                done();
            }});
    });
});