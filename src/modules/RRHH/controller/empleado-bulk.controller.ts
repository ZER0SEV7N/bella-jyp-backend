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
import { ProcesarCargaMasivaUseCase } from '@/modules/RRHH/use-cases/carga-masiva/procesarCargaMasiva.useCase';
import { CLS_USER_ID } from '@/common/cls/cls.constants';
import { IdentityGenerator } from '@/common/utils/uuid.util';
import { ConsultarEstadoCargaMasivaUseCase } from '@/modules/RRHH/use-cases/carga-masiva/consultarEstadoCargaMasiva.useCase';
import { ClsService } from 'nestjs-cls';

//Decorador para definir el controlador y la ruta base
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
  @Post()
  async uploadBulk(
    @Req() request: FastifyRequest, //Request que contiene el archivo CSV
    @Res({ passthrough: true }) response: FastifyReply, //Response con passthrough para permitir la manipulación de cookies y cabeceras
  ) {
    //Verificacion JIT de protocola
    if (!request.isMultipart())
      throw new BadRequestException(
        'El formato de la petición debe ser multipart/form-data.',
      );

    //Extraer el archivo en formato Stream (Cero Buffers Masivos en RAM)
    const data = await request.file();
    if (!data)
      throw new BadRequestException(
        'No se encontró ningún archivo en la petición.',
      );

    //Verificar que el archivo sea de tipo CSV
    if (data.mimetype !== 'text/csv')
      throw new BadRequestException('El archivo debe ser de tipo CSV.');

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
  @Get(':jobId')
  async getBulkStatus(@Param('jobId') jobId: string) {
    // Extraemos la identidad de forma segura desde la memoria CLS del hilo[cite: 2]
    const usuarioId = this.cls.get(CLS_USER_ID);

    if (!jobId)
      throw new BadRequestException('El parámetro jobId es obligatorio.');

    const status = await this.consultarEstadoCargaMasiva.execute(
      jobId,
      usuarioId,
    );

    return {
      data: status,
      timestamp: new Date().toISOString(),
    };
  }
}
