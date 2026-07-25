//src/modules/RRHH/use-cases/empleado/crearEmpleado.UseCase.ts
//Caso de uso para crear un empleado en el módulo de RRHH
import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { IdentityGenerator } from '@/common/utils/uuid.util';
import { ReniecAdapter } from '../../services/reniec.adapter';
import type { CrearEmpleadoDto } from '@jyp/shared-contracts';

//Caso de uso
@Injectable()
export class CrearEmpleadoUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reniecAdapter: ReniecAdapter
  ) {}

  async execute(dto: CrearEmpleadoDto) {
    try {
      //Buscar si ya existe un empleado con el mismo número de documento
      const empleadoExistente = await this.prisma.empleados.findUnique({ where: { nro_documento: dto.nro_documento } });

      if (empleadoExistente) throw new BadRequestException({
        title: 'Documento Duplicado',
        detail: `Ya existe un colaborador registrado con el documento ${dto.nro_documento}.`,
      });

      let nombreFinal = dto.nombre;
      let apellidoFinal = dto.apellido;

      //Si no nos enviaron el nombre o el apellido y parece ser un DNI (8 dígitos)
      if ((!nombreFinal || !apellidoFinal) && dto.nro_documento.length === 8) {
        try {
          const ciudadano = await this.reniecAdapter.consultarDni(dto.nro_documento);
          nombreFinal = ciudadano.nombre;
          apellidoFinal = `${ciudadano.apellido_paterno} ${ciudadano.apellido_materno}`.trim();
        } catch (error) {
          //Si RENIEC falla, no detenemos el proceso, pero enviamos el error hacia el FrontEnd
          throw new BadRequestException({
            title: 'Fallo de Verificación de Identidad',
            detail: 'No se pudo auto-completar los datos mediante RENIEC. Por favor, ingrese el nombre manualmente o intente de nuevo.',
          });
        }
      }

      //Generar un nuevo ID para el empleado utilizando la utilidad IdentityGenerator
      const nuevoId = IdentityGenerator.generateId();

      const nuevoEmpleado = await this.prisma.empleados.create({
        data: {
          id: nuevoId,
          cargo_id: dto.cargo_id,
          area_id: dto.area_id,
          documento_id: dto.documento_id,
          estado_empleado_id: dto.estado_empleado_id,
          nro_documento: dto.nro_documento,
          nombre: nombreFinal,
          apellido: apellidoFinal,
          fecha_nacimiento: dto.fecha_nacimiento ? new Date(dto.fecha_nacimiento) : null,
          fecha_inicio: dto.fecha_inicio ? new Date(dto.fecha_inicio) : null,
          asig_familiar: dto.asig_familiar,
          activo: true,
          estado_sincronizacion: 'COMPLETO',
        },
      });

      return nuevoEmpleado;

    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      
      throw new BadRequestException({
        title: 'Error al Registrar Colaborador',
        detail: 'Fallo interno en la base de datos al intentar crear el legajo.',
      });
    }
  }
}