//src/modules/audit/auditar.useCase.ts
//Caso de uso para registrar auditoría en el sistema
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { CLS_USER_ID, CLS_IP_ADDRESS } from '@/common/cls/cls.constants';
import { PrismaService } from '@/common/prisma/prisma.service';
import { AuditLogDto } from '@jyp/shared-contracts';
import { ClsService } from 'nestjs-cls';
import { IdentityGenerator } from '@/common/utils/uuid.util';

@Injectable()
export class AuditCreateUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
  ) {}
  /**
   * Ejecuta un registro manual de auditoría para operaciones no transaccionales.
   * Útil para rastrear consultas (SELECTs) críticas, descargas de reportes o exports a PLAME.
   */
  async execute(payload: AuditLogDto) {
    try {
      const userId = this.cls.get(CLS_USER_ID) || null;
      const ipAddress = this.cls.get(CLS_IP_ADDRESS) || '127.0.0.1';

      const auditLog = await this.prisma.audit_log.create({
        data: {
          id: IdentityGenerator.generateId(),
          usuario_id: userId,
          accion: payload.accion,
          tabla_afectada: payload.tabla_afectada,
          registro_id: payload.registro_id,
          valores_antes: payload.valores_antes
            ? JSON.parse(JSON.stringify(payload.valores_antes))
            : null,
          valores_despues: payload.valores_despues
            ? JSON.parse(JSON.stringify(payload.valores_despues))
            : null,
          direccion_ip: ipAddress,
        },
      });

      return auditLog;
    } catch (error) {
      throw new InternalServerErrorException({
        title: 'Fallo de Auditoría Manual',
        detail: 'No se pudo guardar el rastro del sistema.',
      });
    }
  }
}
