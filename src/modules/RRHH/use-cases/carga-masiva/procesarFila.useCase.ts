import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { ReniecAdapter } from '../../services/reniec.adapter';
import { CargaMasivaFilaDTO } from '@jyp/shared-contracts';
import { IdentityGenerator } from '@/common/utils/uuid.util';
@Injectable()
export class ProcesarFilaEmpleadoUseCase {
  private readonly logger = new Logger(ProcesarFilaEmpleadoUseCase.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly reniecAdapter: ReniecAdapter,
  ) {}

  /**
   * Ejecuta el Upsert (Actualizar o Crear) de un empleado basado en el DNI.
   * Operación atómica gobernada por la extensión de auditoría de Prisma.
   */
  async execute(fila: CargaMasivaFilaDTO, jobId: string): Promise<void> {
    let nombreValidado = fila.nombre || null;
    let apellidoValidado = fila.apellido || null;
    let estadoLegajo = 'COMPLETO'; //Asumimos éxito inicial

    //Si el CSV no trae nombres, intentamos obtenerlos de RENIEC
    if (!nombreValidado || !apellidoValidado) {
      try {
        const ciudadano = await this.reniecAdapter.consultarDni(
          fila.nro_documento,
        );
        nombreValidado = ciudadano.nombre;
        apellidoValidado = `${ciudadano.apellido_paterno} ${ciudadano.apellido_materno}`;
      } catch (error) {
        this.logger.warn(
          `Degradando legajo ${fila.nro_documento} a BORRADOR. RENIEC inaccesible.`,
        );
        //El empleado se guarda, pero RRHH tendrá que revisarlo manualmente
        estadoLegajo = 'BORRADOR';
      }
    }

    //Si a pesar de RENIEC seguimos sin nombre, la fila es estructuralmente inválida
    if (!nombreValidado || !apellidoValidado)
      throw new Error(
        `Imposible registrar DNI ${fila.nro_documento}: Nombres ausentes y RENIEC inoperativo.`,
      );

    //Persistencia Transaccional (Upsert para garantizar Idempotencia)
    await this.prisma.empleados.upsert({
      where: { nro_documento: fila.nro_documento },
      update: {
        area_id: fila.area_id,
        cargo_id: fila.cargo_id,
        asig_familiar: fila.asig_familiar,
      },
      create: {
        id: IdentityGenerator.generateId(),
        documento_id: fila.tipo_documento,
        nro_documento: fila.nro_documento,
        nombre: nombreValidado,
        apellido: apellidoValidado,
        area_id: fila.area_id,
        cargo_id: fila.cargo_id,
        asig_familiar: fila.asig_familiar,
        estado_empleado_id: estadoLegajo, // Ajustado a tu schema real
        activo: true,
      },
    });
  }
}
