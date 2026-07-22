import { Injectable } from '@nestjs/common';
import { CLS_USER_ID, CLS_IP_ADDRESS } from '@/common/cls/cls.constants';
import { PrismaService } from '@/common/prisma/prisma.service';
import { auditLogSchema, dtoAuditLog } from '@jyp/shared-contracts';
import { ClsService } from 'nestjs-cls';
@Injectable()
export class AuditCreateUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
  ) {}
  async execute(dto: dtoAuditLog) {
    //obtener los datos de usuario mediante interceptor
    const id_usuario = this.cls.get<string | null>(CLS_USER_ID);
    const id_ip = this.cls.get<string | null>(CLS_IP_ADDRESS);
    //validacion con zod
    const dataValidad = auditLogSchema.parse(dto);
    //ejecucion del prisma
    await this.prisma.audit_log.create({
      data: {
        id: crypto.randomUUID(),
        usuario_id: id_usuario,
        direccion_ip: id_ip,
        accion: dataValidad.accion,
        registro_id: dataValidad.registro_id,
        tabla_afectada: dataValidad.tabla_afectada,
        valores_antes: dataValidad.valores_antes,
        valores_despues: dataValidad.valores_despues,
      },
    });
    return true;
  }
}
