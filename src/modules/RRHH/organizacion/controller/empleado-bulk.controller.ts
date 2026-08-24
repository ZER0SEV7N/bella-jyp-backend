//src/modules/RRHH/controller/empleado-bulk.controller.ts
//Controlador para manejar la carga masiva de empleados desde un archivo CSV
//Importaciones necesarias para el controlador
import {Controller, Post, Req, Res, UseGuards, BadRequestException, HttpStatus, Get, Param, Body } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { JwtAccessGuard } from '@/common/guards/jwt-access.guard';
import { CLS_USER_ID } from '@/common/cls/cls.constants';
import { IdentityGenerator } from '@/common/utils/uuid.util';
//Use-Cases para la carga masiva de empleados
import { ConsultarEstadoCargaMasivaUseCase } from '@/modules/RRHH/organizacion/use-cases/carga-masiva/consultarEstadoCargaMasiva.useCase';
import { ValidarCargaMasivaUseCase } from '../use-cases/carga-masiva/validarCargaMasiva.useCase';
import { ConfirmarCargaMasivaUseCase } from '../use-cases/carga-masiva/confirmarCargaMasiva.useCase';
import type { ConfirmarCargaMasivaDTO } from '../use-cases/carga-masiva/confirmarCargaMasiva.useCase';
//Importaciones para la inyección de dependencias y servicios
import { ClsService } from 'nestjs-cls';
import {
  ApiSwaggerEmpleadosBulkController,
  ApiSwaggerGetBulkStatus,
  ApiSwaggerDownloadTemplate,
} from '../decorators/empleado-bulk-swagger.decorator';

/**
 * Controlador para manejar la carga masiva de empleados desde un archivo CSV.
 * Este controlador expone dos endpoints:
 * 1. GET /api/rrhh/empleados/bulk/:jobId: Para consultar el estado del procesamiento del archivo CSV.
 * 2. GET /api/rrhh/empleados/bulk/plantilla: Para descargar un archivo CSV de plantilla para la carga masiva.
 * 3. POST /api/rrhh/empleados/bulk/validar: Para validar un archivo CSV antes de su procesamiento.
 * 4. POST /api/rrhh/empleados/bulk/confirmar: Para confirmar el procesamiento de las filas pre-validadas.
 * 
 * El controlador utiliza JWT y roles para proteger los endpoints, permitiendo el acceso solo a usuarios con roles 'ADMIN' o 'RRHH'.
 * La carga masiva se procesa de manera asíncrona, retornando un ID de job que puede ser usado para consultar el estado del procesamiento.
 */

//Decorador para definir el controlador y la ruta base
@ApiSwaggerEmpleadosBulkController()
@Controller('api/rrhh/empleados/bulk')
@UseGuards(JwtAccessGuard, RolesGuard) //Protege el endpoint con JWT y roles
@Roles('ADMIN', 'RRHH') //Define los roles permitidos para acceder a este endpoint
export class EmpleadoBulkController {
  constructor(
    private readonly consultarEstadoCargaMasiva: ConsultarEstadoCargaMasivaUseCase, //Inyecta el caso de uso para consultar el estado de la carga masiva
    private readonly validarCargaMasiva: ValidarCargaMasivaUseCase, //Inyecta el caso de uso para validar la carga masiva
    private readonly confirmarCargaMasiva: ConfirmarCargaMasivaUseCase, //Inyecta el caso de uso para confirmar la carga masiva
    private readonly cls: ClsService, //Inyecta el servicio de CLS para obtener el ID del usuario desde el contexto
  ) {}

