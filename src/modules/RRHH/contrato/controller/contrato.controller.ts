//src/modules/RRHH/contrato/controller/contrato.controller.ts
import { Controller, Post, Get, Param, Body, Patch, Delete, Req, Res, UseGuards, UsePipes, HttpCode, HttpStatus, BadRequestException, NotFoundException, ForbiddenException, Put, ParseUUIDPipe, Query } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { JwtAccessGuard } from '@/common/guards/jwt-access.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe';
import type { FastifyRequest, FastifyReply } from 'fastify';
import * as path from 'node:path';
import * as fs from 'node:fs';
//DTOs y Schemas
import { CrearContratoSchema, EditarContratoSchema, ListarContratosQuerySchema, RenovarContratoSchema } from '@jyp/shared-contracts';
import type { CrearContratoDto, EditarContratoDto, ListarContratosQueryDto, RenovarContratoDto } from '@jyp/shared-contracts';
//Casos de Uso
import { CrearContratoUseCase } from '../use-cases/crearContrato.useCase';
import { EditarContratoUseCase } from '../use-cases/editarContrato.useCase';
import { RenovarContratoUseCase } from '../use-cases/renovarContrato.useCase';
import { AnularContratoUseCase } from '../use-cases/anularContrato.useCase';
import { ListarContratoUseCase } from '../use-cases/listarContrato.useCase';
import { SubirContratoPdfUseCase } from '../use-cases/subirContratoPdf.useCase';
//Decoradores Swagger Limpios
import { ApiSwaggerContratoController, ApiSwaggerCrearContrato, ApiSwaggerEditarContrato, ApiSwaggerRenovarContrato, ApiSwaggerAnularContrato, ApiSwaggerListarContratosEmpleado, ApiSwaggerSubirPdf, ApiSwaggerDescargarPdf, ApiSwaggerListarContratos, ApiSwaggerListarContratosPorId } from '../decorators/contrato-swagger.decorator';

/**
 * Controlador para manejar las operaciones relacionadas con los contratos en el módulo de RRHH.
 * Este controlador define los endpoints para crear, editar, renovar, eliminar y listar contratos, así como para subir y descargar archivos PDF asociados a los contratos.
 * Utiliza casos de uso para encapsular la lógica de negocio y aplicar validaciones mediante DTOs y esquemas de Zod.
 * Además, aplica guardias de autenticación y autorización para proteger los endpoints.
 * 
 * USO: Unicamente para los roles de Administrador y RRHH, ya que son los encargados de gestionar los contratos de los empleados.
 */
@ApiSwaggerContratoController()
@Controller('api/v1/rrhh/contrato')
@UseGuards(JwtAccessGuard, RolesGuard)
export class ContratoController {
  constructor(
    private readonly crearContratoUseCase: CrearContratoUseCase,
    private readonly anularContratoUseCase: AnularContratoUseCase,
    private readonly renovaContratoUseCase: RenovarContratoUseCase,
    private readonly listarContratoUseCase: ListarContratoUseCase,
    private readonly editarContratoUseCase: EditarContratoUseCase,
    private readonly subirContratoPdfUseCase: SubirContratoPdfUseCase,
    private readonly prisma: PrismaService
  ) {}

  /**
   * Endpoint para crear un nuevo contrato en el módulo de RRHH.
   * Este endpoint recibe los datos del contrato en el cuerpo de la solicitud y utiliza el caso de uso CrearContratoUseCase para registrar un nuevo contrato sin PDF adjunto.
   * El contrato queda habilitado para edición y se marca como borrador.
   * @POST http://localhost:3000/api/v1/rrhh/contrato
   * @roles ADMIN, RRHH - Solo usuarios con estos roles pueden acceder a este endpoint.
   * @param file : pdf
   * @param payload {
   *      * Empleado_id: string (UUID del empleado al que se le asignará el contrato)
   *      * id_estado: string (UUID del estado del contrato)
   *      * tipo_modalidad: string (opcional, modalidad del contrato)
   *      * fecha_inicio: string (fecha de inicio del contrato en formato ISO 8601: YYYY-MM-DD-THH:mm:ss.sssZ)
   *      * fecha_fin: string (opcional, fecha de fin del contrato en formato ISO 8601: YYYY-MM-DD-THH:mm:ss.sssZ)
   *      * renovado: boolean (opcional, indica si el contrato ha sido renovado, por defecto es false)
   *      * observacion: string (opcional, observaciones adicionales sobre el contrato)
   * }
   * @Returns Un objeto con los datos del contrato creado y un mensaje de éxito.
   * 
   */
  @ApiSwaggerCrearContrato()
  @Post()
  @Roles('ADMIN', 'RRHH')
  @UsePipes(new ZodValidationPipe(CrearContratoSchema))
  async crearContrato(@Body() payload: CrearContratoDto) {
    return await this.crearContratoUseCase.execute(payload);
  }

