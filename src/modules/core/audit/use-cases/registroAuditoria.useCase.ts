//src/modules/core/audit/use-cases/RegistroAuditoria.useCase.ts
//Caso de uso para registrar auditoría en el sistema
import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { CLS_USER_ID, CLS_IP_ADDRESS } from '@/common/cls/cls.constants';
import { PrismaService } from '@/common/prisma/prisma.service';
import { AuditLogDto } from '@jyp/shared-contracts';
import { ClsService } from 'nestjs-cls';
import { IdentityGenerator } from '@/common/utils/uuid.util';

/**
 * Caso de uso para registrar auditoría en el sistema.
 * Este caso de uso permite registrar logs de auditoría en la base de datos,
 * incluyendo información sobre el usuario que realiza la acción, la acción realizada,
 * la tabla afectada, los valores antes y después de la acción, y la dirección IP del usuario.
 */
@Injectable()
export class RegistroAuditoriaUseCase {
  private readonly logger = new Logger(RegistroAuditoriaUseCase.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
  ) {}

  /**
   * Registra un log de auditoría en la base de datos.
   * @param payload - Objeto que contiene la información del log de auditoría a registrar.
   * @returns El log de auditoría registrado en la base de datos.
   * @throws InternalServerErrorException si ocurre un error al registrar el log de auditoría.
   */
  async execute(payload: AuditLogDto) {
    try {
      const userId = this.cls.get(CLS_USER_ID) || null;
      const ipAddress = this.cls.get(CLS_IP_ADDRESS) || '127.0.0.1';
      const cloneAuditValue = <T>(value: T): T => {
        if (value === undefined || value === null) 
          return value;
        
        if (typeof structuredClone === 'function') 
          return structuredClone(value);
        

        return structuredClone(value);
      };

      const auditLog = await this.prisma.audit_log.create({
        data: {
          id: IdentityGenerator.generateId(),
          usuario_id: userId,
          accion: payload.accion,
          tabla_afectada: payload.tabla_afectada,
          registro_id: payload.registro_id,
          valores_antes: payload.valores_antes ? cloneAuditValue(payload.valores_antes) : null,
          valores_despues: payload.valores_despues ? cloneAuditValue(payload.valores_despues) : null,
          direccion_ip: ipAddress,
        },
      });

      return auditLog;
     } catch (error) {
      this.logger.error('No se pudo registrar la auditoría manual.', error);
      throw new InternalServerErrorException({title: 'Fallo de Auditoría Manual', detail: 'No se pudo guardar el rastro del sistema.'});
    }
  }
}
