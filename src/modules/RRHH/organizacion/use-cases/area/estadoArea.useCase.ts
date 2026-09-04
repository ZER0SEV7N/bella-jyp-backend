//src/modules/RRHH/organizacion/use-cases/area/estadoArea.useCase.ts
import { PrismaService } from '@/common/prisma/prisma.service';
import {Injectable, BadRequestException, NotFoundException, InternalServerErrorException, } from '@nestjs/common';

/** 
 * Caso de uso para gestionar el estado de un área (activar o desactivar).
 * Permite a los usuarios con los roles adecuados (ADMIN, RRHH)
 * cambiar el estado de un área en el sistema, asegurando que no se desactive un área que tenga empleados o cargos activos asociados.
 * Se encarga de validar la existencia del área y de manejar errores durante la activación o desactivación.
 */
@Injectable()
export class EstadoAreaUseCase {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Ejecuta el caso de uso para desactivar un área.
   * @param areaId - El ID del área que se desea desactivar.
   * @returns - El área desactivada si la operación es exitosa.
   * @throws NotFoundException si el área con el ID proporcionado no existe o ya está desactivada.
   * @throws BadRequestException si el área tiene empleados o cargos activos asociados.
   * @throws InternalServerErrorException si ocurre un error inesperado durante la desactivación.
   */
  async desactivar(areaId: string) {
    try {
      //Verificar si el área existe y no ha sido eliminada
      const area = await this.prisma.area.findUnique({
        where: { id: areaId, deleted_at: null },
        include: {
          _count: {
            select: {
              cargo: { where: { activo: true, deleted_at: null } },
              empleados: { where: { activo: true, deleted_at: null } }
            }
          }
        }
      });

      //Si el área no existe o ya está desactivada, lanzar una excepción de no encontrado
      if (!area) throw new NotFoundException({
        title: 'Área no encontrada',
        detail: `El área con ID '${areaId}' no existe o ya fue desactivada.`
      });
      
      //Si el área tiene empleados activos asociados, lanzar una excepción de solicitud incorrecta
      if (area._count.empleados > 0) throw new BadRequestException({
        title: 'Área en Uso por Colaboradores',
        detail: `No se puede desactivar el área '${area.nombre}' porque contiene ${area._count.empleados} empleado(s) activo(s). 
                Reasigne a los colaboradores antes de proceder.`
      });
      
      //Si el área tiene cargos activos asociados, lanzar una excepción de solicitud incorrecta
      if (area._count.cargo > 0) throw new BadRequestException({
        title: 'Área con Cargos Activos',
        detail: `No se puede desactivar el área '${area.nombre}' porque contiene ${area._count.cargo} cargo(s) activo(s) asignado(s). 
                 Reasigne o desactive los cargos primero.`
      });
      
      //Actualizar el área en la base de datos utilizando Prisma
      return await this.prisma.area.update({
        where: { id: areaId },
        data: { activo: false, deleted_at: new Date() }
      });
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) 
        throw error;

      throw new InternalServerErrorException('Error al intentar desactivar el área.');
    }
  }

  /**
   * Ejecuta el caso de uso para reactivar un área previamente desactivada.
   * @param areaId - El ID del área que se desea reactivar.
   * @returns - El área reactivada si la operación es exitosa.
   * @throws NotFoundException si el área con el ID proporcionado no existe.
   * @throws BadRequestException si el área ya está activa.
   * @throws InternalServerErrorException si ocurre un error inesperado durante la reactivación.
   */
  async reactivar(areaId: string) {
    try {
      //Verificar si el área existe
      const area = await this.prisma.area.findUnique({ where: { id: areaId } });

      //Si el área no existe, lanzar una excepción de no encontrado
      if (!area) throw new NotFoundException({
        title: 'Área no encontrada',
        detail: `El área con ID '${areaId}' no existe en el sistema.`
      });
      
      //Si el área ya está activa, lanzar una excepción de solicitud incorrecta
      if (area.activo && area.deleted_at === null) throw new BadRequestException({
        title: 'Área ya activa',
        detail: `El área '${area.nombre}' ya se encuentra activa en el sistema.`
      });
      
      //Actualizar el área en la base de datos utilizando Prisma
      return await this.prisma.area.update({
        where: { id: areaId },
        data: { activo: true, deleted_at: null }
      });
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) 
        throw error;

      throw new InternalServerErrorException('Error al intentar reactivar el área.');
    }
  }
}