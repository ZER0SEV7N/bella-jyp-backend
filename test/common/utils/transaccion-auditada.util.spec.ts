import { Prisma } from '@prisma/client';
import { PrismaService } from '@/common/prisma/prisma.service';
import { bloquearEmpleado, transaccionAuditada } from '@/common/utils/transaccion-auditada.util';

describe('transaccionAuditada - Atomicidad y concurrencia', () => {
    const actor = { id: 'usuario-demo', ip: '127.0.0.1' };

    it('Debe registrar el actor antes del trabajo y usar aislamiento Serializable', async () => {
        // Arrange: simular una única transacción sin abrir una conexión real.
        const tx = { $executeRaw: jest.fn().mockResolvedValue(1) };
        const prisma = {
            $transaction: jest.fn(
                async (trabajo: (cliente: unknown) => Promise<unknown>) =>
                    trabajo(tx)
            ),
        };
        const trabajo = jest.fn(async () => 'guardado');
        // Act: ejecutar el trabajo auditado.
        const resultado = await transaccionAuditada(
            prisma as unknown as PrismaService,
            actor,
            trabajo
        );
        // Assert: la identificación y el trabajo comparten el cliente transaccional.
        expect(resultado).toBe('guardado');
        expect(trabajo).toHaveBeenCalledWith(tx);
        expect(tx.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
            trabajo.mock.invocationCallOrder[0]
        );
        expect(prisma.$transaction).toHaveBeenCalledWith(
            expect.any(Function),
            expect.objectContaining({ isolationLevel: 'Serializable' })
        );
        expect(tx.$executeRaw.mock.calls[0].slice(1)).toEqual([
            actor.id,
            actor.ip,
        ]);
    });

    it('Debe reintentar una colisión P2034 y limitarla a tres intentos', async () => {
        // Arrange: PostgreSQL comunica un conflicto de serialización en cada intento.
        const error = new Prisma.PrismaClientKnownRequestError('Conflicto', {
            code: 'P2034',
            clientVersion: 'test',
        });
        const prisma = { $transaction: jest.fn().mockRejectedValue(error) };
        // Act: diferir la operación para comprobar el rechazo.
        const operacion = transaccionAuditada(
            prisma as unknown as PrismaService,
            actor,
            jest.fn()
        );
        // Assert: no reintentar indefinidamente ni ocultar la excepción original.
        await expect(operacion).rejects.toBe(error);
        expect(prisma.$transaction).toHaveBeenCalledTimes(3);
    });

    it('Debe propagar un fallo técnico sin reintentar', async () => {
        // Arrange: simular una desconexión que no es un conflicto serializable.
        const error = new Error('Conexión interrumpida');
        const prisma = { $transaction: jest.fn().mockRejectedValue(error) };
        // Act: solicitar la transacción.
        const operacion = transaccionAuditada(
            prisma as unknown as PrismaService,
            actor,
            jest.fn()
        );
        // Assert: el llamador recibe el fallo técnico una sola vez.
        await expect(operacion).rejects.toBe(error);
        expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('Debe bloquear por empleado usando parámetros SQL, sin concatenarlos al comando', async () => {
        // Arrange: cliente transaccional mockeado.
        const tx = { $executeRaw: jest.fn().mockResolvedValue(1) };
        // Act: adquirir el bloqueo lógico del empleado.
        await bloquearEmpleado(
            tx as unknown as Prisma.TransactionClient,
            'empleado-demo'
        );
        // Assert: la clave va como parámetro y distingue a cada empleado.
        expect(tx.$executeRaw.mock.calls[0][1]).toBe(
            'asistencia:empleado-demo'
        );
    });
});
