import { AuditContextInterceptor } from '@/common/interceptors/audit-context.interceptor';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { of } from 'rxjs';
import { CLS_USER_ID, CLS_IP_ADDRESS } from '@/common/cls/cls.constants';

describe('AuditContextInterceptor - Pruebas Unitarias', () => {
    let interceptor: AuditContextInterceptor;
    let mockClsService: jest.Mocked<ClsService>;

    beforeEach(() => {
        mockClsService = {
            set: jest.fn(),
            get: jest.fn()
        } as unknown as jest.Mocked<ClsService>;

        interceptor = new AuditContextInterceptor(mockClsService);
    });

    const createMockContext = (requestData: any): ExecutionContext => {
        return {
            switchToHttp: jest.fn().mockReturnValue({getRequest: jest.fn().mockReturnValue(requestData)})
        } as unknown as ExecutionContext;
    };

    const createMockCallHandler = (): CallHandler => ({handle: jest.fn().mockReturnValue(of({ success: true }))});

    it('Debe extraer userId e IP de la petición y guardarlos en ClsService', (done) => {
        const mockRequest = {
            user: { id: 'user-uuid-123' },
            ip: '192.168.1.50',
            headers: {},
        };

            const mockContext = createMockContext(mockRequest);
            const mockHandler = createMockCallHandler();

            interceptor.intercept(mockContext, mockHandler).subscribe({
            next: (result) => {
                expect(mockClsService.set).toHaveBeenCalledWith(CLS_USER_ID, 'user-uuid-123');
                expect(mockClsService.set).toHaveBeenCalledWith(CLS_IP_ADDRESS, '192.168.1.50');
                expect(result).toEqual({ success: true });
                done();
            }
        });
    });

    it('Debe asignar null a userId cuando el objeto user no existe en la petición', (done) => {
        const mockRequest = {
            user: undefined,
            ip: '10.0.0.1',
            headers: {}
        };

        const mockContext = createMockContext(mockRequest);
        const mockHandler = createMockCallHandler();

        interceptor.intercept(mockContext, mockHandler).subscribe({
            next: () => {
                expect(mockClsService.set).toHaveBeenCalledWith(CLS_USER_ID, null);
                expect(mockClsService.set).toHaveBeenCalledWith(CLS_IP_ADDRESS, '10.0.0.1');
                done();
            }});
    });

    it('Debe usar la cabecera x-forwarded-for si req.ip no está presente', (done) => {
        const mockRequest = {
            user: { id: 'user-456' },
            ip: undefined,
            headers: { 'x-forwarded-for': '203.0.113.195' }
        };

            const mockContext = createMockContext(mockRequest);
            const mockHandler = createMockCallHandler();

            interceptor.intercept(mockContext, mockHandler).subscribe({
            next: () => {
                expect(mockClsService.set).toHaveBeenCalledWith(CLS_IP_ADDRESS, '203.0.113.195');
                done();
            }});
    });

    it('Debe usar la IP por defecto 127.0.0.1 si req.ip y x-forwarded-for no existen', (done) => {
        const mockRequest = {
            ip: undefined,
            headers: {}
        };

        const mockContext = createMockContext(mockRequest);
        const mockHandler = createMockCallHandler();

        interceptor.intercept(mockContext, mockHandler).subscribe({
        next: () => {
            expect(mockClsService.set).toHaveBeenCalledWith(CLS_IP_ADDRESS, '127.0.0.1');
            done();
        }});
    });
});