//src/modules/tareas/controller/tareas.controller.ts
//Controlador de Tareas: Este controlador maneja las solicitudes HTTP relacionadas con la gestión de tareas,
import {
  Controller,
  Post,
  Body,
  Get,
  Query,
  Patch,
  Param,
  ParseUUIDPipe,
  UseGuards,
  UsePipes,
  Req,
} from '@nestjs/common';
import { JwtAccessGuard } from '@/common/guards/jwt-access.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe';
import type { FastifyRequest } from 'fastify';

import type {
  CrearTareaDto,
  ObtenerTareasQueryDto,
  CambiarEstadoTareaDto,
  CrearAnotacionDto,
} from '@jyp/shared-contracts';
import {
  CrearTareaSchema,
  ObtenerTareasQuerySchema,
  CambiarEstadoTareaSchema,
  CrearAnotacionSchema,
} from '@jyp/shared-contracts';
import { CrearTareaUseCase } from '../use-cases/crearTarea.useCase';
import { ObtenerTareasUseCase } from '../use-cases/obtenerTareas.useCase';
import { FlujoTareasUseCase } from '../use-cases/flujoTareas.useCase';

//Controlador de Tareas: Este controlador maneja las solicitudes HTTP relacionadas con la gestión de tareas,
//incluyendo la creación, obtención, actualización de estado y adición de anotaciones a las tareas.
@Controller('api/tareas')
@UseGuards(JwtAccessGuard, RolesGuard)
export class TareasController {
  constructor(
    private readonly crearTareaUseCase: CrearTareaUseCase,
    private readonly obtenerTareasUseCase: ObtenerTareasUseCase,
    private readonly flujoTareasUseCase: FlujoTareasUseCase,
  ) {}

  /**
   * Crear una nueva tarea en el sistema.
   * Solo los usuarios con rol 'ADMIN' o 'CONTADOR' pueden crear tareas.
   * Post: /api/tareas
   * @Request Body: CrearTareaDto{
   *    *   asignado_a: string; // ID del usuario al que se asigna la tarea
   *    *   titulo: string;
   *    *   descripcion?: string;
   *    *   fecha_entrega?: string; // Formato ISO 8601}
   *    }
   * @Returns: La tarea creada con todos sus detalles.
   */
  @Post()
  //@Roles('ADMIN', 'CONTADOR')
  @UsePipes(new ZodValidationPipe(CrearTareaSchema))
  async crearTarea(
    @Body() payload: CrearTareaDto,
    @Req() req: FastifyRequest & { user: { id: string } },
  ) {
    return await this.crearTareaUseCase.execute(payload, req.user.id);
  }

  /**
   * Obtener una lista de tareas según ciertos criterios de filtrado y paginación.
   * Todos los usuarios autenticados pueden obtener tareas, pero la visibilidad depende del rol.
   * Get: /api/tareas
   * @Request Query: ObtenerTareasQueryDto{
   *    *   page?: number; // Página de resultados (default: 1)
   *    *   limit?: number; // Cantidad de resultados por página (default: 10, max: 100)
   *   *   estado?: 'PENDIENTE' | 'REVISION' | 'APROBADO' | 'RECHAZADO' | 'AUDITADO'; // Filtrar por estado de la tarea
   *   }
   * @Returns: Un objeto con la lista de tareas y metadatos de paginación.
   */
  @Get()
  @Roles('ADMIN', 'CONTADOR', 'ASISTENTE')
  @UsePipes(new ZodValidationPipe(ObtenerTareasQuerySchema))
  async obtenerTareas(
    @Query() queryParams: ObtenerTareasQueryDto,
    @Req() req: FastifyRequest & { user: { id: string; rol: string } },
  ) {
    return await this.obtenerTareasUseCase.execute(queryParams, req.user);
  }

  /**
   * Cambiar el estado de una tarea existente.
   * El Asistente solo puede cambiar el estado a 'REVISION', mientras que el Contador/Admin puede cambiarlo a cualquier estado.
   * Patch: /api/tareas/:id/estado
   * @Request Param: id (UUID) - ID de la tarea
   * @Request Body: CambiarEstadoTareaDto{
   *    *   estado: 'PENDIENTE' | 'REVISION' | 'APROBADO' | 'RECHAZADO' | 'AUDITADO';
   *   }
   * @Returns: La tarea actualizada con el nuevo estado.
   */
  @Patch(':id/estado')
  @Roles('CONTADOR', 'ADMIN', 'ASISTENTE')
  @UsePipes(new ZodValidationPipe(CambiarEstadoTareaSchema))
  async cambiarEstado(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() payload: CambiarEstadoTareaDto,
    @Req() req: FastifyRequest & { user: { id: string; rol: string } },
  ) {
    return await this.flujoTareasUseCase.cambiarEstado(
      id,
      payload,
      req.user.id,
      req.user.rol,
    );
  }

  /**
   * Agregar una anotación (comentario) a una tarea existente.
   * Todos los usuarios autenticados pueden agregar anotaciones a las tareas que les pertenecen o que han creado.
   * Post: /api/tareas/:id/anotaciones
   * @Request Param: id (UUID) - ID de la tarea
   * @Request Body: CrearAnotacionDto{
   *   *   descripcion: string; // Contenido de la anotación
   *  }
   * @Returns: La anotación creada con todos sus detalles.
   */
  @Post(':id/anotaciones')
  @Roles('CONTADOR', 'ADMIN', 'ASISTENTE')
  @UsePipes(new ZodValidationPipe(CrearAnotacionSchema))
  async agregarAnotacion(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() payload: CrearAnotacionDto,
    @Req() req: FastifyRequest & { user: { id: string } },
  ) {
    return await this.flujoTareasUseCase.agregarAnotacion(
      id,
      payload,
      req.user.id,
    );
  }
}
