//src/modules/RRHH/controller/empleado-bulk.controller.ts
//Controlador para manejar la carga masiva de empleados desde un archivo CSV
//Importaciones necesarias para el controlador
import {
  Controller,
  Post,
  Req,
  Res,
  UseGuards,
  BadRequestException,
  HttpStatus,
  Get,
  Param,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { JwtAccessGuard } from '@/common/guards/jwt-access.guard';
import { ProcesarCargaMasivaUseCase } from '@/modules/RRHH/organizacion/use-cases/carga-masiva/procesarCargaMasiva.useCase';
import { CLS_USER_ID } from '@/common/cls/cls.constants';
import { IdentityGenerator } from '@/common/utils/uuid.util';
import { ConsultarEstadoCargaMasivaUseCase } from '@/modules/RRHH/organizacion/use-cases/carga-masiva/consultarEstadoCargaMasiva.useCase';
import { ClsService } from 'nestjs-cls';
import {
  ApiSwaggerEmpleadosBulkController,
  ApiSwaggerUploadBulk,
  ApiSwaggerGetBulkStatus,
  ApiSwaggerDownloadTemplate,
} from '../decorators/empleado-bulk-swagger.decorator';

/**
 * Controlador para manejar la carga masiva de empleados desde un archivo CSV.
 * Este controlador expone dos endpoints:
 * 1. POST /api/rrhh/empleados/bulk: Para subir un archivo CSV y procesarlo en segundo plano.
 * 2. GET /api/rrhh/empleados/bulk/:jobId: Para consultar el estado del procesamiento del archivo CSV.
 * 3. GET /api/rrhh/empleados/bulk/plantilla: Para descargar un archivo CSV de plantilla para la carga masiva.
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
    private readonly procesarCargaMasiva: ProcesarCargaMasivaUseCase, //Inyecta el caso de uso para procesar la carga masiva
    private readonly consultarEstadoCargaMasiva: ConsultarEstadoCargaMasivaUseCase, //Inyecta el caso de uso para consultar el estado de la carga masiva
    private readonly cls: ClsService, //Inyecta el servicio de CLS para obtener el ID del usuario desde el contexto
  ) {}

  /**
   * Endpoint asíncrono para ingesta masiva por Streams.
   * Patron: Fire-and-Forget. Retorna 202 Accepted inmediatamente, mientras el procesamiento ocurre en segundo plano.
   * @param req FastifyRequest - La solicitud HTTP entrante, que contiene el archivo CSV en el cuerpo.
   * @param res FastifyReply - La respuesta HTTP que se enviará al cliente.
   */
  @ApiSwaggerUploadBulk()
  @Post()
  async uploadBulk(
    @Req() request: FastifyRequest, //Request que contiene el archivo CSV
    @Res({ passthrough: true }) response: FastifyReply, //Response con passthrough para permitir la manipulación de cookies y cabeceras
  ) {
    //Verificar que la solicitud sea de tipo multipart/form-data
    if (!request.isMultipart())throw new BadRequestException('El formato de la petición debe ser multipart/form-data.');

    //Extraer el archivo en formato Stream (Cero Buffers Masivos en RAM)
    const data = await request.file();
    if (!data) throw new BadRequestException('No se encontró ningún archivo en la petición.');

    //Verificar que el archivo sea de tipo CSV
    if (data.mimetype !== 'text/csv') throw new BadRequestException('El archivo debe ser de tipo CSV.');

    const jobId = IdentityGenerator.generateId(); //Generar un ID único para el job de carga masiva
    const usuarioId = this.cls.get(CLS_USER_ID); //Obtener el ID del usuario desde el contexto CLS

    //Enviar el Readable Stream del archivo CSV al caso de uso para su procesamiento en segundo plano
    this.procesarCargaMasiva
      .execute(jobId, usuarioId, data.file)
      .catch((error) => {
        //Loguear el error y actualizar el estado del job a FALLIDO en la base de datos
        console.error(`Error al procesar la carga masiva: ${error.message}`);
        this.procesarCargaMasiva.handleJobFailure(jobId, error);
      });

    //Retornar una respuesta inmediata al cliente indicando que la solicitud ha sido aceptada para procesamiento
    response.status(HttpStatus.ACCEPTED);

    return {
      type: 'https://api.jyp.com/jobs/accepted',
      title: 'Procesamiento en Cola',
      status: HttpStatus.ACCEPTED,
      detail: 'El archivo ha sido encolado para su procesamiento.',
      jobId: jobId, // El cliente usará este ID para el Polling Inteligente
      timestamp: new Date().toISOString(),
    };
  }

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
    const status = await this.consultarEstadoCargaMasiva.execute(
      jobId,
      usuarioId
    );

    return {
      data: status,
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
      'DNI,12345678,Juan,Perez,Recursos Humanos,Analista,Tiempo Completo,1990-01-01,true',
      'CE,87654321,Maria,Gomez,Finanzas,Contador,Medio Tiempo,1985-05-15,false',
      'PASAPORTE,AB1234567,,,TI,Desarrollador,Tiempo Completo,1992-07-20,true',
    ];

    const csvContent = cabeceras + filasEjemplo.join('\n');

    //configurar los headers para la descarga del archivo CSV
    res.header('Content-Type', 'text/csv; charset=UTF-8');
    res.header('content-disposition', 'attachment; filename="plantilla_carga_masiva_empleados.csv"');

    res.send(csvContent); //Enviar el contenido del CSV como respuesta
  }
}