  /**
   * Endpoint para actualizar un contrato existente en el módulo de RRHH.
   * Este endpoint permite editar un contrato SOLO si aún no tiene un PDF subido.
   * Recibe el ID del contrato como parámetro de ruta y los datos a actualizar en el cuerpo de la solicitud.
   * @PUT -  http://localhost:3000/api/v1/rrhh/contrato/:id
   * @roles ADMIN, RRHH - Solo usuarios con estos roles pueden acceder a este endpoint.
   * @param id : string (UUID del contrato a actualizar)
   * @param payload {
   *      * id_estado: string (UUID del estado del contrato)
   *      * tipo_modalidad: string (opcional, modalidad del contrato) 
   *      * fecha_inicio: string (fecha de inicio del contrato en formato ISO 8601: YYYY-MM-DD-THH:mm:ss.sssZ)
   *      * fecha_fin: string (opcional, fecha de fin del contrato en formato ISO 8601: YYYY-MM-DD-THH:mm:ss.sssZ)
   *      * renovado: boolean (opcional, indica si el contrato ha sido renovado, por defecto es false)
   *      * observacion: string (opcional, observaciones adicionales sobre el contrato)
   * }
   * @Returns Un objeto con los datos del contrato actualizado y un mensaje de éxito.
   * @Throws BadRequestException si el contrato ya tiene un PDF subido y no puede ser editado.
   * @Throws NotFoundException si el contrato con el ID proporcionado no existe.
   * @Throws ForbiddenException si el usuario no tiene los permisos necesarios para editar el contrato.
   */
  @ApiSwaggerEditarContrato()
  @Put(':id')
  @Roles('ADMIN', 'RRHH')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(EditarContratoSchema, true))
  async actualizarContrato(@Param('id', ParseUUIDPipe) id: string, @Body() payload: EditarContratoDto) {
    return await this.editarContratoUseCase.execute(id, payload);
  }

  /**
   * Endpoint para renovar un contrato existente en el módulo de RRHH.
   * Este endpoint permite renovar un contrato, creando un nuevo contrato con las fechas y datos proporcionados.
   * Recibe el ID del contrato a renovar como parámetro de ruta y los datos del nuevo contrato en el cuerpo de la solicitud.
   * @POST -  http://localhost:3000/api/v1/rrhh/contrato/:id/renovar
   * @param id : string (UUID del contrato a renovar)
   * @param payload {
   *    * id_estado: string (UUID del estado del nuevo contrato)
   *    * fecha_inicio: string (fecha de inicio del nuevo contrato en formato ISO 8601: YYYY-MM-DD-THH:mm:ss.sssZ)
   *    * fecha_fin: string (opcional, fecha de fin del nuevo contrato en formato ISO 8601: YYYY-MM-DD-THH:mm:ss.sssZ)
   *    * tipo_modalidad: string (opcional, modalidad del nuevo contrato)
   *    * observacion: string (opcional, observaciones adicionales sobre el nuevo contrato)
   * }
   * @Returns Un objeto con los datos del nuevo contrato creado y un mensaje de éxito.
   */
  @ApiSwaggerRenovarContrato()
  @Post(':id/renovar')
  @Roles('ADMIN', 'RRHH')
  @UsePipes(new ZodValidationPipe(RenovarContratoSchema))
  async renovarContrato( @Param('id', ParseUUIDPipe) idViejoContrato: string, @Body() payload: RenovarContratoDto) {
    return await this.renovaContratoUseCase.execute(idViejoContrato, payload);
  }

  /**
   * Endpoint para anular (eliminar) un contrato existente en el módulo de RRHH.
   * Este endpoint permite anular un contrato, marcándolo como eliminado en la base de datos.
   * Recibe el ID del contrato a anular como parámetro de ruta.
   * @DELETE -  http://localhost:3000/api/v1/rrhh/contrato/:id/anular
   * @roles ADMIN, RRHH - Solo usuarios con estos roles pueden acceder a este endpoint.
   * @param id : string (UUID del contrato a anular)
   * @Returns Un objeto con un mensaje de éxito indicando que el contrato ha sido anulado.
   */
  @ApiSwaggerAnularContrato()
  @Delete(':id/anular')
  @Roles('ADMIN', 'RRHH')
  @HttpCode(HttpStatus.OK)
  async anularContrato(@Param('id', ParseUUIDPipe) id: string) {
    return await this.anularContratoUseCase.execute(id);
  }

  /**
   * Endpoint para listar los contratos existentes en el módulo de RRHH.
   * Este endpoint permite listar todos los contratos registrados en el sistema, con la posibilidad de filtrar por empleado, estado del contrato y fechas.
   * Recibe los parámetros de consulta en la URL.
   * @GET -  http://localhost:3000/api/v1/rrhh/contrato
   * @roles ADMIN, RRHH, CONTADOR, ASISTENTE - Solo usuarios con estos roles pueden acceder a este endpoint.
   * @param query : ListarContratosQueryDto (opcional, parámetros de consulta para filtrar los contratos)
   * @param ListarContratosQueryDto {
   *     - empleado_id: string (opcional, UUID del empleado para filtrar los contratos)
   *     - id_estado: string (opcional, UUID del estado del contrato para filtrar)
   *     - fecha_inicio: string (opcional, fecha de inicio para filtrar contratos a partir de esta fecha en formato ISO 8601: YYYY-MM-DD-THH:mm:ss.sssZ)
   *     - fecha_fin: string (opcional, fecha de fin para filtrar contratos hasta esta fecha en formato ISO 8601: YYYY-MM-DD-THH:mm:ss.sssZ)
   * }
   * @returns Un objeto con un arreglo de contratos que cumplen con los criterios de filtrado y un mensaje de éxito.
   * @Throws BadRequestException si los parámetros de consulta son inválidos.
   * 
   */
  @Get()
  @ApiSwaggerListarContratos()
  @Roles('ADMIN', 'RRHH', 'CONTADOR', 'ASISTENTE')
  @UsePipes(new ZodValidationPipe(ListarContratosQuerySchema))
  async listarContratos(@Query() query: ListarContratosQueryDto) {
    return await this.listarContratoUseCase.execute(query);
  }

  /**
   * Endpoint para obtener el historial de contratos de un empleado en el módulo de RRHH.
   * Este endpoint permite listar todos los contratos asociados a un empleado específico, incluyendo información sobre el estado de cada contrato y si tiene un PDF adjunto.
   * Recibe el ID del empleado como parámetro de ruta.
   * @roles ADMIN, RRHH, CONTADOR, ASISTENTE - Solo usuarios con estos roles pueden acceder a este endpoint.
   * @GET -  http://localhost:3000/api/v1/rrhh/contrato/empleado/:empleadoId
   * @param empleadoId : string (UUID del empleado del cual se desea obtener el historial de contratos)
   * @Returns Un objeto con un arreglo de contratos asociados al empleado y un mensaje de éxito.
   */
  @Get('empleado/:empleadoId')
  @ApiSwaggerListarContratosEmpleado()
  @Roles('ADMIN', 'RRHH', 'CONTADOR', 'ASISTENTE')
  @UsePipes(new ZodValidationPipe(ListarContratosQuerySchema))
  async obtenerHistorialEmpleado(@Param('empleadoId', ParseUUIDPipe) empleadoId: string, @Query() query: ListarContratosQueryDto) {
    return await this.listarContratoUseCase.execute({...query, empleado_id: empleadoId});
  }

  //===================================================
  //Subida y Descarga de PDF
  //===================================================

  /**
   * Endpoint para subir un archivo PDF asociado a un contrato en el módulo de RRHH.
   * Este endpoint permite subir un archivo PDF que representa el contrato firmado por el empleado.
   * Recibe el ID del contrato como parámetro de ruta y el archivo PDF en el cuerpo de la solicitud (multipart/form-data).
   * @roles ADMIN, RRHH - Solo usuarios con estos roles pueden acceder a este endpoint.
   * @POST -  http://localhost:3000/api/v1/rrhh/contrato/:id/subir-pdf
   * @param id : string (UUID del contrato al cual se asociará el archivo PDF)
   * @param file : archivo PDF (multipart/form-data) que representa el contrato firmado
   * @Returns Un objeto con un mensaje de éxito indicando que el archivo PDF ha sido subido correctamente y asociado al contrato.
   */
  @ApiSwaggerSubirPdf()
  @Post(':id/subir-pdf')
  @Roles('ADMIN', 'RRHH')
  async subirContratoPdf(@Param('id', ParseUUIDPipe) id: string, @Req() req: FastifyRequest) {
    if (!req.isMultipart()) throw new BadRequestException('La petición debe ser multipart/form-data');

    //Obtener el archivo del request. Fastify maneja la subida de archivos de manera diferente a Express.
    const data = await req.file();
    if (!data) throw new BadRequestException('No se adjuntó ningún archivo en el campo "file"');

    if (data.mimetype !== 'application/pdf' || path.extname(data.filename).toLowerCase() !== '.pdf') {
      data.file.resume();
      throw new BadRequestException('El contrato firmado debe ser un archivo PDF.');
    }
    return await this.subirContratoPdfUseCase.execute(id, data);
  }

  /**
   * Endpoint para descargar un archivo PDF asociado a un contrato en el módulo de RRHH.
   * Este endpoint permite descargar el archivo PDF que representa el contrato firmado por el empleado.
   * Recibe el nombre del archivo como parámetro de ruta y devuelve el archivo PDF como respuesta.
   * @roles ADMIN, RRHH, CONTADOR, EMPLEADO - Solo usuarios con estos roles pueden acceder a este endpoint.
   * @GET -  http://localhost:3000/api/v1/rrhh/contrato/descargar/:filename
   * @param filename : string (nombre del archivo PDF a descargar, generado por el sistema al subir el contrato)
   * @Returns El archivo PDF como respuesta, con el tipo de contenido 'application/pdf'.
   * @Throws BadRequestException si el archivo solicitado no existe en el servidor.
   */
  @ApiSwaggerDescargarPdf()
  @Get('descargar/:filename')
  @Roles('ADMIN', 'RRHH', 'CONTADOR', 'EMPLEADO')
  async descargarContratoPdf(@Param('filename') filename: string, @Res() res: FastifyReply, @Req() req: FastifyRequest & { user: { rol: string; empleado_id: string } }) {

    //Evitar ataques de path traversal asegurando que el nombre del archivo sea seguro y no contenga rutas relativas.
    const safeFilename = path.basename(filename);
    if (safeFilename !== filename || path.extname(safeFilename).toLowerCase() !== '.pdf')
      throw new BadRequestException('El nombre del archivo PDF es inválido.');
    if (req.user.rol === 'EMPLEADO' && !req.user.empleado_id)
      throw new ForbiddenException('El usuario no tiene un colaborador asociado.');
    const contrato = await this.prisma.contratos.findFirst({
      where: { url: `/archivos/contratos/${safeFilename}`, deleted_at: null, ...(req.user.rol === 'EMPLEADO' ? { empleado_id: req.user.empleado_id } : {}) },
      select: { id: true }
    });
    if (!contrato) throw new NotFoundException('El contrato no existe o no pertenece al colaborador.');
    const filePath = path.join(process.cwd(), 'archivos', 'contratos', safeFilename);

    if (!fs.existsSync(filePath)) throw new BadRequestException('El archivo solicitado no existe.');

    //Enviar el archivo PDF como respuesta. Fastify maneja la respuesta de archivos de manera diferente a Express.
    const stream = fs.createReadStream(filePath);
    res.type('application/pdf').send(stream);
  }

  /**
   * Endpoint para obtener un contrato específico por su ID en el módulo de RRHH.
   * Este endpoint permite obtener los detalles de un contrato específico, incluyendo información sobre el empleado asociado, el estado del contrato y si tiene un PDF adjunto.
   * Recibe el ID del contrato como parámetro de ruta.
   * @GET -  http://localhost:3000/api/v1/rrhh/contrato/:id
   * @roles ADMIN, RRHH - Solo usuarios con estos roles pueden acceder a este endpoint.
   * @param id - string (UUID del contrato que se desea obtener)
   * @returns - Un objeto con los detalles del contrato solicitado y un mensaje de éxito.
   * @throws NotFoundException si el contrato con el ID proporcionado no existe.
   * @throws ForbiddenException si el usuario no tiene los permisos necesarios para acceder al contrato.
   */
  @Get(':id')
  @Roles('ADMIN', 'RRHH')
  @ApiSwaggerListarContratosPorId()
  obtenerPorId(@Param('id', ParseUUIDPipe) id: string) {
    return this.listarContratoUseCase.obtenerPorId(id);
  }
}