  /**
   * Endpoint de consulta para el Polling Inteligente del Frontend.
   * GET /api/rrhh/empleados/bulk/:jobId
   * @param jobId string - El ID del job de carga masiva que se desea consultar.
   * @returns Un objeto con el estado actual del job, incluyendo total de registros, procesados y fallidos.
   */
  @ApiSwaggerGetBulkStatus()
  @Get(':jobId')
  async getBulkStatus(@Param('jobId') jobId: string) {
    //Obtener el ID del usuario desde el contexto CLS para asegurar que solo el usuario que inició la carga pueda consultar su estado
    const usuarioId = this.cls.get(CLS_USER_ID);
    if (!jobId) throw new BadRequestException('El parámetro jobId es obligatorio.');

    //Consultar el estado del job de carga masiva utilizando el caso de uso correspondiente
    const status = await this.consultarEstadoCargaMasiva.execute(jobId, usuarioId);

    return {
      data: status,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Endpoint para validar un archivo CSV antes de su procesamiento.
   * POST /api/rrhh/empleados/bulk/validar
   * @param request FastifyRequest - La solicitud HTTP entrante, que contiene el archivo CSV en el cuerpo.
   * @returns Un objeto con un reporte de pre-validación, incluyendo total de filas, filas válidas, filas inválidas y detalles de errores.
   */
  @Post('validar')
  async validateBulk(@Req() request: FastifyRequest) {
    if (!request.isMultipart()) throw new BadRequestException('El formato de la petición debe ser multipart/form-data.');

    const data = await request.file();
    if (!data) throw new BadRequestException('No se encontró ningún archivo en la petición.');
    
    const extensionesPermitidas = ['.xlsx', '.csv'];
    const esExtensionValida = extensionesPermitidas.some((ext) => data.filename.toLowerCase().endsWith(ext));

    if (!esExtensionValida) throw new BadRequestException('El archivo debe ser de formato Excel (.xlsx) o CSV (.csv).');

    const reporte = await this.validarCargaMasiva.execute(
      data.filename,
      data.mimetype,
      data.file
    );

    return {
      type: 'https://api.jyp.com/bulk/pre-validation',
      title: 'Reporte de Pre-Visualización',
      status: HttpStatus.OK,
      data: reporte,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Endpoint para confirmar el procesamiento de las filas pre-validadas.
   * POST /api/rrhh/empleados/bulk/confirmar
   * @param body ConfirmarCargaMasivaDTO - El DTO que contiene las filas validadas para su procesamiento.
   * @param response FastifyReply - La respuesta HTTP que se enviará al cliente.
   * @returns Un objeto con el ID del job de carga masiva que ha sido encolado para procesamiento.
   */
  @Post('confirmar')
  async confirmBulk(
    @Body() body: ConfirmarCargaMasivaDTO,
    @Res({ passthrough: true }) response: FastifyReply,
  ) {
    const usuarioId = this.cls.get(CLS_USER_ID);

    const result = await this.confirmarCargaMasiva.execute(usuarioId, body);

    response.status(HttpStatus.ACCEPTED);

    return {
      type: 'https://api.jyp.com/jobs/accepted',
      title: 'Procesamiento en Cola',
      status: HttpStatus.ACCEPTED,
      detail: 'Las filas válidas confirmadas han sido encoladas para procesamiento en segundo plano.',
      jobId: result.jobId,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Endpoint para descargar un archivo CSV de plantilla para la carga masiva de empleados.
   * GET /api/rrhh/empleados/bulk/plantilla
   * @returns Un archivo CSV con la estructura necesaria para la carga masiva de empleados.
   */
  @Get('plantilla')
  @ApiSwaggerDownloadTemplate()
  descargarPlantilla(@Res() res: FastifyReply) {
    const cabeceras = 'tipo_documento,nro_documento,nombre,apellido,area,cargo,jornada,fecha_nacimiento,asig_familiar\n';


    //Filas de ejemplo para la plantilla
     const filasEjemplo = [
      'DNI,70998877,Roberto,Flores Gomez,Oficina Central,Contador Principal,Turno Mañana (Oficina),1992-04-10,true',
      'CE,002233445,Luis,Paredes Soto,Seguridad Física,Vigilante Nocturno,Turno Madrugada (Seguridad),1988-11-25,false',
    ];

    const csvContent = cabeceras + filasEjemplo.join('\n');

    //configurar los headers para la descarga del archivo CSV
    res.header('Content-Type', 'text/csv; charset=UTF-8');
    res.header('content-disposition', 'attachment; filename="plantilla_carga_masiva_empleados.csv"');

    res.send(csvContent); //Enviar el contenido del CSV como respuesta
  }
}
